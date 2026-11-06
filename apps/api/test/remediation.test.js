const test = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH_REQUIRED = 'true';
process.env.RISK_SYNC_API_KEY = 'read-key';
process.env.RULES_ADMIN_API_KEY = 'write-key';
process.env.BACKEND_API_KEY = 'backend-key';
process.env.HMAC_SECRET = 'audit-hmac-secret-at-least-32-characters';
process.env.BACKEND_API_URL = 'https://backend.example.com';
process.env.REDIS_URL = 'redis://127.0.0.1:1';

const batchHandler = require('../api/v1/risk/batch-check');
const addressHandler = require('../api/v1/risk/address/[address]');
const rulesHandler = require('../api/v1/rules');

const ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee';

function req(method, body, query = {}, admin = false) {
  return {
    method,
    body,
    query,
    headers: {
      'content-type': 'application/json',
      'x-api-key': admin ? 'write-key' : 'read-key',
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function res() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
  };
}

test('batch risk uses backend and preserves Sepolia chain', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ results: [], summary: {} }), { status: 200 });
  };
  const response = res();
  await batchHandler(req('POST', { addresses: [ADDRESS], chainId: 11155111 }, {}, true), response);
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).chainId, 11155111);
  assert.match(calls[0].options.headers['X-Request-Signature'], /^[a-f0-9]{64}$/);
});

test('single address maps chain and never falls back to Ethereum mainnet', async () => {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ risk_level: 'unknown' }), { status: 200 });
  };
  const response = res();
  await addressHandler(req('GET', undefined, { address: ADDRESS, chainId: '11155111' }), response);
  assert.match(calls[0], /chain=sepolia/);
  assert.doesNotMatch(calls[0], /chain=ethereum/);
});

test('unsupported chain is rejected before backend call', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected'); };
  const response = res();
  await addressHandler(req('GET', undefined, { address: ADDRESS, chainId: '999999' }), response);
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
});

test('legacy non-executable rules are rejected without a backend write', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected'); };
  const response = res();
  await rulesHandler(req('POST', {
    name: 'legacy', conditions: [{}], actions: [{}],
  }, {}, true), response);
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
});

test('executable rules use the PostgreSQL backend and HMAC', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 1, name: 'sanctioned_list' }), { status: 201 });
  };
  const response = res();
  await rulesHandler(req('POST', {
    name: 'sanctioned_list', rule_type: 'sanctions', category: 'compliance', condition: {},
  }, {}, true), response);
  assert.equal(response.statusCode, 201);
  assert.match(calls[0].url, /\/api\/v1\/rules\/$/);
  assert.match(calls[0].options.headers['X-Request-Signature'], /^[a-f0-9]{64}$/);
});
