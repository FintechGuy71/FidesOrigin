/**
 * Dead Letter Queue 服务
 *
 * 负责：
 * 1. 记录失败的同步任务到 Prisma SyncFailure 表
 * 2. 指数退避重试策略（最多 3 次）
 * 3. 超过重试次数 → 标记 permanent_failure + 告警
 * 4. 提供 reprocessFailures() 手动重试接口
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { defaultLogger: secureLog } = require('../utils/logger');
const { sendAlert } = require('../alertManager');

// ==================== 重试配置 ====================
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MINUTES = [1, 5, 15]; // 指数退避：第1次1min，第2次5min，第3次15min
const INCREMENTAL_FALLBACK_THRESHOLD = 5000; // 增量数据量超过此阈值 fallback 到 full sync

// ==================== DLQ Service ====================
class DLQService {
  constructor(prismaInstance) {
    // 允许注入已有的 PrismaClient（如 databaseService 中的实例）
    this.prisma = prismaInstance || new PrismaClient();
    this.isExternalPrisma = !!prismaInstance;
  }

  /**
   * 记录同步失败
   *
   * [Audit-Fix #28] Note on upsert behavior: The where clause for Prisma upsert requires a unique constraint.
   * Since `source + recordId` may not have a unique constraint in the Prisma schema, this method
   * falls back to findFirst + create/update (the _recordFailureFallback method).
   * Consider adding a @@unique([source, recordId]) constraint to the SyncFailure model for native upserts.
   *
   * @param {string} source - 数据源名称 (ofac, un, hmt, eu, chainalysis...)
   * @param {string} recordId - 失败记录的标识符
   * @param {string|Error} error - 错误信息
   * @param {object} options - 可选参数
   * @param {number} options.retryCount - 初始重试次数（默认 0）
   * @param {Date} options.nextRetryAt - 下次重试时间
   * @returns {Promise<object>} 创建的失败记录
   */
  async recordFailure(source, recordId, error, options = {}) {
    if (!source || typeof source !== 'string') {
      throw new Error('DLQ recordFailure: source is required');
    }
    if (!recordId && recordId !== 0) {
      throw new Error('DLQ recordFailure: recordId is required');
    }

    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
    const errorStack = error instanceof Error ? error.stack : null;

    const retryCount = options.retryCount || 0;
    const nextRetryAt = options.nextRetryAt || this._computeNextRetryAt(retryCount);

    try {
      const failure = await this.prisma.syncFailure.upsert({
        where: {
          // 使用 source + recordId 复合唯一约束
          // Prisma 不直接支持复合唯一 upsert where，改用 findFirst + create/update
        },
        create: {
          source,
          recordId: String(recordId),
          error: errorMessage.slice(0, 2000), // 限制长度
          retryCount,
          status: retryCount >= MAX_RETRIES ? 'permanent_failure' : 'pending',
          nextRetryAt,
        },
        update: {
          error: errorMessage.slice(0, 2000),
          retryCount,
          status: retryCount >= MAX_RETRIES ? 'permanent_failure' : 'pending',
          nextRetryAt,
          updatedAt: new Date(),
        },
      });

      secureLog.warn(`[DLQ] 记录失败: source=${source}, recordId=${recordId}, retry=${retryCount}, status=${failure.status}`);
      return failure;
    } catch (dbError) {
      // 如果 upsert 的 where 不生效（Prisma 限制），fallback 到 findFirst + create/update
      secureLog.warn(`[DLQ] upsert 失败，使用 findFirst fallback: ${dbError.message}`);
      return this._recordFailureFallback(source, recordId, errorMessage, retryCount, nextRetryAt);
    }
  }

  /**
   * Fallback: findFirst + create/update（处理复合唯一键场景）
   */
  async _recordFailureFallback(source, recordId, errorMessage, retryCount, nextRetryAt) {
    const existing = await this.prisma.syncFailure.findFirst({
      where: { source, recordId: String(recordId) },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return this.prisma.syncFailure.update({
        where: { id: existing.id },
        data: {
          error: errorMessage.slice(0, 2000),
          retryCount,
          status: retryCount >= MAX_RETRIES ? 'permanent_failure' : 'pending',
          nextRetryAt,
          updatedAt: new Date(),
        },
      });
    }

    return this.prisma.syncFailure.create({
      data: {
        source,
        recordId: String(recordId),
        error: errorMessage.slice(0, 2000),
        retryCount,
        status: retryCount >= MAX_RETRIES ? 'permanent_failure' : 'pending',
        nextRetryAt,
      },
    });
  }

  /**
   * 计算下次重试时间
   */
  _computeNextRetryAt(retryCount) {
    const delayMinutes = RETRY_BACKOFF_MINUTES[Math.min(retryCount, RETRY_BACKOFF_MINUTES.length - 1)] || 15;
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  /**
   * 处理待重试的失败记录
   * 由调度器在同步周期开始前调用
   *
   * @param {Function} retryHandler - 重试处理函数，接收 failure 对象，返回 Promise<boolean>（true=成功）
   * @returns {Promise<object>} 重试统计
   */
  async processRetries(retryHandler) {
    if (typeof retryHandler !== 'function') {
      secureLog.info('[DLQ] 未提供 retryHandler，跳过重试处理');
      return { processed: 0, resolved: 0, failed: 0 };
    }

    const now = new Date();

    // 查询所有待重试的记录（pending 且 nextRetryAt <= now，或 retrying 状态）
    const pendingFailures = await this.prisma.syncFailure.findMany({
      where: {
        OR: [
          { status: 'pending', nextRetryAt: { lte: now } },
          { status: 'retrying' },
        ],
        retryCount: { lt: MAX_RETRIES },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: 100, // 每次最多处理 100 条
    });

    secureLog.info(`[DLQ] 开始处理重试: ${pendingFailures.length} 条记录`);

    let resolved = 0;
    let failed = 0;

    for (const failure of pendingFailures) {
      try {
        // 标记为 retrying
        await this.prisma.syncFailure.update({
          where: { id: failure.id },
          data: { status: 'retrying', updatedAt: new Date() },
        });

        // 调用业务重试处理器
        const success = await retryHandler(failure);

        if (success) {
          await this.prisma.syncFailure.update({
            where: { id: failure.id },
            data: { status: 'resolved', updatedAt: new Date() },
          });
          resolved++;
          secureLog.info(`[DLQ] 重试成功: ${failure.source}/${failure.recordId}`);
        } else {
          // 重试失败，递增计数
          const newRetryCount = failure.retryCount + 1;
          const newStatus = newRetryCount >= MAX_RETRIES ? 'permanent_failure' : 'pending';
          const newNextRetryAt = newStatus === 'pending' ? this._computeNextRetryAt(newRetryCount) : null;

          await this.prisma.syncFailure.update({
            where: { id: failure.id },
            data: {
              retryCount: newRetryCount,
              status: newStatus,
              nextRetryAt: newNextRetryAt,
              updatedAt: new Date(),
            },
          });
          failed++;
          secureLog.warn(`[DLQ] 重试失败: ${failure.source}/${failure.recordId}, retry=${newRetryCount}, status=${newStatus}`);
        }
      } catch (error) {
        // 重试处理器本身抛异常
        const newRetryCount = failure.retryCount + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? 'permanent_failure' : 'pending';

        await this.prisma.syncFailure.update({
          where: { id: failure.id },
          data: {
            retryCount: newRetryCount,
            status: newStatus,
            nextRetryAt: newStatus === 'pending' ? this._computeNextRetryAt(newRetryCount) : null,
            error: `Retry handler error: ${error.message}`.slice(0, 2000),
            updatedAt: new Date(),
          },
        });
        failed++;
        secureLog.error(`[DLQ] 重试异常: ${failure.source}/${failure.recordId}: ${error.message}`);
      }
    }

    secureLog.info(`[DLQ] 重试处理完成: ${pendingFailures.length} 处理, ${resolved} 成功, ${failed} 失败`);
    return { processed: pendingFailures.length, resolved, failed };
  }

  /**
   * 获取永久失败的记录（用于告警）
   */
  async getPermanentFailures(source = null) {
    const where = { status: 'permanent_failure' };
    if (source) where.source = source;

    return this.prisma.syncFailure.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 获取所有未解决的失败记录
   */
  async getPendingFailures(source = null) {
    const where = {
      status: { in: ['pending', 'retrying'] },
    };
    if (source) where.source = source;

    return this.prisma.syncFailure.findMany({
      where,
      orderBy: { nextRetryAt: 'asc' },
    });
  }

  /**
   * 手动重试永久失败的记录
   * 提供 reprocessFailures() 接口供运维手动触发
   *
   * @param {string} source - 可选，指定数据源过滤
   * @param {Function} retryHandler - 重试处理函数
   * @returns {Promise<object>} 重试统计
   */
  async reprocessFailures(source = null, retryHandler) {
    if (typeof retryHandler !== 'function') {
      throw new Error('DLQ reprocessFailures: retryHandler is required');
    }

    const where = { status: 'permanent_failure' };
    if (source) where.source = source;

    const permanentFailures = await this.prisma.syncFailure.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    secureLog.info(`[DLQ] 手动重试永久失败记录: ${permanentFailures.length} 条`);

    let resolved = 0;
    let failed = 0;

    for (const failure of permanentFailures) {
      try {
        // 重置状态为 retrying，重置 retryCount 为 0 允许重新计数
        await this.prisma.syncFailure.update({
          where: { id: failure.id },
          data: { status: 'retrying', retryCount: 0, updatedAt: new Date() },
        });

        const success = await retryHandler(failure);

        if (success) {
          await this.prisma.syncFailure.update({
            where: { id: failure.id },
            data: { status: 'resolved', updatedAt: new Date() },
          });
          resolved++;
        } else {
          // 手动重试也失败，回到 pending 状态，重试计数归 1
          await this.prisma.syncFailure.update({
            where: { id: failure.id },
            data: {
              status: 'pending',
              retryCount: 1,
              nextRetryAt: this._computeNextRetryAt(1),
              updatedAt: new Date(),
            },
          });
          failed++;
        }
      } catch (error) {
        await this.prisma.syncFailure.update({
          where: { id: failure.id },
          data: {
            status: 'pending',
            retryCount: 1,
            nextRetryAt: this._computeNextRetryAt(1),
            error: `Manual retry error: ${error.message}`.slice(0, 2000),
            updatedAt: new Date(),
          },
        });
        failed++;
        secureLog.error(`[DLQ] 手动重试异常: ${failure.source}/${failure.recordId}: ${error.message}`);
      }
    }

    secureLog.info(`[DLQ] 手动重试完成: ${permanentFailures.length} 处理, ${resolved} 成功, ${failed} 失败`);
    return { processed: permanentFailures.length, resolved, failed };
  }

  /**
   * 告警：永久失败的记录通知
   * 在同步周期结束后调用
   */
  async alertPermanentFailures(source = null) {
    const failures = await this.getPermanentFailures(source);

    if (failures.length === 0) {
      secureLog.info('[DLQ] 无永久失败记录');
      return { alerted: false, count: 0 };
    }

    // 按 source 分组统计
    const bySource = {};
    for (const f of failures) {
      bySource[f.source] = (bySource[f.source] || 0) + 1;
    }

    const summary = Object.entries(bySource)
      .map(([s, c]) => `${s}: ${c}`)
      .join(', ');

    const message = `[DLQ ALERT] 同步死信队列存在 ${failures.length} 条永久失败记录 (${summary})。需要人工介入处理。`;

    secureLog.error(`[DLQ] ${message}`);

    try {
      await sendAlert(message);
    } catch (alertError) {
      secureLog.error(`[DLQ] 告警发送失败: ${alertError.message}`);
    }

    return { alerted: true, count: failures.length, bySource };
  }

  /**
   * 清理已解决的旧记录（可选，定期任务）
   */
  async cleanupResolved(olderThanDays = 30) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.syncFailure.deleteMany({
      where: {
        status: 'resolved',
        updatedAt: { lt: cutoff },
      },
    });

    secureLog.info(`[DLQ] 清理已解决记录: ${result.count} 条 (>${olderThanDays}天)`);
    return result.count;
  }

  /**
   * 关闭连接
   */
  async disconnect() {
    if (!this.isExternalPrisma) {
      await this.prisma.$disconnect();
    }
  }
}

module.exports = {
  DLQService,
  MAX_RETRIES,
  RETRY_BACKOFF_MINUTES,
  INCREMENTAL_FALLBACK_THRESHOLD,
};
