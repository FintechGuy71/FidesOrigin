const { createHash } = require('crypto');

/**
 * 并发安全的 Nonce 管理器
 * 解决多线程/多进程环境下的 nonce 冲突问题
 */

class NonceManager {
  constructor(provider, walletAddress) {
    this.provider = provider;
    this.walletAddress = walletAddress;
    this._nonce = null;
    this._pending = new Map(); // txHash -> nonce
    this._lock = Promise.resolve();
    this._initialized = false;
  }

  /**
   * 初始化 nonce（从链上获取最新 pending nonce）
   */
  async initialize() {
    // [High Fix] Use double-checked locking to prevent TOCTOU race
    if (this._initialized) return this._nonce;
    const release = await this._acquireLock();
    try {
      if (this._initialized) return this._nonce; // double-check after acquiring lock
      this._nonce = await this.provider.getTransactionCount(this.walletAddress, 'pending');
      if (!Number.isSafeInteger(this._nonce) || this._nonce < 0) {
        throw new Error(`Invalid nonce from provider: ${this._nonce}`);
      }
      this._initialized = true;
      return this._nonce;
    } finally {
      release();
    }
  }

  /**
   * 获取下一个可用 nonce（原子操作）
   */
  async getNextNonce() {
    // 链式锁：确保每个 getNextNonce 调用串行执行
    const release = await this._acquireLock();
    try {
      if (!this._initialized) {
        await this.initialize();
      }
      const nonce = this._nonce;
      this._nonce++;
      return nonce;
    } finally {
      release();
    }
  }

  /**
   * 预分配 nonce 用于批量交易
   */
  async allocateNonces(count) {
    // [High Fix] Input validation: reject non-integers, negatives, zero, and unreasonably large values
    if (!Number.isSafeInteger(count) || count <= 0 || count > 1000) {
      throw new Error(`Invalid count for allocateNonces: ${count}. Must be a positive integer <= 1000`);
    }
    const release = await this._acquireLock();
    try {
      if (!this._initialized) {
        await this.initialize();
      }
      const startNonce = this._nonce;
      this._nonce += count;
      return Array.from({ length: count }, (_, i) => startNonce + i);
    } finally {
      release();
    }
  }

  /**
   * 标记交易已提交（用于追踪 pending）
   */
  markSubmitted(txHash, nonce) {
    this._pending.set(txHash, { nonce, submittedAt: Date.now() });
  }

  /**
   * 标记交易已确认/失败，释放 nonce
   */
  markCompleted(txHash, success = true) {
    const info = this._pending.get(txHash);
    if (info) {
      this._pending.delete(txHash);
    }
    // 如果失败，不自动回退 nonce（EIP-规则：nonce 只能递增）
    // 失败交易需要被替换（replace-by-fee）或等待被挖出
  }

  /**
   * 同步链上 nonce（用于恢复或重启后）
   */
  async syncFromChain() {
    const release = await this._acquireLock();
    try {
      const chainNonce = await this.provider.getTransactionCount(this.walletAddress, 'pending');
      // 如果链上 nonce 大于本地，说明有外部交易，需要同步
      if (chainNonce > this._nonce) {
        this._nonce = chainNonce;
      }
      return this._nonce;
    } finally {
      release();
    }
  }

  /**
   * 获取当前 pending 交易数
   */
  getPendingCount() {
    return this._pending.size;
  }

  /**
   * 获取当前 nonce 状态（用于调试）
   */
  getStatus() {
    return {
      localNonce: this._nonce,
      pendingCount: this._pending.size,
      initialized: this._initialized,
    };
  }

  /**
   * 私有：获取锁
   */
  async _acquireLock() {
    let release;
    const newLock = new Promise(resolve => { release = resolve; });
    const oldLock = this._lock;
    this._lock = oldLock.then(() => newLock);
    await oldLock;
    return release;
  }
}

module.exports = { NonceManager };
