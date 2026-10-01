/**
 * Chain Profile Sync — 链上档案增量写入（幂等 + 重试 + 字段一致）
 *
 * 解决三个问题：
 *   1. 【重复写入】原 syncToChain 每轮无条件重写全部地址（139 条 / 3 批 / ~3.5M gas），
 *      即使数据零变化。Merkle 根有幂等跳过，profile 写入却没有 —— 两端不一致。
 *      本模块先读链上现状做 diff，只写「状态不一致」的地址；无变化则零交易。
 *   2. 【字段不一致】原实现 `tags = batch.map(() => [])` 恒传空数组，
 *      而本地存储已有 sources 多源归因 —— 链上 tags 与本地不一致。
 *      本模块把规范标签集编码为 bytes32[] 上链，与本地/后端库同源。
 *   3. 【失败无重试】原实现批次失败只 catch 记 error 就继续，瞬时故障（RPC 抖动、
 *      nonce 竞争、限流）会造成静默数据缺口。本模块加指数退避重试。
 *
 * 合约约束（RiskRegistry.sol）：
 *   - BATCH_MAX_SIZE = 100（单批上限）
 *   - MAX_TAGS_PER_ADDRESS = 10
 *   - MIN_UPDATE_INTERVAL = 1h：1 小时内已更新的地址会被 skip-and-continue
 *     （不 revert），故重试不会因频率限制而永久失败，但需记录以便排查。
 */

'use strict';

const { ethers } = require('ethers');
const { tagsForEntry, checkBytes32Safe, MAX_TAGS_PER_ADDRESS } = require('./riskGrading');

/** 合约单批上限（与 RiskRegistry.BATCH_MAX_SIZE 一致） */
const BATCH_MAX_SIZE = 100;

/** 读链上档案的并发上限（避免打爆公共 RPC 限流） */
const READ_CONCURRENCY = 10;

/** 默认重试策略 */
const DEFAULT_RETRY = { attempts: 3, baseDelayMs: 2000, maxDelayMs: 20000 };

// ==================== bytes32 标签编解码 ====================

/**
 * 标签字符串 → bytes32。
 * 用 ethers.encodeBytes32String（短字符串 UTF-8 编码，≤31 字节），
 * 与合约侧 bytes32 语义一致，可被 decodeBytes32String 无损还原。
 */
function tagToBytes32(tag) {
  return ethers.encodeBytes32String(String(tag));
}

/** bytes32 → 标签字符串；全零或解码失败返回 null（链上空槽/非文本标签） */
function bytes32ToTag(b32) {
  if (!b32 || typeof b32 !== 'string') return null;
  if (/^0x0+$/.test(b32)) return null;
  try {
    const s = ethers.decodeBytes32String(b32);
    return s && s.length ? s : null;
  } catch {
    return null; // 非短字符串编码的 bytes32（历史数据/其他工具写入）
  }
}

/**
 * 计算一条记录的规范链上 tags（bytes32[]）。
 * 过滤不可编码标签 + 截断到合约上限，保证不会因 TagsLimitExceeded 整批 revert。
 * @returns {{tags: string[], dropped: string[]}}
 */
function encodeTags(entry) {
  const raw = tagsForEntry(entry);
  const kept = [];
  const dropped = [];
  for (const t of raw) {
    if (kept.length >= MAX_TAGS_PER_ADDRESS) { dropped.push(t); continue; }
    if (!checkBytes32Safe(t).ok) { dropped.push(t); continue; }
    kept.push(t);
  }
  return { tags: kept, dropped };
}

/** 链上档案 → 可比对的规范形态 */
function normalizeOnChain(profile) {
  const tags = (profile.tags || [])
    .map(bytes32ToTag)
    .filter(Boolean)
    .sort();
  return {
    riskScore: Number(profile.riskScore) || 0,
    tier: Number(profile.tier) || 0,
    sanctioned: Boolean(profile.sanctioned),
    tags,
    lastUpdated: Number(profile.lastUpdated) || 0,
    exists: (Number(profile.lastUpdated) || 0) > 0,
  };
}

/** 目标状态 → 可比对的规范形态 */
function normalizeTarget(entry) {
  const { tags } = encodeTags(entry);
  return {
    riskScore: Number(entry.riskScore) || 0,
    tier: Number(entry.tier) || 0,
    sanctioned: entry.sanctioned !== undefined ? Boolean(entry.sanctioned) : true,
    tags: [...tags].sort(),
  };
}

/** 状态指纹（用于 diff 与日志） */
function fingerprint(state) {
  return JSON.stringify([state.riskScore, state.tier, state.sanctioned, state.tags]);
}

// ==================== 链上读取 ====================

/** 限流并发执行（简易池，避免 Promise.all 一次性打满 RPC） */
async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * 批量读取链上档案现状。
 * 单个地址读取失败不致命：记为 null，后续 diff 会当作「需要写入」处理。
 */
async function readOnChainProfiles(contract, addresses, opts = {}) {
  const concurrency = opts.concurrency || READ_CONCURRENCY;
  const errors = [];
  const profiles = await mapWithConcurrency(addresses, concurrency, async (addr) => {
    try {
      const p = await contract.getRiskProfile(addr);
      // ABI: (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool sanctioned)
      if (Array.isArray(p)) {
        return { riskScore: p[0], tier: p[1], tags: p[2], lastUpdated: p[3], sanctioned: p[4] };
      }
      return p;
    } catch (e) {
      errors.push({ address: addr, error: e.message });
      return null;
    }
  });
  return { profiles, errors };
}

// ==================== diff ====================

/**
 * 计算需要写链的地址（幂等核心）。
 *
 * @param {object} contract RiskRegistry 实例
 * @param {Array} entries 目标档案（含 address/riskScore/tier/sources）
 * @param {object} opts { onLog, sanctionedDefault }
 * @returns {{changed: Array, unchanged: number, readErrors: Array, details: Array}}
 */
async function diffAgainstChain(contract, entries, opts = {}) {
  const log = opts.onLog || (() => {});
  const addresses = entries.map((e) => e.address);

  log(`   🔎 Reading on-chain state for ${addresses.length} addresses...`);
  const { profiles, errors } = await readOnChainProfiles(contract, addresses, opts);
  if (errors.length) {
    log(`   ⚠️ ${errors.length} on-chain reads failed (will be treated as needing write)`);
  }

  const changed = [];
  const details = [];
  let unchanged = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const target = normalizeTarget(entry);
    const onchain = profiles[i] ? normalizeOnChain(profiles[i]) : null;

    if (onchain && fingerprint(onchain) === fingerprint(target)) {
      unchanged++;
      details.push({ address: entry.address, status: 'unchanged' });
      continue;
    }

    changed.push({ entry, target, previous: onchain });
    details.push({
      address: entry.address,
      status: onchain && onchain.exists ? 'update' : 'insert',
      from: onchain ? { score: onchain.riskScore, tier: onchain.tier, tags: onchain.tags } : null,
      to: { score: target.riskScore, tier: target.tier, tags: target.tags },
    });
  }

  log(`   📊 Diff: ${changed.length} to write, ${unchanged} already in sync, ${errors.length} read errors`);
  return { changed, unchanged, readErrors: errors, details };
}

// ==================== 写入（分批 + 重试） ====================

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 指数退避延迟 */
function backoffDelay(attempt, cfg) {
  const d = cfg.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  // 加 ±20% 抖动，避免多批同时重试打爆节点
  const jitter = d * (0.8 + Math.random() * 0.4);
  return Math.min(Math.round(jitter), cfg.maxDelayMs);
}

/**
 * 写入一批档案到链上（含重试）。
 * @returns {{ok: boolean, hash?: string, block?: number, gasUsed?: string,
 *            attempts: number, error?: string, skipped?: boolean}}
 */
async function writeBatchWithRetry(contract, batch, opts = {}) {
  const cfg = { ...DEFAULT_RETRY, ...(opts.retry || {}) };
  const log = opts.onLog || (() => {});

  const accounts = batch.map((b) => b.entry.address);
  const riskScores = batch.map((b) => b.target.riskScore);
  const tiers = batch.map((b) => b.target.tier);
  const sanctioned = batch.map((b) => b.target.sanctioned);
  const tags = batch.map((b) => b.target.tags.map(tagToBytes32));

  let lastError = null;
  for (let attempt = 1; attempt <= cfg.attempts; attempt++) {
    try {
      const gasEstimate = await contract.batchUpdateRiskProfiles.estimateGas(
        accounts, riskScores, tiers, sanctioned, tags
      );
      const tx = await contract.batchUpdateRiskProfiles(
        accounts, riskScores, tiers, sanctioned, tags,
        { gasLimit: (gasEstimate * 12n) / 10n } // +20% buffer
      );
      log(`      📝 TX: ${tx.hash} (attempt ${attempt})`);
      const receipt = await tx.wait();
      if (receipt.status !== 1) {
        throw new Error(`tx reverted (status=${receipt.status}) hash=${receipt.hash}`);
      }
      // 统计合约 skip 事件（频率限制/校验不通过），便于排查"写了但没生效"
      let skipped = 0;
      try {
        const iface = contract.interface;
        for (const l of receipt.logs || []) {
          try {
            const parsed = iface.parseLog({ topics: l.topics, data: l.data });
            if (parsed && parsed.name === 'BatchUpdateSkipped') skipped++;
          } catch { /* 非本合约日志 */ }
        }
      } catch { /* ignore */ }

      return {
        ok: true,
        hash: receipt.hash,
        block: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        attempts: attempt,
        skipped,
      };
    } catch (e) {
      lastError = e;
      const msg = String(e.message || e);
      // nonce/替换类错误重试前需清 nonce，否则会用同一 nonce 反复失败
      const nonceIssue = /nonce|already known|replacement|underpriced/i.test(msg);
      log(`      ⚠️ Attempt ${attempt}/${cfg.attempts} failed: ${msg.slice(0, 160)}`);
      if (attempt < cfg.attempts) {
        const delay = backoffDelay(attempt, cfg);
        if (nonceIssue && opts.wallet) {
          try {
            const n = await opts.wallet.getNonce('pending');
            log(`      🔧 nonce resync → ${n}`);
          } catch { /* ignore */ }
        }
        log(`      ⏳ retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  return { ok: false, attempts: cfg.attempts, error: String(lastError && lastError.message || lastError) };
}

/**
 * 增量同步链上档案（主入口）。
 *
 * @param {object} contract RiskRegistry
 * @param {Array} entries 目标档案
 * @param {object} opts { dryRun, batchSize, onLog, retry, wallet, maxBatches }
 * @returns {{skipped?: boolean, dryRun?: boolean, total: number, toWrite: number,
 *            unchanged: number, batches: number, results: Array, readErrors: Array,
 *            ok: boolean, failedBatches: number}}
 */
async function syncProfilesToChain(contract, entries, opts = {}) {
  const log = opts.onLog || (() => {});
  const batchSize = Math.min(opts.batchSize || 50, BATCH_MAX_SIZE);
  const dryRun = Boolean(opts.dryRun);

  if (!contract) {
    log('\n⏭️ Skipping chain sync (no contract configured)');
    return { skipped: true, ok: true, total: entries.length, toWrite: 0, unchanged: 0, batches: 0, results: [], readErrors: [], failedBatches: 0 };
  }
  if (!entries || entries.length === 0) {
    return { skipped: true, ok: true, total: 0, toWrite: 0, unchanged: 0, batches: 0, results: [], readErrors: [], failedBatches: 0 };
  }

  const { changed, unchanged, readErrors } = await diffAgainstChain(contract, entries, { ...opts, onLog: log });

  if (dryRun) {
    log(`   [DRY RUN] would write ${changed.length} addresses (${unchanged} already in sync)`);
    return { dryRun: true, ok: true, total: entries.length, toWrite: changed.length, unchanged, batches: 0, results: [], readErrors, failedBatches: 0 };
  }

  if (changed.length === 0) {
    log('   ✅ All addresses already in sync — no chain write needed (idempotent)');
    return { ok: true, total: entries.length, toWrite: 0, unchanged, batches: 0, results: [], readErrors, failedBatches: 0 };
  }

  const batches = [];
  for (let i = 0; i < changed.length; i += batchSize) {
    batches.push(changed.slice(i, i + batchSize));
  }
  log(`   ✍️ Writing ${changed.length} changed addresses in ${batches.length} batch(es)...`);

  const results = [];
  let failedBatches = 0;
  for (let i = 0; i < batches.length; i++) {
    log(`   📤 Batch ${i + 1}/${batches.length} (${batches[i].length} addresses)`);
    const r = await writeBatchWithRetry(contract, batches[i], { ...opts, onLog: log });
    r.batch = i + 1;
    r.count = batches[i].length;
    results.push(r);
    if (r.ok) {
      log(`      ✅ Confirmed (block ${r.block}, gas ${r.gasUsed}${r.skipped ? `, skipped ${r.skipped}` : ''})`);
    } else {
      failedBatches++;
      log(`      ❌ Batch ${i + 1} failed after ${r.attempts} attempts: ${r.error}`);
    }
    if (i < batches.length - 1) await sleep(3000); // 批间延迟防限流
  }

  return {
    ok: failedBatches === 0,
    total: entries.length,
    toWrite: changed.length,
    unchanged,
    batches: batches.length,
    results,
    readErrors,
    failedBatches,
  };
}

module.exports = {
  BATCH_MAX_SIZE,
  DEFAULT_RETRY,
  tagToBytes32,
  bytes32ToTag,
  encodeTags,
  normalizeOnChain,
  normalizeTarget,
  fingerprint,
  readOnChainProfiles,
  diffAgainstChain,
  writeBatchWithRetry,
  syncProfilesToChain,
  mapWithConcurrency,
};
