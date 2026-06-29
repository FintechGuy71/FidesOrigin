export interface RiskProfile {
  address: string;
  riskScore: number;      // 0-100
  tier: RiskTier;
  tags: string[];
  isSanctioned: boolean;
  source: string;
  confidence: number;     // 0-1
  timestamp: number;
}

export enum RiskTier {
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
  timeout: number;        // ms
  retryCount: number;
  refreshInterval: string; // cron expression
}

export interface PublisherConfig {
  rpcUrl: string;
  chainId: number;
  riskRegistryAddress: string;
  privateKey?: string;    // Optional: use env or KMS
  kmsProvider?: 'aws' | 'azure' | 'vault';
  kmsKeyId?: string;
  awsRegion?: string;     // [P2-fix] AWS region for data-sync compatibility
  vault?: VaultConfig;
  gasLimit: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  batchSize: number;
  txInterval: number;     // ms between transactions
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
  status: 'running' | 'completed' | 'failed' | 'skipped';
}
