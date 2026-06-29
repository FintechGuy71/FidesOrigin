import { isAddress, getAddress } from "ethers";
import { FidesOriginError } from "@fidesorigin/sdk";

// ─── Ethereum Address Validation ───────────────────────────────────────────

/**
 * Validates that a string is a properly formatted Ethereum address.
 * Checks both regex format (0x + 40 hex chars) and EIP-55 checksum.
 *
 * @param address - The address string to validate
 * @returns true if valid, false otherwise
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  return isAddress(address.trim());
}

/**
 * Validates an Ethereum address and returns the checksummed version.
 *
 * @param address - The address to validate
 * @returns Checksummed address (e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f8dEee)
 * @throws {FidesOriginError} with code INVALID_ADDRESS if invalid
 */
export function validateEthereumAddress(address: string): string {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) {
    throw new FidesOriginError(
      `Invalid Ethereum address: ${address}. Must be 0x-prefixed 40-character hex string with valid checksum.`,
      "INVALID_ADDRESS"
    );
  }
  try {
    return getAddress(trimmed);
  } catch {
    throw new FidesOriginError(
      `Failed to compute checksum for address: ${address}`,
      "INVALID_ADDRESS"
    );
  }
}

/**
 * Validates multiple Ethereum addresses in a batch.
 *
 * @param addresses - Array of address strings
 * @returns Array of validated, checksummed addresses
 * @throws {FidesOriginError} if any address is invalid
 */
export function validateEthereumAddresses(addresses: string[]): string[] {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new FidesOriginError(
      "Addresses must be a non-empty array",
      "INVALID_ADDRESS"
    );
  }
  if (addresses.length > 100) {
    throw new FidesOriginError(
      "Batch size cannot exceed 100 addresses",
      "INVALID_ADDRESS"
    );
  }
  return addresses.map(validateEthereumAddress);
}

// ─── Chain ID Validation ─────────────────────────────────────────────────────

/** Known supported chain IDs */
export const SUPPORTED_CHAIN_IDS = [
  1,    // Ethereum Mainnet
  5,    // Goerli
  11155111, // Sepolia
  137,  // Polygon
  80001, // Mumbai
  56,   // BSC
  97,   // BSC Testnet
  42161, // Arbitrum
  10,   // Optimism
  43114, // Avalanche
  250,  // Fantom
] as const;

export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];

/**
 * Validates a chain ID.
 *
 * @param chainId - Chain ID as number or string
 * @param options - Validation options
 * @returns Normalized chain ID number
 * @throws {FidesOriginError} with code INVALID_CHAIN_ID if invalid
 */
export function validateChainId(
  chainId: number | string,
  options: { strict?: boolean } = {}
): number {
  const id = typeof chainId === "string" ? parseInt(chainId, 10) : chainId;

  if (!Number.isInteger(id) || id <= 0 || id > 999999) {
    throw new FidesOriginError(
      `Invalid chain ID: ${chainId}. Must be a positive integer between 1 and 999999.`,
      "INVALID_CHAIN_ID"
    );
  }

  if (options.strict && !SUPPORTED_CHAIN_IDS.includes(id as SupportedChainId)) {
    throw new FidesOriginError(
      `Unsupported chain ID: ${id}. Supported chains: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
      "INVALID_CHAIN_ID"
    );
  }

  return id;
}

/**
 * Checks if a chain ID is supported.
 *
 * @param chainId - Chain ID to check
 * @returns true if supported
 */
export function isSupportedChainId(chainId: number | string): boolean {
  try {
    const id = validateChainId(chainId);
    return SUPPORTED_CHAIN_IDS.includes(id as SupportedChainId);
  } catch {
    return false;
  }
}

// ─── Amount Validation (BigNumber-safe) ────────────────────────────────────

/**
 * Validates an amount string suitable for BigNumber / ethers.js parsing.
 *
 * Rules:
 * - Must be a non-empty string
 * - Must be a non-negative decimal number
 * - No scientific notation
 * - Max 18 decimal places (wei precision)
 *
 * @param amount - Amount string (e.g., "1.5", "1000000000000000000")
 * @returns Sanitized amount string
 * @throws {FidesOriginError} with code INVALID_AMOUNT if invalid
 */
export function validateAmount(amount: string): string {
  if (!amount || typeof amount !== "string") {
    throw new FidesOriginError(
      "Amount must be a non-empty string",
      "INVALID_AMOUNT"
    );
  }

  const trimmed = amount.trim();

  // Reject scientific notation, hex, etc.
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) {
    throw new FidesOriginError(
      `Invalid amount: ${amount}. Must be a non-negative decimal with max 18 decimal places.`,
      "INVALID_AMOUNT"
    );
  }

  // Reject leading zeros (except "0" or "0.xxx")
  if (/^0\d/.test(trimmed)) {
    throw new FidesOriginError(
      `Invalid amount: ${amount}. Leading zeros not allowed (except "0" or "0.xxx").`,
      "INVALID_AMOUNT"
    );
  }

  // Reject empty decimal part (e.g., "1.")
  if (trimmed.endsWith(".")) {
    throw new FidesOriginError(
      `Invalid amount: ${amount}. Trailing decimal point not allowed.`,
      "INVALID_AMOUNT"
    );
  }

  return trimmed;
}

/**
 * Validates an amount in wei (integer string).
 *
 * @param wei - Wei amount string
 * @returns Sanitized wei string
 * @throws {FidesOriginError} with code INVALID_AMOUNT if invalid
 */
export function validateWeiAmount(wei: string): string {
  if (!wei || typeof wei !== "string") {
    throw new FidesOriginError(
      "Wei amount must be a non-empty string",
      "INVALID_AMOUNT"
    );
  }

  const trimmed = wei.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new FidesOriginError(
      `Invalid wei amount: ${wei}. Must be a non-negative integer.`,
      "INVALID_AMOUNT"
    );
  }

  return trimmed;
}

/**
 * Converts an ether amount to wei and validates both.
 *
 * @param ether - Amount in ether (e.g., "1.5")
 * @returns Object with ether and wei representations
 * @throws {FidesOriginError} if invalid
 */
export function parseEtherAmount(ether: string): { ether: string; wei: string } {
  const validatedEther = validateAmount(ether);

  // Simple conversion: split on decimal, pad to 18 places
  const [whole = "0", fraction = "0"] = validatedEther.split(".");
  const paddedFraction = fraction.padEnd(18, "0").slice(0, 18);
  const wei = (BigInt(whole) * BigInt(10 ** 18) + BigInt(paddedFraction)).toString();

  return { ether: validatedEther, wei };
}

// ─── Risk Score Validation ─────────────────────────────────────────────────

/**
 * Validates a risk score (0-100).
 *
 * @param score - Risk score number
 * @returns Validated score
 * @throws {FidesOriginError} if out of range
 */
export function validateRiskScore(score: number): number {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new FidesOriginError(
      `Invalid risk score: ${score}. Must be between 0 and 100.`,
      "INVALID_AMOUNT"
    );
  }
  return score;
}

// ─── Combined Input Validation ─────────────────────────────────────────────

export interface RiskCheckInput {
  address: string;
  chainId?: number | string;
  amount?: string;
}

export interface ValidatedRiskCheckInput {
  address: string;
  chainId?: number;
  amount?: string;
}

/**
 * Validates all fields of a risk check input.
 *
 * @param input - Raw risk check input
 * @returns Validated and normalized input
 * @throws {FidesOriginError} if any field is invalid
 */
export function validateRiskCheckInput(
  input: RiskCheckInput
): ValidatedRiskCheckInput {
  const address = validateEthereumAddress(input.address);
  const chainId = input.chainId !== undefined
    ? validateChainId(input.chainId)
    : undefined;
  const amount = input.amount !== undefined
    ? validateAmount(input.amount)
    : undefined;

  return { address, chainId, amount };
}

// ─── Re-export from SDK for convenience ──────────────────────────────────────

export {
  FidesOriginError,
} from "@fidesorigin/sdk";

export type {
  FidesOriginErrorCode,
} from "@fidesorigin/sdk";
