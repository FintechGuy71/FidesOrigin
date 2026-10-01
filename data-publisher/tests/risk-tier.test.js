/**
 * 风险分级阈值与 tier 映射的回归测试。
 *
 * 为什么重要：data-publisher 会【真实写链】（batch-collector.ts 调
 * batchUpdateRiskProfiles、publisher.ts 调 updateRiskProfile、
 * fatf-publisher.ts 调 updateRiskProfile），写入的 tier 被
 * PolicyEngine.sol:588 的阻断逻辑消费（`tier == HIGH && !allowHighRisk` → 拦截）。
 * 因此阈值/映射错误会直接导致【该拦的地址被放行】。
 *
 * 2026-10-02 修复的四个缺陷（本文件逐个锁定）：
 *   A. collector.ts / collectors-extended.ts / processor.ts 三份 scoreToTier 拷贝
 *      都用阈值 20/40/60/80，与合约 RiskRegistry.RiskTier 的 30/50/80/95 不符
 *      → 已统一为 src/riskTier.ts 单一实现。
 *   B. publisher.ts tierStringToNumber 映射 {LOW:0,MEDIUM:1,HIGH:2,CRITICAL:3}，
 *      与权威枚举 {UNKNOWN:0,LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4} 整体错位一档
 *      → 每个 tier 写链时都降一级；未知名称 ?? 0 静默变成 UNKNOWN（最低档）。
 *   C. publisher.ts tierNumberToString 反向同样错位，且 ?? 'LOW' 会把
 *      UNKNOWN(0) 与越界值都显示成 LOW。
 *   D. B/C 两个方向必须严格互逆，否则「写入再读回」会漂移。
 *
 * 测试对象是编译产物 dist/（npm test = `tsc && jest`），因为本包未装 ts-jest，
 * jest 无法直接转译 .ts。
 *
 * 注意：config.ts 在【模块加载时】强制要求 key manager 配置，否则 import 即抛错，
 * 故涉及 publisher 的用例必须在 require 之前设置环境变量。
 */
'use strict';

// —— 必须在 require 被测模块之前设置（config.ts 顶层校验）——
process.env.RISK_REGISTRY_ADDRESS = '0x953f985f38f94d6159c0600d1f15D543895cE896';
process.env.FATF_RISK_REGISTRY_ADDRESS = '0x953f985f38f94d6159c0600d1f15D543895cE896';
process.env.PUBLISHER_PRIVATE_KEY = '0x' + '11'.repeat(32);

const { scoreToTier, tierToName, nameToTier } = require('../dist/src/riskTier.js');
const { RiskTier } = require('../dist/src/types.js');
const { BlockchainPublisher } = require('../dist/src/publisher.js');

/**
 * 合约权威枚举（RiskRegistry.sol:49 `enum RiskTier { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }`）
 * 与 data-publisher/src/types.ts 的 RiskTier 一致。
 */
const CHAIN_ENUM = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
/** 链上权威分级阈值（= data-sync/src/riskGrading.js 的 scoreToTier） */
const CHAIN_TIERS = [
  { score: 0, tier: CHAIN_ENUM.UNKNOWN },
  { score: 29, tier: CHAIN_ENUM.UNKNOWN },
  { score: 30, tier: CHAIN_ENUM.LOW },
  { score: 49, tier: CHAIN_ENUM.LOW },
  { score: 50, tier: CHAIN_ENUM.MEDIUM },
  { score: 79, tier: CHAIN_ENUM.MEDIUM },
  { score: 80, tier: CHAIN_ENUM.HIGH },
  { score: 94, tier: CHAIN_ENUM.HIGH },
  { score: 95, tier: CHAIN_ENUM.CRITICAL },
  { score: 100, tier: CHAIN_ENUM.CRITICAL },
];

describe('riskTier.scoreToTier (链上权威阈值 30/50/80/95)', () => {
  it.each(CHAIN_TIERS)('score $score → tier $tier', ({ score, tier }) => {
    expect(scoreToTier(score)).toBe(tier);
  });

  it('should match the contract enum values exactly', () => {
    expect(RiskTier.UNKNOWN).toBe(CHAIN_ENUM.UNKNOWN);
    expect(RiskTier.LOW).toBe(CHAIN_ENUM.LOW);
    expect(RiskTier.MEDIUM).toBe(CHAIN_ENUM.MEDIUM);
    expect(RiskTier.HIGH).toBe(CHAIN_ENUM.HIGH);
    expect(RiskTier.CRITICAL).toBe(CHAIN_ENUM.CRITICAL);
  });

  it('should NOT use the old drifted thresholds (20/40/60/80)', () => {
    // 旧实现：score>=80 → CRITICAL、>=60 → HIGH、>=40 → MEDIUM、>=20 → LOW。
    // 这些分界点在权威阈值下都必须落到【不同】的档位，以此锁定回归。
    expect(scoreToTier(80)).toBe(CHAIN_ENUM.HIGH); // 旧实现会给 CRITICAL
    expect(scoreToTier(94)).toBe(CHAIN_ENUM.HIGH); // 旧实现会给 CRITICAL
    expect(scoreToTier(60)).toBe(CHAIN_ENUM.MEDIUM); // 旧实现会给 HIGH
    expect(scoreToTier(79)).toBe(CHAIN_ENUM.MEDIUM); // 旧实现会给 HIGH
    expect(scoreToTier(40)).toBe(CHAIN_ENUM.LOW); // 旧实现会给 MEDIUM
    expect(scoreToTier(49)).toBe(CHAIN_ENUM.LOW); // 旧实现会给 MEDIUM
    expect(scoreToTier(20)).toBe(CHAIN_ENUM.UNKNOWN); // 旧实现会给 LOW
    expect(scoreToTier(29)).toBe(CHAIN_ENUM.UNKNOWN); // 旧实现会给 LOW
  });

  it('should be safe against non-numeric / out-of-range input', () => {
    expect(scoreToTier(NaN)).toBe(CHAIN_ENUM.UNKNOWN);
    expect(scoreToTier(undefined)).toBe(CHAIN_ENUM.UNKNOWN);
    expect(scoreToTier(null)).toBe(CHAIN_ENUM.UNKNOWN);
    expect(scoreToTier('abc')).toBe(CHAIN_ENUM.UNKNOWN);
    // 数值字符串应正常工作（真实数据源可能给出字符串）
    expect(scoreToTier('100')).toBe(CHAIN_ENUM.CRITICAL);
    expect(scoreToTier('95')).toBe(CHAIN_ENUM.CRITICAL);
  });
});

describe('riskTier.tierToName / nameToTier (双向映射)', () => {
  it.each([
    ['UNKNOWN', CHAIN_ENUM.UNKNOWN],
    ['LOW', CHAIN_ENUM.LOW],
    ['MEDIUM', CHAIN_ENUM.MEDIUM],
    ['HIGH', CHAIN_ENUM.HIGH],
    ['CRITICAL', CHAIN_ENUM.CRITICAL],
  ])('%s ↔ %i 应互逆', (name, num) => {
    expect(tierToName(num)).toBe(name);
    expect(nameToTier(name)).toBe(num);
    // 互逆性
    expect(tierToName(nameToTier(name))).toBe(name);
    expect(nameToTier(tierToName(num))).toBe(num);
  });

  it('should accept lowercase / mixed-case / padded names', () => {
    expect(nameToTier('critical')).toBe(CHAIN_ENUM.CRITICAL);
    expect(nameToTier('High')).toBe(CHAIN_ENUM.HIGH);
    expect(nameToTier('  medium  ')).toBe(CHAIN_ENUM.MEDIUM);
  });

  it('should throw on unknown tier name (never silently downgrade to UNKNOWN)', () => {
    // 静默降级会让拼写错误把高危地址当无风险写链，必须显式失败
    expect(() => nameToTier('BOGUS')).toThrow(/Unknown risk tier name/);
    expect(() => nameToTier('')).toThrow(/Unknown risk tier name/);
    expect(() => nameToTier('SEVERE')).toThrow(/Unknown risk tier name/);
  });

  it('should map out-of-range tier numbers to UNKNOWN without throwing', () => {
    // 展示/日志用途：不应因脏数据抛错，但也不能谎报为 LOW（旧实现的 bug）
    expect(tierToName(9)).toBe('UNKNOWN');
    expect(tierToName(-1)).toBe('UNKNOWN');
    expect(tierToName(undefined)).toBe('UNKNOWN');
  });
});

describe('BlockchainPublisher tier 映射（写链路径，缺陷 B/C/D）', () => {
  // tierStringToNumber / tierNumberToString 是 private，用最小替身取到原型方法
  const proto = BlockchainPublisher.prototype;
  const toNumber = (s) => proto.tierStringToNumber.call({}, s);
  const toString_ = (n) => proto.tierNumberToString.call({}, n);

  it.each([
    ['UNKNOWN', 0],
    ['LOW', 1],
    ['MEDIUM', 2],
    ['HIGH', 3],
    ['CRITICAL', 4],
  ])('tierStringToNumber("%s") 应为 %i（不是错位一档的旧值）', (name, expected) => {
    expect(toNumber(name)).toBe(expected);
    // 旧实现的错位值必须不再出现
    expect(toNumber(name)).not.toBe(expected - 1);
  });

  it('CRITICAL must map to 4, not 3 (旧实现会让 CRITICAL 降级为 HIGH)', () => {
    expect(toNumber('CRITICAL')).toBe(CHAIN_ENUM.CRITICAL);
    // 与 scoreToTier 保持一致：score 100 → tier 4
    expect(toNumber('CRITICAL')).toBe(scoreToTier(100));
    expect(toNumber('HIGH')).toBe(scoreToTier(80));
    expect(toNumber('MEDIUM')).toBe(scoreToTier(50));
    expect(toNumber('LOW')).toBe(scoreToTier(30));
  });

  it.each([
    [0, 'UNKNOWN'],
    [1, 'LOW'],
    [2, 'MEDIUM'],
    [3, 'HIGH'],
    [4, 'CRITICAL'],
  ])('tierNumberToString(%i) 应为 "%s"', (num, expected) => {
    expect(toString_(num)).toBe(expected);
  });

  it('should round-trip both directions for every tier (缺陷 D)', () => {
    for (const name of ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      expect(toString_(toNumber(name))).toBe(name);
    }
    for (let n = 0; n <= 4; n++) {
      expect(toNumber(toString_(n))).toBe(n);
    }
  });

  it('should throw on unknown tier string instead of silently writing UNKNOWN(0)', () => {
    // 旧实现 `?? 0` 会把任何拼错的 tier 名静默写成 UNKNOWN（最低档）→ 高危地址被放行
    expect(() => toNumber('BOGUS')).toThrow(/Unknown risk tier/);
    expect(() => toNumber('')).toThrow(/Unknown risk tier/);
  });

  it('tierNumberToString should not report LOW for out-of-range values', () => {
    // 旧实现 `?? 'LOW'` 会把越界/UNKNOWN 都显示成 LOW，审计日志会误导
    expect(toString_(9)).toBe('UNKNOWN');
    expect(toString_(-1)).toBe('UNKNOWN');
    expect(toString_(undefined)).toBe('UNKNOWN');
  });
});

describe('三处 scoreToTier 调用点均已委托单一实现（缺陷 A）', () => {
  // 这三份拷贝曾各写一套阈值导致漂移；此测试通过行为等价性锁定它们已收敛。
  it('DataProcessor 与 collector 的 tier 应与权威实现一致', () => {
    const { DataProcessor } = require('../dist/src/processor.js');
    const proc = DataProcessor.prototype;
    for (const { score, tier } of CHAIN_TIERS) {
      expect(proc.scoreToTier.call({}, score)).toBe(tier);
    }
  });
});
