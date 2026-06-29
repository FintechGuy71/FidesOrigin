/**
 * FidesOrigin SDK - Type Definitions
 *
 * Complete type definitions for the FidesOrigin risk assessment platform
 */
/** Supported blockchain chains */
export type Chain = 'ethereum' | 'bitcoin' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'base' | 'solana';
/** Risk severity levels */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
/** Address classification types */
export type AddressType = 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';
/** Rule status values */
export type RuleStatus = 'active' | 'inactive' | 'draft';
/** Rule comparison operators */
export type RuleOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
/** WebSocket event types */
export type WebSocketEventType = 'risk.update' | 'alert.new' | 'rule.match' | 'connection.established' | 'connection.closed' | 'error';
/** SDK Client configuration */
export interface FidesOriginConfig {
    /** API base URL */
    baseUrl: string;
    /** API key for authentication */
    apiKey?: string;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Enable debug logging */
    debug?: boolean;
    /** Custom headers */
    headers?: Record<string, string>;
}
/** Generic API response wrapper */
export interface ApiResponse<T> {
    /** Response data */
    data: T;
    /** Response status */
    status: number;
    /** Response message */
    message?: string;
}
/** API error structure */
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
/** Risk flag details */
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
/** Risk score details */
export interface RiskScore {
    /** Overall risk score (0-100) */
    score: number;
    /** Risk level */
    level: RiskLevel;
    /** Confidence level (0-1) */
    confidence: number;
}
/** Complete address risk assessment */
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
/** Entity information */
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
/** Transaction statistics */
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
/** Options for single address risk check */
export interface RiskCheckOptions {
    /** Blockchain chain */
    chain?: Chain;
    /** Include detailed entity information */
    includeEntities?: boolean;
    /** Include transaction statistics */
    includeStats?: boolean;
}
/** Batch risk check request */
export interface BatchRiskCheckRequest {
    /** Addresses to check */
    addresses: string[];
    /** Blockchain chain */
    chain?: Chain;
    /** Include detailed information */
    detailed?: boolean;
}
/** Batch risk check response */
export interface BatchRiskCheckResponse {
    /** Address risk results */
    results: AddressRisk[];
    /** Failed addresses */
    failed?: string[];
}
/** Rule condition definition */
export interface RuleCondition {
    /** Field to evaluate */
    field: string;
    /** Comparison operator */
    operator: RuleOperator;
    /** Value to compare against */
    value: unknown;
}
/** Rule action definition */
export interface RuleAction {
    /** Action type */
    type: 'flag' | 'block' | 'review' | 'allow';
    /** Action parameters */
    params?: Record<string, unknown>;
}
/** Compliance rule */
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
/** Create rule request */
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
/** Update rule request */
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
/** Rule list options */
export interface RuleListOptions {
    /** Filter by status */
    status?: RuleStatus;
    /** Page number (1-based) */
    page?: number;
    /** Items per page */
    limit?: number;
}
/** Rule list response */
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
/** WebSocket message structure */
export interface WebSocketMessage {
    /** Event type */
    event: WebSocketEventType;
    /** Message payload */
    data: unknown;
    /** Timestamp */
    timestamp: string;
}
/** Risk update event payload */
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
/** Alert event payload */
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
/** Rule match event payload */
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
/** WebSocket event handler type */
export type WebSocketEventHandler = (message: WebSocketMessage) => void;
/** WebSocket connection options */
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
/** React hook options for useRiskCheck */
export interface UseRiskCheckOptions {
    /** API client instance */
    client: FidesOriginClient;
    /** Polling interval in milliseconds (0 to disable) */
    pollInterval?: number;
    /** Enable on mount */
    enabled?: boolean;
}
/** React hook state for useRiskCheck */
export interface UseRiskCheckState {
    /** Loading state */
    loading: boolean;
    /** Error state */
    error: ApiError | null;
    /** Risk assessment result */
    data: AddressRisk | null;
}
/** React hook return type for useRiskCheck */
export interface UseRiskCheckReturn extends UseRiskCheckState {
    /** Manually refresh risk data */
    refetch: () => Promise<void>;
    /** Clear cached data */
    clear: () => void;
}
/** FidesOriginClient interface */
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
/** FidesOriginWebSocket interface */
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
