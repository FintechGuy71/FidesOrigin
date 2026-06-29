/**
 * FidesOrigin SDK Error Class
 * Standardized error handling with error codes and context
 */
import type { APIErrorResponse } from '@fidesorigin/shared';
/** Error codes for SDK operations */
export type ErrorCode = 'INVALID_ADDRESS' | 'INVALID_CHAIN_ID' | 'INVALID_AMOUNT' | 'NETWORK_ERROR' | 'API_ERROR' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'SERVER_ERROR' | 'TIMEOUT' | 'UNKNOWN';
/** Error code to HTTP status mapping */
export declare const ERROR_STATUS_MAP: Record<ErrorCode, number>;
/** Error context for debugging */
export interface ErrorContext {
    /** Request URL */
    url?: string;
    /** Request method */
    method?: string;
    /** Request body (sanitized) */
    body?: unknown;
    /** Response status */
    status?: number;
    /** Timestamp */
    timestamp: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
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
export declare class FidesOriginError extends Error {
    /** Error code for programmatic handling */
    readonly code: ErrorCode;
    /** HTTP status code (if applicable) */
    readonly status: number;
    /** Request ID for tracking */
    readonly requestId?: string;
    /** Error context for debugging */
    readonly context?: ErrorContext;
    /** Original error (if wrapped) */
    readonly cause?: Error;
    constructor(message: string, code?: ErrorCode, options?: {
        requestId?: string;
        context?: Partial<ErrorContext>;
        cause?: Error;
    });
    /**
     * Create error from API response
     */
    static fromAPIResponse(response: APIErrorResponse, context?: Partial<ErrorContext>): FidesOriginError;
    /**
     * Create error from network failure
     */
    static fromNetworkError(error: Error, context?: Partial<ErrorContext>): FidesOriginError;
    /**
     * Create error from timeout
     */
    static fromTimeout(context?: Partial<ErrorContext>): FidesOriginError;
    /**
     * Check if error is retryable
     */
    isRetryable(): boolean;
    /**
     * Get retry delay in milliseconds (with exponential backoff)
     */
    getRetryDelay(attempt: number, baseDelayMs?: number, maxDelayMs?: number): number;
    /**
     * Convert to JSON for logging
     */
    toJSON(): Record<string, unknown>;
}
export default FidesOriginError;
