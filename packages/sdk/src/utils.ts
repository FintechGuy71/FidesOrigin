/**
 * FidesOrigin SDK Utilities
 * Address validation, formatting, and helper functions
 */

import type { Chain } from '@fidesorigin/shared';
import { CHAIN_NAMES, ADDRESS_LENGTHS, ADDRESS_PREFIXES } from '@fidesorigin/shared';
import { FidesOriginError } from './error';

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
export function isAddress(address: string, chain: Chain): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const trimmed = address.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const lengths = ADDRESS_LENGTHS[chain];
  const prefixes = ADDRESS_PREFIXES[chain];

  if (!lengths) {
    return false;
  }

  // Check length
  if (trimmed.length < lengths.min || trimmed.length > lengths.max) {
    return false;
  }

  // Check prefix
  if (prefixes && prefixes.length > 0) {
    const hasValidPrefix = prefixes.some((prefix) => trimmed.startsWith(prefix));
    if (!hasValidPrefix) {
      return false;
    }
  }

  // Additional validation for Ethereum-style addresses
  if (chain === 'ethereum' || chain === 'polygon' || chain === 'bsc' || chain === 'arbitrum' || chain === 'optimism' || chain === 'base') {
    // Check hex format
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      return false;
    }
  }

  // Bitcoin address validation
  if (chain === 'bitcoin') {
    // Basic pattern check for common Bitcoin address formats
    const btcPattern = /^(1|3)[a-zA-Z0-9]{25,34}$|^bc1[a-zA-Z0-9]{39,59}$/;
    if (!btcPattern.test(trimmed)) {
      return false;
    }
  }

  // Solana address validation
  if (chain === 'solana') {
    // Base58 encoded, 32-44 characters
    const solPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solPattern.test(trimmed)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate an address and throw if invalid
 *
 * @param address - The address to validate
 * @param chain - The blockchain network
 * @throws {FidesOriginError} If the address is invalid
 */
export function validateAddress(address: string, chain: Chain): void {
  if (!isAddress(address, chain)) {
    throw new FidesOriginError(
      `Invalid ${CHAIN_NAMES[chain]} address: ${address}`,
      'INVALID_ADDRESS',
      {
        context: {
          metadata: { address, chain },
          timestamp: new Date().toISOString(),
        },
      }
    );
  }
}

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
export function formatAddress(
  address: string,
  options: { prefix?: number; suffix?: number; lowerCase?: boolean } = {}
): string {
  const { prefix = 6, suffix = 4, lowerCase = false } = options;

  if (!address || address.length < prefix + suffix + 3) {
    return address || '';
  }

  let formatted = address;
  if (lowerCase) {
    formatted = formatted.toLowerCase();
  }

  const start = formatted.slice(0, prefix);
  const end = formatted.slice(-suffix);

  return `${start}...${end}`;
}

/**
 * Normalize an address (lowercase for EVM, preserve for others)
 *
 * @param address - The address to normalize
 * @param chain - The blockchain network
 * @returns Normalized address
 */
export function normalizeAddress(address: string, chain: Chain): string {
  const trimmed = address.trim();

  // EVM chains: lowercase
  if (
    chain === 'ethereum' ||
    chain === 'polygon' ||
    chain === 'bsc' ||
    chain === 'arbitrum' ||
    chain === 'optimism' ||
    chain === 'base'
  ) {
    return trimmed.toLowerCase();
  }

  // Bitcoin: preserve case
  if (chain === 'bitcoin') {
    return trimmed;
  }

  // Solana: preserve case
  if (chain === 'solana') {
    return trimmed;
  }

  return trimmed;
}

/**
 * Get explorer URL for an address
 *
 * @param address - The blockchain address
 * @param chain - The blockchain network
 * @returns Explorer URL or null if not available
 */
export function getExplorerUrl(address: string, chain: Chain): string | null {
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io',
    bitcoin: 'https://blockchain.info',
    polygon: 'https://polygonscan.com',
    bsc: 'https://bscscan.com',
    arbitrum: 'https://arbiscan.io',
    optimism: 'https://optimistic.etherscan.io',
    base: 'https://basescan.org',
    solana: 'https://solscan.io',
  };

  const base = explorers[chain];
  if (!base) return null;

  if (chain === 'bitcoin') {
    return `${base}/address/${address}`;
  }

  if (chain === 'solana') {
    return `${base}/account/${address}`;
  }

  return `${base}/address/${address}`;
}

/**
 * Calculate exponential backoff delay
 *
 * @param attempt - Retry attempt number (0-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep for a given duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique request ID
 *
 * @returns Unique request ID string
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Deep merge two objects
 *
 * @param target - Target object
 * @param source - Source object to merge
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Sanitize API key for logging (show only first/last 4 chars)
 *
 * @param apiKey - The API key to sanitize
 * @returns Sanitized API key string
 */
export function sanitizeApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '***';
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
