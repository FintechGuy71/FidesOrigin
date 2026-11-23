'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyDailyRuntime } = require('../scripts/verify-daily-runtime');

function withLocal(value) {
  const previous = process.env.VERIFY_LOCAL_RUNTIME;
  if (value === undefined) delete process.env.VERIFY_LOCAL_RUNTIME;
  else process.env.VERIFY_LOCAL_RUNTIME = value;
  return () => {
    if (previous === undefined) delete process.env.VERIFY_LOCAL_RUNTIME;
    else process.env.VERIFY_LOCAL_RUNTIME = previous;
  };
}

const passing = async () => ({ pass: true, details: { verified: true } });

test('daily verification accepts complete chain and public checks with local skipped remotely', async () => {
  const restore = withLocal(undefined);
  try {
    const report = await verifyDailyRuntime({ dryRun: false }, { chain: passing, public: passing });
    assert.strictEqual(report.pass, true);
    assert.strictEqual(report.checks.length, 3);
    assert.strictEqual(report.checks[2].skipped, true);
  } finally { restore(); }
});

test('daily verification fails when the final chain read differs', async () => {
  const restore = withLocal(undefined);
  try {
    const report = await verifyDailyRuntime({ dryRun: false }, {
      chain: async () => ({ pass: false, details: { remainingDiff: 1 } }),
      public: passing,
    });
    assert.strictEqual(report.pass, false);
  } finally { restore(); }
});

test('daily verification converts public API failures into a failed check', async () => {
  const restore = withLocal(undefined);
  try {
    const report = await verifyDailyRuntime({ dryRun: true }, {
      chain: passing,
      public: async () => { throw new Error('HTTP 503'); },
    });
    assert.strictEqual(report.pass, false);
    assert.strictEqual(report.checks[1].error, 'HTTP 503');
  } finally { restore(); }
});

test('daily verification runs and requires local checks when enabled', async () => {
  const restore = withLocal('true');
  try {
    let called = false;
    const report = await verifyDailyRuntime({ dryRun: false }, {
      chain: passing,
      public: passing,
      local: async () => { called = true; return { pass: true, details: {} }; },
    });
    assert.strictEqual(called, true);
    assert.strictEqual(report.checks[2].skipped, false);
    assert.strictEqual(report.pass, true);
  } finally { restore(); }
});

test('daily verification propagates local health or queue failure', async () => {
  const restore = withLocal('true');
  try {
    const report = await verifyDailyRuntime({ dryRun: false }, {
      chain: passing,
      public: passing,
      local: async () => ({ pass: false, details: { pending: 1 } }),
    });
    assert.strictEqual(report.pass, false);
  } finally { restore(); }
});
