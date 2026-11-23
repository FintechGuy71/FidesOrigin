const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BACKEND_API_URL = 'https://backend.example.com';
process.env.BACKEND_API_KEY = 'backend-key';
process.env.HMAC_SECRET = 'audit-hmac-secret-at-least-32-characters';
const { proxyToBackend } = require('../api/_lib/proxy');

test('proxy retries an explicitly enabled GET after a network failure', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new Error('simulated cold-start timeout');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const response = await proxyToBackend('/api/v1/public/stats', {
      timeoutMs: 25000,
      retries: 1,
      retryDelayMs: 0,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls, 2);
  } finally {
    global.fetch = original;
  }
});

test('proxy preserves the default no-retry behavior', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error('offline'); };
  try {
    const response = await proxyToBackend('/api/v1/public/stats', { retryDelayMs: 0 });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test('proxy never retries a write even when retries are configured', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error('offline'); };
  try {
    const response = await proxyToBackend('/api/v1/rules', {
      method: 'POST',
      body: { name: 'test' },
      sign: true,
      retries: 3,
      retryDelayMs: 0,
    });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});

test('proxy does not retry a successful or backend HTTP error response', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: 'backend rejection' }), { status: 503 });
  };
  try {
    const response = await proxyToBackend('/api/v1/public/stats', { retries: 1, retryDelayMs: 0 });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
  } finally {
    global.fetch = original;
  }
});
