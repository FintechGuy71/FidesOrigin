/**
 * Core TypeScript types for FidesOrigin On-Chain SDK
 * Mirrors the Solidity enums and structs from IAssetCompliance and IWalletCompliance
 */

/** 合规决策类型 */
export enum Decision {
  ALLOW = 0,   // 放行
  BLOCK = 1,   // 阻止
  FLAG = 2,    // 标记
  HOLD = 3,    // 冻结
}

/** 风险等级 */
export enum RiskTier {
  UNKNOWN = 0, // 未知
  LOW = 1,     // 低风险
  MEDIUM = 2,  // 中风险
  HIGH = 3,    // 高风险
}

/** 钱包操作类型 */
export enum OperationType {
  TRANSFER = 0,
  CONTRACT_CALL = 1,
  TOKEN_APPROVE = 2,
  TOKEN_TRANSFER = 3,
  TOKEN_TRANSFER_FROM = 4,
  SWAP = 5,
  BRIDGE = 6,
  STAKE = 7,
  UNSTAKE = 8,
  CLAIM = 9,
  DELEGATE = 10,
  GOVERNANCE_VOTE = 11,
}

/** 合约地址配置 */
export interface ContractAddresses {
  complianceEngine: string;
  riskRegistry: string;
  policyEngine: string;
  riskOracle: string;
}

/** 风险档案 */
export interface RiskProfile {
  riskScore: number;      // 0-100
  tier: RiskTier;
  tags: string[];
  isSanctioned: boolean;
  lastUpdated: Date;
}

/** 资产发行方策略 */
export interface IssuerPolicy {
  maxTxAmount: bigint;
  dailyLimit: bigint;
  allowMediumRisk: boolean;
  allowHighRisk: boolean;
  blockMixer: boolean;
  requireDestinationKYC: boolean;
  cooldownPeriod: number;
}

/** 钱包策略 */
export interface WalletPolicy {
  maxTxValue: bigint;
  maxTokenTxAmount: bigint;
  dailyEthLimit: bigint;
  dailyTokenLimit: bigint;
  blockContractCalls: boolean;
  blockUnknownTokens: boolean;
  requireWhitelist: boolean;
  allowedDex: string[];
  blockedContracts: string[];
}

/** 钱包操作 */
export interface Operation {
  opType: OperationType;
  target: string;
  value: bigint;
  data: string;
  token: string;
  tokenAmount: bigint;
  chainId: number;
}

/** 转账验证结果 */
export interface TransferValidationResult {
  wouldSucceed: boolean;
  decision: Decision;
  reason: string;
}

/** 操作模拟结果 */
export interface OperationSimulationResult {
  wouldSucceed: boolean;
  decision: Decision;
  reason: string;
  riskScore: number;
  tier: RiskTier;
}

/** 合约风险信息 */
export interface ContractRiskInfo {
  verified: boolean;
  riskScore: number;
  contractType: string;
}
