import { ethers, Contract, Signer, JsonRpcProvider, TransactionResponse, NonceManager } from 'ethers';
import { RiskProfile, PublisherConfig, TxResult } from './types';
import { config } from './config';
import logger from './logger';
import { createKeyManager } from './kms-key-manager';

// RiskRegistry ABI (minimal — only the functions we need)
const RISK_REGISTRY_ABI = [
  'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
  'function getRiskProfile(address addr) view returns (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool isSanctioned)',
  'function riskProfiles(address) view returns (uint256, address, uint32, uint8, uint8, bool, bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function ORACLE_ROLE() view returns (bytes32)',
  'function totalProfiles() view returns (uint256)',
];

/**
 * Blockchain Publisher — signs and sends transactions to RiskRegistry
 */
export class BlockchainPublisher {
  private provider: JsonRpcProvider;
  private contract: Contract;
  private signer?: Signer;
  private nonceManager?: NonceManager;  // [Audit-Fix #1] Use NonceManager for proper nonce handling
  private address?: string;
  private nonce: number = 0;
  private isReady: boolean = false;
  private oracleRole?: string;

  constructor(cfg: PublisherConfig) {
    this.provider = new JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
    this.contract = new Contract(cfg.riskRegistryAddress, RISK_REGISTRY_ABI, this.provider);
  }

  /**
   * Initialize the publisher (connect signer, verify role)
   */
  async initialize(): Promise<void> {
    try {
      // Create key manager and get signer
      const keyManager = await createKeyManager(this.provider);
      this.signer = await keyManager.getSigner();
      this.address = await keyManager.getAddress();

      // [Audit-Fix #1] Wrap signer with NonceManager for automatic nonce management
      // This prevents nonce-related transaction failures under concurrent load
      this.nonceManager = new NonceManager(this.signer);

      // Connect contract to signer (via NonceManager)
      this.contract = this.contract.connect(this.nonceManager) as Contract;

      // Get current nonce (for logging/monitoring only; NonceManager handles it automatically)
      this.nonce = await this.provider.getTransactionCount(this.address, 'latest');

      // Verify ORACLE_ROLE
      this.oracleRole = await this.contract.ORACLE_ROLE();
      const hasRole = await this.contract.hasRole(this.oracleRole, this.address);
      
      if (!hasRole) {
        throw new Error(
          `Address ${this.address} does not have ORACLE_ROLE on RiskRegistry. ` +
          `Grant role by calling: riskRegistry.grantRole(ORACLE_ROLE, ${this.address})`
        );
      }

      this.isReady = true;
      
      logger.info('Publisher initialized successfully', {
        address: this.address,
        riskRegistry: config.publisher.riskRegistryAddress,
        chainId: config.publisher.chainId,
        oracleRole: this.oracleRole,
        nonce: this.nonce,
      });
    } catch (error) {
      logger.error('Failed to initialize publisher', { error: (error as Error).stack });
      throw error;
    }
  }

  async getAddress(): Promise<string | undefined> {
    return this.address;
  }

  /**
   * Get on-chain data for all addresses to determine which need updating
   * [Audit-Fix #14] Added concurrency limiter to prevent overwhelming the RPC endpoint
   * when querying large address lists. Uses a simple concurrency pool pattern.
   */
  async getOnChainData(addresses: string[]): Promise<Map<string, { score: number; tier: number; sanctioned: boolean; timestamp: number }>> {
    const results = new Map();
    // [Audit-Fix #14] Limit concurrency to prevent RPC rate limiting
    const MAX_CONCURRENT = 5;

    for (let i = 0; i < addresses.length; i += 10) {
      const batch = addresses.slice(i, i + 10);
      
      // Process in sub-batches with limited concurrency
      for (let j = 0; j < batch.length; j += MAX_CONCURRENT) {
        const concurrentBatch = batch.slice(j, j + MAX_CONCURRENT);
        const promises = concurrentBatch.map(async (addr) => {
          try {
            const profile = await this.contract.riskProfiles(addr);
            return {
              address: addr,
              score: Number(profile[0]),
              tier: Number(profile[3]),
              sanctioned: profile[5],
              timestamp: Number(profile[2]),
            };
          } catch (error) {
            // Address not registered yet
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        for (const r of batchResults) {
          if (r) results.set(r.address, r);
        }
      }
    }

    return results;
  }

  /**
   * Publish risk profiles to the blockchain
   */
  async publish(profiles: RiskProfile[]): Promise<TxResult[]> {
    if (!this.isReady) {
      throw new Error('Publisher not initialized. Call initialize() first.');
    }

    if (config.publisher.dryRun) {
      logger.info(`[DRY RUN] Would publish ${profiles.length} profiles`, {
        firstProfile: profiles[0],
      });
      return profiles.map(p => ({
        hash: `dryrun-${p.address}`,
        status: 'success' as const,
      }));
    }

    const results: TxResult[] = [];
    const batchSize = config.publisher.batchSize;

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      
      logger.info(`Publishing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}`, {
        batchSize: batch.length,
        remaining: profiles.length - i - batch.length,
      });

      for (const profile of batch) {
        try {
          const result = await this.publishSingle(profile);
          results.push(result);
        } catch (error) {
          results.push({
            hash: '',
            status: 'failed',
            error: (error as Error).message,
          });
          logger.error(`Failed to publish profile for ${profile.address}`, { error: (error as Error).message });
        }

        // Rate limiting between transactions
        if (config.publisher.txInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, config.publisher.txInterval));
        }
      }
    }

    // Summary
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    
    logger.info(`Publishing complete: ${successCount} success, ${failedCount} failed`, {
      total: results.length,
      success: successCount,
      failed: failedCount,
    });

    return results;
  }

  /**
   * Publish a single risk profile
   */
  private async publishSingle(profile: RiskProfile): Promise<TxResult> {
    // D1-AUDIT1-060 fix: use ethers.encodeBytes32String for correct UTF-8 handling
    const tagsBytes32 = profile.tags.map(t => ethers.encodeBytes32String(t));

    // Build gas params
    const feeData = await this.provider.getFeeData();
    const gasParams: any = {
      gasLimit: config.publisher.gasLimit,
    };

    if (config.publisher.maxFeePerGas) {
      gasParams.maxFeePerGas = ethers.parseUnits(config.publisher.maxFeePerGas, 'gwei');
    } else if (feeData.maxFeePerGas) {
      gasParams.maxFeePerGas = feeData.maxFeePerGas;
    }

    if (config.publisher.maxPriorityFeePerGas) {
      gasParams.maxPriorityFeePerGas = ethers.parseUnits(config.publisher.maxPriorityFeePerGas, 'gwei');
    } else if (feeData.maxPriorityFeePerGas) {
      gasParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    } else if (feeData.gasPrice) {
      gasParams.gasPrice = feeData.gasPrice;
    }

    // Send transaction
    const tx: TransactionResponse = await this.contract.updateRiskProfile(
      profile.address,
      profile.riskScore,
      profile.tier,
      tagsBytes32,
      profile.isSanctioned,
      gasParams
    );

    logger.debug(`Transaction sent: ${tx.hash}`, {
      address: profile.address,
      score: profile.riskScore,
      tier: profile.tier,
    });

    // Wait for confirmation
    const receipt = await tx.wait(1); // Wait for 1 confirmation

    if (!receipt) {
      throw new Error('Transaction receipt not received');
    }

    const status = receipt.status === 1 ? 'success' : 'failed';
    
    logger.info(`Transaction confirmed: ${tx.hash}`, {
      status,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
    });

    return {
      hash: tx.hash,
      status,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Health check — verify connection and role
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      if (!this.isReady) {
        return { healthy: false, error: 'Publisher not initialized' };
      }

      // Check RPC connection
      const blockNumber = await this.provider.getBlockNumber();
      
      // Check role
      const hasRole = await this.contract.hasRole(this.oracleRole, this.address);
      if (!hasRole) {
        return { healthy: false, error: 'ORACLE_ROLE revoked' };
      }

      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: (error as Error).message };
    }
  }

  /**
   * Estimate gas cost for publishing
   */
  async estimateGasCost(count: number): Promise<{ eth: string; usd?: string }> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(0);
      const totalGas = BigInt(config.publisher.gasLimit) * BigInt(count);
      const costWei = gasPrice * totalGas;
      const costEth = ethers.formatEther(costWei);
      
      return { eth: costEth };
    } catch (error) {
      logger.error('Failed to estimate gas', { error });
      return { eth: 'unknown' };
    }
  }
}

export default BlockchainPublisher;
