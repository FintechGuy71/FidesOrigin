"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("./config");
const { combine, timestamp, json, errors } = winston_1.default.format;
// Redact sensitive fields from logs
const redactFormat = winston_1.default.format((info) => {
    const redacted = { ...info };
    const sensitiveKeys = ['privateKey', 'apiKey', 'secret', 'password', 'token'];
    for (const key of sensitiveKeys) {
        if (redacted[key] !== undefined) {
            redacted[key] = '***REDACTED***';
        }
    }
    // Redact nested fields
    if (redacted.message && typeof redacted.message === 'string') {
        for (const key of sensitiveKeys) {
            const regex = new RegExp(`"${key}":\\s*"[^"]*"`, 'gi');
            redacted.message = redacted.message.replace(regex, `"${key}": "***REDACTED***"`);
        }
    }
    return redacted;
});
exports.logger = winston_1.default.createLogger({
    level: config_1.config.logLevel,
    defaultMeta: {
        service: 'fidesorigin-data-publisher',
        env: config_1.config.env,
        version: process.env.npm_package_version || '1.0.0',
    },
    format: combine(timestamp(), redactFormat(), errors({ stack: true }), json()),
    transports: [
        new winston_1.default.transports.Console({
            format: config_1.config.env === 'development'
                ? combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, service, ...rest }) => {
                    const meta = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
                    return `${timestamp} [${level}] ${service}: ${message} ${meta}`;
                }))
                : undefined
        }),
        // File transport for production
        ...(config_1.config.env === 'production' ? [
            new winston_1.default.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
            }),
            new winston_1.default.transports.File({
                filename: 'logs/combined.log',
                maxsize: 50 * 1024 * 1024, // 50MB
                maxFiles: 10,
            }),
        ] : []),
    ],
    exitOnError: false,
});
// Handle uncaught exceptions
exports.logger.exceptions.handle(new winston_1.default.transports.Console(), ...(config_1.config.env === 'production' ? [new winston_1.default.transports.File({ filename: 'logs/exceptions.log' })] : []));
exports.logger.rejections.handle(new winston_1.default.transports.Console(), ...(config_1.config.env === 'production' ? [new winston_1.default.transports.File({ filename: 'logs/rejections.log' })] : []));
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map