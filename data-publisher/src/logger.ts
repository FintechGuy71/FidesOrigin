import winston from 'winston';
import { config } from './config';

const { combine, timestamp, json, errors } = winston.format;

// Redact sensitive fields from logs — recursively scan nested objects
const redactFormat = winston.format((info: any) => {
  const redacted = deepRedact({ ...info });
  
  // Redact embedded JSON in message strings
  if (redacted.message && typeof redacted.message === 'string') {
    for (const key of sensitiveKeys) {
      const regex = new RegExp(`"${key}":\\s*"[^"]*"`, 'gi');
      redacted.message = redacted.message.replace(regex, `"${key}": "***REDACTED***"`);
    }
  }
  
  return redacted;
});

const sensitiveKeys = ['privateKey', 'apiKey', 'secret', 'password', 'token', 'vaultToken', 'kmsKeyId', 'oraclePrivateKey'];

function deepRedact(obj: any, seen = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (seen.has(obj)) return obj; // circular reference guard
  seen.add(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepRedact(item, seen));
  }
  
  const redacted = { ...obj };
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
      redacted[key] = '***REDACTED***';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = deepRedact(redacted[key], seen);
    }
  }
  return redacted;
}

export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: { 
    service: 'fidesorigin-data-publisher',
    env: config.env,
    version: process.env.npm_package_version || '1.0.0',
  },
  format: combine(
    timestamp(),
    redactFormat(),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: config.env === 'development' 
        ? combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, service, ...rest }: any) => {
              const meta = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
              return `${timestamp} [${level}] ${service}: ${message} ${meta}`;
            })
          )
        : undefined
    }),
    // File transport for production
    ...(config.env === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
      }),
    ] : []),
  ],
  exitOnError: false,
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.Console(),
  ...(config.env === 'production' ? [new winston.transports.File({ filename: 'logs/exceptions.log' })] : [])
);

logger.rejections.handle(
  new winston.transports.Console(),
  ...(config.env === 'production' ? [new winston.transports.File({ filename: 'logs/rejections.log' })] : [])
);

export default logger;
