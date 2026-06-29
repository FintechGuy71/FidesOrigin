/**
 * 数据库服务
 * 封装Prisma操作
 */

const { PrismaClient } = require('@prisma/client');
const { createLogger } = require('../utils/logger');
const logger = createLogger('databaseService');

// 白名单常量
const ALLOWED_CHAINS = new Set(['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base']);
const ALLOWED_CATEGORIES = new Set(['BLACKLIST', 'GRAYLIST', 'WHITELIST', 'UNKNOWN']);
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// 原型污染防护：移除危险键
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 递归清理对象中的原型污染键
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizeObject(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

class DatabaseService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 验证地址数据格式
   */
  assertAddress(addr) {
    if (!addr || typeof addr !== 'object') {
      throw new Error('invalid address object');
    }
    if (typeof addr.address !== 'string' || !ADDRESS_RE.test(addr.address)) {
      throw new Error('invalid address format');
    }
    if (addr.chain && !ALLOWED_CHAINS.has(addr.chain)) {
      throw new Error(`invalid chain: ${addr.chain}`);
    }
    if (addr.category && !ALLOWED_CATEGORIES.has(addr.category)) {
      throw new Error(`invalid category: ${addr.category}`);
    }
  }

  /**
   * 限制 limit 参数范围
   */
  clampLimit(v, def, max) {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.min(n, max);
  }

  /**
   * 保存地址列表（批量upsert）
   * 修复：使用 Serializable 事务包裹整个批次，消除 TOCTOU 竞态
   */
  async saveAddresses(addresses, source) {
    // 入参验证
    if (!Array.isArray(addresses)) {
      throw new Error('addresses must be an array');
    }
    if (addresses.length === 0) {
      return { newCount: 0, updatedCount: 0, errors: 0 };
    }
    if (typeof source !== 'string' || source.length === 0 || source.length > 100) {
      throw new Error('invalid source');
    }
    if (addresses.length > 10000) {
      throw new Error('addresses batch too large (max 10000)');
    }

    console.log(`[Database] 开始保存 ${addresses.length} 个地址...`);

    let newCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 将循环 + SyncLog 写入合并到同一事务中，保证原子性
    // Serializable 隔离级别消除 TOCTOU 竞态条件
    await this.prisma.$transaction(async (tx) => {
      for (const addr of addresses) {
        try {
          // 验证地址数据
          this.assertAddress(addr);

          // 标准化地址数据
          const normalizedAddr = this.normalizeAddressData(addr, source);

          // 在 Serializable 事务中，findUnique + update/create 是安全的
          // 不会出现并发竞态
          const existing = await tx.riskAddress.findUnique({
            where: { address: normalizedAddr.address },
          });

          if (existing) {
            await tx.riskAddress.update({
              where: { address: normalizedAddr.address },
              data: {
                category: normalizedAddr.category,
                label: normalizedAddr.label,
                riskScore: normalizedAddr.riskScore,
                tags: normalizedAddr.tags,
                sources: this.mergeSources(existing.sources, normalizedAddr.sources),
                metadata: this.mergeMetadata(existing.metadata, normalizedAddr.metadata),
                updatedAt: new Date(),
              },
            });
            updatedCount++;
          } else {
            await tx.riskAddress.create({
              data: normalizedAddr,
            });
            newCount++;
          }
        } catch (error) {
          // 仅记录稳定的错误码与脱敏摘要到数据库
          errors.push({
            address: (addr && addr.address) || 'unknown',
            code: error.code || 'UNKNOWN',
            message: String(error.message || '').split('\n')[0].slice(0, 120),
          });
          // 完整堆栈写入受访问控制的日志系统
          logger.error('Failed to save address', {
            address: addr && addr.address,
            error: error.message,
            code: error.code,
          });
        }
      }

      // 同步日志在同一事务中写入，保证数据一致性
      await tx.syncLog.create({
        data: {
          source: source,
          addressesCount: addresses.length,
          newCount: newCount,
          updatedCount: updatedCount,
          status: errors.length === 0 ? 'SUCCESS' : (errors.length < addresses.length ? 'PARTIAL' : 'ERROR'),
          details: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        },
      });
    }, { isolationLevel: 'Serializable' });

    console.log(`[Database] 保存完成: 新增 ${newCount}, 更新 ${updatedCount}, 错误 ${errors.length}`);

    return { newCount, updatedCount, errors: errors.length };
  }

  /**
   * 标准化地址数据，确保与 Prisma schema 兼容
   */
  normalizeAddressData(addr, source) {
    return {
      address: addr.address.toLowerCase(),
      chain: addr.chain || 'ethereum',
      category: addr.category || 'UNKNOWN',
      label: typeof addr.label === 'string' ? addr.label.slice(0, 200) : 'unknown',
      riskScore: typeof addr.riskScore === 'number' ? Math.max(0, Math.min(100, addr.riskScore)) : 0,
      tags: this.ensureJsonString(this.parseJsonArray(addr.tags)),
      sources: this.ensureJsonString(this.parseJsonArray(addr.sources || [source])),
      metadata: this.ensureJsonString(this.parseJsonObject(addr.metadata)),
      syncedToChain: false,
    };
  }

  /**
   * 确保值为 JSON 字符串
   */
  ensureJsonString(value) {
    if (value === null || value === undefined) return '[]';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return '[]';
    }
  }

  /**
   * 合并来源列表
   */
  mergeSources(existing, new_) {
    const existingArr = this.parseJsonArray(existing);
    const newArr = this.parseJsonArray(new_);
    const merged = [...new Set([...existingArr, ...newArr])];
    return JSON.stringify(merged);
  }

  /**
   * 合并元数据（含原型污染防护）
   */
  mergeMetadata(existing, new_) {
    const existingObj = sanitizeObject(this.parseJsonObject(existing));
    const newObj = sanitizeObject(this.parseJsonObject(new_));
    const merged = { ...existingObj, ...newObj, updatedAt: new Date().toISOString() };
    return JSON.stringify(merged);
  }

  /**
   * 安全解析 JSON 数组字段（处理字符串或对象）
   */
  parseJsonArray(value, fallback = []) {
    if (Array.isArray(value)) return value;
    if (value == null) return fallback;
    if (typeof value === 'object') return fallback; // 非数组的 object 不应当作数组
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * 安全解析 JSON 对象字段（处理字符串或对象）
   */
  parseJsonObject(value, fallback = {}) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    const total = await this.prisma.riskAddress.count();
    const blacklist = await this.prisma.riskAddress.count({ where: { category: 'BLACKLIST' } });
    const graylist = await this.prisma.riskAddress.count({ where: { category: 'GRAYLIST' } });
    const whitelist = await this.prisma.riskAddress.count({ where: { category: 'WHITELIST' } });
    const unsynced = await this.prisma.riskAddress.count({ where: { syncedToChain: false } });

    return {
      total,
      blacklist,
      graylist,
      whitelist,
      unsynced,
    };
  }

  /**
   * 获取最近的同步日志
   */
  async getRecentLogs(limit = 10) {
    const safeLimit = this.clampLimit(limit, 10, 500);
    return this.prisma.syncLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: safeLimit,
    });
  }

  /**
   * 获取需要同步到链上的地址
   */
  async getUnsyncedAddresses(limit = 100) {
    const safeLimit = this.clampLimit(limit, 100, 500);
    return this.prisma.riskAddress.findMany({
      where: { syncedToChain: false },
      take: safeLimit,
    });
  }

  /**
   * 标记为已同步
   */
  async markAsSynced(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) return;

    const addressesList = addresses
      .map(a => (a && typeof a.address === 'string') ? a.address.toLowerCase() : null)
      .filter(addr => addr !== null && ADDRESS_RE.test(addr));

    if (addressesList.length === 0) return;

    await this.prisma.riskAddress.updateMany({
      where: { address: { in: addressesList } },
      data: { syncedToChain: true, syncedAt: new Date() },
    });
  }

  /**
   * 关闭连接
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = { DatabaseService };