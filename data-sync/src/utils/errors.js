/**
 * 统一错误处理系统
 * 定义标准错误类、错误分类、统一错误响应格式
 */

/**
 * 安全合并辅助函数，防止原型污染
 * 过滤 __proto__ / constructor / prototype 等危险键
 */
function safeMerge(...objs) {
  const safe = {};
  for (const obj of objs) {
    if (!obj || typeof obj !== 'object') continue;
    for (const [key, value] of Object.entries(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      safe[key] = value;
    }
  }
  return safe;
}

class AppError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details; // 内部使用，可包含完整信息
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 安全序列化：屏蔽或隐藏敏感字段，避免 API 密钥/凭据/内部信息泄露
   */
  toJSON() {
    // 过滤敏感字段的实现
    const safeDetails = JSON.parse(
      JSON.stringify(this.details, (key, value) => {
        const lowerKey = (key || '').toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('authorization') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('api_key') ||
          lowerKey.includes('private') ||
          lowerKey.includes('credential') ||
          lowerKey.includes('cookie')
        ) {
          return '[REDACTED]';
        }
        return value;
      })
    );

    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        // 外部响应只暴露安全的 details
        details: safeDetails,
        timestamp: this.timestamp,
      },
    };
  }
}

// 配置错误
class ConfigError extends AppError {
  constructor(message, details = {}) {
    super(message, 'CONFIG_ERROR', 500, safeMerge(details));
  }
}

// 验证错误
class ValidationError extends AppError {
  constructor(message, field, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, safeMerge({ field }, details));
    this.field = field;
  }
}

// 数据库错误
class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(message, 'DATABASE_ERROR', 500, safeMerge(details));
  }
}

// 区块链错误
class BlockchainError extends AppError {
  constructor(message, details = {}) {
    super(message, 'BLOCKCHAIN_ERROR', 500, safeMerge(details));
  }
}

// 网络/外部 API 错误
class ExternalApiError extends AppError {
  constructor(message, source, details = {}) {
    super(message, 'EXTERNAL_API_ERROR', 502, safeMerge({ source }, details));
    this.source = source;
  }
}

// 限流错误
class RateLimitError extends AppError {
  constructor(message, retryAfter = 60, details = {}) {
    super(message, 'RATE_LIMIT_ERROR', 429, safeMerge({ retryAfter }, details));
    this.retryAfter = retryAfter;
  }
}

// 认证/授权错误
class AuthError extends AppError {
  constructor(message, details = {}) {
    super(message, 'AUTH_ERROR', 401, safeMerge(details));
  }
}

// 并发/锁错误
class ConcurrencyError extends AppError {
  constructor(message, details = {}) {
    super(message, 'CONCURRENCY_ERROR', 423, safeMerge(details));
  }
}

// 超时错误
class TimeoutError extends AppError {
  constructor(message, operation, timeoutMs, details = {}) {
    super(
      message,
      'TIMEOUT_ERROR',
      504,
      safeMerge({ operation, timeoutMs }, details)
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * 错误分类与处理策略
 */
const ErrorStrategies = {
  // 可重试错误：指数退避后重试
  RETRIABLE: [
    'DATABASE_ERROR',
    'EXTERNAL_API_ERROR',
    'RATE_LIMIT_ERROR',
    'TIMEOUT_ERROR',
    'CONCURRENCY_ERROR',
  ],

  // 致命错误：立即退出
  FATAL: [
    'CONFIG_ERROR',
    'AUTH_ERROR',
  ],

  // 可忽略错误：记录但继续
  IGNORABLE: [
    'VALIDATION_ERROR',
  ],
};

/**
 * 判断错误是否可重试
 */
function isRetriable(error) {
  if (error instanceof AppError) {
    return ErrorStrategies.RETRIABLE.includes(error.code);
  }

  // 类型安全防御：确保 message 是字符串
  const message =
    error && typeof error.message === 'string'
      ? error.message
      : String(error || '');

  // 兜底：根据常见错误模式判断
  const retriablePatterns = [
    /connection/i,
    /timeout/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /ECONNREFUSED/i,
    /rate.?limit/i,
    /too.?many.?requests/i,
    /temporarily.?unavailable/i,
  ];
  return retriablePatterns.some((p) => p.test(message));
}

/**
 * 判断错误是否致命
 */
function isFatal(error) {
  if (error instanceof AppError) {
    return ErrorStrategies.FATAL.includes(error.code);
  }
  return false;
}

/**
 * 统一错误处理包装器
 */
async function withErrorHandling(operationName, fn, options = {}) {
  // 强制类型安全与边界限制，防止 DoS（如 maxRetries = Number.MAX_VALUE）
  let maxRetries = parseInt(options.maxRetries, 10);
  if (isNaN(maxRetries) || maxRetries < 1) maxRetries = 3;
  if (maxRetries > 10) maxRetries = 10; // 硬上限

  let retryDelay = parseInt(options.retryDelay, 10);
  if (isNaN(retryDelay) || retryDelay < 0) retryDelay = 2000;

  const {
    critical = false,
    logger = null,
    onRetry = null,
    onFatal = null,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (logger) {
        logger.warn(`[${operationName}] 错误 (尝试 ${attempt}/${maxRetries})`, {
          message:
            error && typeof error.message === 'string'
              ? error.message
              : String(error),
          code: (error && error.code) || 'UNKNOWN',
          attempt,
        });
      }

      // 验证错误：不重试，直接抛出
      if (error instanceof ValidationError) throw error;

      // 致命错误：不重试
      if (isFatal(error)) {
        if (logger)
          logger.error(`[${operationName}] 致命错误，停止重试`, {
            error:
              error && typeof error.message === 'string'
                ? error.message
                : String(error),
          });
        if (onFatal) await onFatal(error);
        throw error;
      }

      // 不可重试的错误：直接抛出
      if (!isRetriable(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        if (critical) {
          if (logger)
            logger.error(`[${operationName}] 关键操作最终失败`, {
              error:
                error && typeof error.message === 'string'
                  ? error.message
                  : String(error),
            });
        }
        throw error;
      }

      // 计算退避延迟
      const delay = retryDelay * Math.pow(2, attempt - 1);
      const jitter = delay * 0.3 * (Math.random() * 2 - 1);

      // 设置最大延迟上限（5 分钟），防止 setTimeout 整数溢出和过长的挂起
      const MAX_DELAY = 5 * 60 * 1000;
      let waitMs = Math.max(1000, Math.floor(delay + jitter));
      waitMs = Math.min(waitMs, MAX_DELAY);

      if (onRetry) await onRetry(error, attempt, waitMs);
      await sleep(waitMs);
    }
  }

  // 兜底（理论上不会到达）
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 全局未捕获异常处理器
 * 遵循 Node.js 最佳实践：任何 uncaughtException / unhandledRejection 都是致命的，
 * 记录日志后强制退出，交由进程管理器（PM2 / Docker 等）重启。
 */
function setupGlobalErrorHandlers(logger) {
  process.on('uncaughtException', (err) => {
    const log = logger || console;
    try {
      log.error('[Global] 未捕获异常 (进程即将崩溃并重启)', {
        message: err && err.message,
        stack: err && err.stack,
        type: err && err.constructor && err.constructor.name,
      });
    } catch (_) {
      // 日志失败也不能阻止退出
    }

    // 任何 uncaughtException 都是致命的，必须退出
    // 通过 setImmediate 确保异步日志写入完成后再退出
    setImmediate(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    const log = logger || console;
    try {
      log.error('[Global] 未处理 Promise 拒绝 (进程即将崩溃并重启)', {
        reason:
          reason && reason.message
            ? reason.message
            : String(reason),
        stack: reason && reason.stack,
      });
    } catch (_) {
      // ignore
    }

    // 现代 Node.js 中，未处理的 rejection 也应该导致进程退出
    setImmediate(() => process.exit(1));
  });
}

module.exports = {
  AppError,
  ConfigError,
  ValidationError,
  DatabaseError,
  BlockchainError,
  ExternalApiError,
  RateLimitError,
  AuthError,
  ConcurrencyError,
  TimeoutError,
  ErrorStrategies,
  isRetriable,
  isFatal,
  withErrorHandling,
  setupGlobalErrorHandlers,
  safeMerge,
};