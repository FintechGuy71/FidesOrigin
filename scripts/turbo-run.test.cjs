'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { turboArgs } = require('./turbo-run.cjs');

test('turbo launcher preserves strict mode on Linux CI', () => {
  assert.deepEqual(turboArgs('build', ['--filter=web'], 'linux', undefined), ['run', 'build', '--filter=web']);
});

test('turbo launcher enables compatibility only for the Electron Windows runtime', () => {
  assert.deepEqual(turboArgs('test', [], 'win32', '1'), ['run', 'test', '--env-mode=loose']);
  assert.deepEqual(turboArgs('test', [], 'win32', ''), ['run', 'test']);
});

test('turbo launcher rejects invalid or missing tasks', () => {
  assert.throws(() => turboArgs('', [], 'linux'), /Invalid Turbo task/);
  assert.throws(() => turboArgs('../bad', [], 'linux'), /Invalid Turbo task/);
});
