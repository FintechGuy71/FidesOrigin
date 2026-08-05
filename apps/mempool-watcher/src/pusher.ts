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
    reason: string
  ): Promise<void> {
    console.log(`🚨 Pushing high risk: ${address} | Score: ${riskScore} | ${reason}`);
    
    try {
      if (riskScore >= 100) {
        // 制裁地址 → 直接更新 Guard 缓存
        const tx = await this.guardContract.updateSanctionedCache(address, true);
        await tx.wait();
        console.log(`✅ Sanctioned cache updated: ${tx.hash}`);
      } else {
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
    // 批量更新 — 使用多签或时间锁执行
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
    
    if (result.matched && result.riskScore >= 80) {
      // 高置信度 → 立即推送
      if (tx.to) {
        pusher.pushHighRisk(tx.to, result.riskScore, result.reason);
      }
      if (tx.from) {
        pusher.pushHighRisk(tx.from, result.riskScore, result.reason);
      }
    }
  });

  console.log('🚀 Risk pusher started');
}
