/**
 * 增量同步调度器（服务层）
 *
 * 负责：
 * 1. 管理各数据源的增量同步游标 (lastSyncCursor)
 * 2. 根据 SYNC_MODE 环境变量控制同步策略
 * 3. 增量数据量超过阈值时自动 fallback 到 full sync
 * 4. 与 DLQ 集成，记录单条记录同步失败
 *
 * 注：此文件为服务层调度器，主 Cron 调度逻辑在 src/scheduler.js
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { defaultLogger: secureLog } = require('../utils/logger');
const { DLQService, INCREMENTAL_FALLBACK_THRESHOLD } = require('./dlq');
const { SanctionsDataManager } = require('../../sanctions-sync');

// ==================== 同步模式 ====================
const SYNC_MODE = process.env.SYNC_MODE || 'auto'; // incremental | full | auto

// ==================== 数据源定义 ====================
const DATA_SOURCE_KEYS = {
  OFAC: 'ofac',
  UN: 'un',
  HMT: 'hmt',
  EU: 'eu',
};

// ==================== 增量同步调度器 ====================
class IncrementalSyncScheduler {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
    this.isExternalPrisma = !!prismaInstance;
    this.dlq = new DLQService(this.prisma);
    this.sanctionsManager = new SanctionsDataManager();
  }

  async init() {
    await this.sanctionsManager.ensureCacheDir();
    secureLog.info('[IncrementalScheduler] 初始化完成');
  }

  /**
   * 获取数据源的同步配置（含游标）
   */
  async getSourceConfig(sourceKey) {
    const name = this._mapSourceKeyToName(sourceKey);

    let config = await this.prisma.dataSourceConfig.findUnique({
      where: { name },
    });

    // 如果不存在，自动创建
    if (!config) {
      config = await this.prisma.dataSourceConfig.create({
        data: {
          name,
          enabled: true,
          lastSyncMode: 'full',
        },
      });
      secureLog.info(`[IncrementalScheduler] 自动创建数据源配置: ${name}`);
    }

    return config;
  }

  /**
   * 更新数据源的同步游标和模式
   */
  async updateSourceCursor(sourceKey, cursor, mode) {
    const name = this._mapSourceKeyToName(sourceKey);

    await this.prisma.dataSourceConfig.update({
      where: { name },
      data: {
        lastSyncCursor: cursor,
        lastSyncMode: mode,
        lastSync: new Date(),
      },
    });

    secureLog.info(`[IncrementalScheduler] 更新游标: ${name}, cursor=${cursor}, mode=${mode}`);
  }

  /**
   * 判断当前应使用哪种同步模式
   *
   * @param {string} sourceKey - 数据源标识
   * @param {number} incrementalCount - 增量数据预估量
   * @returns {Promise<string>} 'incremental' | 'full'
   */
  async resolveSyncMode(sourceKey, incrementalCount = 0) {
    const envMode = SYNC_MODE;

    // 环境变量强制模式
    if (envMode === 'full') return 'full';
    if (envMode === 'incremental') return 'incremental';

    // auto 模式：根据数据量智能判断
    if (envMode === 'auto') {
      // 如果预估增量数据量超过阈值，fallback 到 full sync
      if (incrementalCount > INCREMENTAL_FALLBACK_THRESHOLD) {
        secureLog.warn(
          `[IncrementalScheduler] ${sourceKey} 增量数据量 ${incrementalCount} > 阈值 ${INCREMENTAL_FALLBACK_THRESHOLD}，` +
          `fallback 到 full sync`
        );
        return 'full';
      }

      // 如果没有游标（首次同步），也走 full sync
      const config = await this.getSourceConfig(sourceKey);
      if (!config.lastSyncCursor) {
        secureLog.info(`[IncrementalScheduler] ${sourceKey} 无历史游标，使用 full sync`);
        return 'full';
      }

      return 'incremental';
    }

    // 默认 fallback
    return 'full';
  }

  /**
   * 执行单个数据源的增量同步
   *
   * @param {string} sourceKey - 数据源标识 (ofac, un, hmt, eu)
   * @param {object} options - 同步选项
   * @param {Function} options.processRecord - 单条记录处理函数，接收 entry，返回 Promise<void>
   * @returns {Promise<object>} 同步结果
   */
  async syncSource(sourceKey, options = {}) {
    const startTime = Date.now();
    const config = await this.getSourceConfig(sourceKey);

    secureLog.info(`[IncrementalScheduler] 开始同步: ${sourceKey}, 上次游标=${config.lastSyncCursor || '无'}`);

    let mode;
    let entries = [];
    let cursor;
    let fetchError = null;

    try {
      // Step 1: 获取增量数据
      const fetchResult = await this._fetchIncrementalData(sourceKey, config);
      entries = fetchResult.entries || [];
      cursor = fetchResult.cursor;
      fetchError = fetchResult.error;

      // Step 2: 解析同步模式
      mode = await this.resolveSyncMode(sourceKey, entries.length);

      // 如果解析为 full 但实际获取的是增量数据，清空 entries 重新全量拉取
      if (mode === 'full' && config.lastSyncCursor) {
        secureLog.info(`[IncrementalScheduler] ${sourceKey} 切换到 full sync，重新拉取全量数据`);
        const fullResult = await this._fetchFullData(sourceKey);
        entries = fullResult.entries || [];
        cursor = fullResult.cursor;
      }

      secureLog.info(`[IncrementalScheduler] ${sourceKey} 拉取到 ${entries.length} 条记录, mode=${mode}`);

    } catch (error) {
      secureLog.error(`[IncrementalScheduler] ${sourceKey} 数据拉取失败: ${error.message}`);
      // 失败时尝试使用缓存数据
      const cached = await this.sanctionsManager.readCache(sourceKey);
      if (cached && cached.entries) {
        entries = cached.entries;
        cursor = cached.fetchedAt;
        mode = 'full'; // 缓存视为全量
        secureLog.info(`[IncrementalScheduler] ${sourceKey} 使用缓存数据: ${entries.length} 条`);
      } else {
        throw error;
      }
    }

    // Step 3: 逐条处理记录（带 DLQ 失败记录）
    const processRecord = options.processRecord;
    let processed = 0;
    let failed = 0;
    const failedRecordIds = [];

    if (typeof processRecord === 'function') {
      for (const entry of entries) {
        try {
          await processRecord(entry, sourceKey);
          processed++;
        } catch (error) {
          failed++;
          const recordId = entry.uid || entry.sourceId || `unknown-${failed}`;
          failedRecordIds.push(recordId);

          // 记录到 DLQ
          await this.dlq.recordFailure(sourceKey, recordId, error);
          secureLog.warn(`[IncrementalScheduler] ${sourceKey} 记录处理失败: ${recordId}, ${error.message}`);
        }
      }
    } else {
      // 如果没有提供处理函数，只返回数据不处理
      processed = entries.length;
      secureLog.info(`[IncrementalScheduler] ${sourceKey} 未提供 processRecord，仅返回数据`);
    }

    // Step 4: 更新游标（即使部分失败也更新游标，避免重复拉取）
    if (cursor) {
      await this.updateSourceCursor(sourceKey, cursor, mode);
    }

    const duration = Date.now() - startTime;

    // Step 5: 写入 SyncHistory 日志
    try {
      await this.prisma.syncHistory.create({
        data: {
          source: sourceKey,
          addressesCount: entries.length,
          newCount: processed,
          updatedCount: 0, // 由上层计算
          status: failed === 0 ? 'SUCCESS' : (failed < entries.length ? 'PARTIAL' : 'ERROR'),
          details: JSON.stringify({
            mode,
            processed,
            failed,
            failedRecordIds: failedRecordIds.slice(0, 50), // 限制长度
            duration,
          }),
        },
      });
    } catch (logError) {
      secureLog.error(`[IncrementalScheduler] SyncHistory 写入失败: ${logError.message}`);
    }

    secureLog.info(
      `[IncrementalScheduler] ${sourceKey} 同步完成: mode=${mode}, ` +
      `total=${entries.length}, processed=${processed}, failed=${failed}, ${duration}ms`
    );

    return {
      source: sourceKey,
      mode,
      total: entries.length,
      processed,
      failed,
      failedRecordIds,
      cursor,
      duration,
    };
  }

  /**
   * 执行所有数据源的同步
   */
  async syncAllSources(options = {}) {
    secureLog.info('[IncrementalScheduler] ====== 开始全量数据源同步 ======');

    const sources = Object.values(DATA_SOURCE_KEYS);
    const results = [];

    // 先处理 DLQ 重试
    if (options.retryHandler) {
      await this.dlq.processRetries(options.retryHandler);
    }

    // 串行同步各数据源（避免并发请求过多）
    for (const sourceKey of sources) {
      try {
        const result = await this.syncSource(sourceKey, options);
        results.push(result);
      } catch (error) {
        secureLog.error(`[IncrementalScheduler] ${sourceKey} 同步异常: ${error.message}`);
        results.push({
          source: sourceKey,
          mode: 'error',
          total: 0,
          processed: 0,
          failed: 0,
          error: error.message,
        });
      }
    }

    // 同步结束后检查永久失败并告警
    await this.dlq.alertPermanentFailures();

    const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0);

    secureLog.info(
      `[IncrementalScheduler] ====== 全量同步完成: ` +
      `processed=${totalProcessed}, failed=${totalFailed} ======`
    );

    return {
      results,
      totalProcessed,
      totalFailed,
    };
  }

  /**
   * 获取各数据源的同步状态摘要
   */
  async getSyncStatus() {
    const configs = await this.prisma.dataSourceConfig.findMany({
      orderBy: { name: 'asc' },
    });

    const pendingFailures = await this.prisma.syncFailure.groupBy({
      by: ['source'],
      where: { status: { in: ['pending', 'retrying'] } },
      _count: { id: true },
    });

    const permanentFailures = await this.prisma.syncFailure.groupBy({
      by: ['source'],
      where: { status: 'permanent_failure' },
      _count: { id: true },
    });

    const pendingMap = {};
    for (const p of pendingFailures) pendingMap[p.source] = p._count.id;

    const permanentMap = {};
    for (const p of permanentFailures) permanentMap[p.source] = p._count.id;

    return configs.map((c) => ({
      name: c.name,
      enabled: c.enabled,
      lastSync: c.lastSync,
      lastSyncCursor: c.lastSyncCursor,
      lastSyncMode: c.lastSyncMode,
      pendingFailures: pendingMap[c.name] || 0,
      permanentFailures: permanentMap[c.name] || 0,
    }));
  }

  // ==================== 私有方法 ====================

  /**
   * 拉取增量数据（基于游标）
   */
  async _fetchIncrementalData(sourceKey, config) {
    const adapter = this._getAdapter(sourceKey);
    if (!adapter) {
      throw new Error(`Unknown source: ${sourceKey}`);
    }

    // 如果适配器支持增量拉取，传入游标
    if (typeof adapter.fetchIncremental === 'function') {
      return adapter.fetchIncremental(config.lastSyncCursor);
    }

    // 否则 fallback 到全量拉取
    secureLog.warn(`[IncrementalScheduler] ${sourceKey} 不支持增量拉取，fallback 到全量`);
    return this._fetchFullData(sourceKey);
  }

  /**
   * 拉取全量数据
   */
  async _fetchFullData(sourceKey) {
    const adapter = this._getAdapter(sourceKey);
    if (!adapter) {
      throw new Error(`Unknown source: ${sourceKey}`);
    }

    const result = await adapter.fetch();

    return {
      entries: result.entries || [],
      cursor: result.fetchedAt || new Date().toISOString(),
    };
  }

  _getAdapter(sourceKey) {
    const adapters = this.sanctionsManager.adapters;
    return adapters[sourceKey] || null;
  }

  _mapSourceKeyToName(sourceKey) {
    const map = {
      ofac: 'ofac',
      un: 'un',
      hmt: 'hmt',
      eu: 'eu',
    };
    return map[sourceKey] || sourceKey;
  }

  /**
   * 关闭连接
   */
  async disconnect() {
    await this.dlq.disconnect();
    if (!this.isExternalPrisma) {
      await this.prisma.$disconnect();
    }
  }
}

module.exports = {
  IncrementalSyncScheduler,
  SYNC_MODE,
  DATA_SOURCE_KEYS,
};
