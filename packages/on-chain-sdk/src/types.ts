/**
 * FidesOrigin On-Chain SDK — 类型定义
 * 与合约 IAssetCompliance / RiskRegistry / FidesCompliance 的链上形状一一对应。
 */

/** 合规决策（对应合约 IAssetCompliance.Decision 枚举序） */
export enum Decision {
  ALLOW = 0, // 放行
  BLOCK = 1, // 阻止（revert transaction）
  FLAG = 2,  // 标记（记录可疑但放行）
  HOLD = 3,  // 冻结（转入托管等待审核）
}

/** 风险等级（对应合约 RiskTier 枚举序） */
export enum RiskTier {
  UNKNOWN = 0,
  LOW = 1,     // 低风险/VIP
  MEDIUM = 2,  // 中风险/灰名单
  HIGH = 3,    // 高风险/黑名单
  CRITICAL = 4 // 极高风险/严重制裁
}

/** 合约地址集（new FidesOriginSDK 的第一个参数） */
export interface ContractAddresses {
  /** GuardedComplianceEngine / DiamondComplianceEngine 地址（validateTransfer 所在） */
  complianceEngine: string;
  /** RiskRegistry 地址（风险画像只读查询所在） */
  riskRegistry: string;
  /** PolicyEngine 地址（可选，预留） */
  policyEngine?: string;
  /** RiskOracle 地址（可选，预留） */
  riskOracle?: string;
}

/** validateTransfer 的返回 */
export interface TransferValidation {
  decision: Decision;
  reason: string;
}

/** getRiskProfile 的返回（组合 RiskRegistry 的完整画像） */
export interface RiskProfile {
  /** 0-100 风险评分 */
  riskScore: number;
  /** 风险等级 */
  tier: RiskTier;
  /** 标签（如 "exchange", "whale"；bytes32 已解码为可读字符串） */
  tags: string[];
  /** 是否在制裁名单 */
  isSanctioned: boolean;
  /** 最后更新时间（unix 秒） */
  lastUpdated: number;
}

/** TransferValidated 事件回调 */
export type TransferValidatedCallback = (
  asset: string,
  from: string,
  to: string,
  amount: bigint,
  decision: Decision,
  reason: string
) => void;

/** SanctionAdded 事件回调 */
export type SanctionAddedCallback = (account: string, reason: string) => void;
