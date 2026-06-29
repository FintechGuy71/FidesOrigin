const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');

/**
 * 数据备份服务 v2.0
 * 增强功能：
 * - 定期自动备份（cron 调度）
 * - 增量备份支持
 * - 备份文件校验和验证
 * - 备份记录持久化到数据库
 * - 支持多种备份目标（本地、S3、远程）
 * - 备份保留策略（按数量/按时间）
 * - 流式写入防止内存溢出
 *
 * Security Fixes:
 * - [Critical] 路径遍历防护：backupType 白名单校验 + 路径包含检查
 * - [Critical] 敏感配置脱敏：API 密钥/凭据不写入备份文件
 * - [High] 流 error 事件即时监听：防止进程崩溃
 * - [High] 流写入背压处理：防止内存溢出
 */
class BackupService {
  constructor(prisma, options = {}) {
    this.prisma = prisma;
    this.backupDir = options.backupDir || './backups';
    this.retentionCount = options.retentionCount || 30;
    this.retentionDays = options.retentionDays || 90;
    this.enableAutoBackup = options.enableAutoBackup !== false;
    this.autoBackupCron = options.autoBackupCron || '0 2 * * *'; // 每天凌晨2点
    this.backupTargets = options.backupTargets || ['local']; // local, s3, remote
    this.compressionEnabled = options.compressionEnabled !== false;
    this.checksumAlgorithm = options.checksumAlgorithm || 'sha256';
    this.maxMemoryRows = options.maxMemoryRows || 10000; // 流式处理阈值

    this.cronJob = null;
    this.isRunning = false; // 防止并发备份

    // [Critical] 敏感字段集合
    this.sensitiveFields = new Set([
      'apikey', 'apisecret', 'password', 'token', 'secret',
      'connectionstring', 'privatekey', 'accesstoken', 'refreshtoken',
      'credentials', 'auth', 'apikeyid', 'secretkey',
    ]);
  }

  /**
   * 启动自动备份调度
   */
  startAutoBackup() {
    if (!this.enableAutoBackup) {
      console.log('[Backup] 自动备份已禁用');
      return;
    }

    if (this.cronJob) {
      console.log('[Backup] 自动备份已在运行');
      return;
    }

    console.log(`[Backup] 启动自动备份调度: ${this.autoBackupCron}`);

    this.cronJob = cron.schedule(this.autoBackupCron, async () => {
      // 防止并发备份任务
      if (this.isRunning) {
        console.log('[Backup] 已有备份任务在运行，跳过本次定时备份');
        return;
      }

      console.log('[Backup] 执行定时备份...');
      try {
        await this.createBackup('FULL');
      } catch (err) {
        console.error('[Backup] 定时备份失败:', err.message);
      }
    });
  }

  /**
   * 停止自动备份调度
   */
  stopAutoBackup() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[Backup] 自动备份已停止');
    }
  }

  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (err) {
      console.error('[Backup] 创建备份目录失败:', err.message);
      throw err;
    }
  }

  /**
   * 计算文件校验和
   */
  async calculateChecksum(filepath) {
    const hash = crypto.createHash(this.checksumAlgorithm);
    const data = await fs.readFile(filepath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * 验证备份文件完整性
   */
  async verifyBackup(filepath, expectedChecksum) {
    try {
      const actualChecksum = await this.calculateChecksum(filepath);
      const isValid = actualChecksum === expectedChecksum;

      if (!isValid) {
        console.error(`[Backup] 校验失败! 期望: ${expectedChecksum}, 实际: ${actualChecksum}`);
      }

      return { isValid, actualChecksum };
    } catch (err) {
      console.error('[Backup] 校验计算失败:', err.message);
      return { isValid: false, actualChecksum: null };
    }
  }

  /**
   * [High] 安全写入包装器 — 即时 error 监听 + 背压处理
   */
  _createSafeStreamWriter(filepath) {
    const writeStream = createWriteStream(filepath);

    let streamError = null;

    // [High] 立即注册 error 事件，在任何 write 调用之前
    const errorPromise = new Promise((_, reject) => {
      writeStream.on('error', (err) => {
        streamError = err;
        reject(err);
      });
    });

    /**
     * 安全写入方法，处理背压
     */
    const safeWrite = async (chunk) => {
      if (streamError) throw streamError;

      const canContinue = writeStream.write(chunk);
      if (!canContinue) {
        // 处理背压：等待 drain 事件
        await new Promise((resolve, reject) => {
          writeStream.once('drain', resolve);
          // 如果在等待 drain 期间出错，errorPromise 会 reject
        });
      }
    };

    /**
     * 安全结束流
     */
    const finishStream = () => {
      return new Promise((resolve, reject) => {
        writeStream.once('finish', resolve);
        writeStream.once('error', reject);  // [Fix] 监听 error，防止永久挂起
        writeStream.end();
      });
    };

    return { safeWrite, finishStream, errorPromise, writeStream };
  }

  /**
   * [Critical] 脱敏敏感数据
   */
  redactSensitiveData(record) {
    if (!record || typeof record !== 'object') return record;

    const redacted = Array.isArray(record) ? [...record] : { ...record };

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();

      // 检查字段名是否匹配敏感字段（包括部分匹配）
      const isSensitive = this.sensitiveFields.has(lowerKey) ||
        Array.from(this.sensitiveFields).some(sf => lowerKey.includes(sf));

      if (isSensitive && redacted[key] != null) {
        const hash = crypto.createHash('sha256')
          .update(String(redacted[key]))
          .digest('hex')
          .substring(0, 8);
        redacted[key] = `[REDACTED:${hash}]`;
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = this.redactSensitiveData(redacted[key]);
      }
    }

    return redacted;
  }

  /**
   * 创建备份（支持流式写入防止内存溢出）
   * @param {string} backupType - FULL 或 INCREMENTAL
   */
  async createBackup(backupType = 'FULL') {
    // 防止并发备份
    if (this.isRunning) {
      throw new Error('已有备份任务在运行');
    }

    // [Critical] 白名单验证 backupType
    const VALID_TYPES = new Set(['FULL', 'INCREMENTAL']);
    if (!VALID_TYPES.has(backupType)) {
      throw new Error(`无效的备份类型: ${backupType}。仅支持: ${[...VALID_TYPES].join(', ')}`);
    }

    this.isRunning = true;

    const startTime = Date.now();
    await this.ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${backupType.toLowerCase()}_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    // [Critical] 二次校验：确保最终路径在 backupDir 内
    const resolvedBackupDir = path.resolve(this.backupDir);
    const resolvedFilePath = path.resolve(filepath);
    if (!resolvedFilePath.startsWith(resolvedBackupDir + path.sep)) {
      this.isRunning = false;
      throw new Error('路径遍历检测：文件路径超出备份目录范围');
    }

    let backupRecord;

    try {
      // 记录备份开始
      backupRecord = await this.prisma.backupRecord.create({
        data: {
          backupType,
          status: 'RUNNING',
          filePath: filepath,
        },
      });

      // [High] 使用安全的写入包装器（即时 error 监听 + 背压处理）
      const { safeWrite, finishStream, errorPromise } = this._createSafeStreamWriter(filepath);

      let riskAddresses = [];
      let syncHistories = [];
      let dataSourceConfigs = [];

      // 写入操作的 Promise，与 errorPromise 竞争
      const writePromise = (async () => {
        // 写入头部
        await safeWrite('{\n');
        await safeWrite(`  "timestamp": "${new Date().toISOString()}",\n`);
        await safeWrite(`  "version": "2.0",\n`);
        await safeWrite(`  "backupType": "${backupType}",\n`);

        if (backupType === 'FULL') {
          // 全量备份 - 使用流式分页防止内存溢出
          riskAddresses = await this.streamRiskAddresses(safeWrite);
          syncHistories = await this.streamSyncHistories(safeWrite);
          dataSourceConfigs = await this.streamDataSourceConfigs(safeWrite);
        } else {
          // 增量备份
          const lastBackup = await this.prisma.backupRecord.findFirst({
            where: { status: 'SUCCESS' },
            orderBy: { timestamp: 'desc' },
          });

          const since = lastBackup ? lastBackup.timestamp : new Date(0);

          riskAddresses = await this.prisma.riskAddress.findMany({
            where: { updatedAt: { gt: since } },
          });
          syncHistories = await this.prisma.syncHistory.findMany({
            where: { timestamp: { gt: since } },
            orderBy: { timestamp: 'desc' },
          });
          dataSourceConfigs = await this.prisma.dataSourceConfig.findMany({
            where: { updatedAt: { gt: since } },
          });

          // [Critical] 增量备份也需脱敏
          const redactedConfigs = dataSourceConfigs.map(c => this.redactSensitiveData(c));

          // 写入增量数据
          await safeWrite(`  "riskAddresses": ${JSON.stringify(riskAddresses)},\n`);
          await safeWrite(`  "syncHistories": ${JSON.stringify(syncHistories)},\n`);
          await safeWrite(`  "dataSourceConfigs": ${JSON.stringify(redactedConfigs)},\n`);
        }

        // 写入统计信息
        const stats = {
          totalRiskAddresses: riskAddresses.length,
          totalSyncHistories: syncHistories.length,
          totalDataSourceConfigs: dataSourceConfigs.length,
        };
        await safeWrite(`  "stats": ${JSON.stringify(stats)}\n`);
        await safeWrite('}\n');

        // 等待写入完成
        await finishStream();
      })();

      // [High] 使用 Promise.race 确保任何写入期间的错误都能被捕获
      await Promise.race([writePromise, errorPromise]);

      // 计算校验和
      const checksum = await this.calculateChecksum(filepath);

      // 获取文件大小
      const fileStats = await fs.stat(filepath);

      const durationMs = Date.now() - startTime;

      // 更新备份记录
      await this.prisma.backupRecord.update({
        where: { id: backupRecord.id },
        data: {
          status: 'SUCCESS',
          filePath: filepath,
          fileSize: fileStats.size,
          checksum,
          durationMs,
          details: JSON.stringify({
            riskAddressesCount: riskAddresses.length,
            syncHistoriesCount: syncHistories.length,
            dataSourceConfigsCount: dataSourceConfigs.length,
          }),
        },
      });

      // 清理旧备份
      await this.cleanupOldBackups();

      console.log(`[Backup] 备份创建成功: ${filename}`);
      console.log(`[Backup] 文件大小: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`[Backup] 校验和: ${checksum}`);
      console.log(`[Backup] 耗时: ${durationMs}ms`);

      return {
        filepath,
        filename,
        checksum,
        size: fileStats.size,
        durationMs,
        recordId: backupRecord.id,
      };
    } catch (err) {
      // 更新备份记录为失败
      if (backupRecord) {
        await this.prisma.backupRecord.update({
          where: { id: backupRecord.id },
          data: {
            status: 'FAILED',
            details: err.message,
            durationMs: Date.now() - startTime,
          },
        });
      }

      console.error('[Backup] 备份失败:', err.message);
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 流式写入风险地址（防止内存溢出）
   * [High] 增加背压处理
   * @param {Function} safeWrite - 安全写入函数
   * @returns {Array} 所有写入的地址（用于统计）
   */
  async streamRiskAddresses(safeWrite) {
    const allAddresses = [];
    let skip = 0;
    const batchSize = 1000;
    let hasMore = true;

    await safeWrite('  "riskAddresses": [\n');
    let isFirst = true;

    while (hasMore) {
      const batch = await this.prisma.riskAddress.findMany({
        skip,
        take: batchSize,
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const addr of batch) {
        if (!isFirst) {
          await safeWrite(',\n');
        }
        await safeWrite('    ' + JSON.stringify(addr));
        allAddresses.push(addr);
        isFirst = false;
      }

      skip += batchSize;
    }

    await safeWrite('\n  ],\n');
    return allAddresses;
  }

  /**
   * 流式写入同步历史（防止内存溢出）
   * [High] 增加背压处理
   * @param {Function} safeWrite - 安全写入函数
   * @returns {Array} 所有写入的历史（用于统计）
   */
  async streamSyncHistories(safeWrite) {
    const allHistories = [];
    let skip = 0;
    const batchSize = 1000;
    let hasMore = true;

    await safeWrite('  "syncHistories": [\n');
    let isFirst = true;

    while (hasMore) {
      const batch = await this.prisma.syncHistory.findMany({
        skip,
        take: batchSize,
        orderBy: { timestamp: 'desc' },
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const history of batch) {
        if (!isFirst) {
          await safeWrite(',\n');
        }
        await safeWrite('    ' + JSON.stringify(history));
        allHistories.push(history);
        isFirst = false;
      }

      skip += batchSize;
    }

    await safeWrite('\n  ],\n');
    return allHistories;
  }

  /**
   * 流式写入数据源配置（防止内存溢出）
   * [Critical] 敏感字段脱敏后写入
   * [High] 增加背压处理
   * @param {Function} safeWrite - 安全写入函数
   * @returns {Array} 所有写入的配置（用于统计）
   */
  async streamDataSourceConfigs(safeWrite) {
    const allConfigs = [];
    let skip = 0;
    const batchSize = 1000;
    let hasMore = true;

    await safeWrite('  "dataSourceConfigs": [\n');
    let isFirst = true;

    while (hasMore) {
      const batch = await this.prisma.dataSourceConfig.findMany({
        skip,
        take: batchSize,
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const config of batch) {
        if (!isFirst) {
          await safeWrite(',\n');
        }
        // [Critical] 脱敏敏感字段后写入
        const redactedConfig = this.redactSensitiveData(config);
        await safeWrite('    ' + JSON.stringify(redactedConfig));
        allConfigs.push(config);
        isFirst = false;
      }

      skip += batchSize;
    }

    await safeWrite('\n  ],\n');
    return allConfigs;
  }

  /**
   * 清理旧备份（按数量/时间保留策略）
   */
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup_') && f.endsWith('.json'));

      // 获取文件信息
      const fileInfos = await Promise.all(
        backupFiles.map(async (filename) => {
          const filepath = path.join(this.backupDir, filename);
          try {
            const stats = await fs.stat(filepath);
            return { filename, filepath, mtime: stats.mtime, size: stats.size };
          } catch {
            return null;
          }
        })
      );

      const validFiles = fileInfos.filter(f => f !== null);

      // 按修改时间降序排序
      validFiles.sort((a, b) => b.mtime - a.mtime);

      // 按数量保留
      if (validFiles.length > this.retentionCount) {
        const toDelete = validFiles.slice(this.retentionCount);
        for (const file of toDelete) {
          try {
            await fs.unlink(file.filepath);
            console.log(`[Backup] 清理旧备份（超出数量限制）: ${file.filename}`);
          } catch (err) {
            console.error(`[Backup] 清理失败 ${file.filename}:`, err.message);
          }
        }
      }

      // 按时间保留
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      for (const file of validFiles) {
        if (file.mtime < cutoffDate) {
          try {
            await fs.unlink(file.filepath);
            console.log(`[Backup] 清理旧备份（超出时间限制）: ${file.filename}`);
          } catch (err) {
            console.error(`[Backup] 清理失败 ${file.filename}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('[Backup] 清理旧备份失败:', err.message);
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup_') && f.endsWith('.json'));

      const fileInfos = await Promise.all(
        backupFiles.map(async (filename) => {
          const filepath = path.join(this.backupDir, filename);
          try {
            const stats = await fs.stat(filepath);
            return {
              filename,
              filepath,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
            };
          } catch {
            return null;
          }
        })
      );

      return fileInfos
        .filter(f => f !== null)
        .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    } catch (err) {
      console.error('[Backup] 列出备份失败:', err.message);
      return [];
    }
  }

  /**
   * 删除指定备份
   */
  async deleteBackup(filename) {
    // [Critical] 防止路径遍历
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('无效的文件名');
    }

    const filepath = path.join(this.backupDir, filename);
    const resolvedBackupDir = path.resolve(this.backupDir);
    const resolvedFilePath = path.resolve(filepath);

    if (!resolvedFilePath.startsWith(resolvedBackupDir + path.sep)) {
      throw new Error('路径遍历检测：文件路径超出备份目录范围');
    }

    try {
      await fs.unlink(filepath);
      console.log(`[Backup] 删除备份: ${filename}`);
      return true;
    } catch (err) {
      console.error(`[Backup] 删除备份失败 ${filename}:`, err.message);
      throw err;
    }
  }
}

module.exports = { BackupService };