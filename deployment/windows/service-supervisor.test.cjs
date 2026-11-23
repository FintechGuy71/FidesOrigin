'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  nextBackoff,
  redactText,
  acquireSingletonLock,
  healthPidMatches,
} = require('./service-supervisor.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(__dirname, '.test-supervisor-'));
}

test('supervisor: exponential backoff is bounded', () => {
  assert.strictEqual(nextBackoff(1000), 2000);
  assert.strictEqual(nextBackoff(2000), 4000);
  assert.strictEqual(nextBackoff(32000), 60000);
  assert.strictEqual(nextBackoff(60000), 60000);
});

test('supervisor: logs redact URLs, private-length hex, and oversized input', () => {
  const secret = `0x${'a'.repeat(64)}`;
  const value = redactText(`failed https://user:pass@example.com/v2/secret ${secret}`);
  assert.ok(!value.includes('example.com'));
  assert.ok(!value.includes(secret));
  assert.ok(value.includes('[redacted-hex]'));
  assert.strictEqual(redactText('x', 1), 'x');
});

test('supervisor: health PID must match the supervised child when enabled', () => {
  assert.strictEqual(healthPidMatches('{"pid":1234}', 'pid', 1234), true);
  assert.strictEqual(healthPidMatches('{"pid":9999}', 'pid', 1234), false);
  assert.strictEqual(healthPidMatches('not-json', 'pid', 1234), false);
  assert.strictEqual(healthPidMatches('not-json', '', 1234), true);
});

test('supervisor: singleton lock rejects a live duplicate and releases cleanly', () => {
  const dir = tempDir();
  const lock = path.join(dir, 'service.lock');
  try {
    const first = acquireSingletonLock(lock, 'publisher', { isProcessAlive: () => true });
    assert.throws(
      () => acquireSingletonLock(lock, 'publisher', { isProcessAlive: () => true }),
      /already running/
    );
    first.release();
    assert.strictEqual(fs.existsSync(lock), false);
    first.release();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('supervisor: stale PID lock is reclaimed', () => {
  const dir = tempDir();
  const lock = path.join(dir, 'service.lock');
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: 987654, service: 'publisher' }));
    const current = acquireSingletonLock(lock, 'publisher', { isProcessAlive: () => false });
    const saved = JSON.parse(fs.readFileSync(lock, 'utf8'));
    assert.strictEqual(saved.pid, process.pid);
    current.release();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('supervisor: corrupt lock is quarantined and never silently reused', () => {
  const dir = tempDir();
  const lock = path.join(dir, 'service.lock');
  try {
    fs.writeFileSync(lock, '{corrupt');
    const current = acquireSingletonLock(lock, 'publisher', { isProcessAlive: () => false });
    assert.ok(fs.readdirSync(dir).some(name => name.startsWith('service.lock.corrupt-')));
    assert.strictEqual(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, process.pid);
    current.release();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
