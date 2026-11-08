'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveSchedule, acquireSchedulerLock } = require('../src/dailySchedule');

const HOUR = 3;
const MINUTE = 37;
const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute, 0, 0);

test('schedule: 错过当天任务且没有执行记录时立即补跑', () => {
  const result = resolveSchedule({ lastResult: null }, at(8, 10, 45), HOUR, MINUTE);
  assert.strictEqual(result.runNow, true);
  assert.strictEqual(result.scheduledFor.toISOString(), at(8, HOUR, MINUTE).toISOString());
});

test('schedule: 当天已成功则不重复执行', () => {
  const state = { lastResult: { scheduledFor: at(8, HOUR, MINUTE).toISOString(), finishedAt: at(8, 10, 47).toISOString(), exitCode: 0 } };
  const result = resolveSchedule(state, at(8, 10, 45), HOUR, MINUTE);
  assert.strictEqual(result.runNow, false);
  assert.strictEqual(result.nextRun.toISOString(), at(9, HOUR, MINUTE).toISOString());
});

test('schedule: 兼容旧状态，以 finishedAt 判断当天已经补跑', () => {
  const state = { lastResult: { finishedAt: at(8, 10, 47).toISOString(), exitCode: 0 } };
  assert.strictEqual(resolveSchedule(state, at(8, 10, 45), HOUR, MINUTE).runNow, false);
});

test('schedule: 当天失败不在 30 秒循环中热重试', () => {
  const state = { lastResult: { scheduledFor: at(8, HOUR, MINUTE).toISOString(), finishedAt: at(8, 10, 40).toISOString(), exitCode: 1 } };
  assert.strictEqual(resolveSchedule(state, at(8, 10, 45), HOUR, MINUTE).runNow, false);
});

test('schedule: 新的一天会再次执行任务', () => {
  const state = { lastResult: { scheduledFor: at(8, HOUR, MINUTE).toISOString(), finishedAt: at(8, 4, 0).toISOString(), exitCode: 0 } };
  assert.strictEqual(resolveSchedule(state, at(9, 3, 38), HOUR, MINUTE).runNow, true);
});

test('schedule lock: 清理陈旧锁并拒绝第二个活跃实例', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fides-schedule-'));
  const lock = path.join(dir, 'scheduler.lock');
  fs.writeFileSync(lock, '999999999');
  const release = acquireSchedulerLock(lock);
  assert.strictEqual(fs.readFileSync(lock, 'utf8'), String(process.pid));
  assert.throws(() => acquireSchedulerLock(lock), /Another daily scheduler/);
  release();
  assert.strictEqual(fs.existsSync(lock), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
