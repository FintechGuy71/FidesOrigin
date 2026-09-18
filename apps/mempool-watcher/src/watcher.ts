import { WebSocketProvider, TransactionResponse, ethers } from 'ethers';
import { EventEmitter } from 'events';

export interface MempoolTx {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  data: string;
  nonce: number;
  chainId: number;
  timestamp: number;
}

export interface DetectionResult {
  matched: boolean;
  confidence: number;
  riskScore: number;
  patterns: string[];
  reason: string;
}

export class MempoolWatcher extends EventEmitter {
  private providers: WebSocketProvider[] = [];
  private isRunning = false;
  // [L-22 FIX] 去重缓存改为 Map（保持插入序）实现 FIFO 淘汰：
  // 原实现 Set 达 10 万上限时整体 clear() —— 近期去重记忆全部丢失，
  // 已见交易会重复处理。Map 逐条淘汰最旧条目，保留近期记忆。
  private processedTxs = new Map<string, true>();
  private maxCacheSize = 100000;

  constructor(private rpcUrls: string[]) {
    super();
  }

  private markProcessed(txHash: string): void {
    this.processedTxs.set(txHash, true);
    while (this.processedTxs.size > this.maxCacheSize) {
      const oldest = this.processedTxs.keys().next().value;
      if (oldest === undefined) break;
      this.processedTxs.delete(oldest);
    }
  }

  /* [AUDIT FIX 2026-09-18 R3-W2] 单 URL 建连提取为独立方法，供断线重连复用
     （原实现无重连：WS 断开期间 mempool 全丢；且初版重连调 start() 会被
     isRunning 守卫挡住——真正的修复必须按 URL 维度重建 provider）。 */
  private connectProvider(url: string): void {
    {
      try {
        const provider = new WebSocketProvider(url);

        provider.on('pending', async (txHash: string) => {
          if (this.processedTxs.has(txHash)) return;

          try {
            const tx = await provider.getTransaction(txHash);
            /* [AUDIT FIX 2026-09-18 R3-W1] 原先标记后拉取：拉取失败/返回 null
               的交易被永久标记已处理 → 静默漏检。改为成功获取后才标记。 */
            if (!tx) return;
            this.markProcessed(txHash);

            const mempoolTx: MempoolTx = {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              // [AUDIT FIX 2026-09-18 R3-W3] type-2 交易 gasPrice 为 null →
              // 规则恒不触发。用 maxFeePerGas 兜底。
              gasPrice: tx.gasPrice ?? tx.maxFeePerGas ?? BigInt(0),
              gasLimit: tx.gasLimit,
              data: tx.data,
              nonce: tx.nonce,
              chainId: Number(tx.chainId),
              timestamp: Date.now()
            };

            this.emit('transaction', mempoolTx);
          } catch (err) {
            // 忽略无法获取的交易
          }
        });

        provider.on('error', (err) => {
          console.error(`WebSocket error on ${url}:`, err.message);
          this.emit('error', { url, error: err });
        });

        /* [AUDIT FIX 2026-09-18 R3-W2] 原无断线重连：WS 断开后仅 emit error，
           断线期间 mempool 全丢。底层 websocket close 后延迟重建 provider。 */
        const ws = provider.websocket as { onclose?: unknown } | undefined;
        if (ws && typeof ws === 'object') {
          const prev = (ws as any).onclose;
          (ws as any).onclose = (ev: unknown) => {
            if (typeof prev === 'function') (prev as any)(ev);
            if (!this.isRunning) return;
            console.warn(`WebSocket closed on ${url}, reconnecting in 5s...`);
            setTimeout(() => {
              // 移除已死 provider 再按 URL 重建
              const idx = this.providers.indexOf(provider);
              if (idx >= 0) this.providers.splice(idx, 1);
              provider.destroy().catch(() => {});
              this.connectProvider(url);
            }, 5000);
          };
        }

        this.providers.push(provider);
        console.log(`Connected to mempool: ${url}`);
      } catch (err) {
        console.error(`Failed to connect to ${url}:`, err);
      }
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const url of this.rpcUrls) {
      this.connectProvider(url);
    }

    this.emit('started');
  }

  stop(): void {
    this.isRunning = false;
    for (const provider of this.providers) {
      provider.destroy();
    }
    this.providers = [];
    this.emit('stopped');
  }

  getStats(): { providers: number; cachedTxs: number; running: boolean } {
    return {
      providers: this.providers.length,
      cachedTxs: this.processedTxs.size,
      running: this.isRunning
    };
  }
}
