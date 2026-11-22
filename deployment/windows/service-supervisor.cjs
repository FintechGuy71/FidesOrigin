'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFile } = require('child_process');

function redactText(value, maxLength = 1000) {
  return String(value)
    .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/0x[a-fA-F0-9]{64}/g, '[redacted-hex]')
    .slice(0, maxLength);
}

function nextBackoff(current, maximum = 60000) {
  return Math.min(Math.max(1000, current * 2), maximum);
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function main() {
  const service = required('SERVICE_NAME');
  const executable = required('SERVICE_EXECUTABLE');
  // SERVICE_ARGS uses | as a Windows-safe alternative to JSON quoting in CMD.
  const args = process.env.SERVICE_ARGS
    ? process.env.SERVICE_ARGS.split('|')
    : JSON.parse(process.env.SERVICE_ARGS_JSON || '[]');
  if (!Array.isArray(args)) throw new Error('Service arguments must be an array');
  const cwd = required('SERVICE_CWD');
  const stateFile = required('SERVICE_STATE_FILE');
  const logFile = required('SERVICE_LOG_FILE');
  const outputLog = required('SERVICE_OUTPUT_LOG');
  const healthUrl = process.env.SERVICE_HEALTH_URL || '';
  const redisCli = process.env.SERVICE_REDIS_CLI || '';
  const alertWebhook = process.env.ALERT_WEBHOOK_URL || '';
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });

  let child;
  let stopping = false;
  let restarting = false;
  let unhealthyChecks = 0;
  let lastHealth = null;
  let restartDelay = 1000;
  let restartCount = 0;
  let lastStartedAt = 0;

  function log(message) {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${redactText(message)}\n`);
  }

  async function alert(message) {
    log(`ALERT ${message}`);
    if (!alertWebhook) return;
    try {
      await fetch(alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `FidesOrigin ${service}: ${redactText(message)}` }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      log(`Alert delivery failed: ${error.message}`);
    }
  }

  function writeState(status) {
    const value = {
      service,
      status,
      supervisorPid: process.pid,
      childPid: child && !child.killed ? child.pid : null,
      publisherPid: service === 'publisher' && child && !child.killed ? child.pid : undefined,
      redisPid: service === 'redis' && child && !child.killed ? child.pid : undefined,
      unhealthyChecks,
      restartCount,
      restartDelay,
      lastHealth,
      updatedAt: new Date().toISOString(),
    };
    const temp = `${stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, stateFile);
  }

  function startService() {
    if (stopping) return;
    restarting = false;
    unhealthyChecks = 0;
    lastStartedAt = Date.now();
    log(`Starting ${service}; delay=${restartDelay}ms restartCount=${restartCount}`);
    child = spawn(executable, args, {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', data => fs.appendFileSync(outputLog, redactText(data.toString(), 100000)));
    child.stderr.on('data', data => fs.appendFileSync(outputLog, redactText(data.toString(), 100000)));
    child.on('error', error => log(`${service} spawn error: ${error.message}`));
    child.on('exit', (code, signal) => {
      log(`${service} exited code=${code} signal=${signal}`);
      writeState('stopped');
      scheduleRestart();
    });
    writeState('running');
  }

  function scheduleRestart() {
    if (stopping) return;
    if (Date.now() - lastStartedAt > 5 * 60 * 1000) {
      restartDelay = 1000;
      restartCount = 0;
    }
    const delay = restartDelay;
    restartDelay = nextBackoff(restartDelay);
    restartCount += 1;
    if (restartCount % 5 === 0) void alert(`${service} has restarted ${restartCount} times without a stable recovery`);
    setTimeout(startService, delay);
  }

  function noteUnhealthy() {
    unhealthyChecks += 1;
    if (unhealthyChecks >= 2 && child && !restarting) {
      restarting = true;
      log(`Restarting ${service} after ${unhealthyChecks} unhealthy checks`);
      writeState('restarting');
      child.kill();
    }
  }

  function healthy(body) {
    const previous = lastHealth;
    lastHealth = { status: 'healthy', body: redactText(body || ''), checkedAt: new Date().toISOString() };
    unhealthyChecks = 0;
    restartDelay = 1000;
    restartCount = 0;
    if (previous?.status !== 'healthy') log(`${service} health=healthy`);
    if (!restarting) writeState('healthy');
  }

  function unhealthy(error) {
    const previous = lastHealth;
    lastHealth = { status: 'unhealthy', error: redactText(error), checkedAt: new Date().toISOString() };
    if (previous?.status !== 'unhealthy') log(`${service} health=unhealthy: ${error}`);
    writeState('unhealthy');
    noteUnhealthy();
  }

  function checkHealth() {
    if (healthUrl) {
      const target = new URL(healthUrl);
      const request = http.get({
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        timeout: 10000,
      }, response => {
        let body = '';
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => {
          if (response.statusCode === 200) healthy(body);
          else unhealthy(`HTTP ${response.statusCode}: ${body}`);
        });
      });
      request.on('timeout', () => request.destroy(new Error('health check timeout')));
      request.on('error', error => unhealthy(error.message));
      return;
    }
    if (redisCli) {
      execFile(redisCli, ['-h', '127.0.0.1', '-p', '6379', 'ping'], { timeout: 8000, windowsHide: true }, (error, stdout, stderr) => {
        if (!error && stdout.trim() === 'PONG') healthy('PONG');
        else unhealthy(error ? error.message : stderr || stdout);
      });
    }
  }

  process.on('SIGTERM', () => { stopping = true; if (child) child.kill(); process.exit(0); });
  process.on('SIGINT', () => { stopping = true; if (child) child.kill(); process.exit(0); });
  process.on('uncaughtException', error => {
    log(`Supervisor uncaughtException: ${error.stack || error.message}`);
    void alert(`${service} supervisor failed: ${error.message}`).finally(() => process.exit(1));
  });

  startService();
  checkHealth();
  setInterval(checkHealth, 30000);
}

if (require.main === module) main();

module.exports = { nextBackoff, redactText };
