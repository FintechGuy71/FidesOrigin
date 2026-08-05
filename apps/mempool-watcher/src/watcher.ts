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
  private processedTxs = new Set<string>();
  private maxCacheSize = 100000;

  constructor(private rpcUrls: string[]) {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const url of this.rpcUrls) {
      try {
        const provider = new WebSocketProvider(url);
        
        provider.on('pending', async (txHash: string) => {
          if (this.processedTxs.has(txHash)) return;
          if (this.processedTxs.size >= this.maxCacheSize) {
            this.processedTxs.clear();
          }
          this.processedTxs.add(txHash);

          try {
            const tx = await provider.getTransaction(txHash);
            if (!tx) return;

            const mempoolTx: MempoolTx = {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: tx.value,
              gasPrice: tx.gasPrice || BigInt(0),
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

        this.providers.push(provider);
        console.log(`Connected to mempool: ${url}`);
      } catch (err) {
        console.error(`Failed to connect to ${url}:`, err);
      }
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
