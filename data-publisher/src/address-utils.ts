import { ethers } from 'ethers';

/**
 * Ethereum address validation utilities.
 *
 * All addresses are normalized to lowercase 0x-prefixed 42-char strings.
 * Checksum validation is optional (default: false) for performance —
 * invalid checksums are rejected at the contract level.
 */

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const ETH_ADDRESS_LOWERCASE_REGEX = /^0x[0-9a-f]{40}$/;

/**
 * Validate an Ethereum address format.
 * @param addr Raw address string
 * @param strict If true, also verify EIP-55 checksum
 * @returns true if valid
 */
export function isValidEthAddress(addr: string, strict = false): boolean {
  if (typeof addr !== 'string') return false;
  const trimmed = addr.trim();
  if (!ETH_ADDRESS_REGEX.test(trimmed)) return false;
  if (strict) {
    try {
      return ethers.getAddress(trimmed) === trimmed;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Normalize an address to lowercase 0x format.
 * Returns undefined if the address is invalid.
 */
export function normalizeAddress(addr: string): string | undefined {
  if (typeof addr !== 'string') return undefined;
  const trimmed = addr.trim().toLowerCase();
  if (ETH_ADDRESS_LOWERCASE_REGEX.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}

/**
 * Batch-normalize addresses, filtering out invalid ones.
 */
export function normalizeAddresses(addrs: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const a of addrs) {
    const norm = normalizeAddress(a);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(norm);
    }
  }
  return result;
}

/**
 * Convert a string to a bytes32 hex string compatible with Solidity.
 * Uses ethers.encodeBytes32String for short strings (< 32 bytes),
 * safely truncates longer strings at byte boundaries.
 */
export function stringToBytes32(str: string): string {
  const encoded = ethers.encodeBytes32String(str);
  // If the string is 31 bytes or less, encodeBytes32String returns a valid bytes32
  if (encoded.length === 66) return encoded;

  // String is too long — truncate at byte boundary
  const bytes = Buffer.from(str, 'utf8');
  const truncated = bytes.slice(0, 31);
  return ethers.encodeBytes32String(truncated.toString('utf8'));
}
