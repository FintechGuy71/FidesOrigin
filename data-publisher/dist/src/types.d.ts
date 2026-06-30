export interface RiskProfile {
    address: string;
    riskScore: number;
    tier: RiskTier;
    tags: string[];
    isSanctioned: boolean;
    source: string;
    confidence: number;
    timestamp: number;
}
export declare enum RiskTier {
    UNKNOWN = 0,
    LOW = 1,
    MEDIUM = 2,
    HIGH = 3,
    CRITICAL = 4
}
export interface DataSourceConfig {
    id: string;
    name: string;
    enabled: boolean;
    endpoint: string;
    apiKey?: string;
    weight: number;
    timeout: number;
    retryCount: number;
    refreshInterval: string;
}
export interface PublisherConfig {
    rpcUrl: string;
    chainId: number;
    riskRegistryAddress: string;
    privateKey?: string;
    kmsProvider?: 'aws' | 'azure' | 'vault';
    kmsKeyId?: string;
    vault?: VaultConfig;
    gasLimit: number;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    batchSize: number;
    txInterval: number;
    dryRun: boolean;
}
export interface VaultConfig {
    addr: string;
    secretPath: string;
    keyName: string;
    token?: string;
}
export interface MonitorConfig {
    enabled: boolean;
    port: number;
    metricsPath: string;
    healthPath: string;
    alertWebhook?: string;
}
export interface ClusterConfig {
    enabled: boolean;
    redisUrl: string;
    lockPrefix: string;
    lockTtl: number;
    instanceId: string;
    heartbeatInterval: number;
}
export interface AppConfig {
    env: 'development' | 'staging' | 'production';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    dataSources: DataSourceConfig[];
    publisher: PublisherConfig;
    monitor: MonitorConfig;
    scheduler: {
        fullSync: string;
        incrementalSync: string;
    };
    cluster: ClusterConfig;
}
export interface RawRiskData {
    address: string;
    source: string;
    riskScore?: number;
    tier?: RiskTier;
    tags?: string[];
    isSanctioned?: boolean;
    reason?: string;
    confidence?: number;
}
export interface TxResult {
    hash: string;
    status: 'success' | 'failed' | 'pending';
    gasUsed?: bigint;
    blockNumber?: number;
    error?: string;
}
export interface SyncJob {
    id: string;
    type: 'full' | 'incremental';
    startedAt: Date;
    completedAt?: Date;
    addressesProcessed: number;
    addressesUpdated: number;
    errors: string[];
    status: 'running' | 'completed' | 'failed';
}
//# sourceMappingURL=types.d.ts.map