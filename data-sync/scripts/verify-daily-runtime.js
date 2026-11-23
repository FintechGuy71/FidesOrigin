'use strict';

/** Read-only post-sync verification for chain, public API and local runtime. */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { createClient } = require('redis');
const { diffAgainstChain } = require('../src/chainProfileSync');

const APP = path.resolve(__dirname, '..');
const ZERO = '0x0000000000000000000000000000000000000000';
const SANCTIONED = '0x252a8bd2319d8a555b872990601221b3a2053bce';
const SCAM = '0x101ce0cedd142f199c9ef61739ae59b6611a0fc0';

async function fetchJson(url, timeoutMs = 60000) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function checkChain(summary) {
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111, { staticNetwork: true });
  const riskAddress = process.env.RISK_REGISTRY_ADDRESS || process.env.RISK_REGISTRY_CONTRACT;
  if (!riskAddress) throw new Error('RISK_REGISTRY_ADDRESS is required for daily verification');
  const merkleAddress = process.env.MERKLE_REGISTRY_ADDRESS || '0x31A034efbe22eDc1a78ceb37F52BA869D869c33B';
  const risk = new ethers.Contract(riskAddress, [
    'function getRiskProfile(address) view returns (uint8,uint8,bytes32[],uint256,bool)',
    'function totalProfiles() view returns (uint256)',
    'function getSanctionedAddresses() view returns (address[])',
  ], provider);
  const merkle = new ethers.Contract(merkleAddress, ['function merkleRoot() view returns (bytes32)'], provider);
  const targets = JSON.parse(fs.readFileSync(path.join(APP, 'cache', 'risk-database.json'), 'utf8'));
  const diff = await diffAgainstChain(risk, targets, { onLog: () => {} });
  const [root, totalProfiles, sanctioned] = await Promise.all([
    merkle.merkleRoot(), risk.totalProfiles(), risk.getSanctionedAddresses(),
  ]);
  const expectedRoot = summary.merkle && summary.merkle.root;
  const details = {
    candidateAddresses: targets.length,
    remainingDiff: diff.changed.length,
    readErrors: diff.readErrors,
    expectedRoot,
    onchainRoot: root,
    totalProfiles: Number(totalProfiles),
    sanctionedAddresses: sanctioned.length,
  };
  return {
    pass: diff.changed.length === 0 && diff.readErrors.length === 0 && Boolean(expectedRoot) && root.toLowerCase() === expectedRoot.toLowerCase(),
    details,
  };
}

async function checkPublic() {
  const base = process.env.PUBLIC_API_BASE || 'https://fidesorigin.com/api/v1/public';
  const [sanctioned, scam, zero, stats] = await Promise.all([
    fetchJson(`${base}/risk-check?address=${SANCTIONED}&chainId=11155111`),
    fetchJson(`${base}/risk-check?address=${SCAM}&chainId=11155111`),
    fetchJson(`${base}/risk-check?address=${ZERO}&chainId=11155111`),
    fetchJson(`${base}/stats`),
  ]);
  const pass = sanctioned.risk_score === 100 && scam.risk_score === 75 && zero.risk_score === 0
    && stats.risk_addresses_total >= 132 && stats.risk_addresses_high >= 0;
  return { pass, details: { sanctioned, scam, zero, stats } };
}

async function checkLocal() {
  const healthBase = process.env.PUBLISHER_HEALTH_BASE || 'http://127.0.0.1:9090';
  const stateFile = process.env.PUBLISHER_STATE_FILE || path.join(APP, '..', '..', 'deployment', 'windows', 'publisher-state.json');
  const publisherState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const [health, ready] = await Promise.all([
    fetchJson(`${healthBase}/health`, 15000),
    fetchJson(`${healthBase}/ready`, 15000),
  ]);
  const publisherPass = health.status === 'healthy' && ready.ready === true
    && Number(health.pid) === Number(publisherState.publisherPid);
  const redis = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
  let queue;
  try {
    await redis.connect();
    const [pending, dlq, rawGroups] = await Promise.all([
      redis.xPending('fides:stream:risk_updates', 'fides:cg:publisher'),
      redis.lLen('fides:mq:dlq'),
      redis.sendCommand(['XINFO', 'GROUPS', 'fides:stream:risk_updates']),
    ]);
    const groups = rawGroups.map(values => {
      const item = {};
      for (let i = 0; i < values.length; i += 2) item[values[i]] = values[i + 1];
      return item;
    });
    queue = { pending: pending.pending, dlq, groups };
  } finally {
    if (redis.isOpen) await redis.quit();
  }
  const queuePass = queue.pending === 0 && queue.dlq === 0 && queue.groups.every(group => Number(group.lag) === 0);
  return { pass: publisherPass && queuePass, details: { health, ready, publisherState, queue } };
}

async function verifyDailyRuntime(summary, dependencies = {}) {
  const localEnabled = process.env.VERIFY_LOCAL_RUNTIME === 'true';
  const implementations = {
    chain: dependencies.chain || checkChain,
    public: dependencies.public || checkPublic,
    local: dependencies.local || checkLocal,
  };
  const checks = [];
  for (const name of ['chain', 'public', 'local']) {
    if (name === 'local' && !localEnabled) {
      checks.push({ name, skipped: true, pass: true, reason: 'Local Windows runtime verification is disabled on this runner' });
      continue;
    }
    try {
      const result = await implementations[name](summary);
      checks.push({ name, skipped: false, pass: result.pass === true, details: result.details });
    } catch (error) {
      checks.push({ name, skipped: false, pass: false, error: error.message });
    }
  }
  return {
    schema: 'fidesorigin-daily-runtime-verification-v1',
    generatedAt: new Date().toISOString(),
    dryRun: Boolean(summary.dryRun),
    pass: checks.every(check => check.pass),
    checks,
  };
}

module.exports = { verifyDailyRuntime, checkChain, checkPublic, checkLocal, SANCTIONED, SCAM, ZERO };
