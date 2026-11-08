'use strict';

const fs = require('fs');
const path = require('path');

function getScheduledFor(now, hour = 3, minute = 37) {
  const scheduled = new Date(now);
  scheduled.setHours(hour, minute, 0, 0);
  if (scheduled > now) scheduled.setDate(scheduled.getDate() - 1);
  return scheduled;
}

function getNextRun(now, hour = 3, minute = 37) {
  const next = getScheduledFor(now, hour, minute);
  next.setDate(next.getDate() + 1);
  return next;
}

/** Decide whether the latest occurrence needs a catch-up run, exactly once. */
function resolveSchedule(state, now, hour = 3, minute = 37) {
  const scheduledFor = getScheduledFor(now, hour, minute);
  const scheduledIso = scheduledFor.toISOString();
  const last = state && state.lastResult;
  const lastFor = last && last.scheduledFor;
  const lastFinished = last && last.finishedAt ? new Date(last.finishedAt) : null;
  const alreadyAttempted = lastFor === scheduledIso
    || (lastFinished && !Number.isNaN(lastFinished.getTime()) && lastFinished >= scheduledFor);
  const nextRun = alreadyAttempted ? getNextRun(now, hour, minute) : scheduledFor;
  return { runNow: !alreadyAttempted, scheduledFor, nextRun };
}

function acquireSchedulerLock(lockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  if (fs.existsSync(lockPath)) {
    const pid = Number(fs.readFileSync(lockPath, 'utf8').trim());
    let alive = false;
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); alive = true; } catch { alive = false; }
    }
    if (alive) throw new Error(`Another daily scheduler is running with pid ${pid}`);
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  return () => {
    try {
      if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf8').trim() === String(process.pid)) {
        fs.unlinkSync(lockPath);
      }
    } catch { /* stale lock is handled on next startup */ }
  };
}

module.exports = { getScheduledFor, getNextRun, resolveSchedule, acquireSchedulerLock };
