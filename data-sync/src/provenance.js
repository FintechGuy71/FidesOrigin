/**
 * Provenance — 数据可信度校验与来源注册表
 *
 * 解决三个问题：
 *   1. 【全量自动发现】来源原先硬编码在 daily-sync.js 的 run() 里，加源必须改主流程。
 *      此处改为声明式 SOURCE_REGISTRY，run() 遍历注册表抓取，新增源只需注册一项。
 *   2. 【可信度校验】原先 src/validators.js 存在但 daily-sync 从未引用，条目级质量无人把关。
 *      此处提供逐条校验：来源标识、时间戳、字段完整性、值域、标签规范、分级一致性。
 *   3. 【一致性比对】原先无跨轮次比对，数据源突变（如地址数腰斩）只能靠人肉发现。
 *      此处提供与上一版快照的 diff 与异常波动告警。
 *
 * 设计原则：校验失败【不静默丢弃】—— 返回结构化 reason，由调用方决定拒绝或告警，
 * 并在汇总日志中计数，保证「不遗漏」可被审计。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const {
  TAG_BY_STRING,
  categoryOfSource,
  grade,
  tagsForEntry,
  checkBytes32Safe,
  MAX_TAGS_PER_ADDRESS,
} = require('./riskGrading');

// ==================== 1. 来源注册表（全量自动发现） ====================

/**
 * 数据源注册表 —— 单一事实源。
 *
 * 字段说明：
 *   id          稳定标识（用于快照文件名与日志）
 *   name        人类可读名
 *   category    sanction（官方制裁，写链）| risk（风险情报，不写链）
 *   authority   official（政府/官方名单）| aggregator（聚合器）| security-vendor（安全厂商）
 *   method      daily-sync.js 上的抓取方法名
 *   snapshot    静态后备快照文件名（端点故障时兜底）
 *   maxAgeHours 快照新鲜度门槛（超龄则不置健康位）
 *   envUrl      可覆盖端点的环境变量名
 *   expectMin   产出下限：低于此值视为疑似源故障（触发告警，非硬失败）
 *   mergeIntoChain  是否参与链上写入（risk 源恒为 false，见 D-2 决策）
 *   sourceTags  该源产出的 source 标识白名单（用于归属一致性校验）
 */
const SOURCE_REGISTRY = Object.freeze([
  {
    id: 'ofac',
    name: 'OFAC SDN Advanced (US Treasury)',
    category: 'sanction',
    authority: 'official',
    method: 'fetchOFAC',
    snapshot: null, // 主源无静态兜底（主源故障时走 localCache + 停摆保护）
    maxAgeHours: null,
    envUrl: 'OFAC_ADVANCED_URL',
    expectMin: 50,
    mergeIntoChain: true,
    primary: true,
    sourceTags: ['OFAC_SDN_ADVANCED', 'STATIC_CACHE', 'STATIC_SNAPSHOT'],
  },
  {
    id: 'hmt',
    name: 'UK OFSI / HMT Consolidated List',
    category: 'sanction',
    authority: 'official',
    method: 'fetchHMT',
    snapshot: 'hmt-eth-source.txt',
    maxAgeHours: 48,
    envUrl: 'HMT_URL',
    expectMin: 1,
    mergeIntoChain: true,
    sourceTags: ['HMT_OFSI', 'HMT_OFSI_STATIC'],
  },
  {
    id: 'openSanctions',
    name: 'OpenSanctions aggregated sanctions',
    category: 'sanction',
    authority: 'aggregator',
    method: 'fetchOpenSanctions',
    snapshot: 'open-sanctions-source.txt',
    maxAgeHours: 48,
    envUrl: 'OPEN_SANCTIONS_URL',
    expectMin: 50,
    mergeIntoChain: true,
    sourceTags: ['OPEN_SANCTIONS', 'OPEN_SANCTIONS_STATIC'],
  },
  {
    id: 'scamSniffer',
    name: 'Scam Sniffer phishing/scam blacklist',
    category: 'risk',
    authority: 'security-vendor',
    method: 'fetchScamSniffer',
    snapshot: 'scam-sniffer-source.txt',
    maxAgeHours: 48,
    envUrl: 'SCAM_SNIFFER_URL',
    expectMin: 100,
    mergeIntoChain: false, // 风险情报不写链（D-2：避免举报当制裁误封）
    sourceTags: ['SCAM_SNIFFER', 'SCAM_SNIFFER_STATIC'],
  },
]);

/** 按 id 取注册项 */
function getSource(id) {
  return SOURCE_REGISTRY.find((s) => s.id === id) || null;
}

/** 取某一类别的源（sanction | risk） */
function sourcesByCategory(category) {
  return SOURCE_REGISTRY.filter((s) => s.category === category);
}

// ==================== 2. 条目级可信度校验 ====================

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * 校验单条采集记录。
 *
 * @param {object} item  形如 { address, riskScore, source|sources, reason, tier? }
 * @param {object} ctx   { sourceId, fetchedAt }
 * @returns {{ok: boolean, issues: string[], warnings: string[], record: object|null}}
 *          ok=false 表示必须拒绝入库；warnings 不阻断但需记录。
 */
function validateRecord(item, ctx = {}) {
  const issues = [];
  const warnings = [];
  const sourceId = ctx.sourceId || null;
  const fetchedAt = ctx.fetchedAt || new Date().toISOString();

  if (!item || typeof item !== 'object') {
    return { ok: false, issues: ['record is not an object'], warnings, record: null };
  }

  // --- ① 字段完整性：address ---
  const rawAddr = item.address;
  if (typeof rawAddr !== 'string' || !ADDRESS_RE.test(rawAddr)) {
    issues.push(`invalid address format: ${JSON.stringify(rawAddr)}`);
  }
  const address = typeof rawAddr === 'string' ? rawAddr.toLowerCase() : null;

  // EIP-55 校验和一致性（源若给了混合大小写，checksum 不符说明数据被篡改/损坏）
  if (address && /[A-F]/.test(rawAddr) && /[a-f]/.test(rawAddr)) {
    try {
      if (ethers.getAddress(rawAddr) !== ethers.getAddress(address)) {
        warnings.push(`address checksum mismatch: ${rawAddr}`);
      }
    } catch {
      /* 非混合大小写则跳过 */
    }
  }

  // --- ② 字段完整性 + 值域：riskScore ---
  const score = Number(item.riskScore);
  if (!Number.isFinite(score)) {
    issues.push(`riskScore not a finite number: ${JSON.stringify(item.riskScore)}`);
  } else if (score < 0 || score > 100) {
    issues.push(`riskScore out of range [0,100]: ${score}`);
  }

  // --- ③ 来源标识：必须存在且在受控词表内 ---
  const srcs = Array.isArray(item.sources) && item.sources.length
    ? item.sources
    : (item.source ? [item.source] : []);
  if (srcs.length === 0) {
    issues.push('missing source attribution');
  } else {
    for (const s of srcs) {
      if (!TAG_BY_STRING[String(s)]) {
        // 词表外来源：不拒绝（避免新源上线即全量丢弃），但必须告警以便补词表
        warnings.push(`source not in controlled vocabulary: ${s}`);
      }
    }
  }
  // 来源归属一致性：仅当注册表为该源声明了 sourceTags 白名单时检查。
  // 不用字符串模糊匹配 —— merged 后的多源数据（如 OFAC+OPEN_SANCTIONS）会误报。
  const srcDef = sourceId ? getSource(sourceId) : null;
  if (srcDef && Array.isArray(srcDef.sourceTags) && srcs.length) {
    const allowed = new Set(srcDef.sourceTags.map(String));
    const foreign = srcs.filter((s) => !allowed.has(String(s)));
    if (foreign.length === srcs.length) {
      warnings.push(
        `source attribution mismatch: fetched by ${sourceId} but tagged ${srcs.join(',')}`
      );
    }
  }

  // --- ④ 时间戳：逐条落库（可信度溯源的最小要素） ---
  const provenance = {
    fetchedAt,
    sourceId,
    authority: sourceId ? (getSource(sourceId) || {}).authority || null : null,
    category: srcs.length ? categoryOfSource(srcs[0]) : (item.category || null),
  };
  if (!provenance.fetchedAt || Number.isNaN(Date.parse(provenance.fetchedAt))) {
    issues.push(`invalid fetchedAt timestamp: ${provenance.fetchedAt}`);
  }
  // 时间戳不得来自未来（时钟漂移/源数据异常）
  if (provenance.fetchedAt && Date.parse(provenance.fetchedAt) > Date.now() + 5 * 60 * 1000) {
    warnings.push(`fetchedAt is in the future: ${provenance.fetchedAt}`);
  }

  // --- ⑤ 标签规范：受控词表 + bytes32 可编码 + 数量上限 ---
  const tags = tagsForEntry({ sources: srcs, category: item.category });
  if (tags.length > MAX_TAGS_PER_ADDRESS) {
    issues.push(`too many tags (${tags.length} > ${MAX_TAGS_PER_ADDRESS})`);
  }
  for (const t of tags) {
    const chk = checkBytes32Safe(t);
    if (!chk.ok) issues.push(`tag not bytes32-safe: ${chk.reason}`);
  }

  // --- ⑥ 分级一致性：tier 必须由 score 推导（防三方漂移） ---
  const g = grade(score);
  if (item.tier !== undefined && item.tier !== null) {
    const declared = Number(item.tier);
    if (!Number.isInteger(declared) || declared < 0 || declared > 4) {
      issues.push(`tier out of range [0,4]: ${item.tier}`);
    } else if (declared !== g.tier) {
      // 声明 tier 与 score 推导不一致 —— 以推导值为准并告警（历史 P1-2 同类问题）
      warnings.push(`tier inconsistent with score: declared=${declared} derived=${g.tier}`);
    }
  }

  // --- ⑦ 归因文本：可追溯性（缺失不阻断，但降低可信度） ---
  if (!item.reason && !(Array.isArray(item.reasons) && item.reasons.length)) {
    warnings.push('missing reason/attribution text');
  }

  const ok = issues.length === 0;
  const record = ok
    ? {
        address,
        riskScore: Number.isFinite(score) ? Math.round(score) : 0,
        tier: g.tier,
        tierName: g.tierName,
        riskLevel: g.riskLevel,
        sources: srcs.map(String),
        tags,
        category: provenance.category,
        reason: item.reason || (Array.isArray(item.reasons) ? item.reasons[0] : null),
        provenance,
      }
    : null;

  return { ok, issues, warnings, record };
}

/**
 * 批量校验一个源的产出。
 * @returns {{accepted: object[], rejected: Array<{raw:object,issues:string[]}>,
 *            warnings: Array<{address?:string,msg:string}>, stats: object}}
 */
function validateBatch(items, ctx = {}) {
  const accepted = [];
  const rejected = [];
  const warnings = [];
  const seen = new Set();
  let duplicates = 0;

  for (const raw of Array.isArray(items) ? items : []) {
    const { ok, issues, warnings: w, record } = validateRecord(raw, ctx);
    for (const msg of w) warnings.push({ address: raw && raw.address, msg });
    if (!ok) {
      rejected.push({ raw, issues });
      continue;
    }
    // 同批次内去重（防源自身重复；跨源重复由 mergeData 归因合并处理）
    if (seen.has(record.address)) {
      duplicates++;
      continue;
    }
    seen.add(record.address);
    accepted.push(record);
  }

  return {
    accepted,
    rejected,
    warnings,
    stats: {
      sourceId: ctx.sourceId || null,
      fetchedAt: ctx.fetchedAt || null,
      input: Array.isArray(items) ? items.length : 0,
      accepted: accepted.length,
      rejected: rejected.length,
      duplicates,
      warnings: warnings.length,
    },
  };
}

// ==================== 3. 跨轮次一致性比对 ====================

/**
 * 与上一版快照比对，检测异常波动。
 *
 * 为什么需要：数据源端点迁移/解析器退化时，产出可能骤降（如 OFAC 从 124 → 3），
 * 若不比对就会被当作「名单大幅下架」写链，造成大面积误删。
 *
 * @param {string} sourceId
 * @param {number} currentCount 本轮产出条数
 * @param {object} opts { snapshotDir, expectMin, dropRatioThreshold }
 * @returns {{ok: boolean, warnings: string[], previous: number|null}}
 */
function compareWithPrevious(sourceId, currentCount, opts = {}) {
  const {
    snapshotDir,
    expectMin = 0,
    dropRatioThreshold = 0.5,
  } = opts;

  const warnings = [];
  let previous = null;

  if (snapshotDir) {
    const histFile = path.join(snapshotDir, `provenance-${sourceId}.json`);
    try {
      if (fs.existsSync(histFile)) {
        const hist = JSON.parse(fs.readFileSync(histFile, 'utf8'));
        // 基线优先取 accepted（本轮实际入库的有效条数），兼容旧记录的 count 字段。
        // [FIX] 原实现只读 hist.count，而 writeProvenance 落盘的是 validateBatch 的
        // stats（含 input/accepted，无 count）→ previous 恒为 null，跨轮次比对形同虚设。
        const base = Number.isFinite(hist.accepted) ? hist.accepted : hist.count;
        previous = Number.isFinite(base) ? Number(base) : null;
      }
    } catch (e) {
      warnings.push(`cannot read provenance history for ${sourceId}: ${e.message}`);
    }
  }

  if (currentCount < expectMin) {
    warnings.push(
      `${sourceId} produced ${currentCount} records, below expected minimum ${expectMin} (possible source outage or parser regression)`
    );
  }

  if (previous !== null && previous > 0) {
    const dropRatio = (previous - currentCount) / previous;
    if (dropRatio >= dropRatioThreshold) {
      warnings.push(
        `${sourceId} dropped ${previous} → ${currentCount} (${(dropRatio * 100).toFixed(1)}%), exceeds ${dropRatioThreshold * 100}% threshold — verify source before trusting delisting`
      );
    }
  }

  return { ok: warnings.length === 0, warnings, previous };
}

/**
 * 落盘本轮来源溯源记录（供下一轮比对 + 审计追溯）。
 */
function writeProvenance(sourceId, stats, snapshotDir) {
  if (!snapshotDir) return null;
  try {
    if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
    const file = path.join(snapshotDir, `provenance-${sourceId}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...stats, writtenAt: new Date().toISOString() }, null, 2));
    return file;
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = {
  SOURCE_REGISTRY,
  getSource,
  sourcesByCategory,
  validateRecord,
  validateBatch,
  compareWithPrevious,
  writeProvenance,
  ADDRESS_RE,
};
