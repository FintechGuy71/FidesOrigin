/**
 * Scheduler — Cron 调度 + 主同步流程
 *
 * 负责：
 * 1. 定时触发同步周期
 * 2. 数据源抓取、清洗、去重
 * 3. 数据库同步
 * 4. 协调 Merkle Tree 构建与链上同步
 */

'use strict';

const { defaultLogger: secureLog } = require('./utils/logger');
const { ValidationError, withErrorHandling } = require('./utils/errors');
const { sendAlert } = require('./alertManager');
const { buildMerkleTree } = require('./merkleBuilder');
const { syncMerkleRootToChain, getNonceManager } = require('./chainSyncer');
const { validateEthereumAddress, validateRiskScore, validateUrl } = require('./validators');
const { DLQService } = require('./services/dlq');

const cron = require('node-cron');
const axios = require('axios');
const xml2js = require('xml2js');
const http = require('http');
const https = require('https');

// ==================== 专用 Axios 实例 ====================
const syncAxios = axios.create({
  timeout: 30000,
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024,
  maxRedirects: 0,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
});

// ==================== 验证工具 ====================
// validateEthereumAddress, validateRiskScore → moved to validators.js

function validateTag(tag) {
  const allowed = ['SANCTIONS', 'PHISHING', 'HACK', 'SCAM', 'RUGPULL', 'MIXER', 'EXCHANGE', 'DEFI', 'UNKNOWN'];
  if (!tag || typeof tag !== 'string')
    throw new ValidationError('标签不能为空', 'tag');
  if (!allowed.includes(tag.toUpperCase()))
    throw new ValidationError(`无效的标签: ${tag}`, 'tag');
  return tag.toUpperCase();
}

function validateCategory(category) {
  const allowed = ['BLACKLIST', 'GRAYLIST', 'WHITELIST'];
  if (!allowed.includes(category?.toUpperCase()))
    throw new ValidationError(`无效的分类: ${category}`, 'category');
  return category.toUpperCase();
}

function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>"']/g, '');
}

// ==================== SSRF 防护 ====================
// validateUrl → moved to validators.js

// ==================== 错误处理与重试 ====================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operationName, fn, options = {}) {
  const { maxRetries = 3, retryDelay = 2000, critical = false } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      secureLog.warn(`[${operationName}] 错误 (尝试 ${attempt}/${maxRetries})`, {
        message: error.message,
        code: error.code,
      });
      if (error instanceof ValidationError) throw error;
      if (attempt === maxRetries) {
        if (critical)
          await sendAlert(`[CRITICAL] ${operationName} 失败: ${error.message}`);
        throw error;
      }
      await sleep(retryDelay * attempt);
    }
  }
  throw lastError;
}

// ==================== 数据源定义 ====================
const DATA_SOURCES = {
  OFAC_SDN: {
    name: 'OFAC SDN List',
    url: 'https://www.treasury.gov/ofac/downloads/sdn.xml',
    type: 'xml',
    parser: 'ofac',
    enabled: process.env.ENABLE_OFAC !== 'false',
  },
  COMMUNITY_BLACKLIST: {
    name: 'Community Blacklist',
    url: process.env.COMMUNITY_BLACKLIST_URL || '',
    type: 'json',
    parser: 'community',
    enabled: !!process.env.COMMUNITY_BLACKLIST_URL,
  },
  INTERNAL_DB: {
    name: 'Internal Database',
    type: 'database',
    enabled: true,
  },
};

// ==================== 数据源抓取 ====================
async function fetchFromUrl(source) {
  validateUrl(source.url);
  return withRetry(`Fetch[${source.name}]`, async () => {
    const res = await syncAxios.get(source.url, {
      headers: { 'User-Agent': 'FidesOrigin-Sync/1.0' },
      responseType: source.type === 'xml' ? 'text' : 'json',
      timeout: 30000,
      maxRedirects: 0,
    });
    return res.data;
  });
}

async function parseOFACXml(xmlData) {
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  const result = await parser.parseStringPromise(xmlData);
  const addresses = [];
  const sdnEntries = result?.sdnList?.sdnEntry || [];
  const entries = Array.isArray(sdnEntries) ? sdnEntries : [sdnEntries];

  for (const entry of entries) {
    const sdnType = entry?.sdnType;
    if (sdnType && (sdnType.includes('Digital Currency') || sdnType.includes('Virtual Currency'))) {
      const addressList = entry?.addressList?.address;
      if (addressList) {
        const addrEntries = Array.isArray(addressList) ? addressList : [addressList];
        for (const addr of addrEntries) {
          if (addr?.address && /^0x[a-fA-F0-9]{40}$/.test(addr.address)) {
            try {
              addresses.push({
                address: validateEthereumAddress(addr.address),
                riskScore: 100,
                tag: 'SANCTIONS',
                category: 'BLACKLIST',
                source: 'OFAC_SDN',
                description: sanitizeString(`OFAC SDN: ${entry.firstName || ''} ${entry.lastName || ''}`.trim(), 500),
              });
            } catch (e) { /* skip */ }
          }
        }
      }
    }
  }
  return addresses;
}

async function parseCommunityJson(data) {
  const addresses = [];
  const items = Array.isArray(data) ? data : data.addresses || data.data || [];
  for (const item of items) {
    try {
      const address = validateEthereumAddress(item.address || item.addr);
      addresses.push({
        address,
        riskScore: validateRiskScore(item.riskScore || item.risk || 50),
        tag: validateTag(item.tag || item.category || 'UNKNOWN'),
        category: validateCategory(item.list || item.category || 'BLACKLIST'),
        source: 'COMMUNITY',
        description: sanitizeString(item.description || item.reason || '', 500),
      });
    } catch (e) { /* skip */ }
  }
  return addresses;
}

async function fetchFromInternalDB(prisma) {
  const records = await prisma.riskAddress.findMany({
    where: { status: 'ACTIVE' },
    select: { address: true, riskScore: true, tag: true, category: true, source: true, description: true },
  });
  return records.map((r) => ({ ...r, address: r.address.toLowerCase() }));
}

async function collectFromAllSources(prisma, auditLogger) {
  const allAddresses = [];
  const sourceStats = {};

  if (DATA_SOURCES.OFAC_SDN.enabled) {
    try {
      secureLog.info('[Sync] 抓取 OFAC SDN 列表...');
      const xmlData = await fetchFromUrl(DATA_SOURCES.OFAC_SDN);
      const parsed = await parseOFACXml(xmlData);
      sourceStats.OFAC_SDN = parsed.length;
      allAddresses.push(...parsed);
      auditLogger.log('DATA_FETCHED', { source: 'OFAC_SDN', count: parsed.length });
    } catch (error) {
      secureLog.error('[Sync] OFAC 抓取失败:', error.message);
      sourceStats.OFAC_SDN = 0;
      auditLogger.log('DATA_FETCH_FAILED', { source: 'OFAC_SDN', error: error.message });
    }
  }

  if (DATA_SOURCES.COMMUNITY_BLACKLIST.enabled) {
    try {
      secureLog.info('[Sync] 抓取社区黑名单...');
      const data = await fetchFromUrl(DATA_SOURCES.COMMUNITY_BLACKLIST);
      const parsed = await parseCommunityJson(data);
      sourceStats.COMMUNITY = parsed.length;
      allAddresses.push(...parsed);
      auditLogger.log('DATA_FETCHED', { source: 'COMMUNITY', count: parsed.length });
    } catch (error) {
      secureLog.error('[Sync] 社区黑名单抓取失败:', error.message);
      sourceStats.COMMUNITY = 0;
    }
  }

  if (DATA_SOURCES.INTERNAL_DB.enabled) {
    try {
      secureLog.info('[Sync] 读取内部数据库风险地址...');
      const records = await fetchFromInternalDB(prisma);
      sourceStats.INTERNAL = records.length;
      allAddresses.push(...records);
      auditLogger.log('DATA_FETCHED', { source: 'INTERNAL', count: records.length });
    } catch (error) {
      secureLog.error('[Sync] 内部数据库读取失败:', error.message);
      sourceStats.INTERNAL = 0;
    }
  }

  return { allAddresses, sourceStats };
}

// ==================== 数据清洗与去重 ====================
function cleanAndDeduplicate(addresses) {
  const addressMap = new Map();
  const categoryPriority = { BLACKLIST: 3, GRAYLIST: 2, WHITELIST: 1 };

  for (const entry of addresses) {
    try {
      const addr = validateEthereumAddress(entry.address);
      const score = validateRiskScore(entry.riskScore || 50);
      const tag = validateTag(entry.tag || 'UNKNOWN');
      const category = validateCategory(entry.category || 'BLACKLIST');
      const existing = addressMap.get(addr);

      if (!existing) {
        addressMap.set(addr, {
          address: addr, riskScore: score, tag, category,
          source: sanitizeString(entry.source || 'UNKNOWN'),
          description: sanitizeString(entry.description || '', 500),
        });
      } else {
        existing.riskScore = Math.max(existing.riskScore, score);
        if ((categoryPriority[category] || 0) > (categoryPriority[existing.category] || 0))
          existing.category = category;
        if (entry.source && !existing.source.includes(sanitizeString(entry.source)))
          existing.source = sanitizeString(`${existing.source},${entry.source}`.slice(0, 255));
      }
    } catch (e) { /* skip */ }
  }
  return Array.from(addressMap.values());
}

// ==================== 数据库同步 ====================
async function syncToDatabase(addresses, prisma, dlq) {
  const batchSize = 500;
  let upserted = 0;
  let failed = 0;

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const operations = batch.map((addr) =>
      prisma.riskAddress.upsert({
        where: { address: addr.address },
        update: {
          riskScore: addr.riskScore, tag: addr.tag, category: addr.category,
          source: addr.source, description: addr.description,
          status: 'ACTIVE', updatedAt: new Date(),
        },
        create: {
          address: addr.address, riskScore: addr.riskScore, tag: addr.tag,
          category: addr.category, source: addr.source, description: addr.description,
          status: 'ACTIVE',
        },
      }).catch((error) => {
        // 单条记录失败 → 记录到 DLQ
        failed++;
        const recordId = addr.address || `batch-${i}-unknown`;
        if (dlq) {
          dlq.recordFailure('database_upsert', recordId, error).catch((e) => {
            secureLog.error(`[Sync] DLQ 记录失败: ${e.message}`);
          });
        }
        secureLog.warn(`[Sync] 单条记录 upsert 失败: ${recordId}, ${error.message}`);
        return null;
      })
    );

    const results = await Promise.all(operations);
    const batchUpserted = results.filter((r) => r !== null).length;
    upserted += batchUpserted;

    if (upserted % 1000 === 0 || upserted === addresses.length)
      secureLog.info(`[Sync] 数据库同步进度: ${upserted}/${addresses.length} (failed: ${failed})`);
  }

  if (failed > 0) {
    secureLog.warn(`[Sync] 数据库同步完成: ${upserted} 成功, ${failed} 失败`);
  }

  return upserted;
}

// ==================== 主同步流程 ====================
let isSyncing = false;

async function runSyncCycle(prisma, auditLogger) {
  if (isSyncing) {
    secureLog.info('[Sync] 上一次同步仍在运行，跳过本次');
    return { success: false, skipped: true, reason: 'already_running' };
  }

  const startTime = Date.now();
  const syncId = `sync_${Date.now()}`;
  secureLog.info(`[Sync] ====== 同步周期开始: ${syncId} ======`);
  auditLogger.log('SYNC_STARTED', { syncId });
  isSyncing = true;

  // 初始化 DLQ
  const dlq = new DLQService(prisma);

  try {
    // Step 0: 处理 DLQ 重试（在同步开始前执行）
    secureLog.info('[Sync] 处理 DLQ 待重试记录...');
    const retryStats = await dlq.processRetries(async (failure) => {
      // DLQ 重试处理器：尝试重新同步单条记录
      // 这里简化为 true（由下次全量同步覆盖），实际可根据 recordId 查询并重新处理
      secureLog.info(`[DLQ Retry] 处理失败记录: ${failure.source}/${failure.recordId}`);
      // 标记为已处理，实际业务逻辑由上层决定
      return true;
    });
    secureLog.info(`[Sync] DLQ 重试完成: ${retryStats.processed} 处理, ${retryStats.resolved} 成功`);

    const { allAddresses, sourceStats } = await collectFromAllSources(prisma, auditLogger);
    secureLog.info(`[Sync] 原始数据总量: ${allAddresses.length}`, sourceStats);

    const cleaned = cleanAndDeduplicate(allAddresses);
    secureLog.info(`[Sync] 清洗后地址数: ${cleaned.length}`);

    const dbCount = await syncToDatabase(cleaned, prisma, dlq);

    const merkleTree = buildMerkleTree(cleaned);
    secureLog.info(`[Sync] Merkle Root: ${merkleTree.root}`);

    const chainResult = await syncMerkleRootToChain(merkleTree.root, cleaned.length, auditLogger);

    // Step N: 检查永久失败并告警（同步结束后执行）
    const alertResult = await dlq.alertPermanentFailures();
    if (alertResult.alerted) {
      secureLog.warn(`[Sync] DLQ 发现 ${alertResult.count} 条永久失败记录`);
    }

    const duration = Date.now() - startTime;
    secureLog.info(`[Sync] ====== 同步完成 (${duration}ms) ======`);

    auditLogger.log('SYNC_COMPLETED', {
      syncId, duration, sourceStats,
      rawCount: allAddresses.length, cleanedCount: cleaned.length,
      dbCount, merkleRoot: merkleTree.root, chainResult,
      dlqRetries: retryStats,
      dlqPermanentFailures: alertResult.count,
    });

    return { success: true, syncId, duration, count: cleaned.length, merkleRoot: merkleTree.root, chainResult };
  } catch (error) {
    const duration = Date.now() - startTime;
    secureLog.error(`[Sync] 同步失败 (${duration}ms):`, error.message);
    secureLog.error(error.stack);
    auditLogger.log('SYNC_FAILED', { syncId, duration, error: error.message, stack: sanitizeString(error.stack || '', 2000) });
    await sendAlert(`同步失败 [${syncId}]: ${error.message}`);

    // 同步整体失败也尝试告警
    try {
      await dlq.alertPermanentFailures();
    } catch {}

    return { success: false, syncId, error: error.message };
  } finally {
    isSyncing = false;
    await dlq.disconnect();
  }
}

// ==================== Cron 调度 ====================
let cronTasks = [];
let intervals = [];
let isShuttingDown = false;

function scheduleSyncJobs(prisma, auditLogger, healthCheckServer) {
  const syncCron = process.env.SYNC_CRON || '0 */6 * * *';

  const mainTask = cron.schedule(syncCron, async () => {
    if (isShuttingDown || isSyncing) {
      secureLog.info('[Cron] 跳过本次同步（已在运行或正在关闭）');
      return;
    }
    try {
      await runSyncCycle(prisma, auditLogger);
    } catch (error) {
      secureLog.error('[Cron] 同步异常:', error.message);
    }
  }, { scheduled: true, timezone: process.env.TZ || 'UTC' });

  cronTasks.push(mainTask);

  if (process.env.RUN_ON_STARTUP === 'true') {
    secureLog.info('[Cron] 配置为启动时立即执行同步');
    setTimeout(async () => {
      if (!isShuttingDown) {
        try {
          await runSyncCycle(prisma, auditLogger);
        } catch (error) {
          secureLog.error('[Cron] 启动同步异常:', error.message);
        }
      }
    }, 5000);
  }

  const nm = getNonceManager();
  if (nm) {
    const nonceInterval = setInterval(() => {
      if (!isShuttingDown && nm) {
        nm.syncNonce().catch((e) => secureLog.warn('[NonceManager] 同步失败:', e.message));
      }
    }, 60000);
    nonceInterval.unref();
    intervals.push(nonceInterval);
  }

  const memInterval = setInterval(() => {
    if (isShuttingDown) return;
    const usage = process.memoryUsage();
    const heapMB = usage.heapUsed / 1024 / 1024;
    if (heapMB > 512)
      secureLog.warn(`[Monitor] 内存使用过高: ${heapMB.toFixed(2)}MB heap`);
  }, 120000);
  memInterval.unref();
  intervals.push(memInterval);

  secureLog.info(`[Cron] 定时任务已启动: cron="${syncCron}"`);
}

function cleanupTimersAndListeners(auditLogger) {
  secureLog.info('[Cleanup] 清理定时器和事件监听器...');
  for (const task of cronTasks) {
    try { task.destroy(); } catch (e) {}
  }
  cronTasks = [];
  for (const interval of intervals) clearInterval(interval);
  intervals = [];
  if (auditLogger) auditLogger.destroy();
  secureLog.info('[Cleanup] 清理完成');
}

function setShuttingDown(value) {
  isShuttingDown = value;
}

function getIsSyncing() {
  return isSyncing;
}

module.exports = {
  syncAxios,
  validateTag,
  validateCategory,
  sanitizeString,
  withRetry,
  runSyncCycle,
  scheduleSyncJobs,
  cleanupTimersAndListeners,
  setShuttingDown,
  getIsSyncing,
  DATA_SOURCES,
};
