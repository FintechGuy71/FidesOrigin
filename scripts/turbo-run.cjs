'use strict';

/**
 * Turbo compatibility launcher.
 * Linux/CI keep strict task environments. Only the local Windows runtime that
 * uses Electron as Node receives Turbo's supported loose-environment mode.
 */
const path = require('path');
const { spawn } = require('child_process');

function turboArgs(task, rest = [], platform = process.platform, electronRunAsNode = process.env.ELECTRON_RUN_AS_NODE) {
  if (!task || !/^[a-z][a-z0-9:_-]*$/i.test(task)) throw new Error('Invalid Turbo task');
  const args = ['run', task, ...rest];
  if (platform === 'win32' && electronRunAsNode === '1') args.push('--env-mode=loose');
  return args;
}

function main() {
  const [task, ...rest] = process.argv.slice(2);
  const cli = path.join(__dirname, '..', 'node_modules', 'turbo', 'bin', 'turbo');
  const child = spawn(process.execPath, [cli, ...turboArgs(task, rest)], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Turbo exited with signal ${signal}`);
      process.exitCode = 1;
    } else {
      process.exitCode = code ?? 1;
    }
  });
}

if (require.main === module) main();

module.exports = { turboArgs };
