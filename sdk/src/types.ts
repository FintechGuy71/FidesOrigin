/**
 * Risk tier levels based on on-chain risk scoring
 * 0 = UNKNOWN, 1 = LOW, 2 = MEDIUM, 3 = HIGH, 4 = CRITICAL
 */
export type RiskTier = 0 | 1 | 2 | 3 | 4;

/**
 * Network configuration for connecting to FidesOrigin contracts
 */
export interface NetworkConfig {
  /** RPC endpoint URL */
  provider: string;
  /** RiskRegistry proxy contract address */
  riskRegistry: string;
  /** PolicyEngine proxy contract address */
  policyEngine: string;
  /** Chain ID (optional, for verification) */
  chainId?: number;
}

/**
 * Configuration options for FidesClient
 */
export interface FidesClientConfig extends Partial<NetworkConfig> {
  /**
   * Predefined network preset.
   * Use 'sepolia' or 'goerli' for built-in testnet configs.
   * Omit or set to 'custom' when providing full NetworkConfig manually.
   */
  network?: 'sepolia' | 'holesky' | 'goerli' | 'custom';
  /** RPC endpoint URL (required for custom network) */
  provider?: string;
  /** RiskRegistry proxy contract address (required for custom network) */
  riskRegistry?: string;
  /** PolicyEngine proxy contract address (required for custom network) */
  policyEngine?: string;
}

/**
 * Complete risk profile for a blockchain address
 */
export interface RiskProfile {
  /** Numerical risk score (0-100) */
  riskScore: number;
  /** Risk tier classification (0=UNKNOWN, 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL) */
  tier: RiskTier;
  /** Whether the address is flagged as sanctioned */
  sanctioned: boolean;
  /** List of risk tags as bytes32 (hex-encoded, e.g. '0x6f6661632d73646e...') */
  tags: string[];
  /** Timestamp of last profile update (Unix epoch seconds) */
  lastUpdated: number;
}

/**
 * Transaction request parameters for risk evaluation
 */
export interface TransactionRequest {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Transaction amount in wei (bigint) */
  amount: bigint;
  /** Optional token address for ERC-20 transfers; omit for ETH */
  token?: string;
}

/**
 * Result of evaluating a transaction against risk policies
 */
export interface TransactionEvaluation {
  /** Whether the transaction is permitted */
  allowed: boolean;
  /** Computed risk score for this transaction */
  riskScore: number;
  /** Human-readable reason for denial (if allowed is false) */
  reason: string | null;
  /** Additional metadata from policy engine */
  metadata?: Record<string, unknown>;
}
