'use strict';

const { createClient } = require('redis');

const DEFAULT_KEY = 'fides:lock:chain:write';

/** Redis ownership lock shared with data-publisher's chain writer. */
class ChainWriteLock {
  constructor(options = {}) {
    this.url = options.url || process.env.REDIS_URL || '';
    this.required = options.required ?? process.env.CHAIN_WRITE_LOCK_REQUIRED === 'true';
    this.key = options.key || DEFAULT_KEY;
    this.ttlMs = options.ttlMs || 15 * 60 * 1000;
    this.waitMs = options.waitMs || 120000;
    this.token = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    this.client = null;
    this.watchdog = null;
  }

  async connect() {
    if (!this.client) {
      this.client = createClient({ url: this.url });
      this.client.on('error', () => { /* connection state is surfaced by acquire/release */ });
      await this.client.connect();
    }
    return this.client;
  }

  async acquire() {
    if (!this.url) {
      if (this.required) throw new Error('REDIS_URL is required for coordinated chain writes');
      return false;
    }
    const client = await this.connect();
    const deadline = Date.now() + this.waitMs;
    while (Date.now() <= deadline) {
      const acquired = await client.set(this.key, this.token, { NX: true, PX: this.ttlMs });
      if (acquired === 'OK') {
        this.watchdog = setInterval(async () => {
          try {
            await client.eval(
              'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end',
              { keys: [this.key], arguments: [this.token, String(this.ttlMs)] }
            );
          } catch { /* acquisition remains bounded by TTL */ }
        }, Math.max(1000, Math.floor(this.ttlMs / 3)));
        this.watchdog.unref();
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out acquiring shared chain write lock: ${this.key}`);
  }

  async release() {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
    if (!this.client) return;
    try {
      await this.client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        { keys: [this.key], arguments: [this.token] }
      );
    } finally {
      await this.client.quit().catch(() => this.client.disconnect());
      this.client = null;
    }
  }

  async runExclusive(fn) {
    const acquired = await this.acquire();
    try {
      return await fn();
    } finally {
      if (acquired) await this.release();
    }
  }
}

module.exports = { ChainWriteLock, DEFAULT_KEY };
