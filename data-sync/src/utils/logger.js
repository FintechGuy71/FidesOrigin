const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * 结构化 JSON 日志系统
 * 支持日志轮转、敏感信息过滤、多级别输出
 *
 * 安全特性：
 * - 消息字符串和元数据双重脱敏（Critical 修复）
 * - 精确密钥模式匹配，避免误报/漏报（High 修复）
 * - 日志注入防护：控制字符/ANSI 转义（High 修复）
 * - 审计日志哈希链：篡改检测（High 修复）
 * - 审计日志外部转发：可选不可变存储（High 修复）
 */

// ==================== 配置校验 ====================
const VALID_LOG_LEVELS = new Set([
  'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly',
]);
const LOG_LEVEL = VALID_LOG_LEVELS.has(process.env.LOG_LEVEL)
  ? process.env.LOG_LEVEL
  : 'info';
const LOG_DIR = path.resolve(
  process.env.LOG_DIR || path.join(process.cwd(), 'logs')
);

// ==================== 敏感字段匹配（精确词边界，避免误报） ====================
// 不再使用 includes('key') 这类过宽匹配，避免 monkey/keyword 等误报
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'mnemonic',
  'authorization', 'cookie', 'credential', 'credentials',
  'apikey', 'api_key', 'privatekey', 'private_key', 'privkey',
  'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
  'idtoken', 'id_token', 'sessionid', 'session_id',
  'authtoken', 'auth_token', 'clientsecret', 'client_secret',
  'seedphrase', 'seed_phrase',
];

// 正则：key 转为 snake_case 后，检查是否包含敏感字段作为独立段
// 例如 apiKey → api_key → 匹配 api_key；monkey → monkey → 不匹配
const SENSITIVE_KEY_REGEX = new RegExp(
  '(?:^|_)(' + SENSITIVE_FIELDS.join('|') + ')(?:$|_)',
  'i'
);

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function isSensitiveKey(key) {
  return SENSITIVE_KEY_REGEX.test(toSnakeCase(key));
}

// ==================== 精确密钥模式（服务前缀/特定格式） ====================
// 不再使用 "32+ 位随机字符串" 启发式规则，避免误杀 UUID/Base58/Merkle Root 等
const SECRET_PATTERNS = [
  { name: 'ETH_PRIVATE_KEY', re: /^0x[a-fA-F0-9]{64}$/ },
  { name: 'JWT', re: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/ },
  { name: 'AWS_ACCESS_KEY', re: /^AKIA[0-9A-Z]{16}$/ },
  { name: 'AWS_SECRET', re: /^[A-Za-z0-9/+=]{40}$/ },
  { name: 'STRIPE_KEY', re: /^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}$/ },
  { name: 'SLACK_TOKEN', re: /^xox[abprs]-[A-Za-z0-9-]{10,}$/ },
  { name: 'GITHUB_PAT', re: /^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}$/ },
  { name: 'GOOGLE_API', re: /^AIza[0-9A-Za-z_-]{35}$/ },
  { name: 'MNEMONIC_12', re: /^([a-z]{3,8}\s){11}[a-z]{3,8}$/i },
  { name: 'MNEMONIC_24', re: /^([a-z]{3,8}\s){23}[a-z]{3,8}$/i },
];

/**
 * 扫描字符串是否匹配已知密钥模式（精确匹配）
 */
function scanSecretExact(str) {
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(str)) return `[${name}_REDACTED]`;
  }
  return null;
}

/**
 * 扫描字符串中的嵌入式密钥（子串匹配，用于 message 字符串）
 */
function scanSecretInText(str) {
  let result = str;
  for (const { name, re } of SECRET_PATTERNS) {
    // 先检查精确匹配
    const exact = scanSecretExact(result);
    if (exact) return exact;
    // 再做全局子串替换
    const globalRe = new RegExp(re.source, 'g');
    result = result.replace(globalRe, `[${name}_REDACTED]`);
  }
  return result;
}

// ==================== 日志注入防护 ====================
/**
 * 转义控制字符和 ANSI 转义序列，防止日志注入
 * 将 \r\n \x1b[2J 等控制字符转为可见的 \uXXXX 表示
 */
function sanitizeForLog(s) {
  if (s === null || s === undefined) return String(s);
  return String(s).replace(
    /[\u0000-\u001F\u007F-\u009F]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

// ==================== 递归脱敏 ====================
/**
 * 递归脱敏对象：敏感字段值替换为 [REDACTED]，字符串值扫描密钥模式
 */
function redactObject(obj, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // 对字符串值进行密钥模式扫描（精确匹配 + 嵌入式扫描）
    return scanSecretInText(obj);
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj === 'function') return '[FUNCTION]';
  if (typeof obj === 'symbol') return '[SYMBOL]';
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) {
    return redactObject(
      { message: obj.message, name: obj.name, stack: obj.stack, code: obj.code },
      depth
    );
  }
  if (obj instanceof RegExp) return obj.toString();
  if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
    return `[Buffer:${obj.length}bytes]`;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (isSensitiveKey(key)) {
        // 敏感字段：直接脱敏
        result[key] = '[REDACTED]';
      } else if (
        (lowerKey === 'merkleroot' || lowerKey === 'merkle_root') &&
        typeof value === 'string'
      ) {
        // Merkle Root 截断显示（保留可辨识的前缀）
        result[key] =
          value.length > 20 ? value.slice(0, 20) + '...' : value;
      } else {
        result[key] = redactObject(value, depth + 1);
      }
    }
    return result;
  }

  return obj;
}

// ==================== 审计日志哈希链（篡改检测） ====================
let auditHashChain = crypto
  .createHash('sha256')
  .update('fidesorigin-audit-genesis')
  .digest('hex');

function computeAuditHash(entry) {
  const data = JSON.stringify(entry) + auditHashChain;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ==================== Logger 创建 ====================
function createLogger(label = 'app') {
  const isProduction = process.env.NODE_ENV === 'production';

  const transports = [
    // 控制台输出（开发环境彩色，生产环境结构化）
    new winston.transports.Console({
      level: LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.colorize({ all: !isProduction }),
        winston.format.printf(
          ({ level, message, timestamp, label: l, ...meta }) => {
            const metaStr =
              Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
            // [High 修复] 对所有用户可控字段进行控制字符转义
            return `${timestamp} [${sanitizeForLog(
              l || label
            )}] ${level}: ${sanitizeForLog(message)}${metaStr}`;
          }
        )
      ),
    }),
  ];

  // 文件输出（生产环境启用）
  if (isProduction || process.env.ENABLE_FILE_LOG === 'true') {
    // 应用日志 - 按天轮转
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '30d',
        level: LOG_LEVEL,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    // 错误日志 - 单独文件
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '60d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    // 审计日志 - 单独文件（保留90天）
    // [High 修复] 部署侧应配合 chattr +a 实现真正的 append-only
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'audit-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '100m',
        maxFiles: '90d',
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );

    // [High 修复] 审计日志外部转发到不可变存储（可选）
    // 配置 AUDIT_SERVER_HOST 后启用，提供 WORM/SIEM 级别的防篡改保障
    if (process.env.AUDIT_SERVER_HOST) {
      transports.push(
        new winston.transports.Http({
          host: process.env.AUDIT_SERVER_HOST,
          port: parseInt(process.env.AUDIT_SERVER_PORT) || 443,
          path: process.env.AUDIT_SERVER_PATH || '/audit/events',
          ssl: process.env.AUDIT_SERVER_SSL !== 'false',
          level: 'info',
          timeout: 5000,  // [Fix] 5秒超时，防止永久挂起
          headers: {
            'Authorization': process.env.AUDIT_SERVER_AUTH || '',  // [Fix] 身份认证
            'Content-Type': 'application/json',
          },
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }
  }

  const logger = winston.createLogger({
    defaultMeta: { label, pid: process.pid, hostname: os.hostname() },
    transports,
    exitOnError: false,
  });

  // [Critical 修复] 包装方法：消息字符串和元数据均脱敏
  const wrap = (level) => (message, meta = {}) => {
    // 对 message 字符串进行脱敏（此前完全绕过）
    let safeMessage;
    if (typeof message === 'string') {
      safeMessage = sanitizeForLog(scanSecretInText(message));
    } else if (message instanceof Error) {
      safeMessage = sanitizeForLog(
        scanSecretInText(message.message || String(message))
      );
    } else {
      safeMessage = sanitizeForLog(String(message));
    }
    const safeMeta = redactObject(meta);
    logger.log(level, safeMessage, safeMeta);
  };

  return {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),

    // [High 修复] 审计日志：带哈希链 + 消息/动作脱敏
    audit: (action, details = {}) => {
      const safeAction = sanitizeForLog(
        scanSecretInText(String(action))
      );
      const safeDetails = redactObject(details);

      // 构建带哈希链的审计条目
      const entry = {
        audit: true,
        action: safeAction,
        details: safeDetails,
        timestamp: new Date().toISOString(),
        prevHash: auditHashChain,
      };
      entry.hash = computeAuditHash(entry);
      auditHashChain = entry.hash;

      logger.log(
        'info',
        sanitizeForLog(`[AUDIT] ${safeAction}`),
        entry
      );
    },

    // 原始 logger（用于高级用法，调用方需自行脱敏）
    raw: logger,
  };
}

// 全局默认 logger
const defaultLogger = createLogger('datasync');

module.exports = {
  createLogger,
  defaultLogger,
  redactObject,
  sanitizeForLog,
};