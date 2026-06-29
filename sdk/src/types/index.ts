/**
 * FidesOrigin SDK Type Definitions
 */

// ============================================================================
// New SDK Client Types (Phase 4)
// ============================================================================

export interface RiskCheckInput {
  /** Ethereum address to check */
  address: string;
  /** Optional chain ID (defaults to Ethereum mainnet: 1) */
  chainId?: number | string;
}

export interface BatchRiskCheckInput {
  /** Array of Ethereum addresses to check */
  addresses: string[];
  /** Optional chain ID for all addresses */
  chainId?: number | string;
}

export interface RiskCheckResult {
  /** Risk score (0-100) */
  riskScore?: number;
  score?: number;
  /** Risk level */
  riskLevel?: string;
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

export interface DashboardStats {
  /** Transactions blocked today */
  todayBlocked: number;
  /** Change percentage from yesterday */
  todayBlockedChange: number;
  /** Total risk addresses detected */
  riskAddresses: number;
  /** Change percentage */
  riskAddressesChange: number;
  /** Compliance rate percentage */
  complianceRate: number;
  /** Compliance rate change */
  complianceRateChange: number;
  /** Total monitored transactions */
  monitoredTransactions: number;
  /** Monitored transactions change */
  monitoredTransactionsChange: number;
}

export interface ComplianceRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Risk threshold (0-100) */
  threshold: number;
  /** Action to take when triggered */
  action: 'flag' | 'block' | 'review';
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

// ============================================================================
// Core Types
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
// Risk Assessment Types
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

export interface RiskFlag {
  /** Flag identifier */
  id: string;
  /** Flag name */
  name: string;
  /** Flag category */
  category: string;
  /** Risk severity */
  severity: RiskLevel;
  /** Flag description */
  description: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
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

export interface BatchRiskCheckRequest {
  /** Addresses to check */
  addresses: string[];
  /** Blockchain chain */
  chain?: Chain;
  /** Include detailed information */
  detailed?: boolean;
}

export interface BatchRiskCheckResponse {
  /** Address risk results */
  results: AddressRisk[];
  /** Failed addresses */
  failed?: string[];
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

export interface AlertEvent {
  /** Alert identifier */
  id: string;
  /** Alert type */
  type: string;
  /** Alert severity */
  severity: RiskLevel;
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Related addresses */
  addresses?: string[];
  /** Alert timestamp */
  createdAt: string;
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

// ============================================================================
// React Hook Types
// ============================================================================

export interface UseRiskCheckOptions {
  /** API client instance */
  client: FidesOriginClient;
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
// Client Interface
// ============================================================================

export interface FidesOriginClient {
  /** Client configuration */
  readonly config: FidesOriginConfig;
  
  /** Check single address risk */
  checkAddress(address: string, options?: RiskCheckOptions): Promise<AddressRisk>;
  
  /** Check multiple addresses */
  checkBatchAddresses(request: BatchRiskCheckRequest): Promise<BatchRiskCheckResponse>;
  
  /** List rules */
  listRules(options?: RuleListOptions): Promise<RuleListResponse>;
  
  /** Get rule by ID */
  getRule(ruleId: string): Promise<Rule>;
  
  /** Create new rule */
  createRule(request: CreateRuleRequest): Promise<Rule>;
  
  /** Update rule */
  updateRule(ruleId: string, request: UpdateRuleRequest): Promise<Rule>;
  
  /** Delete rule */
  deleteRule(ruleId: string): Promise<void>;
  
  /** Create WebSocket connection */
  createWebSocket(options?: WebSocketOptions): FidesOriginWebSocket;
}

export interface FidesOriginWebSocket {
  /** WebSocket connection state */
  readonly isConnected: boolean;
  
  /** Connect to WebSocket */
  connect(): void;
  
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
