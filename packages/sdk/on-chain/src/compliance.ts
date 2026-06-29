import { ethers, Provider, Signer, Contract } from 'ethers';
import {
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
  type ContractRiskInfo,
} from './types';
import {
  ComplianceEngineABI,
  RiskRegistryABI,
  PolicyEngineABI,
  RiskOracleABI,
  CompliantStableCoinABI,
} from './abis';

/**
 * FidesOrigin On-Chain SDK
 * 
 * Provides type-safe interaction with FidesOrigin smart contracts.
 * All view functions are gas-free. Write functions require a signer.
 */
export class FidesOriginSDK {
  private provider: Provider;
  private signer?: Signer;
  
  public complianceEngine: Contract;
  public riskRegistry: Contract;
  public policyEngine: Contract;
  public riskOracle: Contract;

  constructor(addresses: ContractAddresses, provider: Provider, signer?: Signer) {
    this.provider = provider;
    this.signer = signer;

    const contractRunner = signer || provider;

    // [Critical Fix] Validate contract addresses before use — prevent zero-address / phishing
    const validateContractAddress = (addr: string, name: string): string => {
      if (!addr || typeof addr !== 'string') {
        throw new Error(`Missing ${name} address`);
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        throw new Error(`Invalid ${name} address format: ${addr}`);
      }
      const lower = addr.toLowerCase();
      if (lower === '0x0000000000000000000000000000000000000000') {
        throw new Error(`${name} address must not be the zero address`);
      }
      try {
        ethers.getAddress(addr); // validates EIP-55 checksum
      } catch {
        throw new Error(`Invalid EIP-55 checksum for ${name}: ${addr}`);
      }
      return addr;
    };

    this.complianceEngine = new ethers.Contract(
      validateContractAddress(addresses.complianceEngine, 'complianceEngine'),
      ComplianceEngineABI,
      contractRunner
    );
    this.riskRegistry = new ethers.Contract(
      validateContractAddress(addresses.riskRegistry, 'riskRegistry'),
      RiskRegistryABI,
      contractRunner
    );
    this.policyEngine = new ethers.Contract(
      validateContractAddress(addresses.policyEngine, 'policyEngine'),
      PolicyEngineABI,
      contractRunner
    );
    this.riskOracle = new ethers.Contract(
      validateContractAddress(addresses.riskOracle, 'riskOracle'),
      RiskOracleABI,
      contractRunner
    );
  }

  // ============================================================================
  // Risk Profile Queries (Gas-free)
  // ============================================================================

  /**
   * Get full risk profile for an address
   */
  async getRiskProfile(address: string): Promise<RiskProfile> {
    const [riskScore, tier, tags, isSanctioned, lastUpdated] = await this.riskRegistry.getRiskProfile(address);
    return {
      riskScore: Number(riskScore),
      tier: Number(tier) as RiskTier,
      tags: tags.map((t: string) => ethers.decodeBytes32String(t)),
      isSanctioned,
      lastUpdated: new Date(Number(lastUpdated) * 1000),
    };
  }

  /** Check if address is sanctioned */
  async isSanctioned(address: string): Promise<boolean> {
    return this.riskRegistry.isSanctioned(address);
  }

  /** Get risk tier (0=UNKNOWN, 1=LOW, 2=MEDIUM, 3=HIGH) */
  async getRiskTier(address: string): Promise<RiskTier> {
    const tier = await this.riskRegistry.getRiskTier(address);
    return Number(tier) as RiskTier;
  }

  /** Get risk score (0-100) */
  async getRiskScore(address: string): Promise<number> {
    const score = await this.riskRegistry.getRiskScore(address);
    return Number(score);
  }

  /** Check if address has a specific tag */
  async hasTag(address: string, tag: string): Promise<boolean> {
    return this.riskRegistry.hasTag(address, ethers.encodeBytes32String(tag));
  }

  /** Get all tags for an address */
  async getTags(address: string): Promise<string[]> {
    const tags = await this.riskRegistry.getTags(address);
    return tags.map((t: string) => ethers.decodeBytes32String(t));
  }

  /** Get contract risk info from ComplianceEngine (returns string contractType) */
  async getContractRisk(address: string): Promise<ContractRiskInfo> {
    const [verified, riskScore, contractType] = await this.complianceEngine.getContractRisk(address);
    return {
      verified,
      riskScore: Number(riskScore),
      contractType,
    };
  }

  // ============================================================================
  // Transfer Validation (Gas-free)
  // ============================================================================

  /**
   * Validate a transfer through the compliance engine
   * @returns Decision and reason string
   */
  async validateTransfer(
    from: string,
    to: string,
    amount: bigint,
    assetContract: string
  ): Promise<TransferValidationResult> {
    const [decision, reason] = await this.complianceEngine.validateTransfer(from, to, amount, assetContract);
    return {
      wouldSucceed: Number(decision) !== Decision.BLOCK,
      decision: Number(decision) as Decision,
      reason,
    };
  }

  /** Quick check: would transfer succeed? */
  async wouldTransferSucceed(
    from: string,
    to: string,
    amount: bigint,
    assetContract: string
  ): Promise<boolean> {
    const [decision] = await this.complianceEngine.validateTransfer(from, to, amount, assetContract);
    return Number(decision) === Decision.ALLOW;
  }

  // ============================================================================
  // Operation Validation (Gas-free)
  // ============================================================================

  /**
   * Validate a wallet operation
   */
  async simulateOperation(
    walletOwner: string,
    op: Operation,
    wallet: string
  ): Promise<OperationSimulationResult> {
    const [decision, reason] = await this.complianceEngine.validateOperation(
      walletOwner,
      this._toSolidityOp(op),
      wallet
    );
    return {
      wouldSucceed: Number(decision) !== Decision.BLOCK,
      decision: Number(decision) as Decision,
      reason,
      riskScore: 0,
      tier: RiskTier.UNKNOWN,
    };
  }

  /**
   * Analyze operation risk characteristics
   */
  async analyzeOperationRisk(op: Operation): Promise<{ riskScore: number; tier: RiskTier; factors: string }> {
    const [riskScore, tier, factors] = await this.complianceEngine.analyzeOperationRisk(this._toSolidityOp(op));
    return {
      riskScore: Number(riskScore),
      tier: Number(tier) as RiskTier,
      factors,
    };
  }

  // ============================================================================
  // Policy Queries (Gas-free)
  // ============================================================================

  /** Get issuer policy for a specific asset */
  async getIssuerPolicy(issuer: string): Promise<IssuerPolicy> {
    const policy = await this.complianceEngine.getIssuerPolicy(issuer);
    return this._parseIssuerPolicy(policy);
  }

  /** Get daily spent amount for an account on an asset */
  async getDailySpent(account: string, asset: string): Promise<bigint> {
    return this.complianceEngine.getDailySpent(account, asset);
  }

  /** Get default issuer policy */
  async getDefaultIssuerPolicy(): Promise<IssuerPolicy> {
    const policy = await this.policyEngine.defaultIssuerPolicy();
    return this._parseIssuerPolicy(policy);
  }

  // ============================================================================
  // StableCoin Integration Helpers
  // ============================================================================

  /** Get a CompliantStableCoin contract instance */
  getStableCoinContract(address: string): Contract {
    return new ethers.Contract(address, CompliantStableCoinABI, this.signer || this.provider);
  }

  /** Simulate a stablecoin transfer */
  async simulateStableCoinTransfer(
    coinAddress: string,
    from: string,
    to: string,
    amount: bigint
  ): Promise<TransferValidationResult> {
    const coin = this.getStableCoinContract(coinAddress);
    const [wouldSucceed, decision, reason] = await coin.simulateTransfer(from, to, amount);
    return {
      wouldSucceed,
      decision: Number(decision) as Decision,
      reason,
    };
  }

  // ============================================================================
  // Hold Management (Require Signer)
  // ============================================================================

  /** Release held funds by hold ID */
  async releaseHold(holdId: string): Promise<ethers.TransactionReceipt> {
    if (!this.signer) throw new Error('Signer required for write operations');
    if (!/^0x[0-9a-fA-F]{64}$/.test(holdId)) throw new Error('Invalid hold ID');
    const tx = await this.complianceEngine.releaseHold(holdId);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('Transaction failed: releaseHold reverted');
    return receipt;
  }

  /** Get held funds amount for an account on an asset */
  async getHeldFunds(owner: string, asset: string): Promise<bigint> {
    return this.complianceEngine.getHeldFunds(owner, asset);
  }

  /** Get all hold record IDs */
  async getAllHoldRecords(): Promise<string[]> {
    return this.complianceEngine.getAllHoldRecords();
  }

  /** Get hold record details */
  async getHoldRecord(holdId: string): Promise<{ owner: string; asset: string; amount: bigint; timestamp: Date; reason: string; released: boolean }> {
    const record = await this.complianceEngine.getHoldRecord(holdId);
    return {
      owner: record.owner,
      asset: record.asset,
      amount: record.amount,
      timestamp: new Date(Number(record.timestamp) * 1000),
      reason: record.reason,
      released: record.released,
    };
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /** Listen for compliance validation events. Returns unsubscribe function. */
  onTransferValidated(
    callback: (asset: string, from: string, to: string, amount: bigint, decision: Decision, reason: string) => void
  ): () => void {
    this.complianceEngine.on('TransferValidated', callback);
    return () => this.complianceEngine.off('TransferValidated', callback);
  }

  /** Listen for sanction additions. Returns unsubscribe function. */
  onSanctionAdded(callback: (account: string, reason: string) => void): () => void {
    this.riskRegistry.on('SanctionAdded', callback);
    return () => this.riskRegistry.off('SanctionAdded', callback);
  }

  /** Remove all listeners */
  removeAllListeners(): void {
    this.complianceEngine.removeAllListeners();
    this.riskRegistry.removeAllListeners();
    this.policyEngine.removeAllListeners();
    this.riskOracle.removeAllListeners();
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private _toSolidityOp(op: Operation): any {
    return {
      opType: op.opType,
      target: op.target,
      value: op.value,
      data: op.data,
      token: op.token,
      tokenAmount: op.tokenAmount,
      chainId: op.chainId,
    };
  }

  private _parseIssuerPolicy(policy: any): IssuerPolicy {
    return {
      maxTxAmount: policy.maxTxAmount,
      dailyLimit: policy.dailyLimit,
      allowMediumRisk: policy.allowMediumRisk,
      allowHighRisk: policy.allowHighRisk,
      blockMixer: policy.blockMixer,
      requireDestinationKYC: policy.requireDestinationKYC,
      cooldownPeriod: Number(policy.cooldownPeriod),
    };
  }
}
