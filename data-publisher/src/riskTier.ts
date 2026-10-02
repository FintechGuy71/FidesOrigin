/**
 * 风险分级：score → RiskTier 的【唯一】权威实现。
 *
 * 为什么需要这个模块：collector.ts / collectors-extended.ts / processor.ts 曾各自
 * 复制一份 scoreToTier，且都用了一套【与合约不符】的阈值 20/40/60/80。
 * data-publisher 会真实写链（batch-collector.ts 调 batchUpdateRiskProfiles、
 * publisher.ts 调 updateRiskProfile、fatf-publisher.ts 调 updateRiskProfile），
 * 写进去的 tier 被 PolicyEngine.sol:588 的阻断逻辑消费
 * （`tier == HIGH && !allowHighRisk` → 拦截）。阈值错误会让本该拦的地址放行。
 *
 * [2026-10-02 更新] 全站展示分级已对齐链上 tier（决策「展示对齐链上、不升合约」），
 * 故 score→档位阈值现在只有一套权威值 30/50/80/95：
 *
 *   A. 链上 tier（本模块，= data-sync/src/riskGrading.js 的 scoreToTier）：30/50/80/95
 *      合约 RiskRegistry.RiskTier 枚举 {UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL} = 0..4。
 *      编码进 Merkle leaf、写入链上档案、被 PolicyEngine 阻断逻辑消费。
 *      改它属于合约语义变更，需单独评估 + UUPS 升级。
 *
 *   B. 全站展示 level：已对齐 A（50/80/95，无 UNKNOWN 共 4 档，UNKNOWN+LOW 并入 LOW）。
 *      packages/shared 的 RISK_THRESHOLDS 是单一事实源，后端两引擎与前端均已对齐。
 *      对齐后同一 score 两端同档（scam 75：A→MEDIUM、B→MEDIUM）。
 *
 *   C. PolicyEngine 内部 riskTierThresholds：LOW=30 / MEDIUM=60 / HIGH=80
 *      ⚠️ 这是【死配置】——有 public 读取器与 setRiskThreshold 管理函数（会 emit
 *      ThresholdUpdated），但合约内无任何地方读取它做阻断决策；真正阻断走的是
 *      _checkRisk 的 score>=80/>=95 与 _evaluateTransfer 的 tier==HIGH/MEDIUM 枚举比较。
 *      管理员调它零效果。它既非 score→tier 分级表、也不参与执行，勿当分级依据。
 *
 * 本模块导出 A（链上），因为 data-publisher 写的是链上 tier 字段。
 */

import { RiskTier } from './types';

/**
 * score(0-100) → 链上 RiskTier（阈值 30/50/80/95）。
 * 与合约枚举、data-sync/src/riskGrading.js scoreToTier 逐值一致。
 */
export function scoreToTier(score: number): RiskTier {
  const s = Number(score);
  if (!Number.isFinite(s)) return RiskTier.UNKNOWN;
  if (s >= 95) return RiskTier.CRITICAL;
  if (s >= 80) return RiskTier.HIGH;
  if (s >= 50) return RiskTier.MEDIUM;
  if (s >= 30) return RiskTier.LOW;
  return RiskTier.UNKNOWN;
}

/** tier 数字 → 名称（与合约枚举一致，UNKNOWN=0） */
export function tierToName(tier: number): string {
  switch (tier) {
    case RiskTier.UNKNOWN: return 'UNKNOWN';
    case RiskTier.LOW: return 'LOW';
    case RiskTier.MEDIUM: return 'MEDIUM';
    case RiskTier.HIGH: return 'HIGH';
    case RiskTier.CRITICAL: return 'CRITICAL';
    default: return 'UNKNOWN';
  }
}

/** tier 名称 → 数字；未知名称抛错（不静默降级为 UNKNOWN，否则拼写错误会把高危当无风险） */
export function nameToTier(name: string): RiskTier {
  const key = String(name).trim().toUpperCase();
  if (key in RiskTier && Number.isFinite(Number(RiskTier[key as keyof typeof RiskTier]))) {
    return RiskTier[key as keyof typeof RiskTier] as RiskTier;
  }
  throw new Error(`Unknown risk tier name: "${name}"`);
}
