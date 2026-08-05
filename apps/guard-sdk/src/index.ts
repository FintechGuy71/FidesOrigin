import { ethers, Contract, JsonRpcProvider } from 'ethers';

export enum Action {
  ALLOW = 'ALLOW',
  WARN = 'WARN',
  BLOCK = 'BLOCK'
}

export enum RiskCategory {
  UNKNOWN = 'UNKNOWN',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  SANCTIONED = 'SANCTIONED'
}

export interface RiskAssessment {
  action: Action;
  riskScore: number;
  category: RiskCategory;
  tags: string[];
  confidence: number;
  reason: string;
  merkleRoot: string;
  assessmentTime: number;
}

export interface TransactionRequest {
  from: string;
  to: string;
  value?: string;
  token?: string;
  data?: string;
  chainId?: number;
}

interface CacheEntry {
  assessment: RiskAssessment;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const GUARD_ABI = [
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'assessAddress',
    outputs: [{
      components: [
        { name: 'action', type: 'uint8' },
        { name: 'riskScore', type: 'uint256' },
        { name: 'category', type: 'uint8' },
        { name: 'tags', type: 'bytes32[]' },
        { name: 'confidence', type: 'uint256' },
        { name: 'reason', type: 'string' },
        { name: 'merkleRoot', type: 'bytes32' },
        { name: 'assessmentTime', type: 'uint256' }
      ],
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{
      components: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'data', type: 'bytes' },
        { name: 'chainId', type: 'uint256' }
      ],
      name: 'intent',
      type: 'tuple'
    }],
    name: 'assessTransaction',
    outputs: [{
      components: [
        { name: 'action', type: 'uint8' },
        { name: 'riskScore', type: 'uint256' },
        { name: 'category', type: 'uint8' },
        { name: 'tags', type: 'bytes32[]' },
        { name: 'confidence', type: 'uint256' },
        { name: 'reason', type: 'string' },
        { name: 'merkleRoot', type: 'bytes32' },
        { name: 'assessmentTime', type: 'uint256' }
      ],
      name: '',
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  }
];

export class FidesGuardError extends Error {
  constructor(public assessment: RiskAssessment) {
    super(`Transaction blocked: ${assessment.reason} (score: ${assessment.riskScore})`);
    this.name = 'FidesGuardError';
  }
}

export class FidesGuard {
  private provider: JsonRpcProvider;
  private guardContract: Contract;
  private localCache: Map<string, CacheEntry> = new Map();
  private cacheEnabled: boolean;

  constructor(
    rpcUrl: string,
    guardAddress: string,
    options: { cacheEnabled?: boolean } = {}
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.guardContract = new Contract(guardAddress, GUARD_ABI, this.provider);
    this.cacheEnabled = options.cacheEnabled !== false;
  }

  /**
   * 评估单一地址风险
   */
  async assessAddress(addr: string): Promise<RiskAssessment> {
    // 本地缓存检查
    if (this.cacheEnabled) {
      const cached = this.localCache.get(addr.toLowerCase());
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.assessment;
      }
    }

    const result = await this.guardContract.assessAddress.staticCall(addr);
    const assessment = this._parseAssessment(result);

    // 更新缓存
    if (this.cacheEnabled) {
      this.localCache.set(addr.toLowerCase(), {
        assessment,
        timestamp: Date.now()
      });
    }

    return assessment;
  }

  /**
   * 评估交易风险
   */
  async checkTransaction(tx: TransactionRequest): Promise<RiskAssessment> {
    const intent = {
      from: tx.from,
      to: tx.to,
      value: tx.value || '0',
      token: tx.token || ethers.ZeroAddress,
      data: tx.data || '0x',
      chainId: tx.chainId || 1
    };

    // 缓存检查（基于to地址）
    const cacheKey = `${tx.to?.toLowerCase()}_${tx.token?.toLowerCase()}`;
    if (this.cacheEnabled && tx.to) {
      const cached = this.localCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.assessment;
      }
    }

    const result = await this.guardContract.assessTransaction.staticCall(intent);
    const assessment = this._parseAssessment(result);

    if (this.cacheEnabled && tx.to) {
      this.localCache.set(cacheKey, {
        assessment,
        timestamp: Date.now()
      });
    }

    return assessment;
  }

  /**
   * 拦截模式 — BLOCK时抛异常，WARN时返回确认要求
   */
  async intercept(tx: TransactionRequest): Promise<TransactionRequest | null> {
    const assessment = await this.checkTransaction(tx);

    if (assessment.action === Action.BLOCK) {
      throw new FidesGuardError(assessment);
    }

    if (assessment.action === Action.WARN) {
      // 在浏览器环境中，这里可以触发确认对话框
      // Node环境中，返回特殊标记
      console.warn(`⚠️ FidesOrigin Warning: ${assessment.reason} (score: ${assessment.riskScore})`);
    }

    return tx;
  }

  /**
   * 批量评估
   */
  async assessBatch(addresses: string[]): Promise<RiskAssessment[]> {
    return Promise.all(addresses.map(addr => this.assessAddress(addr)));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.localCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.localCache.size,
      keys: Array.from(this.localCache.keys())
    };
  }

  private _parseAssessment(result: any): RiskAssessment {
    const actionMap = ['ALLOW', 'WARN', 'BLOCK'];
    const categoryMap = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'SANCTIONED'];

    return {
      action: actionMap[Number(result.action)] as Action,
      riskScore: Number(result.riskScore),
      category: categoryMap[Number(result.category)] as RiskCategory,
      tags: result.tags.map((t: string) => t.toString()),
      confidence: Number(result.confidence),
      reason: result.reason,
      merkleRoot: result.merkleRoot,
      assessmentTime: Number(result.assessmentTime)
    };
  }
}

// 默认导出
export default FidesGuard;
