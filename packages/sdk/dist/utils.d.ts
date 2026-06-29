/**
 * FidesOrigin SDK Utilities
 * Address validation, formatting, and helper functions
 */
import type { Chain } from '@fidesorigin/shared';
/**
 * Validate a blockchain address for a specific chain
 *
 * @param address - The address to validate
 * @param chain - The blockchain network
 * @returns True if the address is valid for the given chain
 *
 * @example
 * ```ts
 * isAddress('0x742d35Cc6634C0532925a3b8D4C9db96590f6C7E', 'ethereum'); // true
 * isAddress('invalid', 'ethereum'); // false
 * ```
 */
export declare function isAddress(address: string, chain: Chain): boolean;
/**
 * Validate an address and throw if invalid
 *
 * @param address - The address to validate
 * @param chain - The blockchain network
 * @throws {FidesOriginError} If the address is invalid
 */
export declare function validateAddress(address: string, chain: Chain): void;
/**
 * Format an address for display (truncate with ellipsis)
 *
 * @param address - The full address
 * @param options - Formatting options
 * @returns Formatted address string
 *
 * @example
 * ```ts
 * formatAddress('0x742d35Cc6634C0532925a3b8D4C9db96590f6C7E');
 * // '0x742d...6C7E'
 *
 * formatAddress('0x742d35Cc6634C0532925a3b8D4C9db96590f6C7E', { prefix: 8, suffix: 8 });
 * // '0x742d35Cc...b96590f6C7E'
 * ```
 */
export declare function formatAddress(address: string, options?: {
    prefix?: number;
    suffix?: number;
    lowerCase?: boolean;
}): string;
/**
 * Normalize an address (lowercase for EVM, preserve for others)
 *
 * @param address - The address to normalize
 * @param chain - The blockchain network
 * @returns Normalized address
 */
export declare function normalizeAddress(address: string, chain: Chain): string;
/**
 * Get explorer URL for an address
 *
 * @param address - The blockchain address
 * @param chain - The blockchain network
 * @returns Explorer URL or null if not available
 */
export declare function getExplorerUrl(address: string, chain: Chain): string | null;
/**
 * Calculate exponential backoff delay
 *
 * @param attempt - Retry attempt number (0-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export declare function calculateBackoff(attempt: number, baseDelayMs?: number, maxDelayMs?: number): number;
/**
 * Sleep for a given duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Generate a unique request ID
 *
 * @returns Unique request ID string
 */
export declare function generateRequestId(): string;
/**
 * Deep merge two objects
 *
 * @param target - Target object
 * @param source - Source object to merge
 * @returns Merged object
 */
export declare function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T;
/**
 * Sanitize API key for logging (show only first/last 4 chars)
 *
 * @param apiKey - The API key to sanitize
 * @returns Sanitized API key string
 */
export declare function sanitizeApiKey(apiKey: string): string;
