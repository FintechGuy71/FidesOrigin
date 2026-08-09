import { ethers, Contract, Signer, JsonRpcProvider, TransactionResponse, NonceManager } from 'ethers';
import { createClient, RedisClientType } from 'redis';
import { RiskProfile, PublisherConfig, TxResult } from './types';
import { config } from './config';
import logger from './logger';
import { createKeyManager } from './kms-key-manager';
import { getMessageQueue, MessageEnvelope, MessageQueue } from './message-queue';
import { MonitorServer } from './monitor';

// RiskRegistry ABI (minimal — only the functions we need)
const RISK_REGISTRY_ABI = [
  'function updateRiskProfile(address addr, uint256 riskScore, uint8 tier, bytes32[] tags, bool isSanctioned)',
  'function getRiskProfile(address addr) view returns (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool isSanctioned)',
  'function riskProfiles(address) view returns (uint256, address, uint32, uint8, uint8, bool, bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function ORACLE_ROLE() view returns (bytes32)',
  'function totalProfiles() view returns (uint256)',
];

// RiskOracle ABI (minimal — only deferredCount)
const RISK_ORACLE_ABI = [
  'function deferredCount() view returns (uint256)',
];

/**
 * P0-3 Fix: Distributed Lock Manager (Redis Redlock simplified)
 * 
 * 职责：
 * - 防止 data-publisher 和 backend 同时写入链上
 * - 使用 Redis SET NX EX 实现独占锁
 * - 支持锁自动续期和自动释放
 */
class DistributedLockManager {
  private redis: RedisClientType | null = null;
  private readonly lockPrefix: string = 'fides:lock';
  private readonly lockTtl: number = 30; // 锁过期时间（秒）
  private readonly watchdogInterval: number = 10; // 看门狗续期间隔（秒）
  private watchdogTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private redisUrl: string) {}

  private async getRedis(): Promise<RedisClientType> {
    if (!this.redis) {
      this.redis = createClient({ url: this.redisUrl });
      await this.redis.connect();
    }
    return this.redis;
  }

  private lockKey(resource: string): string {
    return `${this.lockPrefix}:${resource}`;
  }

  private generateToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}-${process.pid}`;
  }

  /**
   * P0-3 Fix: 获取分布式锁
   */
  async acquireLock(
    resource: string,
    ttl: number = this.lockTtl,
    blocking: boolean = true,
    blockingTimeout: number = 60,
  ): Promise<string | null> {
    const redis = await this.getRedis();
    const lockKey = this.lockKey(resource);
    const token = this.generateToken();
    const startTime = Date.now();

    while (true) {
      // 尝试获取锁（SET NX EX）
      const acquired = await redis.set(lockKey, token, {
        NX: true,
        EX: ttl,
      });

      if (acquired) {
        logger.info('Lock acquired', { resource, lockKey, token: token.substring(0, 20) + '...' });
        // 启动看门狗自动续期
        this.startWatchdog(resource, lockKey, token, ttl);
        return token;
      }

      if (!blocking) {
        logger.debug('Lock not acquired (non-blocking)', { resource, lockKey });
        return null;
      }

      // 检查阻塞超时
      if (Date.now() - startTime >= blockingTimeout * 1000) {
        logger.warning('Lock acquire timeout', { resource, lockKey, blockingTimeout });
        return null;
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * P0-3 Fix: 释放分布式锁（安全释放）
   */
  async releaseLock(resource: string, token: string): Promise<boolean> {
    const redis = await this.getRedis();
    const lockKey = this.lockKey(resource);

    // 停止看门狗
    this.stopWatchdog(resource);

    // 使用 Lua 脚本安全释放锁
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(luaScript, {
        keys: [lockKey],
        arguments: [token],
      });
      const released = result === 1;

      if (released) {
        logger.info('Lock released', { resource, lockKey });
      } else {
        logger.warning('Lock release failed or expired', { resource, lockKey });
      }

      return released;
    } catch (error) {
      logger.error('Lock release error', { resource, lockKey, error: (error as Error).message });
      return false;
    }
  }

  /**
   * P0-3 Fix: 检查资源是否被锁定
   */
  async isLocked(resource: string): Promise<boolean> {
    const redis = await this.getRedis();
    const lockKey = this.lockKey(resource);
    const exists = await redis.exists(lockKey);
    return exists > 0;
  }

  /**
   * P0-3 Fix: 延长锁过期时间
   */
  async extendLock(resource: string, token: string, additionalTtl: number): Promise<boolean> {
    const redis = await this.getRedis();
    const lockKey = this.lockKey(resource);

    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(luaScript, {
        keys: [lockKey],
        arguments: [token, String(additionalTtl)],
      });
      return result === 1;
    } catch (error) {
      logger.error('Lock extend error', { resource, error: (error as Error).message });
      return false;
    }
  }

  /**
   * P0-3 Fix: 启动看门狗自动续期
   */
  private startWatchdog(resource: string, lockKey: string, token: string, ttl: number): void {
    this.stopWatchdog(resource);

    const timer = setInterval(async () => {
      try {
        const extended = await this.extendLock(resource, token, ttl);
        if (!extended) {
          logger.warning('Watchdog lock extend failed', { resource, lockKey });
          this.stopWatchdog(resource);
        } else {
          logger.debug('Watchdog lock extended', { resource, lockKey });
        }
      } catch (error) {
        logger.error('Watchdog error', { resource, error: (error as Error).message });
        this.stopWatchdog(resource);
      }
    }, this.watchdogInterval * 1000);

    this.watchdogTimers.set(resource, timer);
  }

  /**
   * P0-3 Fix: 停止看门狗
   */
  private stopWatchdog(resource: string): void {
    const timer = this.watchdogTimers.get(resource);
    if (timer) {
      clearInterval(timer);
      this.watchdogTimers.delete(resource);
    }
  }

  async close(): Promise<void> {
    for (const resource of this.watchdogTimers.keys()) {
      this.stopWatchdog(resource);
    }
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

/**
 * Blockchain Publisher — signs and sends transactions to RiskRegistry
 * 
 * P0-3 Fix: 添加分布式锁检查，防止与 backend 同时写入链上
 * P1-2 Fix: 集成消息队列，backend 发布消息后 publisher 订阅处理
 */
export class BlockchainPublisher {
  private provider: JsonRpcProvider;
  private contract: Contract;
  private riskOracle?: Contract;
  private signer?: Signer;
  private nonceManager?: NonceManager;  // [Audit-Fix #1] Use NonceManager for proper nonce handling
  private address?: string;
  private nonce: number = 0;
  private isReady: boolean = false;
  private oracleRole?: string;
  
  // P0-3 Fix: 分布式锁管理器
  private lockManager: DistributedLockManager;
  
  // P1-2 Fix: 消息队列
  private messageQueue: MessageQueue;
  
  // P0-3 Fix: 是否启用锁检查
  private lockEnabled: boolean = true;

  constructor(cfg: PublisherConfig) {
    this.provider = new JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
    this.contract = new Contract(cfg.riskRegistryAddress, RISK_REGISTRY_ABI, this.provider);

    // Initialize RiskOracle contract if address is provided
    if (cfg.riskOracleAddress) {
      this.riskOracle = new Contract(cfg.riskOracleAddress, RISK_ORACLE_ABI, this.provider);
    }
    
    // P0-3 Fix: 初始化锁管理器
    this.lockManager = new DistributedLockManager(config.cluster.redisUrl);
    
    // P1-2 Fix: 初始化消息队列
    this.messageQueue = getMessageQueue();
  }

  /**
   * Initialize the publisher (connect signer, verify role, start message queue)
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

      // P1-2 Fix: 启动消息队列订阅
      await this.setupMessageQueueSubscriber();

      this.isReady = true;
      
      logger.info('Publisher initialized successfully', {
        address: this.address,
        riskRegistry: config.publisher.riskRegistryAddress,
        chainId: config.publisher.chainId,
        oracleRole: this.oracleRole,
        nonce: this.nonce,
        lockEnabled: this.lockEnabled,
      });
    } catch (error) {
      logger.error('Failed to initialize publisher', { error: (error as Error).stack });
      throw error;
    }
  }
  
  /**
   * P1-2 Fix: 设置消息队列订阅
   * - 订阅 backend 发布的 risk_update 消息
   * - 处理消息后发布确认
   */
  private async setupMessageQueueSubscriber(): Promise<void> {
    this.messageQueue.onMessage('risk_update', async (envelope: MessageEnvelope) => {
      logger.info('Received risk_update message from queue', {
        messageId: envelope.message_id,
        source: envelope.source,
        address: envelope.payload?.address,
        score: envelope.payload?.score,
        tier: envelope.payload?.tier,
      });
      
      try {
        // 从消息中提取数据
        const { address, score, tier } = envelope.payload as any;
        
        if (!address || score === undefined || !tier) {
          logger.error('Invalid risk_update message payload', { payload: envelope.payload });
          return;
        }
        
        // 构建 RiskProfile 并发布到链上
        const profile: RiskProfile = {
          address,
          riskScore: Math.round(score),
          tier: this.tierStringToNumber(tier),
          tags: [],
          isSanctioned: false,
          source: envelope.source || 'backend',
          confidence: 1.0,
          timestamp: Date.now(),
        };
        
        // 使用锁保护发布
        const result = await this.publishSingleWithLock(profile);
        
        if (result.status === 'success' || result.status === 'skipped') {
          // P1-2 Fix: 确认消息已处理
          await this.messageQueue.acknowledgeMessage(envelope.message_id);
          
          logger.info('Risk update from queue confirmed', {
            messageId: envelope.message_id,
            address,
            txHash: result.hash,
          });
        } else {
          throw new Error(result.error || 'Publish failed');
        }
      } catch (error) {
        logger.error('Failed to process queue message', {
          messageId: envelope.message_id,
          error: (error as Error).message,
        });
        // 消息处理失败会自动重试或进入死信队列（由 MessageQueue 处理）
      }
    });
    
    await this.messageQueue.startSubscriber();
  }
  
  /**
   * 将 tier 字符串转换为数字
   */
  private tierStringToNumber(tier: string): number {
    const tierMap: Record<string, number> = {
      'LOW': 0,
      'MEDIUM': 1,
      'HIGH': 2,
      'CRITICAL': 3,
    };
    return tierMap[tier.toUpperCase()] ?? 0;
  }

  async getAddress(): Promise<string | undefined> {
    return this.address;
  }
  
  /**
   * P0-3 Fix: 设置是否启用锁检查
   */
  setLockEnabled(enabled: boolean): void {
    this.lockEnabled = enabled;
    logger.info('Lock enabled status changed', { enabled });
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
   * 
   * P0-3 Fix: 批量发布时先获取全局锁，防止与 backend 冲突
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

    // P0-3 Fix: 检查 backend 是否正在写入
    if (this.lockEnabled) {
      const isBackendWriting = await this.lockManager.isLocked('chain:write');
      if (isBackendWriting) {
        logger.warning('Backend is writing to chain, publisher will skip this batch', {
          profilesCount: profiles.length,
        });
        
        // P1-2 Fix: 将消息发送到队列，等待 publisher 后续处理
        for (const profile of profiles) {
          try {
            await this.messageQueue.publishRiskUpdate(
              profile.address,
              profile.riskScore,
              this.tierNumberToString(profile.tier),
              'publisher',
            );
          } catch (e) {
            logger.error('Failed to queue profile for later', { 
              address: profile.address, 
              error: (e as Error).message 
            });
          }
        }
        
        return profiles.map(p => ({
          hash: 'skipped-backend-writing',
          status: 'skipped' as const,
          error: 'Backend is writing to chain, queued for later',
        }));
      }
    }

    // P0-3 Fix: 获取链上写入独占锁
    let lockToken: string | null = null;
    if (this.lockEnabled) {
      lockToken = await this.lockManager.acquireLock('chain:write', 60, true, 30);
      if (!lockToken) {
        logger.warning('Failed to acquire chain write lock, skipping batch', {
          profilesCount: profiles.length,
        });
        return profiles.map(p => ({
          hash: 'skipped-lock-failed',
          status: 'skipped' as const,
          error: 'Failed to acquire chain write lock',
        }));
      }
      logger.info('Acquired chain write lock for batch publish', {
        profilesCount: profiles.length,
      });
    }

    const results: TxResult[] = [];
    const batchSize = config.publisher.batchSize;

    try {
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
            
            // P1-2 Fix: 发布成功后，通知 backend
            if (result.status === 'success') {
              try {
                await this.messageQueue.publishRiskUpdate(
                  profile.address,
                  profile.riskScore,
                  this.tierNumberToString(profile.tier),
                  'publisher',
                );
              } catch (e) {
                logger.debug('Failed to publish confirmation to queue', { 
                  address: profile.address, 
                  error: (e as Error).message 
                });
              }
            }
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
    } finally {
      // P0-3 Fix: 确保锁被释放（即使发布失败）
      if (lockToken) {
        const released = await this.lockManager.releaseLock('chain:write', lockToken);
        logger.info('Released chain write lock after batch publish', { released });
      }
    }

    // Summary
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    
    logger.info(`Publishing complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`, {
      total: results.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
    });

    return results;
  }

  /**
   * Publish a single risk profile
   * [Audit Fix #10] Added idempotency check: skips if on-chain data is already up to date.
   */
  private async publishSingle(profile: RiskProfile): Promise<TxResult> {
    // [Audit Fix #10] Idempotency check: read on-chain state before publishing
    try {
      const onChain = await this.contract.riskProfiles(profile.address);
      const onChainScore = Number(onChain[0]);
      const onChainTier = Number(onChain[3]);
      const onChainSanctioned = onChain[5];

      if (this.isSameProfile(profile, onChainScore, onChainTier, onChainSanctioned)) {
        logger.info(`[Idempotent] Skipping ${profile.address} — on-chain data already up to date`, {
          score: onChainScore,
          tier: onChainTier,
          sanctioned: onChainSanctioned,
        });
        return {
          hash: 'skipped',
          status: 'skipped',
          gasUsed: BigInt(0),
          blockNumber: 0,
        };
      }
    } catch (error) {
      // Address not yet registered on chain — proceed with publish
      logger.debug(`No on-chain data for ${profile.address}, proceeding with publish`);
    }
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

    // Wait for confirmation with timeout (120s) to prevent infinite hanging
    const receipt = await Promise.race([
      tx.wait(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Transaction confirmation timeout after 120s')), 120_000)
      ),
    ]);

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
   * P0-3 Fix: 使用锁保护的单条发布
   * - 如果 backend 正在写入，等待或跳过
   */
  private async publishSingleWithLock(profile: RiskProfile): Promise<TxResult> {
    if (!this.lockEnabled) {
      return this.publishSingle(profile);
    }
    
    // 检查 backend 是否正在写入
    const isBackendWriting = await this.lockManager.isLocked('chain:write');
    if (isBackendWriting) {
      logger.info('Backend is writing to chain, waiting for lock release', {
        address: profile.address,
      });
    }
    
    // 获取锁
    const lockToken = await this.lockManager.acquireLock('chain:write', 60, true, 30);
    if (!lockToken) {
      logger.warning('Failed to acquire lock for single publish', {
        address: profile.address,
      });
      return {
        hash: 'skipped-lock-failed',
        status: 'skipped',
        error: 'Failed to acquire chain write lock',
      };
    }
    
    try {
      return await this.publishSingle(profile);
    } finally {
      // 确保锁被释放
      await this.lockManager.releaseLock('chain:write', lockToken);
    }
  }
  
  /**
   * 将 tier 数字转换为字符串
   */
  private tierNumberToString(tier: number): string {
    const tierMap: Record<number, string> = {
      0: 'LOW',
      1: 'MEDIUM',
      2: 'HIGH',
      3: 'CRITICAL',
    };
    return tierMap[tier] ?? 'LOW';
  }

  /**
   * [Audit Fix #10] Compare local profile with on-chain data for idempotency.
   */
  private isSameProfile(
    profile: RiskProfile,
    onChainScore: number,
    onChainTier: number,
    onChainSanctioned: boolean
  ): boolean {
    return (
      profile.riskScore === onChainScore &&
      profile.tier === onChainTier &&
      profile.isSanctioned === onChainSanctioned
    );
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
      
      // P0-3 Fix: 检查锁管理器连接
      if (this.lockEnabled) {
        try {
          const isLocked = await this.lockManager.isLocked('chain:write');
          logger.debug('Lock manager health check', { isLocked });
        } catch (e) {
          return { healthy: false, error: `Lock manager error: ${(e as Error).message}` };
        }
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
  
  /**
   * P0-3 Fix: 关闭 publisher，释放锁和消息队列
   */
  async close(): Promise<void> {
    await this.lockManager.close();
    await this.messageQueue.close();
    logger.info('Publisher closed');
  }

  /**
   * Start periodic monitoring of RiskOracle deferredCount.
   * Reports the value to the monitor every 60 seconds.
   */
  startDeferredCountReporting(monitor: MonitorServer): void {
    if (!this.riskOracle) {
      logger.warn('RiskOracle address not configured, deferred count monitoring disabled');
      return;
    }

    const intervalMs = 60000;

    const poll = async () => {
      try {
        const count = await this.riskOracle!.deferredCount();
        const countNum = Number(count);
        monitor.setOracleDeferredCount(countNum);
        logger.debug('RiskOracle deferredCount updated', { count: countNum });
      } catch (error) {
        logger.warn('Failed to read RiskOracle deferredCount', { error: (error as Error).message });
      }
    };

    // Run immediately, then every 60s
    poll();
    setInterval(poll, intervalMs);

    logger.info('RiskOracle deferred count monitoring started', {
      intervalMs,
      riskOracleAddress: this.riskOracle.target,
    });
  }
}

export default BlockchainPublisher;
