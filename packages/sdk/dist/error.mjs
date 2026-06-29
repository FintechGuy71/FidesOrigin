/**
 * FidesOrigin SDK Error Class
 * Standardized error handling with error codes and context
 */
/** Error code to HTTP status mapping */
export const ERROR_STATUS_MAP = {
    INVALID_ADDRESS: 400,
    INVALID_CHAIN_ID: 400,
    INVALID_AMOUNT: 400,
    NETWORK_ERROR: 0,
    API_ERROR: 500,
    RATE_LIMITED: 429,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    SERVER_ERROR: 500,
    TIMEOUT: 408,
    UNKNOWN: 500,
};
/**
 * FidesOriginError - Standardized error class for SDK operations
 *
 * Provides structured error information including error codes, messages,
 * and context for debugging. All SDK methods throw this error type.
 *
 * @example
 * ```ts
 * try {
 *   await client.checkAddress('invalid');
 * } catch (error) {
 *   if (error instanceof FidesOriginError) {
 *     console.log(error.code); // 'INVALID_ADDRESS'
 *     console.log(error.status); // 400
 *   }
 * }
 * ```
 */
export class FidesOriginError extends Error {
    /** Error code for programmatic handling */
    code;
    /** HTTP status code (if applicable) */
    status;
    /** Request ID for tracking */
    requestId;
    /** Error context for debugging */
    context;
    /** Original error (if wrapped) */
    cause;
    constructor(message, code = 'UNKNOWN', options) {
        super(message);
        this.name = 'FidesOriginError';
        this.code = code;
        this.status = ERROR_STATUS_MAP[code] || 500;
        this.requestId = options?.requestId;
        this.cause = options?.cause;
        this.context = options?.context
            ? {
                ...options.context,
                timestamp: options.context.timestamp || new Date().toISOString(),
            }
            : undefined;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FidesOriginError);
        }
    }
    /**
     * Create error from API response
     */
    static fromAPIResponse(response, context) {
        const code = response.code || 'API_ERROR';
        return new FidesOriginError(response.message, code, {
            requestId: response.requestId,
            context,
        });
    }
    /**
     * Create error from network failure
     */
    static fromNetworkError(error, context) {
        return new FidesOriginError(`Network error: ${error.message}`, 'NETWORK_ERROR', { cause: error, context });
    }
    /**
     * Create error from timeout
     */
    static fromTimeout(context) {
        return new FidesOriginError('Request timed out. Please try again.', 'TIMEOUT', { context });
    }
    /**
     * Check if error is retryable
     */
    isRetryable() {
        return ['NETWORK_ERROR', 'RATE_LIMITED', 'SERVER_ERROR', 'TIMEOUT'].includes(this.code);
    }
    /**
     * Get retry delay in milliseconds (with exponential backoff)
     */
    getRetryDelay(attempt, baseDelayMs = 1000, maxDelayMs = 30000) {
        if (!this.isRetryable())
            return 0;
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, maxDelayMs);
    }
    /**
     * Convert to JSON for logging
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            status: this.status,
            requestId: this.requestId,
            context: this.context,
            stack: this.stack,
            cause: this.cause?.message,
        };
    }
}
export default FidesOriginError;
