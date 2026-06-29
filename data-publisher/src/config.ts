import { AppConfig, PublisherConfig, DataSourceConfig, ClusterConfig, VaultConfig } from './types';

/** FATF-specific configuration */
export interface FATFConfig {
  enabled: boolean;
  cron: string;
  blacklistUrl: string;
  greylistUrl: string;
  useFallback: boolean;
  ofacTimeout: number;
  /** Separate RiskRegistry proxy used by the FATF oracle (may differ from main publisher). */
  riskRegistryAddress: string;
  /** Private key for the FATF oracle account (ORACLE_ROLE deployer). */
  oraclePrivateKey?: string;
  /** Gas limit for FATF publish transactions. */
  gasLimit: number;
  /** Dry-run mode for the FATF pipeline. */
  dryRun: boolean;
}

import dotenv from 'dotenv';
import path from 'path';

// [Fix] __dirname may not be available in ESM/bundled environments
const getDirname = (): string => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return process.cwd();
};

// Load .env from data-publisher directory
dotenv.config({ path: path.join(getDirname(), '../.env') });

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? defaultValue!;
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer for ${key}: ${value}`);
  return parsed;
}

export const config: AppConfig & { fatf: FATFConfig; publisher: PublisherConfig } = {
  env: (process.env.NODE_ENV as any) || 'development',
  logLevel: (process.env.LOG_LEVEL as any) || 'info',

  dataSources: [
    {
      id: 'ofac-sdn',
      name: 'OFAC SDN List',
      enabled: getEnvBool('OFAC_ENABLED', true),
      endpoint: getEnv('OFAC_ENDPOINT', 'https://www.treasury.gov/ofac/downloads/sdn.xml'),
      apiKey: process.env.OFAC_API_KEY,
      weight: getEnvInt('OFAC_WEIGHT', 1),
      timeout: getEnvInt('OFAC_TIMEOUT', 30000),
      retryCount: getEnvInt('OFAC_RETRY', 3),
      refreshInterval: getEnv('OFAC_CRON', '0 0 * * *'),
    },
    {
      id: 'chainalysis',
      name: 'Chainalysis API',
      enabled: getEnvBool('CHAINALYSIS_ENABLED', false),
      endpoint: getEnv('CHAINALYSIS_ENDPOINT', 'https://api.chainalysis.com/api/v1/'),
      apiKey: process.env.CHAINALYSIS_API_KEY,
      weight: getEnvInt('CHAINALYSIS_WEIGHT', 1),
      timeout: getEnvInt('CHAINALYSIS_TIMEOUT', 30000),
      retryCount: getEnvInt('CHAINALYSIS_RETRY', 3),
      refreshInterval: getEnv('CHAINALYSIS_CRON', '0 */6 * * *'),
    },
    {
      id: 'opensanctions',
      name: 'OpenSanctions',
      enabled: getEnvBool('OPENSANCTIONS_ENABLED', true),
      endpoint: getEnv('OPENSANCTIONS_ENDPOINT', 'https://api.opensanctions.org/'),
      apiKey: process.env.OPENSANCTIONS_API_KEY,
      weight: getEnvInt('OPENSANCTIONS_WEIGHT', 1),
      timeout: getEnvInt('OPENSANCTIONS_TIMEOUT', 30000),
      retryCount: getEnvInt('OPENSANCTIONS_RETRY', 3),
      refreshInterval: getEnv('OPENSANCTIONS_CRON', '0 0 * * *'),
    },
    {
      id: 'etherscan',
      name: 'Etherscan Labels',
      enabled: getEnvBool('ETHERSCAN_ENABLED', false),
      endpoint: getEnv('ETHERSCAN_ENDPOINT', 'https://api.etherscan.io/api'),
      apiKey: process.env.ETHERSCAN_API_KEY,
      weight: getEnvInt('ETHERSCAN_WEIGHT', 1),
      timeout: getEnvInt('ETHERSCAN_TIMEOUT', 30000),
      retryCount: getEnvInt('ETHERSCAN_RETRY', 3),
      refreshInterval: getEnv('ETHERSCAN_CRON', '0 0 * * 0'),
    },
    {
      id: 'elliptic',
      name: 'Elliptic API',
      enabled: getEnvBool('ELLIPTIC_ENABLED', false),
      endpoint: getEnv('ELLIPTIC_ENDPOINT', 'https://api.elliptic.co/'),
      apiKey: process.env.ELLIPTIC_API_KEY,
      weight: getEnvInt('ELLIPTIC_WEIGHT', 1),
      timeout: getEnvInt('ELLIPTIC_TIMEOUT', 30000),
      retryCount: getEnvInt('ELLIPTIC_RETRY', 3),
      refreshInterval: getEnv('ELLIPTIC_CRON', '0 */6 * * *'),
    },
    {
      id: 'trm-labs',
      name: 'TRM Labs API',
      enabled: getEnvBool('TRM_LABS_ENABLED', false),
      endpoint: getEnv('TRM_LABS_ENDPOINT', 'https://api.trmlabs.com/'),
      apiKey: process.env.TRM_LABS_API_KEY,
      weight: getEnvInt('TRM_LABS_WEIGHT', 1),
      timeout: getEnvInt('TRM_LABS_TIMEOUT', 30000),
      retryCount: getEnvInt('TRM_LABS_RETRY', 3),
      refreshInterval: getEnv('TRM_LABS_CRON', '0 */6 * * *'),
    },
    {
      id: 'csv-import',
      name: 'CSV Import',
      enabled: getEnvBool('CSV_ENABLED', false),
      endpoint: getEnv('CSV_PATH', 'file:///app/data/risk-data.csv'),
      weight: getEnvInt('CSV_WEIGHT', 1),
      timeout: 60000,
      retryCount: 1,
      refreshInterval: getEnv('CSV_CRON', '0 0 * * *'),
    },
  ],

  // [P2-fix] Unified key management: support both data-publisher and data-sync env var names
  publisher: {
    rpcUrl: getEnv('RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
    chainId: getEnvInt('CHAIN_ID', 11155111),
    riskRegistryAddress: getEnv('RISK_REGISTRY_ADDRESS', '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'),
    // Support both data-publisher (PUBLISHER_PRIVATE_KEY) and data-sync (PRIVATE_KEY / SYNC_PRIVATE_KEY) naming
    privateKey: process.env.PUBLISHER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.SYNC_PRIVATE_KEY,
    // Support both data-publisher (KMS_PROVIDER + KMS_KEY_ID) and data-sync (AWS_KMS_KEY_ID) naming
    kmsProvider: (process.env.KMS_PROVIDER as any) ||
                 (process.env.AWS_KMS_KEY_ID ? 'aws' : undefined) ||
                 (process.env.AZURE_KEY_VAULT_NAME ? 'azure' : undefined),
    kmsKeyId: process.env.KMS_KEY_ID || process.env.AWS_KMS_KEY_ID || undefined,
    // AWS region (data-sync style env var)
    awsRegion: process.env.AWS_REGION,
    gasLimit: getEnvInt('GAS_LIMIT', 300000),
    maxFeePerGas: process.env.MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: process.env.MAX_PRIORITY_FEE_PER_GAS,
    batchSize: getEnvInt('BATCH_SIZE', 50),
    txInterval: getEnvInt('TX_INTERVAL_MS', 2000),
    dryRun: getEnvBool('DRY_RUN', false),

    // HashiCorp Vault configuration — support both naming conventions
    vault: process.env.VAULT_ADDR ? {
      addr: getEnv('VAULT_ADDR'),
      secretPath: getEnv('VAULT_SECRET_PATH', process.env.VAULT_KEY_PATH || 'secret/data/fidesorigin'),
      keyName: getEnv('VAULT_KEY_NAME', 'privateKey'),
      token: process.env.VAULT_TOKEN,
    } : undefined,
  },

  monitor: {
    enabled: getEnvBool('MONITOR_ENABLED', true),
    port: getEnvInt('MONITOR_PORT', 9090),
    metricsPath: getEnv('MONITOR_METRICS_PATH', '/metrics'),
    healthPath: getEnv('MONITOR_HEALTH_PATH', '/health'),
    alertWebhook: process.env.ALERT_WEBHOOK_URL,
  },

  scheduler: {
    fullSync: getEnv('FULL_SYNC_CRON', '0 2 * * *'),
    incrementalSync: getEnv('INCREMENTAL_SYNC_CRON', '0 */4 * * *'),
  },

  cluster: {
    enabled: getEnvBool('CLUSTER_ENABLED', false),
    redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379'),
    lockPrefix: getEnv('CLUSTER_LOCK_PREFIX', 'fidesorigin:lock'),
    lockTtl: getEnvInt('CLUSTER_LOCK_TTL', 60000),
    instanceId: getEnv('INSTANCE_ID', `instance-${require('os').hostname()}-${process.pid}`),
    heartbeatInterval: getEnvInt('CLUSTER_HEARTBEAT_INTERVAL', 10000),
  },

  fatf: {
    enabled: getEnvBool('FATF_ENABLED', true),
    cron: getEnv('FATF_CRON', '17 3 * * 1'),
    blacklistUrl: getEnv('FATF_BLACKLIST_URL', 'https://www.fatf-gafi.org/content/fatf-gafi/en/publications/High-risk-and-other-monitored-jurisdictions/Call-for-action-february-2026.html'),
    greylistUrl: getEnv('FATF_GREYLIST_URL', 'https://www.fatf-gafi.org/content/fatf-gafi/en/publications/High-risk-and-other-monitored-jurisdictions/increased-monitoring-february-2026.html'),
    useFallback: getEnvBool('FATF_USE_FALLBACK', true),
    ofacTimeout: getEnvInt('OFAC_FETCH_TIMEOUT', 120000),
    riskRegistryAddress: getEnv('FATF_RISK_REGISTRY_ADDRESS', '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'),
    oraclePrivateKey: process.env.FATF_ORACLE_PRIVATE_KEY,
    gasLimit: getEnvInt('FATF_GAS_LIMIT', 300000),
    // D1-AUDIT1-095 fix: default to false (production-safe)
    dryRun: getEnvBool('FATF_DRY_RUN', false),
  },
};

// ── Validation ────────────────────────────────────────────────────────

const hasKMS = config.publisher.kmsProvider && config.publisher.kmsKeyId;
const hasVault = config.publisher.kmsProvider === 'vault' && config.publisher.vault;
const hasPlainKey = config.publisher.privateKey;

if (!hasPlainKey && !hasKMS && !hasVault) {
  throw new Error(
    'No key manager configured. Set one of:\n' +
    '  - PUBLISHER_PRIVATE_KEY (dev only)\n' +
    '  - KMS_PROVIDER=aws + KMS_KEY_ID\n' +
    '  - KMS_PROVIDER=vault + VAULT_ADDR + VAULT_SECRET_PATH + VAULT_KEY_NAME'
  );
}

if (config.env === 'production') {
  const hasPlainKeyAnywhere = config.publisher.privateKey ||
                               config.fatf.oraclePrivateKey ||
                               process.env.ORACLE_PRIVATE_KEY;
  if (hasPlainKeyAnywhere && !hasKMS && !hasVault) {
    throw new Error(
      'SECURITY VIOLATION: Production environment detected with plaintext private key. ' +
      'Plaintext keys are NOT allowed in production. ' +
      'Configure AWS KMS (KMS_PROVIDER=aws + KMS_KEY_ID) or HashiCorp Vault (KMS_PROVIDER=vault).'
    );
  }
}

if (config.publisher.dryRun) {
  console.warn('⚠️ DRY RUN MODE: No transactions will be sent to the blockchain');
}
