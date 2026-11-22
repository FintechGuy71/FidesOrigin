'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { nextBackoff, redactText } = require('./service-supervisor.cjs');

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
