import { Contract, JsonRpcProvider, TransactionResponse, Wallet, AbstractSigner } from 'ethers';
import { AddressJurisdiction } from './address-enricher';
import { stringToBytes32 as safeStringToBytes32 } from './address-utils';
import { config } from './config';
import logger from './logger';
// [Audit-Fix #7] Import createKeyManager factory to avoid bypassing KMS in production
import { createKeyManager } from './kms-key-manager';

/** Minimal RiskRegistry ABI — only updateRiskProfile(). */
const RISK_REGISTRY_ABI = [
  'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
  'function getRiskProfile(address addr) view returns (uint256 riskScore, address, uint32 lastUpdated, uint8 riskTier, uint8 sourceConfidence, bool sanctioned, bool exists)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function ORACLE_ROLE() view returns (bytes32)',
];

/** Result of a single publish operation. */
export interface FATFPublishResult {
  address: string;
  txHash: string;
  status: 'success' | 'failed' | 'dry-run';
  tier: string;
  error?: string;
}

/**
 * FATFPublisher — publishes FATF-enriched address risk data to the
 * RiskRegistry contract on-chain.
 *
 * Uses its own signer (the deployer / oracle account) separate from the
 * main publisher, because FATF data uses a dedicated oracle role.
 */
export class FATFPublisher {
  private provider: JsonRpcProvider;
  private contract: Contract;
  // [Audit-Fix #7] Changed from concrete Wallet to AbstractSigner to support KMS
  private signer!: AbstractSigner;
  private dryRun: boolean;
  private gasLimit: number;
  private txInterval: number;
  private batchSize: number;

  constructor(opts?: {
    rpcUrl?: string;
    chainId?: number;
    registryAddress?: string;
    privateKey?: string;
    gasLimit?: number;
    batchSize?: number;
    txInterval?: number;
    dryRun?: boolean;
  }) {
    const rpcUrl = opts?.rpcUrl ?? config.publisher.rpcUrl;
    const chainId = opts?.chainId ?? config.publisher.chainId;
    const registryAddress = opts?.registryAddress ?? '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';
    // [Audit-Fix #7] No longer accept raw privateKey directly; use createKeyManager() factory.
    // The privateKey parameter is kept for backward compat but ignored in production.
    this.provider = new JsonRpcProvider(rpcUrl, chainId);
    this.contract = new Contract(registryAddress, RISK_REGISTRY_ABI, this.provider);
    this.dryRun = opts?.dryRun ?? config.publisher.dryRun;
    this.gasLimit = opts?.gasLimit ?? config.publisher.gasLimit;
    this.batchSize = opts?.batchSize ?? config.publisher.batchSize;
    this.txInterval = opts?.txInterval ?? config.publisher.txInterval;
  }

  /**
   * Initialise: create signer via key manager factory and verify ORACLE_ROLE.
   * [Audit-Fix #7] Uses createKeyManager() instead of `new Wallet(privateKey)`.
   */
  async initialize(): Promise<void> {
    // [Audit-Fix #7] Use the factory function which enforces KMS in production
    const keyManager = await createKeyManager(this.provider);
    this.signer = await keyManager.getSigner() as AbstractSigner;
    const signerAddress = await keyManager.getAddress();

    // Connect contract to signer
    this.contract = this.contract.connect(this.signer) as Contract;

    const oracleRole = await this.contract.ORACLE_ROLE();
    const hasRole = await this.contract.hasRole(oracleRole, signerAddress);

    if (!hasRole) {
      logger.warn('FATFPublisher: signer does NOT have ORACLE_ROLE', {
        signer: signerAddress,
        oracleRole,
      });
      // Don't throw in dry-run mode
      if (!this.dryRun) {
        throw new Error(`Address ${signerAddress} lacks ORACLE_ROLE on RiskRegistry`);
      }
    }

    logger.info('FATFPublisher initialised', {
      signer: signerAddress,
      registry: await this.contract.getAddress(),
      dryRun: this.dryRun,
    });
  }

  /**
   * Publish enriched address risk data on-chain.
   *
   * @param enrichments — Map<address, AddressJurisdiction> from AddressEnricher
   * @returns summary of all publish operations
   */
  async publish(enrichments: Map<string, AddressJurisdiction>): Promise<FATFPublishResult[]> {
    const results: FATFPublishResult[] = [];
    const total = enrichments.size;

    if (total === 0) {
      logger.info('FATFPublisher: no addresses to publish');
      return results;
    }

    logger.info('FATFPublisher: starting publish', { total, dryRun: this.dryRun });

    let i = 0;
    for (const [address, jur] of enrichments) {
      i++;

      // Only publish Ethereum addresses (0x + 40 hex)
      if (!address.match(/^0x[0-9a-fA-F]{40}$/)) {
        logger.debug('FATFPublisher: skipping non-Ethereum address', { address, index: i });
        continue;
      }

      try {
        const result = await this.publishSingle(address, jur, i, total);
        results.push(result);
      } catch (err) {
        results.push({
          address,
          txHash: '',
          status: 'failed',
          tier: jur.boostedTier ?? 'MEDIUM',
          error: (err as Error).message,
        });
        logger.error('FATFPublisher: publish failed for address', {
          address,
          error: (err as Error).message,
          index: i,
        });
      }

      // Rate limit between txs
      if (!this.dryRun && this.txInterval > 0 && i < total) {
        await new Promise(r => setTimeout(r, this.txInterval));
      }

      // Log progress every batch
      if (i % this.batchSize === 0) {
        logger.info('FATFPublisher: progress', {
          published: i,
          total,
          successRate: `${results.filter(r => r.status === 'success' || r.status === 'dry-run').length}/${i}`,
        });
      }
    }

    const success = results.filter(r => r.status === 'success' || r.status === 'dry-run').length;
    const failed = results.filter(r => r.status === 'failed').length;

    logger.info('FATFPublisher: publish complete', { total: results.length, success, failed });

    return results;
  }

  /**
   * Publish a single enriched address to RiskRegistry.
   */
  private async publishSingle(
    address: string,
    jur: AddressJurisdiction,
    index: number,
    total: number,
  ): Promise<FATFPublishResult> {
    // Map boostedTier → numeric tier + risk score
    const { riskScore, tierNum } = this.tierToScore(jur.boostedTier ?? 'MEDIUM');

    // Build tags
    const tags = this.buildTags(jur);
    const tagsBytes32 = tags.map(t => this.stringToBytes32(t));

    // DRY RUN
    if (this.dryRun) {
      logger.info('FATFPublisher [DRY RUN]: would publish', {
        address,
        entity: jur.entityName,
        iso2: jur.iso2,
        fatfLevel: jur.fatfLevel,
        tier: jur.boostedTier,
        riskScore,
        tags,
        index,
        total,
      });
      return {
        address,
        txHash: `dryrun-${address}`,
        status: 'dry-run',
        tier: jur.boostedTier ?? 'MEDIUM',
      };
    }

    // Build gas params
    // [Audit-Fix #33] Gas params: In production, consider adding maxFeePerGas and maxPriorityFeePerGas
    // overrides from config to prevent gas price spikes from draining the oracle wallet.
    const feeData = await this.provider.getFeeData();
    const gasParams: any = { gasLimit: this.gasLimit };
    if (feeData.maxFeePerGas) gasParams.maxFeePerGas = feeData.maxFeePerGas;
    if (feeData.maxPriorityFeePerGas) gasParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    else if (feeData.gasPrice) gasParams.gasPrice = feeData.gasPrice;

    // Send transaction
    const tx: TransactionResponse = await this.contract.updateRiskProfile(
      address,
      riskScore,
      tierNum,
      tagsBytes32,
      true, // isSanctioned — these are all OFAC SDN addresses
      gasParams,
    );

    const receipt = await tx.wait(1);

    const status = receipt && receipt.status === 1 ? 'success' : 'failed';

    logger.debug('FATFPublisher: tx confirmed', {
      address,
      txHash: tx.hash,
      status,
      gasUsed: receipt?.gasUsed?.toString(),
      blockNumber: receipt?.blockNumber,
    });

    return {
      address,
      txHash: tx.hash,
      status,
      tier: jur.boostedTier ?? 'MEDIUM',
    };
  }

  /**
   * Map a boosted tier string to RiskRegistry numeric values.
   */
  private tierToScore(tier: 'CRITICAL' | 'HIGH' | 'MEDIUM'): { riskScore: number; tierNum: number } {
    switch (tier) {
      case 'CRITICAL':
        return { riskScore: 100, tierNum: 4 }; // RiskTier.CRITICAL
      case 'HIGH':
        return { riskScore: 80, tierNum: 3 }; // RiskTier.HIGH
      case 'MEDIUM':
      default:
        return { riskScore: 60, tierNum: 2 }; // RiskTier.MEDIUM
    }
  }

  /**
   * Build descriptive tags for an enriched address.
   */
  private buildTags(jur: AddressJurisdiction): string[] {
    const tags: string[] = ['ofac-sdn', 'sanctioned'];

    if (jur.fatfLevel === 'blacklist') {
      tags.push('fatf-blacklist');
      tags.push('fatf-call-for-action');
    } else if (jur.fatfLevel === 'greylist') {
      tags.push('fatf-greylist');
      tags.push('fatf-increased-monitoring');
    }

    if (jur.iso2) {
      tags.push(`country:${jur.iso2}`);
    }

    if (jur.entityName) {
      // Truncate entity name to fit bytes32 (31 chars max after hex encoding)
      const name = jur.entityName.slice(0, 31);
      tags.push(`entity:${name}`);
    }

    return tags;
  }

  /**
   * Convert a string to a Solidity bytes32 hex string.
   * Uses ethers.encodeBytes32String for short strings, safely truncates
   * longer strings at UTF-8 byte boundaries.
   */
  private stringToBytes32(str: string): string {
    return safeStringToBytes32(str);
  }
}

export default FATFPublisher;
