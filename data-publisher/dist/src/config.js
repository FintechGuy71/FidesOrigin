"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from data-publisher directory
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
function getEnv(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined && defaultValue === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value ?? defaultValue;
}
function getEnvBool(key, defaultValue = false) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
}
function getEnvInt(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed))
        throw new Error(`Invalid integer for ${key}: ${value}`);
    return parsed;
}
exports.config = {
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    dataSources: [
        {
            id: 'ofac-sdn',
            name: 'OFAC SDN List',
            enabled: getEnvBool('OFAC_ENABLED', true),
            endpoint: getEnv('OFAC_ENDPOINT', 'https://www.treasury.gov/ofac/downloads/sdn.xml'),
            apiKey: process.env.OFAC_API_KEY,
            weight: getEnvInt('OFAC_WEIGHT', 1.0),
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
            weight: getEnvInt('CHAINALYSIS_WEIGHT', 1.0),
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
            weight: getEnvInt('OPENSANCTIONS_WEIGHT', 1.0),
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
            weight: getEnvInt('ETHERSCAN_WEIGHT', 0.5),
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
            weight: getEnvInt('ELLIPTIC_WEIGHT', 1.0),
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
            weight: getEnvInt('TRM_LABS_WEIGHT', 1.0),
            timeout: getEnvInt('TRM_LABS_TIMEOUT', 30000),
            retryCount: getEnvInt('TRM_LABS_RETRY', 3),
            refreshInterval: getEnv('TRM_LABS_CRON', '0 */6 * * *'),
        },
        {
            id: 'csv-import',
            name: 'CSV Import',
            enabled: getEnvBool('CSV_ENABLED', false),
            endpoint: getEnv('CSV_PATH', 'file:///app/data/risk-data.csv'),
            weight: getEnvInt('CSV_WEIGHT', 1.0),
            timeout: 60000,
            retryCount: 1,
            refreshInterval: getEnv('CSV_CRON', '0 0 * * *'),
        },
    ],
    publisher: {
        rpcUrl: getEnv('RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
        chainId: getEnvInt('CHAIN_ID', 11155111),
        riskRegistryAddress: getEnv('RISK_REGISTRY_ADDRESS', '0x7ead67622f6A47318a55502634A429eF9dC5cebc'),
        privateKey: process.env.PUBLISHER_PRIVATE_KEY,
        kmsProvider: process.env.KMS_PROVIDER,
        kmsKeyId: process.env.KMS_KEY_ID,
        gasLimit: getEnvInt('GAS_LIMIT', 300000),
        maxFeePerGas: process.env.MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: process.env.MAX_PRIORITY_FEE_PER_GAS,
        batchSize: getEnvInt('BATCH_SIZE', 50),
        txInterval: getEnvInt('TX_INTERVAL_MS', 2000),
        dryRun: getEnvBool('DRY_RUN', false),
        // HashiCorp Vault configuration (optional fallback)
        vault: process.env.VAULT_ADDR ? {
            addr: getEnv('VAULT_ADDR'),
            secretPath: getEnv('VAULT_SECRET_PATH', 'secret/data/fidesorigin'),
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
        instanceId: getEnv('INSTANCE_ID', `instance-${Date.now()}`),
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
        dryRun: getEnvBool('FATF_DRY_RUN', true),
    },
};
// ── Validation ────────────────────────────────────────────────────────
const hasKMS = exports.config.publisher.kmsProvider && exports.config.publisher.kmsKeyId;
const hasVault = exports.config.publisher.kmsProvider === 'vault' && exports.config.publisher.vault;
const hasPlainKey = exports.config.publisher.privateKey;
if (!hasPlainKey && !hasKMS && !hasVault) {
    throw new Error('No key manager configured. Set one of:\n' +
        '  - PUBLISHER_PRIVATE_KEY (dev only)\n' +
        '  - KMS_PROVIDER=aws + KMS_KEY_ID\n' +
        '  - KMS_PROVIDER=vault + VAULT_ADDR + VAULT_SECRET_PATH + VAULT_KEY_NAME');
}
if (exports.config.env === 'production' && hasPlainKey && !hasKMS && !hasVault) {
    throw new Error('SECURITY VIOLATION: Production environment detected with plaintext private key. ' +
        'Plaintext keys are NOT allowed in production. ' +
        'Configure AWS KMS (KMS_PROVIDER=aws + KMS_KEY_ID) or HashiCorp Vault (KMS_PROVIDER=vault).');
}
if (exports.config.publisher.dryRun) {
    console.warn('⚠️ DRY RUN MODE: No transactions will be sent to the blockchain');
}
//# sourceMappingURL=config.js.map