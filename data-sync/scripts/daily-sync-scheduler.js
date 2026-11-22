'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(app, '.env'), quiet: true });
const { resolveSchedule, acquireSchedulerLock } = require('../src/dailySchedule');
const { sendAlert } = require('../src/alertManager');

const hour = Number(process.env.DAILY_SYNC_HOUR || 3);
const minute = Number(process.env.DAILY_SYNC_MINUTE || 37);
const timeoutMs = Number(process.env.DAILY_SYNC_TIMEOUT_MS || 30 * 60 * 1000);
const retryDelayMs = Number(process.env.DAILY_SYNC_RETRY_DELAY_MS || 15 * 60 * 1000);
const maxAttempts = Number(process.env.DAILY_SYNC_MAX_ATTEMPTS || 3);
const stateFile = process.env.DAILY_SYNC_STATE_FILE || path.join(app, 'cache', 'daily-sync-scheduler-state.json');
const logFile = process.env.DAILY_SYNC_LOG_FILE || path.join(app, 'logs', 'daily-sync-scheduler.log');
const liveLogFile = process.env.DAILY_SYNC_LIVE_LOG_FILE || path.join(app, 'logs', 'daily-sync-live.log');
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.mkdirSync(path.dirname(liveLogFile), { recursive: true });

let state = { status: 'scheduled', lastResult: null };
try {
  state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
} catch (error) {
  if (error.code !== 'ENOENT') {
    const backup = `${stateFile}.corrupt-${Date.now()}`;
    try { fs.renameSync(stateFile, backup); } catch { /* retain original if backup fails */ }
    console.warn(`Invalid scheduler state was quarantined: ${error.message}`);
  }
}
let child = null;
let nextRun = null;
let releaseLock;
let timedOut = false;

function saveState(status) {
  const value = {
    ...state,
    status,
    schedulerPid: process.pid,
    syncPid: child ? child.pid : null,
    nextRun: nextRun ? nextRun.toISOString() : null,
    timezone: process.env.TZ || 'Asia/Shanghai',
    schedule: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} daily`,
    updatedAt: new Date().toISOString(),
  };
  state = value;
  const temp = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, stateFile);
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(logFile, line);
  process.stdout.write(line);
}

function runSync(scheduledFor) {
  if (child) return;
  timedOut = false;
  nextRun = scheduledFor;
  const scheduledIso = scheduledFor.toISOString();
  const previous = state.lastResult && state.lastResult.scheduledFor === scheduledIso
    ? state.lastResult
    : null;
  const attempt = previous ? (Number(previous.attempt) || 1) + 1 : 1;
  const startedAt = new Date().toISOString();
  state.lastResult = { scheduledFor: scheduledIso, startedAt, attempt };
  saveState('running');
  log(`Starting daily-sync for ${scheduledIso}, attempt=${attempt}/${maxAttempts}`);
  const output = fs.createWriteStream(liveLogFile, { flags: 'a' });
  child = spawn(process.execPath, [path.join(app, 'scripts', 'daily-sync.js')], {
    cwd: app,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(output);
  child.stderr.pipe(output);
  saveState('running');
  const timeout = setTimeout(() => {
    if (!child) return;
    timedOut = true;
    log(`Daily-sync exceeded ${timeoutMs}ms; terminating pid ${child.pid}`);
    child.kill();
  }, timeoutMs);
  child.on('error', error => log(`Daily-sync spawn error: ${error.message}`));
  child.on('exit', (code, signal) => {
    clearTimeout(timeout);
    const finishedAt = new Date().toISOString();
    const exitCodeHex = code === null ? null : `0x${code.toString(16)}`;
    state.lastResult = {
      ...state.lastResult,
      scheduledFor: scheduledIso,
      startedAt,
      finishedAt,
      attempt,
      exitCode: code,
      exitCodeHex,
      signal,
      error: timedOut
        ? `Timed out after ${timeoutMs}ms`
        : code !== 0 ? 'Non-zero exit; inspect daily-sync-live.log' : null,
    };
    child = null;
    output.end();
    nextRun = resolveSchedule(
      state, new Date(finishedAt), hour, minute, retryDelayMs, maxAttempts
    ).nextRun;
    const status = code === 0 && !timedOut ? 'scheduled' : 'failed';
    saveState(status);
    log(`Daily-sync exited code=${code} (${exitCodeHex}) signal=${signal} timedOut=${timedOut} attempt=${attempt}/${maxAttempts}`);
    if (status === 'failed') {
      void sendAlert(`Daily sync failed at ${finishedAt}: exit=${code} (${exitCodeHex}), signal=${signal}, timeout=${timedOut}, attempt=${attempt}/${maxAttempts}`);
    }
  });
}

function tick() {
  if (child) return;
  const decision = resolveSchedule(state, new Date(), hour, minute, retryDelayMs, maxAttempts);
  nextRun = decision.nextRun;
  if (decision.runNow) runSync(decision.scheduledFor);
  else saveState(state.status === 'failed' ? 'failed' : 'scheduled');

  const last = state.lastResult;
  const succeededAt = last && last.exitCode === 0 ? new Date(last.finishedAt).getTime() : 0;
  const lastStaleAlert = state.lastStaleAlertAt ? new Date(state.lastStaleAlertAt).getTime() : 0;
  if (succeededAt && Date.now() - succeededAt > 25 * 60 * 60 * 1000
      && Date.now() - lastStaleAlert > 24 * 60 * 60 * 1000) {
    state.lastStaleAlertAt = new Date().toISOString();
    saveState('failed');
    void sendAlert(`Daily sync has not succeeded since ${last.finishedAt}`);
  }
}

function shutdown() {
  if (releaseLock) releaseLock();
  if (child) child.kill();
  process.exit(0);
}

if (require.main === module) {
  try {
    releaseLock = acquireSchedulerLock(`${stateFile}.lock`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => { if (releaseLock) releaseLock(); });
  tick();
  setInterval(tick, 30000);
}

module.exports = { runSync, tick };
