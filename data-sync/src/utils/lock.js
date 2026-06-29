/**
 * FidesOrigin 分布式锁工具
 * 支持 Redis 分布式锁和内存锁（单实例回退）
 * 
 * P0 Fix: 内存锁使用原子操作修复竞态条件
 * [High Fix] Use crypto.randomBytes instead of Math.random for lock tokens
 */

const crypto = require('crypto');

/**
 * [High Fix] Generate a cryptographically secure lock token.
 * Math.random() uses xorshift128+ which can be reversed; crypto.randomBytes is CSPRNG.
 */
function generateSecureToken() {
  return `${process.pid}-${crypto.randomBytes(32).toString('hex')}`;
}

// ==================== Redis 分布式锁 ====================
class RedisDistributedLock {
  constructor(redisClient) {
    this.redis = redisClient;
    this.locks = new Set();
  }

  async acquire(lockName, ttlMs = 300000) {
    const token = generateSecureToken();
    const key = `lock:${lockName}`;

    // 使用 Redis SET NX EX 原子操作
    const result = await this.redis.set(key, token, 'NX', 'PX', ttlMs);

    if (result === 'OK') {
      this.locks.add(lockName);
      return { acquired: true, token };
    }

    return { acquired: false };
  }

  async release(lockName, token) {
    const key = `lock:${lockName}`;

    // 使用 Lua 脚本确保原子性释放（只释放自己持有的锁）
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(luaScript, 1, key, token);
    this.locks.delete(lockName);
    return result === 1;
  }

  async extend(lockName, token, ttlMs = 300000) {
    const key = `lock:${lockName}`;

    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    return await this.redis.eval(luaScript, 1, key, token, ttlMs) === 1;
  }

  async isHeld(lockName) {
    const key = `lock:${lockName}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }
}

// ==================== 内存锁（单实例回退）====================
// P0 Fix: 使用原子操作（自旋锁）修复竞态条件
class MemoryDistributedLock {
  constructor() {
    this.locks = new Map();   // 实际锁存储
    this.pending = new Map(); // 等待队列
    this._lock = new Map();   // 原子锁标记（自旋锁）
  }

  /**
   * P0 Fix: 获取锁（带原子操作保护）
   * 使用自旋锁模拟原子操作，防止多个并发请求同时检查锁状态导致的竞态条件
   */
  async acquire(lockName, ttlMs = 300000) {
    const now = Date.now();
    const token = generateSecureToken();

    // P0 Fix: 步骤1 - 自旋等待原子锁（防止多个请求同时进入临界区）
    while (this._lock.get(lockName)) {
      await this._spinWait(10);
    }

    // P0 Fix: 步骤2 - 原子性设置标记（CAS模拟）
    this._lock.set(lockName, token);

    try {
      // P0 Fix: 步骤3 - 在原子保护下检查锁状态
      const existing = this.locks.get(lockName);
      if (existing && existing.expires > now) {
        // 锁仍被占用，加入等待队列
        if (!this.pending.has(lockName)) {
          this.pending.set(lockName, []);
        }
        this.pending.get(lockName).push(token);

        // 释放原子标记，让其他请求可以检查
        this._lock.delete(lockName);

        // 等待锁释放
        await this._waitForLock(lockName, token);

        // 递归重试获取锁
        return this.acquire(lockName, ttlMs);
      }

      // P0 Fix: 步骤4 - 获取锁成功
      this.locks.set(lockName, {
        acquired: now,
        expires: now + ttlMs,
        pid: process.pid,
        token,
      });

      return { acquired: true, token };
    } finally {
      // P0 Fix: 步骤5 - 确保原子标记被释放（避免死锁）
      if (this._lock.get(lockName) === token) {
        this._lock.delete(lockName);
      }
    }
  }

  /**
   * 自旋等待辅助方法
   */
  async _spinWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 等待锁释放（带超时）
   */
  async _waitForLock(lockName, token, timeoutMs = 30000) {
    const start = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const lock = this.locks.get(lockName);
        const now = Date.now();

        // 锁已释放或过期
        if (!lock || lock.expires <= now) {
          // 从等待队列中移除
          const queue = this.pending.get(lockName) || [];
          const idx = queue.indexOf(token);
          if (idx > -1) queue.splice(idx, 1);
          resolve();
          return;
        }

        // 超时
        if (now - start > timeoutMs) {
          // 从队列中移除
          const queue = this.pending.get(lockName) || [];
          const idx = queue.indexOf(token);
          if (idx > -1) queue.splice(idx, 1);
          resolve();
          return;
        }

        setTimeout(check, 50);
      };
      check();
    });
  }

  async release(lockName, token) {
    const lock = this.locks.get(lockName);
    if (lock && lock.token === token) {
      this.locks.delete(lockName);
      return true;
    }
    return false;
  }

  async isHeld(lockName) {
    const lock = this.locks.get(lockName);
    return lock && lock.expires > Date.now();
  }

  async extend(lockName, token, ttlMs = 300000) {
    const lock = this.locks.get(lockName);
    if (lock && lock.token === token) {
      lock.expires = Date.now() + ttlMs;
      return true;
    }
    return false;
  }
}

// ==================== 锁工厂 ====================
async function createDistributedLock() {
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    redis.on('error', (err) => {
      console.error('[Redis] 连接错误:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] 连接成功');
    });

    console.log('[HA] 使用 Redis 分布式锁');
    return new RedisDistributedLock(redis);
  }

  console.warn('[HA] 未配置 REDIS_URL，使用内存锁（仅限单实例部署）');
  return new MemoryDistributedLock();
}

module.exports = {
  RedisDistributedLock,
  MemoryDistributedLock,
  createDistributedLock,
};
