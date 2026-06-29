/**
 * FidesOrigin SDK Type Definitions
 */
interface FidesOriginConfig {
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
interface ApiResponse<T> {
    /** Response data */
    data: T;
    /** Response status */
    status: number;
    /** Response message */
    message?: string;
}
interface ApiError {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Additional error details */
    details?: Record<string, unknown>;
    /** HTTP status code */
    status?: number;
}
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type AddressType = 'wallet' | 'contract' | 'exchange' | 'mixer' | 'unknown';
type Chain = 'ethereum' | 'bitcoin' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'base' | 'solana';
interface RiskFlag {
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
interface RiskScore {
    /** Overall risk score (0-100) */
    score: number;
    /** Risk level */
    level: RiskLevel;
    /** Confidence level (0-1) */
    confidence: number;
}
interface AddressRisk {
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
interface Entity {
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
interface TransactionStats {
    /** Total transactions */
    totalTransactions: number;
    /** Total volume in USD */
    totalVolume: number;
    /** First transaction timestamp */
    firstTransaction?: string;
    /** Last transaction timestamp */
    lastTransaction?: string;
}
interface RiskCheckOptions {
    /** Blockchain chain */
    chain?: Chain;
    /** Include detailed entity information */
    includeEntities?: boolean;
    /** Include transaction statistics */
    includeStats?: boolean;
}
interface BatchRiskCheckRequest {
    /** Addresses to check */
    addresses: string[];
    /** Blockchain chain */
    chain?: Chain;
    /** Include detailed information */
    detailed?: boolean;
}
interface BatchRiskCheckResponse {
    /** Address risk results */
    results: AddressRisk[];
    /** Failed addresses */
    failed?: string[];
}
type RuleStatus = 'active' | 'inactive' | 'draft';
type RuleOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in';
interface RuleCondition {
    /** Field to evaluate */
    field: string;
    /** Comparison operator */
    operator: RuleOperator;
    /** Value to compare against */
    value: unknown;
}
interface RuleAction {
    /** Action type */
    type: 'flag' | 'block' | 'review' | 'allow';
    /** Action parameters */
    params?: Record<string, unknown>;
}
interface Rule {
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
interface CreateRuleRequest {
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
interface UpdateRuleRequest {
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
interface RuleListOptions {
    /** Filter by status */
    status?: RuleStatus;
    /** Page number (1-based) */
    page?: number;
    /** Items per page */
    limit?: number;
}
interface RuleListResponse {
    /** Rule list */
    rules: Rule[];
    /** Total count */
    total: number;
    /** Current page */
    page: number;
    /** Items per page */
    limit: number;
}
type WebSocketEventType = 'risk.update' | 'alert.new' | 'rule.match' | 'connection.established' | 'connection.closed' | 'error';
interface WebSocketMessage {
    /** Event type */
    event: WebSocketEventType;
    /** Message payload */
    data: unknown;
    /** Timestamp */
    timestamp: string;
}
interface RiskUpdateEvent {
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
interface AlertEvent {
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
interface RuleMatchEvent {
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
type WebSocketEventHandler = (message: WebSocketMessage) => void;
interface WebSocketOptions {
    /** Auto reconnect on disconnect */
    autoReconnect?: boolean;
    /** Reconnect interval in milliseconds */
    reconnectInterval?: number;
    /** Maximum reconnect attempts */
    maxReconnectAttempts?: number;
    /** Subscribe to events on connect */
    subscriptions?: string[];
}
interface UseRiskCheckOptions {
    /** API client instance */
    client: FidesOriginClient$1;
    /** Polling interval in milliseconds (0 to disable) */
    pollInterval?: number;
    /** Enable on mount */
    enabled?: boolean;
}
interface UseRiskCheckState {
    /** Loading state */
    loading: boolean;
    /** Error state */
    error: ApiError | null;
    /** Risk assessment result */
    data: AddressRisk | null;
}
interface UseRiskCheckReturn extends UseRiskCheckState {
    /** Manually refresh risk data */
    refetch: () => Promise<void>;
    /** Clear cached data */
    clear: () => void;
}
interface FidesOriginClient$1 {
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
    createWebSocket(options?: WebSocketOptions): FidesOriginWebSocket$1;
}
interface FidesOriginWebSocket$1 {
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

/**
 * FidesOrigin WebSocket Client
 *
 * Provides real-time updates for risk assessments, alerts, and rule matches
 *
 * @example
 * ```typescript
 * const ws = client.createWebSocket({
 *   autoReconnect: true,
 *   subscriptions: ['risk.update', 'alert.new']
 * });
 *
 * ws.on('risk.update', (message) => {
 *   console.log('Risk updated:', message.data);
 * });
 *
 * ws.connect();
 * ```
 */
declare class FidesOriginWebSocket implements FidesOriginWebSocket$1 {
    private config;
    private options;
    private ws;
    private handlers;
    private reconnectCount;
    private reconnectTimer;
    private _isConnected;
    get isConnected(): boolean;
    constructor(config: FidesOriginConfig, options?: WebSocketOptions);
    /**
     * Connect to WebSocket server
     */
    connect(): void;
    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void;
    /**
     * Subscribe to event types
     */
    subscribe(eventTypes: WebSocketEventType[]): void;
    /**
     * Unsubscribe from event types
     */
    unsubscribe(eventTypes: WebSocketEventType[]): void;
    /**
     * Register event handler
     */
    on(event: WebSocketEventType, handler: WebSocketEventHandler): void;
    /**
     * Remove event handler
     */
    off(event: WebSocketEventType, handler: WebSocketEventHandler): void;
    /**
     * Wait for connection to be established
     */
    waitForConnection(timeout?: number): Promise<void>;
    private handleOpen;
    private handleMessage;
    private handleClose;
    private handleError;
    private send;
    private emit;
    private scheduleReconnect;
    private getWebSocketUrl;
    private log;
}
/**
 * Type guards for WebSocket events
 */
declare function isRiskUpdateEvent(data: unknown): data is RiskUpdateEvent;
declare function isAlertEvent(data: unknown): data is AlertEvent;
declare function isRuleMatchEvent(data: unknown): data is RuleMatchEvent;

/**
 * FidesOrigin API Client
 *
 * Main client for interacting with FidesOrigin risk assessment API
 */
declare class FidesOriginClient implements FidesOriginClient$1 {
    readonly config: FidesOriginConfig;
    private defaultConfig;
    constructor(config: FidesOriginConfig);
    /**
     * Check risk for a single address
     *
     * @example
     * ```typescript
     * const risk = await client.checkAddress('0x123...', { chain: 'ethereum' });
     * console.log(risk.risk.level); // 'low' | 'medium' | 'high' | 'critical'
     * ```
     */
    checkAddress(address: string, options?: RiskCheckOptions): Promise<AddressRisk>;
    /**
     * Check risk for multiple addresses in batch
     *
     * @example
     * ```typescript
     * const result = await client.checkBatchAddresses({
     *   addresses: ['0x123...', '0x456...'],
     *   chain: 'ethereum'
     * });
     * ```
     */
    checkBatchAddresses(request: BatchRiskCheckRequest): Promise<BatchRiskCheckResponse>;
    /**
     * List all rules
     */
    listRules(options?: RuleListOptions): Promise<RuleListResponse>;
    /**
     * Get a specific rule by ID
     */
    getRule(ruleId: string): Promise<Rule>;
    /**
     * Create a new rule
     */
    createRule(request: CreateRuleRequest): Promise<Rule>;
    /**
     * Update an existing rule
     */
    updateRule(ruleId: string, request: UpdateRuleRequest): Promise<Rule>;
    /**
     * Delete a rule
     */
    deleteRule(ruleId: string): Promise<void>;
    /**
     * Create a WebSocket connection for real-time updates
     */
    createWebSocket(options?: WebSocketOptions): FidesOriginWebSocket;
    private request;
    private handleErrorResponse;
    private validateAddress;
    private validateCreateRuleRequest;
    private log;
}
/**
 * FidesOrigin SDK Error Class
 */
declare class FidesOriginError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
    readonly status?: number;
    constructor(message: string, code: string, details?: Record<string, unknown>, status?: number);
    toJSON(): Record<string, unknown>;
}

/**
 * Risk Assessment Helper Functions
 *
 * Provides convenient methods for risk assessment operations
 */
/**
 * Quick risk check - one line integration
 *
 * @example
 * ```typescript
 * import { checkAddress } from '@fidesorigin/sdk';
 *
 * const risk = await checkAddress('0x123...', 'YOUR_API_KEY');
 * console.log(risk.risk.level); // 'low', 'medium', 'high', 'critical'
 * ```
 */
declare function checkAddress(address: string, apiKey: string, options?: RiskCheckOptions & {
    baseUrl?: string;
}): Promise<AddressRisk>;
/**
 * Batch risk check for multiple addresses
 *
 * @example
 * ```typescript
 * import { checkBatchAddresses } from '@fidesorigin/sdk';
 *
 * const result = await checkBatchAddresses(
 *   ['0x123...', '0x456...'],
 *   'YOUR_API_KEY'
 * );
 * ```
 */
declare function checkBatchAddresses(addresses: string[], apiKey: string, options?: {
    baseUrl?: string;
    chain?: Chain;
    detailed?: boolean;
}): Promise<BatchRiskCheckResponse>;
/**
 * Check if an address is considered risky
 *
 * @param riskLevel - The risk level to check
 * @param threshold - The threshold level (default: 'medium')
 * @returns true if risk level is at or above threshold
 *
 * @example
 * ```typescript
 * import { isRisky, checkAddress } from '@fidesorigin/sdk';
 *
 * const risk = await checkAddress('0x123...', 'YOUR_API_KEY');
 * if (isRisky(risk.risk.level, 'medium')) {
 *   console.log('Address is risky!');
 * }
 * ```
 */
declare function isRisky(riskLevel: RiskLevel, threshold?: RiskLevel): boolean;
/**
 * Check if an address is safe (low risk)
 *
 * @param riskLevel - The risk level to check
 * @returns true if risk level is 'low'
 */
declare function isSafe(riskLevel: RiskLevel): boolean;
/**
 * Get risk color for UI display
 *
 * @param riskLevel - The risk level
 * @returns CSS color value
 */
declare function getRiskColor(riskLevel: RiskLevel): string;
/**
 * Get risk label for display
 *
 * @param riskLevel - The risk level
 * @returns Human readable label
 */
declare function getRiskLabel(riskLevel: RiskLevel): string;
/**
 * Filter addresses by risk level
 *
 * @param addresses - Array of address risk assessments
 * @param minRiskLevel - Minimum risk level to include
 * @returns Filtered array of risky addresses
 *
 * @example
 * ```typescript
 * const riskyAddresses = filterByRiskLevel(results, 'high');
 * ```
 */
declare function filterByRiskLevel(addresses: AddressRisk[], minRiskLevel: RiskLevel): AddressRisk[];
/**
 * Sort addresses by risk score (highest first)
 *
 * @param addresses - Array of address risk assessments
 * @returns Sorted array
 */
declare function sortByRiskScore(addresses: AddressRisk[]): AddressRisk[];
/**
 * Get risk statistics for a batch of addresses
 *
 * @param addresses - Array of address risk assessments
 * @returns Statistics object
 */
declare function getRiskStatistics(addresses: AddressRisk[]): {
    total: number;
    byLevel: Record<RiskLevel | 'unknown', number>;
    averageScore: number;
    highestRisk: AddressRisk | null;
};
/**
 * Risk Assessment Class
 *
 * Provides a fluent interface for risk assessment operations
 */
declare class RiskAssessor {
    private client;
    constructor(client: FidesOriginClient);
    /**
     * Check single address risk
     */
    check(address: string, options?: RiskCheckOptions): Promise<AddressRisk>;
    /**
     * Check multiple addresses
     */
    checkBatch(addresses: string[], options?: Omit<BatchRiskCheckRequest, 'addresses'>): Promise<BatchRiskCheckResponse>;
    /**
     * Find high-risk addresses from a list
     */
    findHighRisk(addresses: string[], threshold?: RiskLevel): Promise<AddressRisk[]>;
    /**
     * Validate if all addresses are safe
     */
    validateAllSafe(addresses: string[]): Promise<{
        safe: boolean;
        riskyAddresses: AddressRisk[];
    }>;
}

/**
 * Rules Management Helper Functions
 *
 * Provides convenient methods for managing compliance rules
 */
/**
 * Create a new rule with fluent builder
 *
 * @example
 * ```typescript
 * import { createRuleBuilder } from '@fidesorigin/sdk';
 *
 * const rule = await createRuleBuilder(client)
 *   .name('High Risk Sanctioned Address')
 *   .description('Flag addresses on sanctions list')
 *   .condition('risk.level', 'equals', 'critical')
 *   .condition('flags.category', 'contains', 'sanctions')
 *   .action('flag', { reason: 'Sanctioned entity detected' })
 *   .priority(100)
 *   .build();
 * ```
 */
declare function createRuleBuilder(client: FidesOriginClient): RuleBuilder;
/**
 * Rule Builder Class
 *
 * Fluent API for creating and updating rules
 */
declare class RuleBuilder {
    private client;
    private request;
    constructor(client: FidesOriginClient);
    /**
     * Set rule name
     */
    name(name: string): this;
    /**
     * Set rule description
     */
    description(description: string): this;
    /**
     * Add a condition to the rule
     */
    condition(field: string, operator: RuleCondition['operator'], value: unknown): this;
    /**
     * Add multiple conditions (all must match)
     */
    conditions(conditions: RuleCondition[]): this;
    /**
     * Add an action to the rule
     */
    action(type: RuleAction['type'], params?: Record<string, unknown>): this;
    /**
     * Set actions
     */
    actions(actions: RuleAction[]): this;
    /**
     * Set rule priority
     */
    priority(priority: number): this;
    /**
     * Build and create the rule
     */
    build(): Promise<Rule>;
}
/**
 * Predefined rule templates
 */
declare const RuleTemplates: {
    /**
     * Create a rule to block high-risk addresses
     */
    blockHighRisk(priority?: number): CreateRuleRequest;
    /**
     * Create a rule to flag sanctioned addresses
     */
    flagSanctioned(priority?: number): CreateRuleRequest;
    /**
     * Create a rule for mixer detection
     */
    reviewMixerUsage(priority?: number): CreateRuleRequest;
    /**
     * Create a rule for large volume transactions
     */
    reviewLargeVolume(threshold?: number, priority?: number): CreateRuleRequest;
    /**
     * Create a custom rule for specific risk score threshold
     */
    riskScoreThreshold(minScore: number, action?: "flag" | "block" | "review", priority?: number): CreateRuleRequest;
};
/**
 * Rules Manager Class
 *
 * High-level interface for rule management
 */
declare class RulesManager {
    private client;
    constructor(client: FidesOriginClient);
    /**
     * List all rules with optional filtering
     */
    list(options?: RuleListOptions): Promise<RuleListResponse>;
    /**
     * Get active rules only
     */
    getActive(): Promise<Rule[]>;
    /**
     * Get a rule by ID
     */
    get(ruleId: string): Promise<Rule>;
    /**
     * Create a new rule using the builder
     */
    builder(): RuleBuilder;
    /**
     * Create a rule from a template
     */
    createFromTemplate(template: keyof typeof RuleTemplates, ...args: any[]): Promise<Rule>;
    /**
     * Update a rule
     */
    update(ruleId: string, request: UpdateRuleRequest): Promise<Rule>;
    /**
     * Activate a rule
     */
    activate(ruleId: string): Promise<Rule>;
    /**
     * Deactivate a rule
     */
    deactivate(ruleId: string): Promise<Rule>;
    /**
     * Delete a rule
     */
    delete(ruleId: string): Promise<void>;
    /**
     * Get rules by priority
     */
    getByPriority(minPriority: number): Promise<Rule[]>;
    /**
     * Enable default compliance rules
     */
    enableDefaults(): Promise<Rule[]>;
}

/**
 * React Hook for risk assessment
 *
 * Provides reactive risk checking with polling support
 *
 * @example
 * ```tsx
 * import { useRiskCheck } from '@fidesorigin/sdk/react';
 *
 * function RiskIndicator({ address }: { address: string }) {
 *   const { data, loading, error, refetch } = useRiskCheck(address, {
 *     client,
 *     pollInterval: 30000 // Refresh every 30 seconds
 *   });
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   if (!data) return null;
 *
 *   return (
 *     <div className={`risk-${data.risk.level}`}>
 *       Risk Level: {data.risk.level}
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
declare function useRiskCheck(address: string | null | undefined, options: UseRiskCheckOptions & RiskCheckOptions): UseRiskCheckReturn;
/**
 * React Hook for batch risk assessment
 *
 * @example
 * ```tsx
 * import { useBatchRiskCheck } from '@fidesorigin/sdk/react';
 *
 * function RiskList({ addresses }: { addresses: string[] }) {
 *   const { data, loading, error } = useBatchRiskCheck(addresses, { client });
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {data?.results.map(risk => (
 *         <li key={risk.address}>
 *           {risk.address}: {risk.risk.level}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
declare function useBatchRiskCheck(addresses: string[], options: UseRiskCheckOptions & {
    chain?: Chain;
    detailed?: boolean;
}): {
    loading: boolean;
    error: ApiError | null;
    data: {
        results: AddressRisk[];
        failed: string[];
    } | null;
    refetch: () => Promise<void>;
};
/**
 * React Hook for risk level display
 *
 * Returns human-readable labels and colors for risk levels
 */
declare function useRiskDisplay(): {
    getColor: (level: string) => string;
    getLabel: (level: string) => string;
    getIcon: (level: string) => string;
};

/**
 * FidesOrigin JavaScript/TypeScript SDK
 *
 * Risk assessment and compliance for Web3
 *
 * @example
 * ```typescript
 * import { FidesOriginClient } from '@fidesorigin/sdk';
 *
 * const client = new FidesOriginClient({
 *   baseUrl: 'https://api.fidesorigin.com',
 *   apiKey: 'your-api-key'
 * });
 *
 * // Quick check
 * const risk = await client.checkAddress('0x123...');
 * console.log(risk.risk.level);
 * ```
 *
 * @packageDocumentation
 */

declare const fides: {
    checkAddress: typeof checkAddress;
    checkBatchAddresses: typeof checkBatchAddresses;
};

export { FidesOriginClient, FidesOriginError, FidesOriginWebSocket, RiskAssessor, RuleBuilder, RuleTemplates, RulesManager, checkAddress, checkBatchAddresses, createRuleBuilder, FidesOriginClient as default, fides, filterByRiskLevel, getRiskColor, getRiskLabel, getRiskStatistics, isAlertEvent, isRiskUpdateEvent, isRisky, isRuleMatchEvent, isSafe, sortByRiskScore, useBatchRiskCheck, useRiskCheck, useRiskDisplay };
export type { AddressRisk, AddressType, AlertEvent, ApiError, ApiResponse, BatchRiskCheckRequest, BatchRiskCheckResponse, Chain, CreateRuleRequest, Entity, FidesOriginConfig, RiskCheckOptions, RiskFlag, RiskLevel, RiskScore, RiskUpdateEvent, Rule, RuleAction, RuleCondition, RuleListOptions, RuleListResponse, RuleMatchEvent, RuleOperator, RuleStatus, TransactionStats, UpdateRuleRequest, UseRiskCheckOptions, UseRiskCheckReturn, UseRiskCheckState, WebSocketEventHandler, WebSocketEventType, WebSocketMessage, WebSocketOptions };
