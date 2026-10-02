/**
 * FidesOrigin Shared Constants
 * Chain IDs, contract addresses, risk level enums, and other shared constants
 */

// ============================================================================
// Chain IDs (EIP-155 compatible)
// ============================================================================

/** Chain ID mapping for supported networks */
export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  bitcoin: -1, // [AUDIT FIX 2026-09-18 R3-L9] 原 0 与 solana:0 碰撞；非 EIP-155 链用 -1 哨兵
  polygon: 137,
  bsc: 56,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  solana: -2, // [R3-L9] 同上，非 EIP-155 链各自唯一哨兵
} as const;

/** Chain names for display */
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

/** Chain native currency symbols */
export const CHAIN_CURRENCIES: Record<string, string> = {
  ethereum: 'ETH',
  bitcoin: 'BTC',
  polygon: 'MATIC',
  bsc: 'BNB',
  arbitrum: 'ETH',
  optimism: 'ETH',
  base: 'ETH',
  solana: 'SOL',
} as const;

/** Chain explorer URLs */
export const CHAIN_EXPLORERS: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  bitcoin: 'https://blockchain.info',
  polygon: 'https://polygonscan.com',
  bsc: 'https://bscscan.com',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  base: 'https://basescan.org',
  solana: 'https://solscan.io',
} as const;

// ============================================================================
// Contract Addresses
// ============================================================================

/* [AUDIT FIX 2026-09-17 R1-028] 原 FIDES_REGISTRY_ADDRESSES 六个链的值全是
   非法占位符 '0xFidesOriginRegistry...'（非 hex、不可用于任何调用），却作为
   公共导出 API 存在。当前仅 Sepolia 有真实部署（与 DEPLOYED.md v3.1.0 对齐），
   主网及其他链部署后按链补充，不再放出占位符。 */
export const FIDES_REGISTRY_ADDRESSES: Record<string, string> = {
  sepolia: '0x953f985f38f94d6159c0600d1f15D543895cE896', // RiskRegistry (v3.1.0)
} as const;

// ============================================================================
// Risk Level Configuration
// ============================================================================

/** Risk level definitions with thresholds and display properties */
export const RISK_LEVELS = {
  low: {
    name: 'Low Risk',
    label: 'Low',
    threshold: 0,
    color: '#22c55e',
    bgColor: 'bg-green-500',
    textColor: 'text-green-500',
    borderColor: 'border-green-500',
    icon: 'shield-check',
    description: 'Address shows normal activity patterns with no significant risk indicators.',
  },
  medium: {
    name: 'Medium Risk',
    label: 'Medium',
    threshold: 30,
    color: '#eab308',
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    borderColor: 'border-yellow-500',
    icon: 'alert-triangle',
    description: 'Address has some risk indicators that warrant additional review.',
  },
  high: {
    name: 'High Risk',
    label: 'High',
    threshold: 70,
    color: '#f97316',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500',
    icon: 'alert-octagon',
    description: 'Address shows significant risk indicators and requires enhanced due diligence.',
  },
  critical: {
    name: 'Critical Risk',
    label: 'Critical',
    threshold: 90,
    color: '#ef4444',
    bgColor: 'bg-red-500',
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
    icon: 'shield-alert',
    description: 'Address has severe risk indicators. Immediate action recommended.',
  },
} as const;

/** Risk level keys in order of severity */
export const RISK_LEVEL_ORDER: Array<'low' | 'medium' | 'high' | 'critical'> = [
  'low',
  'medium',
  'high',
  'critical',
];

/**
 * Risk score thresholds for classification.
 *
 * [FIX 2026-10-02] 对齐链上 RiskRegistry.RiskTier 的分级阈值（30/50/80/95）。
 * 原展示阈值 30/70/90 与链上 tier 不一致，导致同一 score 两端给不同档位
 * （实证：scam score=75 → 链上 tier=MEDIUM(50-79) 不阻断，而 UI/后端显示 HIGH）。
 * 按决策「展示对齐链上、不升合约」，展示档位边界改为与链上 tier 一致：
 *   链上 5 档 UNKNOWN(0-29)/LOW(30-49)/MEDIUM(50-79)/HIGH(80-94)/CRITICAL(95-100)，
 *   展示层无 UNKNOWN，故 UNKNOWN+LOW 合并为 low(0-49)，其余逐档对齐。
 * ⚠️ 改这里等于改全站展示口径；链上 tier 阈值在 data-sync/merkleBuilder.js 与
 *   合约 _checkRisk(>=80 阻断 / >=95 Critical)，两处仍是权威源，务必保持一致。
 */
export const RISK_THRESHOLDS = {
  low: { min: 0, max: 49 },
  medium: { min: 50, max: 79 },
  high: { min: 80, max: 94 },
  critical: { min: 95, max: 100 },
} as const;

// ============================================================================
// Risk Flags
// ============================================================================

/** All available risk flags with metadata */
export const RISK_FLAGS = {
  sanctions: {
    label: 'Sanctions',
    description: 'Address associated with sanctioned entities',
    severity: 'critical' as const,
    category: 'compliance',
  },
  fraud: {
    label: 'Fraud',
    description: 'Address involved in fraudulent activities',
    severity: 'high' as const,
    category: 'security',
  },
  phishing: {
    label: 'Phishing',
    description: 'Address used in phishing campaigns',
    severity: 'high' as const,
    category: 'security',
  },
  hack: {
    label: 'Hack',
    description: 'Address involved in hacking incidents',
    severity: 'critical' as const,
    category: 'security',
  },
  mixer: {
    label: 'Mixer',
    description: 'Address associated with cryptocurrency mixers',
    severity: 'high' as const,
    category: 'privacy',
  },
  darknet: {
    label: 'Darknet',
    description: 'Address linked to darknet marketplaces',
    severity: 'critical' as const,
    category: 'compliance',
  },
  scam: {
    label: 'Scam',
    description: 'Address involved in scam operations',
    severity: 'high' as const,
    category: 'security',
  },
  high_risk_exchange: {
    label: 'High-Risk Exchange',
    description: 'Address associated with high-risk exchanges',
    severity: 'medium' as const,
    category: 'compliance',
  },
  ransomware: {
    label: 'Ransomware',
    description: 'Address linked to ransomware operations',
    severity: 'critical' as const,
    category: 'security',
  },
  terrorism_financing: {
    label: 'Terrorism Financing',
    description: 'Address suspected of terrorism financing',
    severity: 'critical' as const,
    category: 'compliance',
  },
  money_laundering: {
    label: 'Money Laundering',
    description: 'Address involved in money laundering',
    severity: 'critical' as const,
    category: 'compliance',
  },
  tornado_cash: {
    label: 'Tornado Cash',
    description: 'Address associated with Tornado Cash',
    severity: 'high' as const,
    category: 'privacy',
  },
  suspicious_activity: {
    label: 'Suspicious Activity',
    description: 'Address showing suspicious transaction patterns',
    severity: 'medium' as const,
    category: 'behavior',
  },
  peeling_chain: {
    label: 'Peeling Chain',
    description: 'Address involved in peeling chain transactions',
    severity: 'medium' as const,
    category: 'behavior',
  },
  layering: {
    label: 'Layering',
    description: 'Address showing layering behavior',
    severity: 'medium' as const,
    category: 'behavior',
  },
} as const;

// ============================================================================
// Address Validation
// ============================================================================

/** Address length requirements by chain */
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

/** Address prefix requirements by chain */
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

/** Validates an Ethereum address format (0x + 40 hex chars) */
export function isValidEthereumAddress(address: string): boolean {
  if (!address) return false;
  const cleanAddress = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);
}

/** Validates a Solana address format (32-44 base58 chars) */
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false;
  const cleanAddress = address.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);
}

/** Detects chain type from address format */
export function detectChainFromAddress(address: string): string | null {
  if (!address) return null;
  if (isValidEthereumAddress(address)) return 'ethereum';
  if (isValidSolanaAddress(address)) return 'solana';
  return null;
}

// ============================================================================
// API Configuration
// ============================================================================

/** Default API configuration */
export const DEFAULT_API_CONFIG = {
  baseUrl: 'https://api.fidesorigin.com',
  timeout: 30000,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
} as const;

/** API endpoints */
export const API_ENDPOINTS = {
  risk: {
    check: '/v1/risk/check',
    batch: '/v1/risk/batch',
    profile: '/v1/risk/profile',
    history: '/v1/risk/history',
  },
  compliance: {
    check: '/v1/compliance/check',
    policies: '/v1/compliance/policies',
  },
  websocket: {
    connect: '/v1/ws',
  },
} as const;

// ============================================================================
// WebSocket Configuration
// ============================================================================

/** WebSocket default configuration */
export const WEBSOCKET_CONFIG = {
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
} as const;

// ============================================================================
// UI Constants
// ============================================================================

/** Default pagination settings */
export const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
} as const;

/** Toast notification durations (ms) */
export const TOAST_DURATIONS = {
  info: 5000,
  success: 3000,
  warning: 5000,
  error: 8000,
} as const;

/** Animation durations (ms) */
export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// ============================================================================
// Regulatory Frameworks
// ============================================================================

/** Supported regulatory frameworks */
export const REGULATORY_FRAMEWORKS = {
  FATF: 'FATF Travel Rule',
  EU_MICA: 'EU MiCA',
  US_BSA: 'US BSA/AML',
  UK_MLR: 'UK MLRs',
  SG_MAS: 'Singapore MAS',
  HK_SFC: 'Hong Kong SFC',
} as const;

/** Jurisdiction codes */
export const JURISDICTIONS = {
  US: 'United States',
  UK: 'United Kingdom',
  EU: 'European Union',
  SG: 'Singapore',
  HK: 'Hong Kong',
  JP: 'Japan',
  CA: 'Canada',
  AU: 'Australia',
  CH: 'Switzerland',
  DE: 'Germany',
  FR: 'France',
} as const;
