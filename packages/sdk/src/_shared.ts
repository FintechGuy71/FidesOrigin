/**
 * Vendored subset of @fidesorigin/shared —— 让本包自包含、可直接发布到公共 npm。
 *
 * [D2 Fix] 原 SDK 通过 `workspace:*` 依赖 @fidesorigin/shared（monorepo 内部包），
 * 公共 npm 无法解析该协议；且 shared 连带 @aws-sdk/client-kms 等重依赖。SDK 实际只用到
 * shared 的少量类型与常量。这里 vendor 运行时缺失的部分；Chain/RiskFlag/RiskLevel/
 * AddressRisk 等基础类型复用本包 ./types（本包已是 SDK 类型的 single source of truth）。
 *
 * ⚠ 维护约定：这些定义与 packages/shared 保持同步；修改 shared 对应定义时必须同步此处。
 */

import type { Chain, RiskLevel, RiskFlag, AddressRisk } from './types';

// ── 常量（vendor 自 shared/src/constants/index.ts）────────────────────────────

/** 链 ID → 显示名 */
export const CHAIN_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  bitcoin: 'Bitcoin',
  polygon: 'Polygon',
  bsc: 'BNB Chain',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  solana: 'Solana',
} as const;

/** 各链地址长度约束 */
export const ADDRESS_LENGTHS: Record<string, { min: number; max: number }> = {
  ethereum: { min: 42, max: 42 },
  bitcoin: { min: 26, max: 62 },
  polygon: { min: 42, max: 42 },
  bsc: { min: 42, max: 42 },
  arbitrum: { min: 42, max: 42 },
  optimism: { min: 42, max: 42 },
  base: { min: 42, max: 42 },
  solana: { min: 32, max: 44 },
} as const;

/** 各链地址前缀约束 */
export const ADDRESS_PREFIXES: Record<string, string[]> = {
  ethereum: ['0x'],
  bitcoin: ['1', '3', 'bc1'],
  polygon: ['0x'],
  bsc: ['0x'],
  arbitrum: ['0x'],
  optimism: ['0x'],
  base: ['0x'],
  solana: [],
} as const;

/** WebSocket 连接配置 */
export const WEBSOCKET_CONFIG = {
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
} as const;

// ── 类型（vendor 自 shared/src/types/index.ts，本包 ./types 缺失的）──────────────

/** API 错误响应 */
export interface APIErrorResponse {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/** 交易记录 */
export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  chain: Chain;
  timestamp: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  status?: 'pending' | 'confirmed' | 'failed';
  riskFlags?: RiskFlag[];
}

/** 合规检查结果 */
export interface ComplianceCheck {
  /** Check identifier */
  id: string;
  /** Check name */
  name: string;
  /** Check status */
  status: 'passed' | 'failed' | 'warning' | 'pending';
  /** Check description */
  description: string;
  /** Detailed findings */
  findings?: string[];
  /** Remediation suggestions */
  remediation?: string[];
  /** Timestamp of the check */
  timestamp: string;
  /** Regulatory framework reference */
  regulation?: string;
  /** Risk level if failed */
  riskLevel?: RiskLevel;
  /** Score impact */
  scoreImpact?: number;
}

/** WebSocket 消息（shared 版：type 字段；本包 types 的同名类型用 event 字段，
    以 shared 版为准——websocket.ts 用的就是这个形状） */
export interface WebSocketMessage<T = unknown> {
  /** Message type */
  type: string;
  /** Message payload */
  data: T;
  /** Timestamp */
  timestamp: string;
}

/** 实时交易事件 */
export interface TransactionEvent {
  /** Event type */
  type: 'transaction' | 'risk_alert' | 'compliance_alert';
  /** Transaction data */
  transaction: Transaction;
  /** Risk assessment */
  riskAssessment?: AddressRisk;
  /** Compliance alerts */
  complianceAlerts?: ComplianceCheck[];
}
