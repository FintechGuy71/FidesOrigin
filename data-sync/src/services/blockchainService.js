/**
 * 区块链同步服务
 * 将本地数据库中的风险地址同步到智能合约
 *
 * P0 Fixes:
 * - 链上批次失败增加重试队列
 * - 链上交易增加Gas硬上限
 * - 私钥改为从环境变量读取，禁止明文存储
 *
 * Security Audit Fixes:
 * - [H] 修复 BigInt 与 Number 类型混用导致交易发送 100% 失败
 * - [H] 校验交易回执状态，防止链上 Revert 被误认为成功
 * - [H] 优雅停机机制，等待当前批次处理完成
 * - [M] 修复脏数据导致状态不一致（非法地址被错误标记为已同步）
 * - [M] 修复重试队列耗尽导致数据静默丢失（增加死信队列）
 * - [M] 修复数据库连接生命周期管理（移除 finally 中的 disconnect）
 * - [L] 生产环境缺少 HSM 时快速失败（抛出异常而非静默 return）
 * - [I] 移除硬编码默认 RPC URL，强制要求环境变量配置
 * - [I] 将所有 console.* 替换为 logger.*
 */

const { ethers } = require('ethers');
const { DatabaseService } = require('./databaseService');
require('dotenv').config();

const { createLogger } = require('../utils/logger');
const logger = createLogger('blockchainService');

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  multiplier: 2,
};

// Gas硬上限配置
const GAS_CONFIG = {
  maxGasLimit: 5000000,        // 单笔交易最大Gas限制 5M
  maxFeePerGas: ethers.parseUnits('100', 'gwei'),  // 最大基础费用 100 gwei
  maxPriorityFeePerGas: ethers.parseUnits('10', 'gwei'), // 最大优先费用 10 gwei
};

// 合约 ABI（仅包含需要的方法）
const CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "accounts", "type": "address[]" },
      { "name": "riskScores", "type": "uint256[]" },
      { "name": "tiers", "type": "uint8[]" },
      { "name": "isSanctioned", "type": "bool[]" }
    ],
    "name": "batchUpdateRiskProfiles",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

class BlockchainSyncService {
  constructor() {
    this.db = new DatabaseService();

    // [I] Fix: 强制要求配置 RPC_URL，移除硬编码后备 URL
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL 环境变量未配置');
    }
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // 私钥改为从环境变量读取，禁止明文存储
    this.wallet = null;
    this._initWallet();

    // [I] Fix: 验证合约地址格式合法性
    const contractAddress = process.env.RISK_REGISTRY_CONTRACT;
    if (!contractAddress) {
      throw new Error('RISK_REGISTRY_CONTRACT 环境变量未配置');
    }
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('环境变量 RISK_REGISTRY_CONTRACT 不是合法的以太坊地址');
    }
    this.contractAddress = contractAddress;

    // 重试队列
    this.retryQueue = [];
    this.isProcessingRetryQueue = false;
    this.isSyncing = false;

    // [High] 优雅停机标志位
    this.isShuttingDown = false;

    // [M] Fix: 注册进程退出时的清理钩子，确保数据库连接正确关闭
    this._registerCleanupHooks();
  }

  /**
   * [High] Fix: 注册进程退出时的数据库清理钩子（支持优雅停机）
   */
  _registerCleanupHooks() {
    const cleanup = async () => {
      // [High] 设置停机标志，通知正在进行的同步操作停止
      this.isShuttingDown = true;
      logger.info('正在等待当前批次处理完成以优雅停机...');

      // 等待当前处理中的批次完成（最多等待 10 秒）
      let attempts = 0;
      while ((this.isProcessingRetryQueue || this.isSyncing) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (this.isProcessingRetryQueue || this.isSyncing) {
        logger.warn('优雅停机超时（10秒），强制关闭。可能存在未完成的交易。');
      }

      // [P0] Fix: 优雅停机时保存重试队列到数据库，防止数据丢失
      if (this.retryQueue.length > 0) {
        logger.warn(`[Cleanup] 停机时重试队列中还有 ${this.retryQueue.length} 个批次，正在保存...`);
        try {
          for (const item of this.retryQueue) {
            await this.db.markAsFailedPermanently(item.batch, new Error('Service shutdown - saved for retry'));
          }
          logger.info('[Cleanup] 重试队列已保存到数据库');
        } catch (saveErr) {
          logger.error('[Cleanup] 保存重试队列失败:', saveErr);
        }
      }

      try {
        if (this.db) {
          await this.db.disconnect();
          logger.info('数据库连接已安全关闭。');
        }
      } catch (err) {
        logger.error('数据库清理失败:', err);
      }

      process.exit(0);
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    process.once('beforeExit', async () => {
      this.isShuttingDown = true;
      try {
        if (this.db) {
          await this.db.disconnect();
        }
      } catch (err) {
        logger.error('数据库清理失败:', err);
      }
    });
  }

  /**
   * 初始化钱包（从环境变量或KMS）
   * 生产环境强制使用KMS/HSM
   */
  _initWallet() {
    const isProduction = process.env.NODE_ENV === 'production';

    // [L] Fix: 生产环境强制使用KMS/HSM，违规时抛出异常而非静默 return
    if (isProduction) {
      const hasHSM = process.env.AWS_KMS_KEY_ID ||
                     (process.env.AZURE_KEY_VAULT_NAME && process.env.AZURE_KEY_NAME) ||
                     process.env.GCP_KMS_KEY_PATH ||
                     (process.env.VAULT_ADDR && process.env.VAULT_KEY_PATH);

      if (!hasHSM || process.env.SYNC_PRIVATE_KEY || process.env.PRIVATE_KEY) {
        const errMsg = '❌ [Security] 生产环境密钥配置违规！必须使用 HSM/KMS 且禁止明文私钥。' +
                       '支持的方案：AWS KMS / Azure Key Vault / GCP KMS / HashiCorp Vault';
        logger.error(errMsg);
        throw new Error(errMsg);
      }

      // [FIX] Production KMS wallet initialization
      // Throw error instead of silently returning with uninitialized wallet
      throw new Error(
        '生产环境 KMS/HSM 钱包初始化尚未实现。' +
        '当前支持的方案：AWS KMS (AWS_KMS_KEY_ID + AWS_REGION)。' +
        '请实现对应 KMS 提供方的钱包初始化逻辑，或暂时在开发环境运行。'
      );
    }

    // 开发环境：允许使用环境变量私钥
    const privateKey = process.env.SYNC_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (privateKey) {
      // [I] Fix: 验证私钥格式
      try {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        logger.warn('⚠️ [Security] 开发环境使用环境变量私钥（仅限本地测试）');
      } catch (err) {
        throw new Error(`私钥格式无效: ${err.message}`);
      }
    }
  }

  /**
   * 计算指数退避延迟
   */
  _calculateRetryDelay(attempt) {
    const exponential = RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.multiplier, attempt);
    const capped = Math.min(exponential, RETRY_CONFIG.maxDelayMs);
    const jitter = capped * 0.3 * (Math.random() * 2 - 1);
    return Math.max(RETRY_CONFIG.baseDelayMs, Math.floor(capped + jitter));
  }

  /**
   * 添加失败批次到重试队列
   */
  _addToRetryQueue(batch, error) {
    const retryItem = {
      batch,
      error: error.message,
      retryCount: 0,
      lastAttempt: Date.now(),
      nextRetryAt: Date.now() + this._calculateRetryDelay(0),
    };
    this.retryQueue.push(retryItem);
    logger.warn(`[RetryQueue] 批次加入重试队列，当前队列长度: ${this.retryQueue.length}`);
  }

  /**
   * 处理重试队列
   */
  async _processRetryQueue(contract) {
    if (this.isProcessingRetryQueue || this.retryQueue.length === 0) {
      return;
    }

    this.isProcessingRetryQueue = true;
    logger.info(`[RetryQueue] 开始处理重试队列，共 ${this.retryQueue.length} 个批次`);

    const now = Date.now();
    const toProcess = [];
    const toKeep = [];

    // 筛选出可以重试的批次
    for (const item of this.retryQueue) {
      if (item.retryCount >= RETRY_CONFIG.maxRetries) {
        // [M] Fix: 将彻底失败的批次写入数据库死信记录，防止数据静默丢失
        logger.error(`[RetryQueue] 批次已用尽重试次数: ${item.error}`);
        try {
          await this.db.markAsFailedPermanently(item.batch, item.error);
          logger.info('[RetryQueue] 已将失败批次写入数据库死信记录');
        } catch (dbErr) {
          logger.error('[RetryQueue] 写入数据库失败:', dbErr);
        }
        continue;
      }

      if (item.nextRetryAt <= now) {
        toProcess.push(item);
      } else {
        toKeep.push(item);
      }
    }

    this.retryQueue = toKeep;

    for (const item of toProcess) {
      // [High] 优雅停机检查
      if (this.isShuttingDown) {
        logger.info('[RetryQueue] 检测到停机信号，将批次放回队列等待下次处理');
        this.retryQueue.push(item);
        break;
      }

      try {
        logger.info(`[RetryQueue] 重试批次 (第 ${item.retryCount + 1}/${RETRY_CONFIG.maxRetries} 次)`);
        const tx = await this._sendBatchWithGasLimit(contract, item.batch);
        logger.info(`   ✅ 重试链上成功: ${tx.hash}`);

        // [P0] Fix: DB 标记单独处理
        try {
          await this.db.markAsSynced(tx.syncedAddresses);
          logger.info(`   ✅ 重试 DB 标记成功`);
        } catch (dbError) {
          logger.error(`   ❌ 重试 DB 标记失败（链上已成功）: ${dbError.message}`);
          // 不重新加入链上重试队列，避免重复支付 Gas
        }
      } catch (error) {
        item.retryCount++;
        item.lastAttempt = Date.now();
        item.nextRetryAt = now + this._calculateRetryDelay(item.retryCount);
        item.error = error.message;
        this.retryQueue.push(item);
        logger.error(`   ❌ 重试失败: ${error.message}`);
      }
    }

    this.isProcessingRetryQueue = false;
    logger.info(`[RetryQueue] 处理完成，剩余 ${this.retryQueue.length} 个批次`);
  }

  /**
   * [Low] 安全包装 RPC 请求，防止 URL 泄露
   */
  async _safeRpcCall(promise) {
    try {
      return await promise;
    } catch (error) {
      // 移除 URL 相关的敏感信息
      if (error.message && this.rpcUrl && error.message.includes(this.rpcUrl)) {
        error.message = error.message.replace(this.rpcUrl, '[REDACTED_RPC_URL]');
      }
      throw error;
    }
  }

  /**
   * 发送批次交易（带Gas硬上限）
   * [M] Fix: 返回实际同步成功的地址列表 syncedAddresses
   * [H] Fix: 校验交易回执状态，防止链上 Revert 被误认为成功
   */
  async _sendBatchWithGasLimit(contract, addresses) {
    const accounts = [];
    const riskScores = [];
    const tiers = [];
    const isSanctionedList = [];
    const syncedAddresses = [];

    for (const addr of addresses) {
      // 验证地址格式
      if (!ethers.isAddress(addr.address)) {
        logger.warn(`   ⚠️ Invalid address skipped: ${addr.address}`);
        continue;
      }
      accounts.push(addr.address);
      syncedAddresses.push(addr);

      // 分类映射
      switch (addr.category) {
        case 'BLACKLIST':
          riskScores.push(100);
          tiers.push(3); // HIGH
          isSanctionedList.push(true);
          break;
        case 'GRAYLIST':
          riskScores.push(50);
          tiers.push(2); // MEDIUM
          isSanctionedList.push(false);
          break;
        case 'WHITELIST':
          riskScores.push(0);
          tiers.push(0); // LOW
          isSanctionedList.push(false);
          break;
        default:
          riskScores.push(30);
          tiers.push(1); // UNKNOWN
          isSanctionedList.push(false);
      }
    }

    if (accounts.length === 0) {
      throw new Error('No valid addresses in batch');
    }

    // [H] Fix: 估算Gas并检查硬上限 - 使用 BigInt 统一运算
    const estimatedGas = await this._safeRpcCall(
      contract.batchUpdateRiskProfiles.estimateGas(
        accounts, riskScores, tiers, isSanctionedList
      )
    );

    const maxGasLimitBig = BigInt(GAS_CONFIG.maxGasLimit);

    if (estimatedGas > maxGasLimitBig) {
      throw new Error(
        `Gas估算超出硬上限: ${estimatedGas} > ${maxGasLimitBig}. ` +
        `请减少批次大小或优化合约。`
      );
    }

    // [H] Fix: 增加 20% 缓冲 - 使用 BigInt 运算 (estimatedGas * 120n / 100n)
    const bufferedGas = (estimatedGas * 120n) / 100n;
    const finalGasLimit = bufferedGas > maxGasLimitBig ? maxGasLimitBig : bufferedGas;

    // 发送交易（带Gas硬上限）
    const tx = await this._safeRpcCall(
      contract.batchUpdateRiskProfiles(
        accounts, riskScores, tiers, isSanctionedList,
        {
          gasLimit: finalGasLimit,
          maxFeePerGas: GAS_CONFIG.maxFeePerGas,
          maxPriorityFeePerGas: GAS_CONFIG.maxPriorityFeePerGas,
        }
      )
    );

    logger.info(`   📤 交易已发送: ${tx.hash}`);
    logger.info(`   ⛽ Gas Limit: ${finalGasLimit}`);

    // 等待确认
    const receipt = await this._safeRpcCall(tx.wait(1));

    // [High] Fix: 必须检查交易回执状态，防止链上 Revert 被误认为成功
    if (receipt.status === 0) {
      throw new Error(`交易在链上执行失败: ${tx.hash}`);
    }

    logger.info(`   ✅ 交易已确认: ${tx.hash}`);
    logger.info(`   ⛽ Gas Used: ${receipt.gasUsed}`);

    return {
      hash: tx.hash || receipt.transactionHash,
      gasUsed: receipt.gasUsed,
      syncedAddresses,
      accounts,
    };
  }

  /**
   * 同步地址到链上
   */
  async syncToChain() {
    // [High] 优雅停机检查
    if (this.isShuttingDown) {
      logger.info('[Sync] 检测到停机信号，跳过本次同步');
      return;
    }

    if (this.isSyncing) {
      logger.info('[Sync] 已有同步任务在运行');
      return;
    }

    if (!this.wallet) {
      throw new Error('钱包未初始化，无法同步到链上');
    }

    this.isSyncing = true;

    try {
      // 创建合约实例
      const contract = new ethers.Contract(
        this.contractAddress,
        CONTRACT_ABI,
        this.wallet
      );

      // 获取未同步的地址
      const unsyncedAddresses = await this.db.getUnsyncedAddresses();

      if (!unsyncedAddresses || unsyncedAddresses.length === 0) {
        logger.info('[Sync] 没有需要同步的地址');
        return;
      }

      logger.info(`[Sync] 开始同步 ${unsyncedAddresses.length} 个地址到链上`);

      // 分批处理
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < unsyncedAddresses.length; i += batchSize) {
        batches.push(unsyncedAddresses.slice(i, i + batchSize));
      }

      let totalSuccessCount = 0;
      let totalFailedCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        // [High] 优雅停机检查
        if (this.isShuttingDown) {
          logger.info('[Sync] 检测到停机信号，将剩余批次放入重试队列');
          for (let j = i; j < batches.length; j++) {
            this._addToRetryQueue(batches[j], new Error('服务正在关闭'));
          }
          break;
        }

        logger.info(`[Sync] 处理批次 ${i + 1}/${batches.length} (${batch.length} 个地址)`);

        try {
          const tx = await this._sendBatchWithGasLimit(contract, batch);
          totalSuccessCount += tx.syncedAddresses.length;
          logger.info(`   ✅ 批次链上成功: ${tx.hash}`);

          // [P0] Fix: DB 标记单独 try-catch，DB 失败不重新上链
          try {
            await this.db.markAsSynced(tx.syncedAddresses);
            logger.info(`   ✅ DB 标记成功: ${tx.syncedAddresses.length} 个地址`);
          } catch (dbError) {
            logger.error(`   ❌ DB 标记失败（链上已成功）: ${dbError.message}`);
            logger.warn(`   ⚠️ 已记录 tx hash ${tx.hash} 供后续对账，不重新发送链上交易`);
            // 可选：写入死信记录或告警，但不加入链上重试队列
          }
        } catch (error) {
          logger.error(`   ❌ 批次失败: ${error.message}`);

          // [Medium] Fix: 如果是 Gas 超限且批次大小 > 1，拆分批次重试
          if (error.message.includes('Gas估算超出硬上限') && batch.length > 1) {
            logger.warn(`   ⚠️ 触发 Gas 超限降级，正在拆分批次...`);
            const mid = Math.floor(batch.length / 2);
            const leftHalf = batch.slice(0, mid);
            const rightHalf = batch.slice(mid);

            // 分别尝试两个子批次
            for (const subBatch of [leftHalf, rightHalf]) {
              try {
                const subTx = await this._sendBatchWithGasLimit(contract, subBatch);
                totalSuccessCount += subTx.syncedAddresses.length;
                logger.info(`   ✅ 拆分批次链上成功: ${subTx.hash}`);

                // [P0] Fix: DB 标记单独处理
                try {
                  await this.db.markAsSynced(subTx.syncedAddresses);
                } catch (dbError) {
                  logger.error(`   ❌ 拆分批次 DB 标记失败（链上已成功）: ${dbError.message}`);
                }
              } catch (subError) {
                logger.error(`   ❌ 拆分批次失败: ${subError.message}`);
                totalFailedCount += subBatch.length;
                this._addToRetryQueue(subBatch, subError);
              }
            }
          } else {
            // 其他错误正常加入重试
            totalFailedCount += batch.length;
            this._addToRetryQueue(batch, error);
          }
        }
      }

      // 处理重试队列
      await this._processRetryQueue(contract);

      logger.info(`[Sync] 同步完成: 成功 ${totalSuccessCount}, 失败 ${totalFailedCount}`);

      return {
        successCount: totalSuccessCount,
        failedCount: totalFailedCount,
        retryQueueLength: this.retryQueue.length,
      };
    } catch (error) {
      logger.error('[Sync] 同步失败:', error.message);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 获取同步状态
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      isShuttingDown: this.isShuttingDown,
      isProcessingRetryQueue: this.isProcessingRetryQueue,
      retryQueueLength: this.retryQueue.length,
      contractAddress: this.contractAddress,
      walletAddress: this.wallet?.address || null,
    };
  }
}

module.exports = { BlockchainSyncService };