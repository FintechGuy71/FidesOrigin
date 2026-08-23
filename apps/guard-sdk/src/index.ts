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
   * @dev [H-6 FIX] 缓存键修复：原实现 cacheKey = to_token，忽略 from 与金额——
   *      同一收款方 1 小时内复用首次评估：不同发送方（含受制裁地址）共享结论，
   *      且 maxTxAmount 等金额相关规则完全失效（$10 交易缓存 ALLOW 后，
   *      $10M 同地址交易直接复用）。现键入 from+to+token+value 四要素。
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

    // [H-6 FIX] 缓存键包含 from 与金额
    const cacheKey = [
      tx.from?.toLowerCase() ?? '',
      tx.to?.toLowerCase() ?? '',
      tx.token?.toLowerCase() ?? '',
      tx.value ?? '0'
    ].join('_');
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
    // [L-23 FIX] 枚举越界防御：未知 action/category 值兜底为 UNKNOWN，
    // 不再返回 undefined（原实现 actionMap[3+] 为 undefined 透传给调用方）
    const actionMap = ['ALLOW', 'WARN', 'BLOCK'] as const;
    const categoryMap = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'SANCTIONED'] as const;
    const actionIdx = Number(result.action);
    const categoryIdx = Number(result.category);

    return {
      action: (actionMap[actionIdx] ?? 'WARN') as Action,
      riskScore: Number(result.riskScore),
      category: (categoryMap[categoryIdx] ?? 'UNKNOWN') as RiskCategory,
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
