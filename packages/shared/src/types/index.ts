/**
 * FidesOrigin Shared Types
 * Core type definitions extracted from the application codebase
 */

// ============================================================================
// Risk & Compliance Types
// ============================================================================

/** Risk severity level */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Supported blockchain networks */
export type Chain =
  | 'ethereum'
  | 'bitcoin'
  | 'polygon'
  | 'bsc'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'solana';

/** Address type classification */
export type AddressType = 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';

/** Risk flag categories */
export type RiskFlag =
  | 'sanctions'
  | 'fraud'
  | 'phishing'
  | 'hack'
  | 'mixer'
  | 'darknet'
  | 'scam'
  | 'high_risk_exchange'
  | 'ransomware'
  | 'terrorism_financing'
  | 'money_laundering'
  | 'tornado_cash'
  | 'suspicious_activity'
  | 'peeling_chain'
  | 'layering';

/** Individual risk score component */
export interface RiskScore {
  /** Risk category name */
  category: string;
  /** Numerical score (0-100) */
  score: number;
  /** Risk level classification */
  level: RiskLevel;
  /** Human-readable description */
  description: string;
  /** Risk flags associated with this score */
  flags?: RiskFlag[];
}

/** Complete risk assessment for an address */
export interface AddressRisk {
  /** Blockchain address */
  address: string;
  /** Blockchain network */
  chain: Chain;
  /** Overall risk score (0-100) */
  overallScore: number;
  /** Overall risk level */
  overallLevel: RiskLevel;
  /** Individual risk category scores */
  scores: RiskScore[];
  /** All risk flags */
  flags: RiskFlag[];
  /** Address type classification */
  addressType: AddressType;
  /** Assessment timestamp */
  timestamp: string;
  /** Related entities (exchanges, mixers, etc.) */
  relatedEntities?: Entity[];
  /** Transaction statistics */
  transactionStats?: TransactionStats;
}

/** Risk profile for an entity or address */
export interface RiskProfile {
  id: string;
  address: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  flags: RiskFlag[];
  lastAssessed: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Entity & Transaction Types
// ============================================================================

/** Known entity (exchange, mixer, etc.) */
export interface Entity {
  /** Entity name */
  name: string;
  /** Entity type */
  type: 'exchange' | 'mixer' | 'wallet' | 'contract' | 'service' | 'unknown';
  /** Risk level of the entity */
  riskLevel: RiskLevel;
  /** Known aliases */
  aliases?: string[];
  /** Associated addresses */
  addresses?: string[];
  /** Entity description */
  description?: string;
  /** Jurisdiction */
  jurisdiction?: string;
  /** Regulatory status */
  regulatoryStatus?: string;
}

/** Transaction statistics */
export interface TransactionStats {
  /** Total transaction count */
  totalTransactions: number;
  /** Total volume in native currency */
  totalVolume: string;
  /** Average transaction value */
  averageValue: string;
  /** Time since first transaction (days) — optional if not available */
  accountAge?: number;
  /** Number of unique counterparties — optional if not available */
  uniqueCounterparties?: number;
  /** Incoming transaction count */
  incomingCount: number;
  /** Outgoing transaction count */
  outgoingCount: number;
  /** Largest single transaction */
  largestTransaction?: string;
  /** First seen timestamp */
  firstSeen?: string;
  /** Last seen timestamp */
  lastSeen?: string;
}

/** Transaction data */
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

// ============================================================================
// Compliance & Policy Types
// ============================================================================

/** Compliance check result */
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

/** Compliance policy definition */
export interface Policy {
  /** Policy identifier */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description: string;
  /** Policy version */
  version: string;
  /** Rules in this policy */
  rules: PolicyRule[];
  /** Policy status */
  status: 'active' | 'inactive' | 'draft';
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Regulatory framework */
  framework?: string;
  /** Jurisdiction applicability */
  jurisdictions?: string[];
}

/** Individual policy rule */
export interface PolicyRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule type */
  type: 'threshold' | 'blacklist' | 'whitelist' | 'pattern' | 'custom';
  /** Rule condition */
  condition: RuleCondition;
  /** Action to take when rule matches */
  action: 'flag' | 'block' | 'review' | 'allow' | 'escalate';
  /** Risk level assigned */
  riskLevel: RiskLevel;
  /** Score impact */
  scoreImpact: number;
  /** Whether rule is active */
  active: boolean;
  /** Priority (lower = higher priority) */
  priority: number;
}

/** Rule condition definition */
export interface RuleCondition {
  /** Condition type */
  type: 'score_threshold' | 'flag_present' | 'flag_absent' | 'address_match' | 'entity_match' | 'custom';
  /** Condition parameters */
  parameters: Record<string, unknown>;
  /** Human-readable condition description */
  description?: string;
}

// ============================================================================
// API & SDK Types
// ============================================================================

/** SDK configuration options */
export interface SDKConfig {
  /** API base URL */
  baseUrl?: string;
  /** API authentication key */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs?: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs?: number;
}

/** API error response */
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

/** Batch risk check request */
export interface BatchRiskCheckRequest {
  /** Addresses to check */
  addresses: Array<{
    address: string;
    chain: Chain;
  }>;
  /** Whether to include detailed scores */
  includeDetails?: boolean;
}

/** Batch risk check response */
export interface BatchRiskCheckResponse {
  /** Results for each address */
  results: AddressRisk[];
  /** Failed checks */
  errors?: Array<{
    address: string;
    error: string;
  }>;
}

/** WebSocket message types */
export interface WebSocketMessage<T = unknown> {
  /** Message type */
  type: string;
  /** Message payload */
  data: T;
  /** Timestamp */
  timestamp: string;
}

/** Real-time transaction event */
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

// ============================================================================
// UI Component Types
// ============================================================================

/** Risk badge display props */
export interface RiskBadgeProps {
  /** Risk level to display */
  level: RiskLevel;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show score number */
  showScore?: boolean;
  /** Score value (if showing score) */
  score?: number;
  /** Additional CSS classes */
  className?: string;
}

/** Risk score display props */
export interface RiskScoreProps {
  /** Risk assessment data */
  risk: AddressRisk;
  /** Whether to show detailed breakdown */
  showDetails?: boolean;
  /** Whether to show related entities */
  showEntities?: boolean;
  /** Whether to show transaction stats */
  showStats?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Address input props */
export interface AddressInputProps {
  /** Current address value */
  value: string;
  /** Change handler */
  onChange: (address: string) => void;
  /** Selected chain */
  chain: Chain;
  /** Chain change handler */
  onChainChange?: (chain: Chain) => void;
  /** Validation state */
  isValid?: boolean;
  /** Error message */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Store / State Types
// ============================================================================

/** Risk store state */
export interface RiskStoreState {
  /** Current risk assessments by address key */
  assessments: Record<string, AddressRisk>;
  /** Loading states */
  loading: Record<string, boolean>;
  /** Errors */
  errors: Record<string, string>;
  /** Selected address */
  selectedAddress: string | null;
  /** Selected chain */
  selectedChain: Chain;
  /** Recent searches */
  recentSearches: Array<{ address: string; chain: Chain; timestamp: string }>;
}

/** Rules store state */
export interface RulesStoreState {
  /** All policies */
  policies: Policy[];
  /** Active policy IDs */
  activePolicies: string[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Selected policy */
  selectedPolicy: Policy | null;
  /** Last updated */
  lastUpdated: string | null;
}

/** UI store state */
export interface UIStoreState {
  /** Theme mode */
  theme: 'light' | 'dark' | 'system';
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Active panel */
  activePanel: string | null;
  /** Toast notifications */
  toasts: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    duration?: number;
  }>;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Generic API response wrapper */
export interface APIResponse<T> {
  /** Response data */
  data: T;
  /** Success flag */
  success: boolean;
  /** Error information (if failed) */
  error?: APIErrorResponse;
  /** Pagination info (if applicable) */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Pagination parameters */
export interface PaginationParams {
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/** Sort configuration */
export interface SortConfig {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/** Filter configuration */
export interface FilterConfig {
  /** Field to filter */
  field: string;
  /** Filter operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'between';
  /** Filter value */
  value: unknown;
}
