/**
 * FidesOrigin SDK Error Class
 * Standardized error handling with error codes and context
 */

import type { APIErrorResponse } from '@fidesorigin/shared';

/** Error codes for SDK operations */
export type ErrorCode =
  | 'INVALID_ADDRESS'
  | 'INVALID_CHAIN_ID'
  | 'INVALID_AMOUNT'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN'
  | 'BAD_REQUEST';

/** Error code to HTTP status mapping */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
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
  BAD_REQUEST: 400,
};

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
export class FidesOriginError extends Error {
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

  constructor(
    message: string,
    code: ErrorCode = 'UNKNOWN',
    options?: {
      requestId?: string;
      context?: Partial<ErrorContext>;
      cause?: Error;
    }
  ) {
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
  static fromAPIResponse(response: APIErrorResponse, context?: Partial<ErrorContext>): FidesOriginError {
    const code = (response.code as ErrorCode) || 'API_ERROR';
    return new FidesOriginError(response.message, code, {
      requestId: response.requestId,
      context,
    });
  }

  /**
   * Create error from network failure
   */
  static fromNetworkError(error: Error, context?: Partial<ErrorContext>): FidesOriginError {
    return new FidesOriginError(
      `Network error: ${error.message}`,
      'NETWORK_ERROR',
      { cause: error, context }
    );
  }

  /**
   * Create error from timeout
   */
  static fromTimeout(context?: Partial<ErrorContext>): FidesOriginError {
    return new FidesOriginError(
      'Request timed out. Please try again.',
      'TIMEOUT',
      { context }
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return ['NETWORK_ERROR', 'RATE_LIMITED', 'SERVER_ERROR', 'TIMEOUT'].includes(this.code);
  }

  /**
   * Get retry delay in milliseconds (with exponential backoff)
   */
  getRetryDelay(attempt: number, baseDelayMs: number = 1000, maxDelayMs: number = 30000): number {
    if (!this.isRetryable()) return 0;
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelayMs);
  }

  /**
   * Convert to JSON for logging (safe version — no stack or context)
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      requestId: this.requestId,
    };
  }

  /**
   * Convert to JSON for debugging (includes stack and context — use with caution)
   */
  toDebugJSON(): Record<string, unknown> {
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
