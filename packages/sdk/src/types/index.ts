/**
 * FidesOrigin SDK Type Definitions
 *
 * [P1-Fix] Unified type definitions — merged from types.ts into types/index.ts.
 * This is the single source of truth for all SDK types.
 */

// ============================================================================
// Request / Input Types
// ============================================================================

export interface RiskCheckInput {
  /** Ethereum address to check */
  address: string;
  /** Chain ID or chain name (defaults to 1 / ethereum) */
  chainId: number | string;
  /** Transaction amount (optional) */
  amount?: string;
}

export interface BatchRiskCheckInput {
  /** Array of Ethereum addresses to check */
  addresses: string[];
  /** Chain ID or chain name (defaults to 1 / ethereum) */
  chainId: number | string;
  /** Transaction amount (optional) */
  amount?: string;
}

export interface BatchRiskCheckRequest {
  /** Addresses to check */
  addresses: string[];
  /** Blockchain chain */
  chain?: Chain;
  /** Chain ID or chain name */
  chainId?: number | string;
  /** Include detailed information */
  detailed?: boolean;
  /** Transaction amount (optional) */
  amount?: string;
}

// ============================================================================
// Response / Result Types
// ============================================================================

export interface RiskCheckResult {
  /** Address assessed */
  address: string;
  /** Chain */
  chain: Chain;
  /** Overall risk score (0-100) — backend field: risk_score */
  risk_score: number;
  /** Overall risk level — backend field: risk_level */
  risk_level: string;
  /** Individual risk category scores */
  scores?: RiskScore[];
  /** All risk flags — backend field: risk_factors */
  risk_factors: RiskFactor[];
  /** Address type classification */
  addressType?: AddressType;
  /** Assessment timestamp */
  timestamp?: string;
  /** Related entities (exchanges, mixers, etc.) */
  relatedEntities?: Entity[];
  /** Transaction statistics */
  transactionStats?: TransactionStats;
  /** Risk tags */
  tags?: string[];
  /** Detailed risk breakdown */
  details?: Array<{
    category: string;
    description: string;
    severity: string;
  }>;
  /** Related transactions */
  transactions?: Array<{
    hash: string;
    type: string;
    amount: string;
    risk: string;
    time: string;
  }>;
  /** Total number of transactions (from AddressRiskDetailResponse) */
  transactions_count?: number;
  /** Recent risk events (from AddressRiskDetailResponse) */
  recent_events?: RiskEventResponse[];
  /** Status */
  status?: string;
  /** Report count */
  report_count?: number;
  /** First seen timestamp */
  first_seen_at?: string;
  /** Last updated timestamp */
  last_updated_at?: string;
  /** Created timestamp */
  created_at?: string;
  /** Legacy alias for risk_score */
  overallScore?: number;
  /** Legacy alias for risk_level */
  overallLevel?: RiskLevel;
  /** Legacy alias for risk_factors */
  flags?: RiskFlag[];
}

export interface BatchRiskCheckResult {
  /** Per-address results */
  results: RiskCheckResult[];
  /** Summary statistics */
  summary: {
    total: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

export interface BatchRiskCheckResponse {
  /** Address risk results */
  results: AddressRisk[];
  /** Failed addresses */
  failed?: string[];
}

export interface DashboardStats {
  /** Total addresses assessed */
  totalAddresses: number;
  /** High risk addresses count */
  highRiskCount: number;
  /** Medium risk addresses count */
  mediumRiskCount: number;
  /** Low risk addresses count */
  lowRiskCount: number;
  /** Last update timestamp */
  lastUpdated: string;
  /** Transactions blocked today (legacy field) */
  todayBlocked?: number;
  /** Total risk addresses detected (legacy field) */
  riskAddresses?: number;
  /** Compliance rate percentage (legacy field) */
  complianceRate?: number;
  /** Total monitored transactions (legacy field) */
  monitoredTransactions?: number;
}

// ============================================================================
// Core / Shared Types
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AddressType = 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';

export type Chain =
  | 'ethereum'
  | 'bitcoin'
  | 'polygon'
  | 'bsc'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'solana';

export interface RiskFactor {
  /** Factor name */
  name: string;
  /** Weight */
  weight?: number;
  /** Score */
  score?: number;
  /** Description */
  description?: string;
}

export interface RiskScore {
  /** Overall risk score (0-100) */
  score: number;
  /** Risk level */
  level: RiskLevel;
  /** Confidence level (0-1) */
  confidence: number;
}

export interface AddressRisk {
  /** Address being assessed */
  address: string;
  /** Blockchain chain */
  chain: Chain;
  /** Address type */
  type: AddressType;
  /** Risk assessment */
  risk: RiskScore;
  /** Risk flags */
  flags: RiskFlag[];
  /** Associated entities */
  entities?: Entity[];
  /** Transaction statistics */
  stats?: TransactionStats;
  /** Assessment timestamp */
  assessedAt: string;
}

export interface Entity {
  /** Entity identifier */
  id: string;
  /** Entity name */
  name: string;
  /** Entity category */
  category: string;
  /** Entity risk level */
  riskLevel: RiskLevel;
  /** Entity description */
  description?: string;
}

export interface TransactionStats {
  /** Total transactions */
  totalTransactions: number;
  /** Total volume in USD */
  totalVolume: number;
  /** First transaction timestamp */
  firstTransaction?: string;
  /** Last transaction timestamp */
  lastTransaction?: string;
}

export interface RiskCheckOptions {
  /** Blockchain chain */
  chain?: Chain;
  /** Include detailed entity information */
  includeEntities?: boolean;
  /** Include transaction statistics */
  includeStats?: boolean;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T> {
  /** Response data */
  data: T;
  /** Response status */
  status: number;
  /** Response message */
  message?: string;
}

export interface ApiError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** HTTP status code */
  status?: number;
}

// ============================================================================
// Rule Management Types
// ============================================================================

export type RuleStatus = 'active' | 'inactive' | 'draft';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in';

export interface RuleCondition {
  /** Field to evaluate */
  field: string;
  /** Comparison operator */
  operator: RuleOperator;
  /** Value to compare against */
  value: unknown;
}

export interface RuleAction {
  /** Action type */
  type: 'flag' | 'block' | 'review' | 'allow';
  /** Action parameters */
  params?: Record<string, unknown>;
}

export interface Rule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Rule status */
  status: RuleStatus;
  /** Rule priority (higher = more important) */
  priority: number;
  /** Rule conditions */
  conditions: RuleCondition[];
  /** Rule actions */
  actions: RuleAction[];
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

export interface CreateRuleRequest {
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Rule conditions */
  conditions: RuleCondition[];
  /** Rule actions */
  actions: RuleAction[];
  /** Rule priority (default: 0) */
  priority?: number;
}

export interface UpdateRuleRequest {
  /** Rule name */
  name?: string;
  /** Rule description */
  description?: string;
  /** Rule status */
  status?: RuleStatus;
  /** Rule conditions */
  conditions?: RuleCondition[];
  /** Rule actions */
  actions?: RuleAction[];
  /** Rule priority */
  priority?: number;
}

export interface RuleListOptions {
  /** Filter by status */
  status?: RuleStatus;
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Items offset */
  offset?: number;
}

export interface RuleListResponse {
  /** Rule list */
  rules: Rule[];
  /** Total count */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
}

export interface ComplianceRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Is rule active */
  active: boolean;
  /** Rule conditions */
  conditions: RuleCondition[];
  /** Rule actions */
  actions: RuleAction[];
  /** Created timestamp */
  createdAt: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export type WebSocketEventType =
  | 'risk.update'
  | 'alert.new'
  | 'rule.match'
  | 'connection.established'
  | 'connection.closed'
  | 'error';

export interface WebSocketMessage {
  /** Event type */
  event: WebSocketEventType;
  /** Message payload */
  data: unknown;
  /** Timestamp */
  timestamp: string;
}

export interface RiskUpdateEvent {
  /** Address */
  address: string;
  /** Chain */
  chain: Chain;
  /** New risk assessment */
  risk: RiskScore;
  /** Previous risk assessment */
  previousRisk?: RiskScore;
  /** Trigger reason */
  reason: string;
}

export interface RiskEventResponse {
  /** Event ID */
  id: string;
  /** Event type */
  event_type: string;
  /** Severity */
  severity: string;
  /** Address */
  address: string;
  /** Transaction hash */
  tx_hash?: string;
  /** Description */
  description: string;
  /** Details */
  details?: Record<string, unknown>;
  /** Triggered rules */
  triggered_rules?: string[];
  /** Is notified */
  is_notified?: boolean;
  /** Created timestamp */
  created_at?: string;
}

export interface RuleMatchEvent {
  /** Rule that matched */
  rule: Rule;
  /** Address that triggered the rule */
  address: string;
  /** Chain */
  chain: Chain;
  /** Matched conditions */
  matchedConditions: RuleCondition[];
  /** Actions taken */
  actions: RuleAction[];
  /** Match timestamp */
  matchedAt: string;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export interface WebSocketOptions {
  /** Auto reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
  /** Subscribe to events on connect */
  subscriptions?: string[];
}

export interface WebSocketConfig {
  /** WebSocket URL (defaults to wss:// version of baseUrl) */
  url?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Auto reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

// ============================================================================
// React Hook Types
// ============================================================================

export interface UseRiskCheckOptions {
  /** SDK client options (will construct a new client) */
  options?: ClientOptions;
  /** Polling interval in milliseconds (0 to disable) */
  pollInterval?: number;
  /** Enable on mount */
  enabled?: boolean;
}

export interface UseRiskCheckState {
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: ApiError | null;
  /** Risk assessment result */
  data: AddressRisk | null;
}

export interface UseRiskCheckReturn extends UseRiskCheckState {
  /** Manually refresh risk data */
  refetch: () => Promise<void>;
  /** Clear cached data */
  clear: () => void;
}

// ============================================================================
// Config / Client Types
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseDelayMs: number;
  /** Maximum delay between retries in ms */
  maxDelayMs: number;
  /** HTTP status codes that trigger retry */
  retryableStatusCodes: number[];
}

export interface FidesOriginConfig {
  /** API base URL (default: https://api.fidesorigin.com) */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Custom retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Enable debug logging */
  debug?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/** SDK client options (extends config with browser/timeout overrides) */
export type ClientOptions = FidesOriginConfig & {
  allowBrowserUsage?: boolean;
  timeoutMs?: number;
};

// ============================================================================
// Client Interface (matches actual FidesOriginClient implementation)
// ============================================================================

export interface FidesOriginClient {
  /** Client configuration */
  readonly config: FidesOriginConfig;

  /** Check single address risk */
  checkRisk(input: RiskCheckInput): Promise<RiskCheckResult>;

  /** Check multiple addresses */
  batchCheckRisk(input: BatchRiskCheckInput): Promise<BatchRiskCheckResult>;

  /** Get latest address risk snapshot */
  getAddressRisk(address: string): Promise<AddressRisk>;

  /** Get dashboard stats */
  getDashboardStats(): Promise<DashboardStats>;

  /** List rules */
  listRules(options?: RuleListOptions): Promise<RuleListResponse>;

  /** Create new rule */
  createRule(req: CreateRuleRequest): Promise<Rule>;

  /** Update rule */
  updateRule(id: string, req: UpdateRuleRequest): Promise<Rule>;

  /** Delete rule */
  deleteRule(id: string): Promise<void>;

  /** Create WebSocket connection */
  createWebSocket(config?: WebSocketConfig): FidesOriginWebSocket;
}

export interface FidesOriginWebSocket {
  /** WebSocket connection state */
  isConnected(): boolean;

  /** Connect to WebSocket */
  connect(): Promise<void>;

  /** Disconnect from WebSocket */
  disconnect(): void;

  /** Subscribe to events */
  subscribe(eventTypes: WebSocketEventType[]): void;

  /** Unsubscribe from events */
  unsubscribe(eventTypes: WebSocketEventType[]): void;

  /** Register event handler */
  on(event: WebSocketEventType, handler: WebSocketEventHandler): void;

  /** Remove event handler */
  off(event: WebSocketEventType, handler: WebSocketEventHandler): void;
}
