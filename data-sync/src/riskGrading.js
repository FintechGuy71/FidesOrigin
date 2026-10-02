/**
 * Risk Grading — 风险分级与标签规范的【单一事实源】
 *
 * 为什么需要这个模块：
 *   分级阈值原先散落在 src/merkleBuilder.js（scoreToTier）与各 fetcher 的硬编码
 *   riskScore 里，标签则散落在 daily-sync.js / push-to-backend-db.js 的字符串字面量中。
 *   任何一处改动都可能造成「链上 tier / 后端 risk_level / 本地 tier」三方漂移
 *   （历史上 P1-2 就修过一次 tier 硬编码漂移）。
 *
 * 本模块集中定义：
 *   1. 分级判定条件（score 区间 → tier 0-4 → 标签名 → 后端 risk_level）
 *   2. 标签受控词表（TAG_VOCABULARY）：只允许表内标签上链/入库，杜绝拼写漂移
 *   3. 来源 → 标签 的规范映射（sourceTagMap）
 *   4. tagsForEntry()：从一条归因记录推导【确定性、有序、去重、限量】的标签集，
 *      供链上 bytes32[] 与本地存储共用，保证两端字段一致。
 *
 * 约束（与合约 RiskRegistry.sol 对齐）：
 *   - MAX_TAGS_PER_ADDRESS = 10 → 超出按优先级截断
 *   - bytes32 标签必须是 ≤31 字节的 ASCII（ethers.encodeBytes32String 限制）
 */

'use strict';

// tier 数值由 merkleBuilder 推导，避免两份阈值实现漂移
const { scoreToTier } = require('./merkleBuilder');

/**
 * 风险分级表：判定条件 + 标签取值范围（唯一权威定义）
 *
 * tier 编码与合约 `enum RiskTier { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }` 一致。
 * score 区间为【左闭右开】下界判定（score >= min），与 merkleBuilder.scoreToTier 对齐。
 */
/**
 * 链上 tier 分级表（合约 enum RiskTier，与 merkleBuilder.scoreToTier 同源）
 *
 * [2026-10-02 更新] 展示分级已对齐链上 tier（原为分离的两套阈值 30/70/90，
 * 决策「展示对齐链上、不升合约」后统一）。现两套阈值【档位边界一致】，仅一处差异：
 *
 *   A. 链上 tier（本表）：30 / 50 / 80 / 95，含 UNKNOWN(0-29) 共 5 档。
 *      由 merkleBuilder.scoreToTier 定义，编码进 Merkle leaf 与 RiskRegistry 档案，
 *      被 PolicyEngine 阻断逻辑消费（PolicyEngine.sol:588 `tier == HIGH &&
 *      !allowHighRisk`）。改它属合约语义变更，需 UUPS 升级 + 时间锁。
 *
 *   B. 全站展示分级（SHARED_RISK_THRESHOLDS）：50 / 80 / 95，无 UNKNOWN 共 4 档，
 *      故链上 UNKNOWN(0-29) + LOW(30-49) 合并为展示 LOW(0-49)。
 *      由 packages/shared/src/constants RISK_THRESHOLDS 定义（单一事实源），
 *      后端两个引擎与前端均已对齐。
 *
 * 对齐后同一 score 两端档位一致（scam 75：链上 tier=2 MEDIUM，展示 risk_level=MEDIUM）。
 * 唯一区别是展示层无 UNKNOWN 档。历史上曾分离（75 链上 MEDIUM / 展示 HIGH），
 * push-to-backend-db 曾用 TIER_TO_LEVEL[tier] 把 A 当 B 写库导致不符，已改走 sharedRiskLevel()。
 *
 * ⚠️ 维护提醒：改 A（链上）是合约语义变更；改 B（展示）需同步
 *    packages/shared + backend risk_engine*.py + apps/web 硬编码 + 本文件，四处一致。
 */
const RISK_TIERS = Object.freeze({
  0: Object.freeze({ tier: 0, name: 'UNKNOWN',  min: 0,   max: 29 }),
  1: Object.freeze({ tier: 1, name: 'LOW',      min: 30,  max: 49 }),
  2: Object.freeze({ tier: 2, name: 'MEDIUM',   min: 50,  max: 79 }),
  3: Object.freeze({ tier: 3, name: 'HIGH',     min: 80,  max: 94 }),
  4: Object.freeze({ tier: 4, name: 'CRITICAL', min: 95,  max: 100 }),
});

/**
 * 全站展示分级阈值 —— 与 packages/shared/src/constants RISK_THRESHOLDS 逐值一致。
 * 后端引擎、前端、SDK 均以此为准。
 *
 * [FIX 2026-10-02] 原为 30/70/90，与链上 tier 阈值（30/50/80/95）不一致，
 * 导致同一 score 两端给不同档位（scam 75 → 链上 MEDIUM 不阻断 / 展示 HIGH）。
 * 按决策「展示对齐链上、不升合约」改为与 RISK_TIERS 相同的档位边界；
 * 展示层无 UNKNOWN，故链上 UNKNOWN(0-29)+LOW(30-49) 合并为展示 LOW(0-49)。
 * ⚠️ 本表必须与 packages/shared RISK_THRESHOLDS 逐值一致
 *    （test/provenance.test.js 有断言锁定）。
 */
const SHARED_RISK_THRESHOLDS = Object.freeze({
  LOW:      Object.freeze({ min: 0,  max: 49 }),
  MEDIUM:   Object.freeze({ min: 50, max: 79 }),
  HIGH:     Object.freeze({ min: 80, max: 94 }),
  CRITICAL: Object.freeze({ min: 95, max: 100 }),
});

/**
 * score → 全站展示 risk_level（阈值 B）。
 * 用于后端库 address_risks.risk_level，与引擎重算结果保持一致。
 * @param {number} riskScore
 * @returns {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'}
 */
function sharedRiskLevel(riskScore) {
  const s = Number(riskScore) || 0;
  if (s >= SHARED_RISK_THRESHOLDS.CRITICAL.min) return 'CRITICAL';
  if (s >= SHARED_RISK_THRESHOLDS.HIGH.min) return 'HIGH';
  if (s >= SHARED_RISK_THRESHOLDS.MEDIUM.min) return 'MEDIUM';
  return 'LOW';
}

/**
 * 标签受控词表 —— 只有这里列出的标签才允许出现在链上 tags / 本地存储 tags。
 *
 * 分类语义：
 *   - category：该地址属于哪一类风险事实（决定走哪个引擎策略、是否写链）
 *       * sanction → 官方制裁（写链 sanctioned=true，引擎 SanctionedListStrategy 满分）
 *       * risk     → 链上风险情报（不写链，引擎 RiskListStrategy 75 分）
 *   - source：归因来源标识（多源可并存，用于审计追溯）
 *   - marker：引擎命中标记（必须与后端 MARKERS 子串匹配语义兼容，改动需同步后端）
 *
 * ⚠️ 后端引擎 MARKERS 是【大小写敏感】子串匹配：
 *     SanctionedListStrategy = ("OFAC","sanctioned","sdn","STATIC_SNAPSHOT")
 *     RiskListStrategy       = ("scam","phishing","SCAM_SNIFFER","fraud","hack")
 *   因此 marker 值不可随意改大小写，否则命中失败（历史上踩过：新源标签一个都匹配不上
 *   → 引擎静默判 0 分）。
 */
const TAG_VOCABULARY = Object.freeze({
  // --- category markers ---
  SANCTIONED: { tag: 'sanctioned', category: 'sanction', marker: true },
  SCAM:       { tag: 'scam',       category: 'risk',     marker: true },

  // --- source tags ---
  // 命名必须与 daily-sync.js 各 fetcher 的 `source:` 字面量逐字一致，
  // 且不可改大小写 —— 后端 SanctionedListStrategy.MARKERS 含 "STATIC_SNAPSHOT"
  // 做大小写敏感子串匹配，改名会导致引擎命中失败（静默判 0 分）。
  OFAC_SDN_ADVANCED:      { tag: 'OFAC_SDN_ADVANCED',      category: 'sanction' },
  OFAC_SDN_ADVANCED_STATIC:{ tag: 'OFAC_SDN_ADVANCED_STATIC', category: 'sanction' },
  STATIC_CACHE:           { tag: 'STATIC_CACHE',           category: 'sanction' },
  STATIC_SNAPSHOT:        { tag: 'STATIC_SNAPSHOT',        category: 'sanction' },
  HMT_OFSI:               { tag: 'HMT_OFSI',               category: 'sanction' },
  HMT_OFSI_STATIC:        { tag: 'HMT_OFSI_STATIC',        category: 'sanction' },
  OPEN_SANCTIONS:         { tag: 'OPEN_SANCTIONS',         category: 'sanction' },
  OPEN_SANCTIONS_STATIC:  { tag: 'OPEN_SANCTIONS_STATIC',  category: 'sanction' },
  // fetchChainalysisData.js 产出的是 'Chainalysis'（首字母大写，非全大写）
  CHAINALYSIS:            { tag: 'Chainalysis',            category: 'sanction' },
  LOCAL_CACHE:            { tag: 'LOCAL_CACHE',            category: 'sanction' },
  INTERNAL:               { tag: 'INTERNAL',               category: 'sanction' },
  SCAM_SNIFFER:           { tag: 'SCAM_SNIFFER',           category: 'risk' },
  SCAM_SNIFFER_STATIC:    { tag: 'SCAM_SNIFFER_STATIC',    category: 'risk' },
});

/** 受控词表反查：tag 字符串 → 定义 */
const TAG_BY_STRING = Object.freeze(
  Object.values(TAG_VOCABULARY).reduce((acc, def) => {
    acc[def.tag] = def;
    return acc;
  }, {})
);

/** 合约上限（与 RiskRegistry.MAX_TAGS_PER_ADDRESS 一致） */
const MAX_TAGS_PER_ADDRESS = 10;

/** bytes32 编码上限（ethers.encodeBytes32String 要求 ≤31 字节 ASCII） */
const MAX_BYTES32_STRING_LEN = 31;

/**
 * 由 source 名推导 category（sanction | risk）。
 * 未在词表中的 source 视为未知 → 归为 sanction（保守：宁可当制裁也不漏判），
 * 但会被 provenance 校验标记为「词表外来源」告警。
 */
function categoryOfSource(source) {
  const def = TAG_BY_STRING[String(source || '')];
  return def ? def.category : 'sanction';
}

/**
 * 计算一条记录的规范标签集（确定性：排序 + 去重 + 限量）。
 *
 * @param {{sources?: string[], source?: string, category?: string}} entry
 * @returns {string[]} 有序标签数组，长度 ≤ MAX_TAGS_PER_ADDRESS
 */
function tagsForEntry(entry) {
  const srcs = entry && Array.isArray(entry.sources) && entry.sources.length
    ? entry.sources
    : (entry && entry.source ? [entry.source] : []);

  const set = new Set();
  let category = entry && entry.category;

  for (const s of srcs) {
    const tag = String(s);
    set.add(tag);
    if (!category) category = categoryOfSource(tag);
    // 来源自带 category 时以其为准（多源混合时取更严：sanction 优先于 risk）
    else if (categoryOfSource(tag) === 'sanction') category = 'sanction';
  }

  // 兜底 category marker：引擎按 marker 命中，缺了会静默判 0 分
  if (!category) category = 'sanction';
  set.add(category === 'risk' ? TAG_VOCABULARY.SCAM.tag : TAG_VOCABULARY.SANCTIONED.tag);

  // 确定性排序（字典序），保证同一输入永远产出同一标签序列 —— 幂等比对的前提
  const sorted = [...set].sort();

  if (sorted.length > MAX_TAGS_PER_ADDRESS) {
    // 超限时优先保留 marker（sanctioned/scam）与前 N-1 个来源，确保引擎仍能命中
    const markers = sorted.filter((t) => TAG_BY_STRING[t] && TAG_BY_STRING[t].marker);
    const rest = sorted.filter((t) => !markers.includes(t));
    return [...markers, ...rest].slice(0, MAX_TAGS_PER_ADDRESS).sort();
  }
  return sorted;
}

/**
 * 校验标签是否可安全编码为 bytes32（≤31 字节 ASCII）。
 * @returns {{ok: boolean, reason?: string}}
 */
function checkBytes32Safe(tag) {
  const s = String(tag);
  if (s.length === 0) return { ok: false, reason: 'empty tag' };
  if (s.length > MAX_BYTES32_STRING_LEN) {
    return { ok: false, reason: `tag exceeds ${MAX_BYTES32_STRING_LEN} bytes: ${s}` };
  }
  // eslint-disable-next-line no-control-regex
  if (/[^\x20-\x7E]/.test(s)) return { ok: false, reason: `non-ASCII tag: ${s}` };
  return { ok: true };
}

/**
 * 分级：score → { tier, tierName, riskLevel }
 *
 * [2026-10-02 更新] 展示分级已对齐链上 tier，两套阈值档位边界一致：
 *   - tier / tierName：链上体系（30/50/80/95，含 UNKNOWN 共 5 档），编码进 Merkle
 *     leaf、RiskRegistry 档案，被 PolicyEngine 阻断逻辑消费。
 *   - riskLevel：全站展示体系（50/80/95，无 UNKNOWN 共 4 档，= packages/shared），
 *     用于后端库 address_risks.risk_level，与引擎/前端一致。
 *
 * 例：score=75 → tier=2/MEDIUM（链上），riskLevel=MEDIUM（展示），二者一致。
 * 唯一差异：链上 UNKNOWN(0-29) 档在展示层并入 LOW，故 score=10 → tier=0/UNKNOWN、
 * riskLevel=LOW。
 */
function grade(riskScore) {
  const score = Number(riskScore) || 0;
  const tier = scoreToTier(score);
  const def = RISK_TIERS[tier] || RISK_TIERS[0];
  return {
    tier,
    tierName: def.name,
    riskLevel: sharedRiskLevel(score),
    min: def.min,
    max: def.max,
  };
}

module.exports = {
  RISK_TIERS,
  SHARED_RISK_THRESHOLDS,
  TAG_VOCABULARY,
  TAG_BY_STRING,
  MAX_TAGS_PER_ADDRESS,
  MAX_BYTES32_STRING_LEN,
  scoreToTier,
  sharedRiskLevel,
  grade,
  tagsForEntry,
  categoryOfSource,
  checkBytes32Safe,
};
