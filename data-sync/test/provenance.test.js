// 采集可信度校验 / 风险分级 / 链上增量写入 的回归测试（node:test）
// 覆盖：受控词表、逐条校验、跨轮次比对、两套分级阈值、bytes32 编解码、diff 幂等、失败重试。
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const {
  RISK_TIERS,
  SHARED_RISK_THRESHOLDS,
  TAG_VOCABULARY,
  TAG_BY_STRING,
  MAX_TAGS_PER_ADDRESS,
  grade,
  scoreToTier,
  sharedRiskLevel,
  tagsForEntry,
  categoryOfSource,
  checkBytes32Safe,
} = require('../src/riskGrading');

const {
  SOURCE_REGISTRY,
  getSource,
  sourcesByCategory,
  validateRecord,
  validateBatch,
  compareWithPrevious,
  writeProvenance,
} = require('../src/provenance');

const {
  tagToBytes32,
  bytes32ToTag,
  encodeTags,
  normalizeOnChain,
  normalizeTarget,
  fingerprint,
  diffAgainstChain,
  syncProfilesToChain,
  BATCH_MAX_SIZE,
} = require('../src/chainProfileSync');

const addr = (c) => '0x' + c.repeat(40);

// ============ 1. 风险分级：两套阈值体系 ============

test('grade: 链上 tier 与展示 riskLevel 是两套阈值，互不混用', () => {
  // score=75：链上 tier=2(MEDIUM，阈值 50/80)，展示 HIGH（阈值 70/90）
  const g = grade(75);
  assert.strictEqual(g.tier, 2);
  assert.strictEqual(g.tierName, 'MEDIUM');
  assert.strictEqual(g.riskLevel, 'HIGH');
});

test('grade: 链上 tier 边界与 merkleBuilder.scoreToTier 一致（30/50/80/95）', () => {
  const cases = [
    [0, 0], [29, 0], [30, 1], [49, 1], [50, 2], [79, 2],
    [80, 3], [94, 3], [95, 4], [100, 4],
  ];
  for (const [score, tier] of cases) {
    assert.strictEqual(grade(score).tier, tier, `score=${score}`);
    assert.strictEqual(scoreToTier(score), tier, `scoreToTier(${score})`);
  }
});

test('grade: 展示 riskLevel 边界与 packages/shared 一致（30/70/90）', () => {
  const cases = [
    [0, 'LOW'], [29, 'LOW'], [30, 'MEDIUM'], [69, 'MEDIUM'],
    [70, 'HIGH'], [89, 'HIGH'], [90, 'CRITICAL'], [100, 'CRITICAL'],
  ];
  for (const [score, level] of cases) {
    assert.strictEqual(sharedRiskLevel(score), level, `score=${score}`);
    assert.strictEqual(grade(score).riskLevel, level, `grade(${score}).riskLevel`);
  }
});

test('grade: 展示阈值表与 packages/shared RISK_THRESHOLDS 逐值一致', () => {
  // packages/shared/src/constants/index.ts: low 0-29 / medium 30-69 / high 70-89 / critical 90-100
  assert.deepStrictEqual(
    {
      LOW: SHARED_RISK_THRESHOLDS.LOW,
      MEDIUM: SHARED_RISK_THRESHOLDS.MEDIUM,
      HIGH: SHARED_RISK_THRESHOLDS.HIGH,
      CRITICAL: SHARED_RISK_THRESHOLDS.CRITICAL,
    },
    {
      LOW: { min: 0, max: 29 },
      MEDIUM: { min: 30, max: 69 },
      HIGH: { min: 70, max: 89 },
      CRITICAL: { min: 90, max: 100 },
    }
  );
});

test('grade: 非法输入降级为 0 分 UNKNOWN/LOW', () => {
  for (const bad of [undefined, null, NaN, 'abc', {}]) {
    const g = grade(bad);
    assert.strictEqual(g.tier, 0);
    assert.strictEqual(g.riskLevel, 'LOW');
  }
});

// ============ 2. 标签受控词表 ============

test('tagsForEntry: 制裁源必带 sanctioned marker，风险源必带 scam marker', () => {
  const s = tagsForEntry({ sources: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS'] });
  assert.ok(s.includes('sanctioned'), '制裁缺 sanctioned marker');
  assert.ok(!s.includes('scam'), '制裁不应带 scam');

  const r = tagsForEntry({ sources: ['SCAM_SNIFFER'] });
  assert.ok(r.includes('scam'), '风险源缺 scam marker');
  assert.ok(!r.includes('sanctioned'), '风险源绝不能带 sanctioned（会被误判满分封号）');
});

test('tagsForEntry: 多源混合时 sanction 优先（更严），marker 不被稀释', () => {
  const t = tagsForEntry({ sources: ['SCAM_SNIFFER', 'OFAC_SDN_ADVANCED'] });
  assert.ok(t.includes('sanctioned'));
  assert.ok(!t.includes('scam'), '混合源应归 sanction，不产出 scam marker');
  assert.strictEqual(categoryOfSource('OFAC_SDN_ADVANCED'), 'sanction');
  assert.strictEqual(categoryOfSource('SCAM_SNIFFER'), 'risk');
});

test('tagsForEntry: 确定性 —— 同集合不同顺序产出完全相同（幂等比对前提）', () => {
  const a = tagsForEntry({ sources: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS', 'HMT_OFSI'] });
  const b = tagsForEntry({ sources: ['HMT_OFSI', 'OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS'] });
  assert.deepStrictEqual(a, b);
});

test('tagsForEntry: 超上限截断且优先保留 marker（引擎仍能命中）', () => {
  const many = Array.from({ length: 15 }, (_, i) => `OFAC_SDN_ADVANCED${i}`);
  const t = tagsForEntry({ sources: [...many, 'SCAM_SNIFFER'] });
  assert.ok(t.length <= MAX_TAGS_PER_ADDRESS, `tags ${t.length} 超上限`);
  // marker 必须存活，否则后端引擎静默判 0 分
  assert.ok(t.some((x) => TAG_BY_STRING[x] && TAG_BY_STRING[x].marker));
});

test('tagsForEntry: 空来源仍产出 sanctioned 兜底（防引擎漏判）', () => {
  assert.deepStrictEqual(tagsForEntry({}), ['sanctioned']);
  assert.deepStrictEqual(tagsForEntry({ sources: [] }), ['sanctioned']);
});

test('词表覆盖 daily-sync 全部实际 source 字面量', () => {
  // 与 scripts/daily-sync.js 的 source:/sources: 字面量逐一对齐
  const actual = [
    'OFAC_SDN_ADVANCED', 'STATIC_CACHE', 'STATIC_SNAPSHOT',
    'HMT_OFSI', 'HMT_OFSI_STATIC',
    'OPEN_SANCTIONS', 'OPEN_SANCTIONS_STATIC',
    'Chainalysis',
    'SCAM_SNIFFER', 'SCAM_SNIFFER_STATIC',
  ];
  for (const t of actual) {
    assert.ok(TAG_BY_STRING[t], `词表缺失实际使用的 source: ${t}`);
  }
  // 大小写敏感：全大写 CHAINALYSIS 不是实际产出值
  assert.strictEqual(TAG_BY_STRING['CHAINALYSIS'], undefined);
  assert.strictEqual(TAG_BY_STRING['Chainalysis'].category, 'sanction');
});

test('checkBytes32Safe: 全部词表标签都可编码为 bytes32', () => {
  for (const def of Object.values(TAG_VOCABULARY)) {
    const r = checkBytes32Safe(def.tag);
    assert.ok(r.ok, `${def.tag} 不可编码: ${r.reason}`);
  }
});

test('checkBytes32Safe: 拒绝超长与非 ASCII', () => {
  assert.strictEqual(checkBytes32Safe('x'.repeat(32)).ok, false);
  assert.strictEqual(checkBytes32Safe('').ok, false);
  assert.strictEqual(checkBytes32Safe('制裁名单').ok, false);
  assert.strictEqual(checkBytes32Safe('x'.repeat(31)).ok, true);
});

// ============ 3. bytes32 编解码往返 ============

test('bytes32: 全部词表标签往返无损', () => {
  for (const def of Object.values(TAG_VOCABULARY)) {
    assert.strictEqual(bytes32ToTag(tagToBytes32(def.tag)), def.tag);
  }
});

test('bytes32ToTag: 零值与非法输入返回 null（链上空槽）', () => {
  assert.strictEqual(bytes32ToTag('0x' + '0'.repeat(64)), null);
  assert.strictEqual(bytes32ToTag(null), null);
  assert.strictEqual(bytes32ToTag(undefined), null);
});

test('encodeTags: 丢弃不可编码标签而非整批失败', () => {
  const { tags, dropped } = encodeTags({
    sources: ['OFAC_SDN_ADVANCED', 'x'.repeat(40)],
  });
  assert.ok(tags.includes('OFAC_SDN_ADVANCED'));
  assert.ok(tags.includes('sanctioned'));
  assert.ok(dropped.length >= 1, '超长标签应被丢弃');
  assert.ok(tags.every((t) => checkBytes32Safe(t).ok));
});

// ============ 4. 逐条可信度校验 ============

test('validateRecord: 合法记录通过并补全 tier/tags/provenance', () => {
  const ts = '2026-10-01T00:00:00.000Z';
  const r = validateRecord(
    { address: addr('a'), riskScore: 100, source: 'OFAC_SDN_ADVANCED', reason: 'OFAC Sanctioned' },
    { sourceId: 'ofac', fetchedAt: ts }
  );
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.issues, []);
  assert.strictEqual(r.record.tier, 4);
  assert.strictEqual(r.record.riskLevel, 'CRITICAL');
  assert.deepStrictEqual(r.record.tags, ['OFAC_SDN_ADVANCED', 'sanctioned']);
  assert.strictEqual(r.record.provenance.fetchedAt, ts);
  assert.strictEqual(r.record.provenance.sourceId, 'ofac');
  assert.strictEqual(r.record.provenance.authority, 'official');
  assert.strictEqual(r.record.provenance.category, 'sanction');
});

test('validateRecord: 地址格式非法 → 拒绝', () => {
  for (const bad of ['0x123', 'abc', addr('g'), '', null, undefined, 123]) {
    const r = validateRecord({ address: bad, riskScore: 100, source: 'HMT_OFSI', reason: 'r' });
    assert.strictEqual(r.ok, false, `应拒绝 address=${JSON.stringify(bad)}`);
    assert.ok(r.issues.some((i) => i.includes('address')));
    assert.strictEqual(r.record, null);
  }
});

test('validateRecord: riskScore 越界/非数 → 拒绝', () => {
  for (const bad of [101, -1, 'abc', NaN, Infinity, undefined]) {
    const r = validateRecord({ address: addr('b'), riskScore: bad, source: 'HMT_OFSI', reason: 'r' });
    assert.strictEqual(r.ok, false, `应拒绝 riskScore=${bad}`);
  }
  // 边界合法值
  for (const okScore of [0, 100]) {
    assert.strictEqual(
      validateRecord({ address: addr('b'), riskScore: okScore, source: 'HMT_OFSI', reason: 'r' }).ok,
      true,
      `score=${okScore} 应合法`
    );
  }
});

test('validateRecord: 缺来源标识 → 拒绝', () => {
  const r = validateRecord({ address: addr('c'), riskScore: 100, reason: 'r' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('source attribution')));
});

test('validateRecord: 词表外来源 → 告警但不拒绝（新源上线不致全量丢弃）', () => {
  const r = validateRecord({ address: addr('d'), riskScore: 100, source: 'BRAND_NEW_SOURCE', reason: 'r' });
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('controlled vocabulary')));
});

test('validateRecord: 声明 tier 与 score 推导不符 → 以推导值为准并告警', () => {
  const r = validateRecord(
    { address: addr('e'), riskScore: 100, tier: 1, source: 'HMT_OFSI', reason: 'r' },
    { sourceId: 'hmt' }
  );
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.record.tier, 4, '应纠正为 score 推导值');
  assert.ok(r.warnings.some((w) => w.includes('tier inconsistent')));
});

test('validateRecord: 缺归因文本 → 告警不拒绝', () => {
  const r = validateRecord({ address: addr('f'), riskScore: 100, source: 'HMT_OFSI' });
  assert.strictEqual(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('reason')));
});

test('validateRecord: 来源归属错配 → 告警（按注册表 sourceTags 精确判定）', () => {
  const r = validateRecord(
    { address: addr('a'), riskScore: 100, source: 'HMT_OFSI', reason: 'r' },
    { sourceId: 'openSanctions' }
  );
  assert.ok(r.warnings.some((w) => w.includes('attribution mismatch')));
});

test('validateRecord: 多源归因记录不误报归属错配', () => {
  // merged 数据带多源，其中含本源标识即不应告警
  const r = validateRecord(
    { address: addr('a'), riskScore: 100, sources: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS'], reason: 'r' },
    { sourceId: 'openSanctions' }
  );
  assert.ok(!r.warnings.some((w) => w.includes('attribution mismatch')));
});

test('validateRecord: 非法 fetchedAt → 拒绝', () => {
  const r = validateRecord(
    { address: addr('a'), riskScore: 100, source: 'HMT_OFSI', reason: 'r' },
    { sourceId: 'hmt', fetchedAt: 'not-a-date' }
  );
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('fetchedAt')));
});

test('validateBatch: 统计口径完整（accepted/rejected/duplicates/warnings）', () => {
  const items = [
    { address: addr('a'), riskScore: 100, source: 'HMT_OFSI', reason: 'r' },
    { address: addr('a'), riskScore: 100, source: 'HMT_OFSI', reason: 'r' }, // 批内重复
    { address: '0xbad', riskScore: 100, source: 'HMT_OFSI', reason: 'r' },  // 拒绝
    { address: addr('b'), riskScore: 100, source: 'HMT_OFSI', reason: 'r' },
  ];
  const r = validateBatch(items, { sourceId: 'hmt', fetchedAt: '2026-10-01T00:00:00.000Z' });
  assert.strictEqual(r.stats.input, 4);
  assert.strictEqual(r.stats.accepted, 2);
  assert.strictEqual(r.stats.rejected, 1);
  assert.strictEqual(r.stats.duplicates, 1);
  assert.strictEqual(r.accepted.length, 2);
});

test('validateBatch: 非数组输入不抛异常', () => {
  for (const bad of [null, undefined, {}, 'x']) {
    const r = validateBatch(bad, { sourceId: 'hmt' });
    assert.strictEqual(r.stats.input, 0);
    assert.strictEqual(r.accepted.length, 0);
  }
});

test('validateBatch: 现役 139 条制裁数据零拒绝（校验器不误伤合法数据）', () => {
  const dbFile = path.join(__dirname, '../cache/risk-database.json');
  if (!fs.existsSync(dbFile)) return; // CI 无缓存时跳过
  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const r = validateBatch(db, { sourceId: 'ofac', fetchedAt: new Date().toISOString() });
  assert.strictEqual(r.stats.rejected, 0, `误拒 ${JSON.stringify(r.rejected.slice(0, 2))}`);
  assert.strictEqual(r.stats.accepted, db.length);
});

// ============ 5. 来源注册表 ============

test('SOURCE_REGISTRY: risk 源永不写链（D-2 决策防误封）', () => {
  for (const s of sourcesByCategory('risk')) {
    assert.strictEqual(s.mergeIntoChain, false, `${s.id} 不应写链`);
  }
  const sanction = sourcesByCategory('sanction');
  assert.ok(sanction.length >= 3);
  assert.ok(sanction.every((s) => s.mergeIntoChain === true));
});

test('SOURCE_REGISTRY: 有且仅有一个主源，且为官方制裁源', () => {
  const primaries = SOURCE_REGISTRY.filter((s) => s.primary);
  assert.strictEqual(primaries.length, 1);
  assert.strictEqual(primaries[0].id, 'ofac');
  assert.strictEqual(primaries[0].category, 'sanction');
  assert.strictEqual(primaries[0].authority, 'official');
});

test('SOURCE_REGISTRY: 每个抓取方法在 DailySyncService 上真实存在', () => {
  const { DailySyncService } = require('../scripts/daily-sync.js');
  for (const s of SOURCE_REGISTRY) {
    assert.strictEqual(
      typeof DailySyncService.prototype[s.method],
      'function',
      `注册表声明的方法不存在: ${s.id}.${s.method}`
    );
  }
});

test('SOURCE_REGISTRY: id 唯一且 sourceTags 均在受控词表内', () => {
  const ids = new Set();
  for (const s of SOURCE_REGISTRY) {
    assert.ok(!ids.has(s.id), `重复 source id: ${s.id}`);
    ids.add(s.id);
    assert.strictEqual(getSource(s.id), s);
    for (const t of s.sourceTags || []) {
      assert.ok(TAG_BY_STRING[t], `${s.id} 声明了词表外标签: ${t}`);
    }
  }
  assert.strictEqual(getSource('nonexistent'), null);
});

// ============ 6. 跨轮次一致性比对 ============

test('compareWithPrevious: 产出低于 expectMin → 告警（疑似源故障）', () => {
  const r = compareWithPrevious('ofac', 3, { expectMin: 50 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.warnings.some((w) => w.includes('below expected minimum')));
});

test('compareWithPrevious: 骤降超阈值 → 告警（防误信大面积下架）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  writeProvenance('ofac', { count: 124 }, dir);
  const r = compareWithPrevious('ofac', 30, { snapshotDir: dir, expectMin: 0 });
  assert.ok(r.warnings.some((w) => w.includes('dropped')), JSON.stringify(r.warnings));
  assert.strictEqual(r.previous, 124);
});

test('compareWithPrevious: 真实 write→read 闭环（回归：validateBatch stats 作基线）', () => {
  // 该用例锁定一个真实 bug：writeProvenance 落盘的是 validateBatch 的 stats
  // （字段为 accepted/input，无 count），而 compareWithPrevious 原先只读 hist.count，
  // 导致 previous 恒为 null、跨轮次比对形同虚设。此处必须走完整写读路径。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  const items = [
    { address: addr('a'), riskScore: 100, source: 'OFAC_SDN_ADVANCED', reason: 'r' },
    { address: addr('b'), riskScore: 100, source: 'OFAC_SDN_ADVANCED', reason: 'r' },
  ];
  const batch = validateBatch(items, { sourceId: 'ofac', fetchedAt: '2026-10-01T00:00:00.000Z' });
  assert.strictEqual(batch.stats.accepted, 2);
  // 按 daily-sync.validateSource 的真实调用方式落盘
  writeProvenance('ofac', { ...batch.stats, consistency: { previous: null, warnings: [] } }, dir);

  // 下一轮：读到基线 2
  const next = compareWithPrevious('ofac', 2, { snapshotDir: dir, expectMin: 0 });
  assert.strictEqual(next.previous, 2, '基线必须来自 accepted 字段');
  assert.strictEqual(next.ok, true);

  // 下一轮骤降到 0 → 必须告警
  const crash = compareWithPrevious('ofac', 0, { snapshotDir: dir, expectMin: 0 });
  assert.strictEqual(crash.previous, 2);
  assert.ok(crash.warnings.some((w) => w.includes('dropped')), JSON.stringify(crash.warnings));
});

test('compareWithPrevious: 兼容旧记录的 count 字段', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  fs.writeFileSync(
    path.join(dir, 'provenance-ofac.json'),
    JSON.stringify({ sourceId: 'ofac', count: 124 })
  );
  const r = compareWithPrevious('ofac', 124, { snapshotDir: dir, expectMin: 0 });
  assert.strictEqual(r.previous, 124);
});

test('compareWithPrevious: 正常波动不告警', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  writeProvenance('ofac', { count: 124 }, dir);
  const r = compareWithPrevious('ofac', 126, { snapshotDir: dir, expectMin: 50 });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.warnings, []);
});

test('compareWithPrevious: 历史文件损坏不抛异常（降级为无基线）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  fs.writeFileSync(path.join(dir, 'provenance-ofac.json'), '{ not json');
  const r = compareWithPrevious('ofac', 124, { snapshotDir: dir, expectMin: 50 });
  assert.strictEqual(r.previous, null);
  assert.ok(r.warnings.some((w) => w.includes('cannot read')));
});

test('writeProvenance: 无目录时返回 null 不抛异常', () => {
  assert.strictEqual(writeProvenance('ofac', { count: 1 }, null), null);
});

// ============ 7. 链上 diff 幂等 ============

// mock 合约：可编排链上现状与失败次数
function makeMockContract(onchainMap = {}, failTimes = 0) {
  let writeCalls = 0;
  const written = [];
  const iface = { parseLog: () => null };
  const fn = async (accounts, scores, tiers, sanctioned, tags) => {
    writeCalls++;
    if (writeCalls <= failTimes) throw new Error('replacement transaction underpriced (mock)');
    written.push({ accounts: [...accounts], tags: tags.map((t) => [...t]) });
    return {
      hash: '0xmock' + writeCalls,
      wait: async () => ({
        status: 1,
        hash: '0xmock' + writeCalls,
        blockNumber: 100 + writeCalls,
        gasUsed: 21000n,
        logs: [],
      }),
    };
  };
  fn.estimateGas = async () => 100000n;
  return {
    contract: {
      interface: iface,
      getRiskProfile: async (a) => {
        const p = onchainMap[String(a).toLowerCase()];
        if (!p) return [0, 0, [], 0, false];
        return [p.riskScore, p.tier, (p.tags || []).map(tagToBytes32), 100, p.sanctioned];
      },
      batchUpdateRiskProfiles: fn,
    },
    written,
    get writeCalls() { return writeCalls; },
  };
}

const TARGETS = [
  { address: addr('a'), riskScore: 100, tier: 4, sources: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS'], reason: 'r' },
  { address: addr('b'), riskScore: 100, tier: 4, sources: ['OFAC_SDN_ADVANCED'], reason: 'r' },
];

test('diff: 链上全空 → 全部判为需写入', async () => {
  const mk = makeMockContract({});
  const r = await diffAgainstChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.changed.length, 2);
  assert.strictEqual(r.unchanged, 0);
});

test('diff: 链上已完全一致 → 零写入（幂等核心）', async () => {
  const mk = makeMockContract({
    [addr('a')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS', 'sanctioned'] },
    [addr('b')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'sanctioned'] },
  });
  const r = await diffAgainstChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.changed.length, 0);
  assert.strictEqual(r.unchanged, 2);
});

test('diff: 仅 tags 缺失也判为不一致（修复链上 tags 恒空的历史缺口）', async () => {
  const mk = makeMockContract({
    [addr('a')]: { riskScore: 100, tier: 4, sanctioned: true, tags: [] },
    [addr('b')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'sanctioned'] },
  });
  const r = await diffAgainstChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.changed.length, 1);
  assert.strictEqual(r.changed[0].entry.address, addr('a'));
  assert.strictEqual(r.unchanged, 1);
});

test('diff: tags 顺序不同不算变化（规范化排序后比对）', async () => {
  const mk = makeMockContract({
    [addr('a')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['sanctioned', 'OPEN_SANCTIONS', 'OFAC_SDN_ADVANCED'] },
    [addr('b')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['sanctioned', 'OFAC_SDN_ADVANCED'] },
  });
  const r = await diffAgainstChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.changed.length, 0, '顺序差异不应触发重写');
});

test('diff: score 变化 → 判为需更新', async () => {
  const mk = makeMockContract({
    [addr('a')]: { riskScore: 80, tier: 3, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS', 'sanctioned'] },
    [addr('b')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'sanctioned'] },
  });
  const r = await diffAgainstChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.changed.length, 1);
  assert.strictEqual(r.changed[0].previous.riskScore, 80);
  assert.strictEqual(r.changed[0].target.riskScore, 100);
});

test('diff: 读链失败不致命，降级为需写入并计入 readErrors', async () => {
  const mk = makeMockContract({});
  mk.contract.getRiskProfile = async () => { throw new Error('RPC timeout (mock)'); };
  const r = await diffAgainstChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.readErrors.length, 2);
  assert.strictEqual(r.changed.length, 2, '读失败应保守地判为需写入');
});

test('normalizeTarget: 默认 sanctioned=true（制裁管道语义）', () => {
  assert.strictEqual(normalizeTarget({ address: addr('a'), riskScore: 100, tier: 4 }).sanctioned, true);
  assert.strictEqual(normalizeTarget({ address: addr('a'), riskScore: 0, tier: 0, sanctioned: false }).sanctioned, false);
});

test('fingerprint: 对字段变化敏感，对顺序不敏感', () => {
  const a = normalizeTarget({ address: addr('a'), riskScore: 100, tier: 4, sources: ['X', 'Y'] });
  const b = normalizeTarget({ address: addr('a'), riskScore: 100, tier: 4, sources: ['Y', 'X'] });
  assert.strictEqual(fingerprint(a), fingerprint(b));
  const c = normalizeTarget({ address: addr('a'), riskScore: 99, tier: 4, sources: ['X', 'Y'] });
  assert.notStrictEqual(fingerprint(a), fingerprint(c));
});

// ============ 8. 写入重试 ============

test('sync: 首次失败后重试成功', async () => {
  const mk = makeMockContract({}, 1);
  const r = await syncProfilesToChain(mk.contract, TARGETS, {
    onLog: () => {},
    retry: { attempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.results[0].attempts, 2);
  assert.strictEqual(mk.written.length, 1);
});

test('sync: 重试耗尽 → ok=false 且 failedBatches 计数（让 workflow 反映 failure）', async () => {
  const mk = makeMockContract({}, 99);
  const r = await syncProfilesToChain(mk.contract, TARGETS, {
    onLog: () => {},
    retry: { attempts: 2, baseDelayMs: 1, maxDelayMs: 5 },
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.failedBatches, 1);
  assert.ok(r.results[0].error.includes('underpriced'));
});

test('sync: 交易 revert（status!=1）视为失败并重试', async () => {
  const mk = makeMockContract({}, 0);
  mk.contract.batchUpdateRiskProfiles = Object.assign(
    async () => ({ hash: '0xrev', wait: async () => ({ status: 0, hash: '0xrev', blockNumber: 1, gasUsed: 1n, logs: [] }) }),
    { estimateGas: async () => 100000n }
  );
  const r = await syncProfilesToChain(mk.contract, TARGETS, {
    onLog: () => {},
    retry: { attempts: 2, baseDelayMs: 1, maxDelayMs: 5 },
  });
  assert.strictEqual(r.ok, false);
  assert.ok(r.results[0].error.includes('reverted'));
});

test('sync: 无变化时零交易（不发无谓写入）', async () => {
  const mk = makeMockContract({
    [addr('a')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'OPEN_SANCTIONS', 'sanctioned'] },
    [addr('b')]: { riskScore: 100, tier: 4, sanctioned: true, tags: ['OFAC_SDN_ADVANCED', 'sanctioned'] },
  });
  const r = await syncProfilesToChain(mk.contract, TARGETS, { onLog: () => {} });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.toWrite, 0);
  assert.strictEqual(mk.writeCalls, 0);
});

test('sync: dry-run 只 diff 不发交易', async () => {
  const mk = makeMockContract({});
  const r = await syncProfilesToChain(mk.contract, TARGETS, { dryRun: true, onLog: () => {} });
  assert.strictEqual(r.dryRun, true);
  assert.strictEqual(r.toWrite, 2);
  assert.strictEqual(mk.writeCalls, 0);
});

test('sync: 分批上限遵守合约 BATCH_MAX_SIZE', async () => {
  const many = Array.from({ length: 120 }, (_, i) => ({
    address: '0x' + i.toString(16).padStart(40, '0'),
    riskScore: 100,
    tier: 4,
    sources: ['OFAC_SDN_ADVANCED'],
    reason: 'r',
  }));
  const mk = makeMockContract({});
  const r = await syncProfilesToChain(mk.contract, many, {
    batchSize: BATCH_MAX_SIZE,
    onLog: () => {},
    retry: { attempts: 1, baseDelayMs: 1, maxDelayMs: 2 },
  });
  assert.strictEqual(r.toWrite, 120);
  assert.strictEqual(r.batches, 2, '120 条按 100 上限应分 2 批');
  for (const w of mk.written) assert.ok(w.accounts.length <= BATCH_MAX_SIZE);
});

test('sync: 上链 tags 与本地规范标签完全一致（三端同源）', async () => {
  const mk = makeMockContract({});
  await syncProfilesToChain(mk.contract, TARGETS, { onLog: () => {}, retry: { attempts: 1, baseDelayMs: 1, maxDelayMs: 2 } });
  const writtenTags = mk.written[0].tags.map((t) => t.map(bytes32ToTag).sort());
  const localTags = TARGETS.map((e) => tagsForEntry(e).slice().sort());
  assert.deepStrictEqual(writtenTags, localTags);
  assert.ok(writtenTags[0].includes('sanctioned'));
});

test('sync: 无合约/无数据时安全跳过', async () => {
  const r1 = await syncProfilesToChain(null, TARGETS, { onLog: () => {} });
  assert.strictEqual(r1.skipped, true);
  assert.strictEqual(r1.ok, true);
  const mk = makeMockContract({});
  const r2 = await syncProfilesToChain(mk.contract, [], { onLog: () => {} });
  assert.strictEqual(r2.skipped, true);
  assert.strictEqual(mk.writeCalls, 0);
});

test('sync: 单批失败不影响其他批（部分成功可审计）', async () => {
  const many = Array.from({ length: 4 }, (_, i) => ({
    address: '0x' + i.toString(16).padStart(40, '0'),
    riskScore: 100, tier: 4, sources: ['OFAC_SDN_ADVANCED'], reason: 'r',
  }));
  const mk = makeMockContract({});
  let n = 0;
  const orig = mk.contract.batchUpdateRiskProfiles;
  mk.contract.batchUpdateRiskProfiles = Object.assign(
    async (...args) => {
      n++;
      if (n <= 2) throw new Error('batch1 always fails (mock)'); // 第 1 批两次尝试都失败
      return orig(...args);
    },
    { estimateGas: async () => 100000n }
  );
  const r = await syncProfilesToChain(mk.contract, many, {
    batchSize: 2,
    onLog: () => {},
    retry: { attempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
  });
  assert.strictEqual(r.batches, 2);
  assert.strictEqual(r.failedBatches, 1);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.results[1].ok, true, '第 2 批应成功');
});
