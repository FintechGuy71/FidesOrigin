/**
 * @fileoverview FidesOrigin On-Chain SDK
 * 
 * TypeScript SDK for direct smart contract interaction with FidesOrigin protocol.
 * Provides type-safe access to ComplianceEngine, RiskRegistry, PolicyEngine, and RiskOracle.
 * 
 * @example
 * ```typescript
 * import { FidesOriginSDK } from '@fidesorigin/on-chain-sdk';
 * 
 * const sdk = new FidesOriginSDK(addresses, provider);
 * const result = await sdk.validateTransfer(from, to, amount, asset);
 * if (result.decision === Decision.BLOCK) {
 *   console.warn('Transfer blocked:', result.reason);
 * }
 * ```
 */

export { FidesOriginSDK } from './compliance';
export { 
  Decision, 
  RiskTier, 
  OperationType,
  type ContractAddresses,
  type RiskProfile,
  type IssuerPolicy,
  type WalletPolicy,
  type Operation,
  type TransferValidationResult,
  type OperationSimulationResult,
} from './types';

export {
  formatDecision,
  formatRiskTier,
  isBlocked,
  parseRiskProfile,
  getRiskColor,
  getRiskIcon,
  isValidAddress,
  shortenAddress,
  formatAmount,
} from './utils';
