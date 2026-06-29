const joi = require('joi');

/**
 * 运行时配置验证 Schema
 * 使用 Joi 进行严格的配置校验
 */

/**
 * [Medium 修复] 统一的数值解析辅助函数
 * 避免 parseInt(x) || default 在 x 为 0 时错误回退到默认值的隐蔽 bug
 */
function parseNumber(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * [Medium 修复] 生产环境断言：禁止使用明文 RPC / 关闭数据库 SSL / 明文私钥
 * 通过 Joi custom 在 schema 层强制阻断，启动即失败
 */
function rejectInProduction(message) {
  return (value, helpers) => {
    if (value !== undefined && value !== null && process.env.NODE_ENV === 'production') {
      return helpers.error('any.invalid', { message });
    }
    return value;
  };
}

const ConfigSchema = joi.object({
  // 数据库配置
  database: joi.object({
    url: joi.string().uri({ scheme: ['postgresql', 'mysql'] }).required()
      .description('数据库连接字符串'),
    useIAM: joi.boolean().default(false)
      .description('是否使用 IAM 认证'),
    // [Medium 修复] 生产环境禁止禁用 SSL
    sslMode: joi.string().valid('require', 'prefer', 'disable').default('require')
      .custom((value, helpers) => {
        if (process.env.NODE_ENV === 'production' && value === 'disable') {
          return helpers.error('any.invalid', { message: '禁止在生产环境禁用数据库 SSL' });
        }
        return value;
      })
      .description('SSL 模式'),
  }).required(),

  // 区块链配置
  blockchain: joi.object({
    // [Medium 修复] 生产环境强制 HTTPS / WSS
    rpcUrl: joi.string().uri({ scheme: ['http', 'https', 'ws', 'wss'] }).required()
      .custom((value, helpers) => {
        if (
          process.env.NODE_ENV === 'production' &&
          !value.startsWith('https') &&
          !value.startsWith('wss')
        ) {
          return helpers.error('any.invalid', { message: '生产环境必须使用 HTTPS 或 WSS 加密 RPC' });
        }
        return value;
      })
      .description('RPC 节点 URL'),
    contractAddress: joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
      .description('RiskRegistry 合约地址'),
    minConfirmations: joi.number().integer().min(1).max(50).default(3)
      .description('最小确认数'),
    maxGasLimit: joi.number().integer().max(10000000).default(5000000)
      .description('单笔交易最大 Gas 限制'),
    maxFeePerGasGwei: joi.number().max(1000).default(100)
      .description('最大基础费用 (gwei)'),
    maxPriorityFeePerGasGwei: joi.number().max(500).default(10)
      .description('最大优先费用'),
  }).required(),

  // 密钥管理
  security: joi.object({
    // [High 修复] 生产环境禁止明文 privateKey
    privateKey: joi.string().pattern(/^0x[a-fA-F0-9]{64}$/)
      .allow('', null)
      .description('开发环境私钥（仅开发）')
      .custom((value, helpers) => {
        if (value && process.env.NODE_ENV === 'production') {
          return helpers.error('any.invalid', { message: '严禁在生产环境配置明文 privateKey' });
        }
        return value;
      }),
    useHSM: joi.boolean().default(false)
      .description('是否使用 HSM/KMS'),
    awsKmsKeyId: joi.string()
      .description('AWS KMS Key ID'),
    awsRegion: joi.string().default('us-east-1')
      .description('AWS 区域'),
    azureVaultName: joi.string()
      .description('Azure Key Vault 名称'),
    azureKeyName: joi.string()
      .description('Azure Key 名称'),
  }).required(),

  // 数据源配置
  sources: joi.object({
    chainalysis: joi.object({
      enabled: joi.boolean().default(true),
      apiKey: joi.string().min(10)
        .description('Chainalysis API Key'),
      // [High 修复] 限制 URL scheme 为 http/https，防止 SSRF / LFI
      baseUrl: joi.string().uri({ scheme: ['http', 'https'] }).default('https://api.chainalysis.com/api/v1'),
      networks: joi.array().items(joi.string()).default(['Ethereum', 'Bitcoin', 'Tron']),
    }).default(),

    ofac: joi.object({
      enabled: joi.boolean().default(true),
      // [High 修复] 限制 URL scheme 为 http/https
      url: joi.string().uri({ scheme: ['http', 'https'] }).default('https://www.treasury.gov/ofac/downloads/sdn.xml'),
      updateInterval: joi.string().default('0 2 * * *'),
    }).default(),

    misttrack: joi.object({
      enabled: joi.boolean().default(false),
      apiKey: joi.string().min(10)
        .description('MistTrack API Key'),
      // [High 修复] 限制 URL scheme 为 http/https
      baseUrl: joi.string().uri({ scheme: ['http', 'https'] }).default('https://api.misttrack.io/v1'),
      dailyLimit: joi.number().integer().max(10000).default(100),
    }).default(),
  }).default(),

  // 聚合配置
  aggregation: joi.object({
    weights: joi.object({
      chainalysis: joi.number().min(0).max(1).default(0.4),
      ofac: joi.number().min(0).max(1).default(0.35),
      misttrack: joi.number().min(0).max(1).default(0.25),
    }).default(),
    highRiskThreshold: joi.number().integer().min(0).max(100).default(70),
    grayRiskThreshold: joi.number().integer().min(0).max(100).default(40),
  }).default(),

  // 高可用配置
  ha: joi.object({
    db: joi.object({
      maxRetries: joi.number().integer().max(50).default(10),
      baseDelayMs: joi.number().integer().max(60000).default(1000),
      maxDelayMs: joi.number().integer().max(300000).default(30000),
      multiplier: joi.number().max(10).default(2),
      jitter: joi.number().min(0).max(1).default(0.3),
    }).default(),
    sync: joi.object({
      maxRetries: joi.number().integer().max(10).default(3),
      baseDelayMs: joi.number().integer().max(60000).default(2000),
      maxDelayMs: joi.number().integer().max(300000).default(30000),
      multiplier: joi.number().max(10).default(2),
    }).default(),
    guardian: joi.object({
      exitOnUncaught: joi.boolean().default(false),
      exitOnUnhandled: joi.boolean().default(false),
      gracefulShutdownTimeoutMs: joi.number().integer().max(120000).default(10000),
    }).default(),
  }).default(),

  // 告警配置
  alerts: joi.object({
    // [High 修复] Slack Webhook 强制为 HTTPS
    slackWebhook: joi.string().uri({ scheme: ['https'] }).allow('').default('')
      .description('Slack Webhook URL'),
    pagerDutyKey: joi.string().allow('').default('')
      .description('PagerDuty Integration Key'),
  }).default(),

  // Redis 配置（可选）
  redis: joi.object({
    url: joi.string().uri({ scheme: ['redis', 'rediss'] }).allow('').default('')
      .description('Redis 连接 URL'),
  }).default(),

  // 日志配置
  logging: joi.object({
    level: joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    // [Info 修复] 简单防止路径穿越 / 指向系统根目录
    dir: joi.string().default('./logs')
      .custom((value, helpers) => {
        if (typeof value !== 'string') return value;
        if (value.includes('..') || value === '/') {
          return helpers.error('string.pattern.base', { message: '无效的日志目录路径' });
        }
        return value;
      }),
    enableFile: joi.boolean().default(false),
  }).default(),
}).required();

/**
 * 从环境变量构建配置对象
 */
function buildConfigFromEnv() {
  return {
    database: {
      url: process.env.DATABASE_URL,
      useIAM: process.env.DATABASE_USE_IAM === 'true',
      sslMode: process.env.DATABASE_SSL_MODE || 'require',
    },
    blockchain: {
      rpcUrl: process.env.RPC_URL,
      contractAddress: process.env.RISK_REGISTRY_CONTRACT,
      // [Medium 修复] 使用 parseNumber 替代 `||`，避免 0 被错误回退
      minConfirmations: parseNumber(process.env.MIN_CONFIRMATIONS, 3),
      maxGasLimit: parseNumber(process.env.MAX_GAS_LIMIT, 5000000),
      maxFeePerGasGwei: parseNumber(process.env.MAX_FEE_PER_GAS_GWEI, 100),
      maxPriorityFeePerGasGwei: parseNumber(process.env.MAX_PRIORITY_FEE_PER_GAS_GWEI, 10),
    },
    security: {
      privateKey: process.env.SYNC_PRIVATE_KEY || process.env.PRIVATE_KEY,
      // [Low 修复] 解耦 NODE_ENV，提供独立环境变量 SECURITY_USE_HSM
      useHSM:
        process.env.SECURITY_USE_HSM === 'true' ||
        (process.env.NODE_ENV === 'production' && !process.env.SYNC_PRIVATE_KEY && !process.env.PRIVATE_KEY),
      awsKmsKeyId: process.env.AWS_KMS_KEY_ID,
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      azureVaultName: process.env.AZURE_KEY_VAULT_NAME,
      azureKeyName: process.env.AZURE_KEY_NAME,
    },
    sources: {
      chainalysis: {
        enabled: process.env.CHAINALYSIS_ENABLED !== 'false',
        apiKey: process.env.CHAINALYSIS_API_KEY,
        baseUrl: process.env.CHAINALYSIS_BASE_URL || 'https://api.chainalysis.com/api/v1',
        networks: (process.env.CHAINALYSIS_NETWORKS || 'Ethereum,Bitcoin,Tron').split(','),
      },
      ofac: {
        enabled: process.env.OFAC_ENABLED !== 'false',
        url: process.env.OFAC_URL || 'https://www.treasury.gov/ofac/downloads/sdn.xml',
        updateInterval: process.env.OFAC_UPDATE_INTERVAL || '0 2 * * *',
      },
      misttrack: {
        enabled: !!process.env.MISTTRACK_API_KEY,
        apiKey: process.env.MISTTRACK_API_KEY,
        baseUrl: process.env.MISTTRACK_BASE_URL || 'https://api.misttrack.io/v1',
        dailyLimit: parseNumber(process.env.MISTTRACK_DAILY_LIMIT, 100),
      },
    },
    aggregation: {
      weights: {
        chainalysis: parseNumber(process.env.WEIGHT_CHAINALYSIS, 0.4),
        ofac: parseNumber(process.env.WEIGHT_OFAC, 0.35),
        misttrack: parseNumber(process.env.WEIGHT_MISTTRACK, 0.25),
      },
      highRiskThreshold: parseNumber(process.env.HIGH_RISK_THRESHOLD, 70),
      grayRiskThreshold: parseNumber(process.env.GRAY_RISK_THRESHOLD, 40),
    },
    ha: {
      db: {
        maxRetries: parseNumber(process.env.DB_MAX_RETRIES, 10),
        baseDelayMs: parseNumber(process.env.DB_BASE_DELAY_MS, 1000),
        maxDelayMs: parseNumber(process.env.DB_MAX_DELAY_MS, 30000),
        multiplier: parseNumber(process.env.DB_MULTIPLIER, 2),
        jitter: parseNumber(process.env.DB_JITTER, 0.3),
      },
      sync: {
        maxRetries: parseNumber(process.env.SYNC_MAX_RETRIES, 3),
        baseDelayMs: parseNumber(process.env.SYNC_BASE_DELAY_MS, 2000),
        maxDelayMs: parseNumber(process.env.SYNC_MAX_DELAY_MS, 30000),
        multiplier: parseNumber(process.env.SYNC_MULTIPLIER, 2),
      },
      guardian: {
        exitOnUncaught: process.env.EXIT_ON_UNCAUGHT === 'true',
        exitOnUnhandled: process.env.EXIT_ON_UNHANDLED === 'true',
        gracefulShutdownTimeoutMs: parseNumber(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS, 10000),
      },
    },
    alerts: {
      slackWebhook: process.env.SLACK_WEBHOOK_URL || '',
      pagerDutyKey: process.env.PAGERDUTY_KEY || '',
    },
    redis: {
      url: process.env.REDIS_URL || '',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      dir: process.env.LOG_DIR || './logs',
      enableFile: process.env.LOG_ENABLE_FILE === 'true',
    },
  };
}

/**
 * 校验并返回最终配置对象
 * @param {object} [envSource] - 可选的自定义环境变量来源（用于测试）
 */
function loadConfig(envSource = process.env) {
  const previousEnv = process.env;
  // 临时替换以便 buildConfigFromEnv 读取传入的 env（测试场景）
  if (envSource !== process.env) {
    process.env = envSource;
  }
  try {
    const rawConfig = buildConfigFromEnv();
    const { error, value } = ConfigSchema.validate(rawConfig, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      throw new Error(`Configuration validation failed: ${messages}`);
    }
    return value;
  } finally {
    if (envSource !== previousEnv) {
      process.env = previousEnv;
    }
  }
}

module.exports = {
  ConfigSchema,
  buildConfigFromEnv,
  loadConfig,
  parseNumber,
};