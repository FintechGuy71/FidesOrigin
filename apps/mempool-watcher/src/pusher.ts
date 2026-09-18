import { MempoolWatcher } from './watcher';
import { DetectionEngine } from './detector';
import { ethers, Contract, Wallet } from 'ethers';

export interface PusherConfig {
  rpcUrl: string;
  privateKey: string;
  guardAddress: string;
  riskRegistryAddress: string;
  highConfidenceThreshold: number;
}

export class RiskPusher {
  private provider: ethers.JsonRpcProvider;
  private signer: Wallet;
  private guardContract: Contract;
  private riskRegistryContract: Contract;
  /* [AUDIT FIX 2026-09-17 R1-015③] 推送串行化队列：事件回调并发触发时
     多笔交易同 nonce 竞争会导致部分交易失败静默丢失。链式 Promise 保证
     同一 signer 的链上写操作按序发送。 */
  private queue: Promise<void> = Promise.resolve();

  constructor(private config: PusherConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new Wallet(config.privateKey, this.provider);
    
    this.guardContract = new Contract(
      config.guardAddress,
      ['function updateSanctionedCache(address,bool)'],
      this.signer
    );
    
    this.riskRegistryContract = new Contract(
      config.riskRegistryAddress,
      ['function updateRiskProfile(address,uint8,uint8,bytes32[],bool)'],
      this.signer
    );
  }

  async pushHighRisk(
    address: string,
    riskScore: number,
    reason: string,
    /* [AUDIT FIX 2026-09-17 R1-015②] 是否允许直写制裁缓存。
       启发式命中只证明「与风险对象发生过交互」：对 tx.to（接收方/对手方）
       成立时可升级制裁；对 tx.from（发送方）不得仅凭一次命中永久标记——
       发送方一律走低级档案更新 + 人工复核日志。 */
    allowSanction: boolean = false
  ): Promise<void> {
    // [R1-015③] 串行化：排队执行，避免并发 nonce 冲突
    const task = this.queue.then(() => this._push(address, riskScore, reason, allowSanction));
    this.queue = task.catch(() => { /* 单个失败不阻断队列 */ });
    return task;
  }

  private async _push(
    address: string,
    riskScore: number,
    reason: string,
    allowSanction: boolean
  ): Promise<void> {
    console.log(`🚨 Pushing high risk: ${address} | Score: ${riskScore} | ${reason}`);

    try {
      if (riskScore >= 100 && allowSanction) {
        // 制裁地址 → 直接更新 Guard 缓存
        const tx = await this.guardContract.updateSanctionedCache(address, true);
        await tx.wait();
        console.log(`✅ Sanctioned cache updated: ${tx.hash}`);
      } else {
        if (riskScore >= 100 && !allowSanction) {
          // [R1-015②] 满分命中但未授权制裁（发送方）：进入待人工复核日志
          console.warn(`⚠️ REVIEW REQUIRED: heuristic score=100 hit on sender ${address} — NOT auto-sanctioned (${reason})`);
        }
        // 高风险 → 更新 RiskRegistry
        const tx = await this.riskRegistryContract.updateRiskProfile(
          address,
          riskScore,
          riskScore >= 80 ? 4 : riskScore >= 50 ? 3 : 2, // tier
          [], // tags
          false // sanctioned
        );
        await tx.wait();
        console.log(`✅ Risk profile updated: ${tx.hash}`);
      }
    } catch (err) {
      console.error(`❌ Failed to push risk for ${address}:`, err);
    }
  }

  async pushBatch(risks: Array<{ address: string; score: number; reason: string }>): Promise<void> {
    /* [AUDIT FIX 2026-09-17 R1-015①] 注释与实现对齐：当前为单私钥逐条直推
       （经串行队列），不是多签/时间锁执行——原注释是虚假声明。 */
    console.log(`📦 Batch push: ${risks.length} addresses`);
    
    for (const risk of risks) {
      await this.pushHighRisk(risk.address, risk.score, risk.reason);
    }
  }
}

export async function startPusher(
  watcher: MempoolWatcher,
  detector: DetectionEngine,
  pusher: RiskPusher
): Promise<void> {
  watcher.on('transaction', (tx) => {
    const result = detector.evaluate(tx);
    
    // [AUDIT FIX 2026-09-18 R3-W5] 原硬编码 80，配置的 highConfidenceThreshold 从未被读取
    if (result.matched && result.riskScore >= (pusher['config'].highConfidenceThreshold ?? 80)) {
      // 高置信度 → 立即推送
      /* [AUDIT FIX 2026-09-17 R1-015②] from/to 区分处置：
         to（对手方）允许满分直写制裁缓存；from（发送方）只允许档案更新，
         满分命中转人工复核，不再一次启发式命中即永久标记制裁。 */
      if (tx.to) {
        pusher.pushHighRisk(tx.to, result.riskScore, result.reason, true);
      }
      if (tx.from) {
        pusher.pushHighRisk(tx.from, result.riskScore, result.reason, false);
      }
    }
  });

  console.log('🚀 Risk pusher started');
}
