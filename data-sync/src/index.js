/**
 * FidesOrigin 自动化风险数据同步系统 — 入口文件
 *
 * 功能：
 * 1. 定时从多个数据源抓取风险地址
 * 2. 聚合、清洗、去重
 * 3. 生成 Merkle 树并同步到链上
 * 4. 进程守护与自动重连（高可用）
 *
 * 模块结构：
 *   index.js       — 入口（本文件）
 *   scheduler.js   — Cron 调度 + 主同步流程
 *   merkleBuilder.js — Merkle Tree 构建
 *   chainSyncer.js — 链上同步 + KMS 签名
 *   alertManager.js — 告警通知
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { defaultLogger: secureLog } = require('./utils/logger');
const { setupGlobalErrorHandlers } = require('./utils/errors');
const { HealthCheckServer } = require('./utils/healthCheck');

// 模块导入
const { sendAlert } = require('./alertManager');
const { initBlockchain, getProvider } = require('./chainSyncer');
const { scheduleSyncJobs, cleanupTimersAndListeners, setShuttingDown } = require('./scheduler');

// ==================== Prisma 客户端 ====================
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// ==================== 审计日志（轻量级，供模块共享）====================
class AuditLogger {
  constructor() {
    this.logs = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 60000;
    this.isFlushing = false;
    this.fallbackLogPath = path.join(process.cwd(), 'audit.log');
    this._timer = null;
    this.startFlushTimer();
  }
  log(action, details = {}) {
    this.logs.push({ timestamp: new Date().toISOString(), action, details, pid: process.pid, hostname: os.hostname() });
    if (['SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED', 'MERKLE_ROOT_UPDATED'].includes(action)) this.flush();
    if (this.logs.length >= this.maxBufferSize) this.flush();
  }
  async flush() {
    if (this.logs.length === 0 || this.isFlushing) return;
    this.isFlushing = true;
    const batch = this.logs.splice(0, this.logs.length);
    try {
      await prisma.auditLog.createMany({ data: batch, skipDuplicates: true });
    } catch (e) {
      this.logs.unshift(...batch);
      try { fs.appendFileSync(this.fallbackLogPath, batch.map(b => JSON.stringify(b)).join('\n') + '\n', { mode: 0o600 }); } catch {}
    } finally { this.isFlushing = false; }
  }
  startFlushTimer() { this._timer = setInterval(() => this.flush(), this.flushInterval); this._timer.unref(); }
  destroy() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
}

const auditLogger = new AuditLogger();

// ==================== 健康检查 ====================
let healthCheckServer = null;

// ==================== 数据库连接 ====================
async function connectDatabase() {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try { await prisma.$connect(); secureLog.info('[DB] 数据库连接成功'); return; }
    catch (error) {
      lastError = error;
      secureLog.error(`[DB] 连接失败 (尝试 ${attempt}/10):`, error.message);
      if (attempt < 10) await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 30000)));
    }
  }
  throw lastError;
}

// ==================== 优雅关闭 ====================
async function gracefulShutdown(signal) {
  if (signal) setShuttingDown(true);
  secureLog.info(`[Shutdown] 收到 ${signal} 信号，开始优雅关闭...`);
  const shutdownTimeout = setTimeout(() => { secureLog.error('[Shutdown] 超时，强制退出'); process.exit(1); }, 10000);
  try {
    cleanupTimersAndListeners(auditLogger);
    await auditLogger.flush();
    if (healthCheckServer) await healthCheckServer.stop();
    await prisma.$disconnect();
    const provider = getProvider();
    if (provider && typeof provider.destroy === 'function') provider.destroy();
    clearTimeout(shutdownTimeout);
    secureLog.info('[Shutdown] 优雅关闭完成');
    process.exit(0);
  } catch (error) {
    secureLog.error('[Shutdown] 出错:', error.message);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// ==================== 进程守护 ====================
function setupProcessGuardian() {
  process.on('uncaughtException', (error) => {
    secureLog.error('[Guardian] 未捕获异常:', error.message);
    sendAlert(`[CRITICAL] 未捕获异常: ${error.message}`).catch(() => {});
  });
  process.on('unhandledRejection', (reason) => {
    secureLog.error('[Guardian] 未处理的 Promise 拒绝:', reason);
    sendAlert(`[CRITICAL] Promise 拒绝: ${reason}`).catch(() => {});
  });
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
}

// ==================== 主函数 ====================
async function main() {
  try {
    secureLog.info('========================================');
    secureLog.info('  FidesOrigin Auto Risk Data Sync');
    secureLog.info('========================================');
    secureLog.info(`[Main] PID: ${process.pid}, Node: ${process.version}`);

    setupGlobalErrorHandlers();
    setupProcessGuardian();
    await connectDatabase();

    const healthPort = parseInt(process.env.HEALTH_CHECK_PORT || '3001');
    healthCheckServer = new HealthCheckServer({ port: healthPort, prisma, provider: null });
    healthCheckServer.start();

    await initBlockchain(healthCheckServer);
    scheduleSyncJobs(prisma, auditLogger, healthCheckServer);

    auditLogger.log('SERVICE_STARTED', { pid: process.pid });
    secureLog.info('[Main] 服务启动完成，等待定时任务触发...');
    process.stdin.resume();
  } catch (error) {
    secureLog.error('[Main] 启动失败:', error.message);
    secureLog.error(error.stack);
    await sendAlert(`[CRITICAL] 服务启动失败: ${error.message}`);
    process.exit(1);
  }
}

// ==================== 导出（向后兼容）====================
module.exports = {
  prisma,
  runSyncCycle: () => require('./scheduler').runSyncCycle(prisma, auditLogger),
  gracefulShutdown,
};

// ==================== 启动 ====================
if (require.main === module) {
  main();
}
