/**
 * FidesOrigin On-Chain SDK —— 主类
 * 直接合约交互：Guard 交易前校验（零 Gas view 调用）+ 风险画像只读查询 + 事件监听。
 * API 面与 docs/sdk 文档逐字对应。
 */
import { Contract, type Provider, type Listener, decodeBytes32String } from 'ethers';
import {
  COMPLIANCE_ENGINE_ABI,
  RISK_REGISTRY_ABI,
  SEPOLIA_ADDRESSES,
} from './abi';
import {
  Decision,
  RiskTier,
  type ContractAddresses,
  type TransferValidation,
  type RiskProfile,
  type TransferValidatedCallback,
  type SanctionAddedCallback,
} from './types';

export class FidesOriginSDK {
  private readonly provider: Provider;
  private readonly engine: Contract;
  private readonly registry: Contract;
  private readonly addresses: Required<Pick<ContractAddresses, 'complianceEngine' | 'riskRegistry'>> &
    ContractAddresses;

  /**
   * @param addresses 合约地址集（至少需 complianceEngine 与 riskRegistry）
   * @param provider  ethers v6 Provider（如 new JsonRpcProvider(rpcUrl)）
   */
  constructor(addresses: ContractAddresses, provider: Provider) {
    if (!addresses?.complianceEngine) {
      throw new Error('FidesOriginSDK: addresses.complianceEngine is required');
    }
    if (!addresses?.riskRegistry) {
      throw new Error('FidesOriginSDK: addresses.riskRegistry is required');
    }
    if (!provider) {
      throw new Error('FidesOriginSDK: provider is required');
    }
    this.addresses = addresses as FidesOriginSDK['addresses'];
    this.provider = provider;
    this.engine = new Contract(addresses.complianceEngine, COMPLIANCE_ENGINE_ABI, provider);
    this.registry = new Contract(addresses.riskRegistry, RISK_REGISTRY_ABI, provider);
  }

  // ── Guard：交易前校验（零 Gas view）──────────────────────────────────────────

  /**
   * 校验一笔转账的合规性。
   * @returns { decision, reason } —— decision ∈ Decision.ALLOW / BLOCK / FLAG / HOLD
   */
  async validateTransfer(
    from: string,
    to: string,
    amount: bigint,
    token: string
  ): Promise<TransferValidation> {
    const [decision, reason]: [bigint, string] = await this.engine.validateTransfer(
      from,
      to,
      amount,
      token
    );
    return { decision: Number(decision) as Decision, reason };
  }

  /**
   * 快速判断一笔转账是否会成功（不被 BLOCK/HOLD）。
   * @returns true = 会成功（ALLOW 或 FLAG 放行）
   */
  async wouldTransferSucceed(
    from: string,
    to: string,
    amount: bigint,
    token: string
  ): Promise<boolean> {
    const { decision } = await this.validateTransfer(from, to, amount, token);
    return decision === Decision.ALLOW || decision === Decision.FLAG;
  }

  // ── 风险画像（gas-free 只读）────────────────────────────────────────────────

  /**
   * 获取地址完整风险画像。
   * bytes32 标签解码为可读字符串；tier 数值转 RiskTier 枚举。
   */
  async getRiskProfile(address: string): Promise<RiskProfile> {
    const [riskScore, tier, tags, lastUpdated, sanctioned]: [
      bigint,
      bigint,
      string[],
      bigint,
      boolean
    ] = await this.registry.getRiskProfile(address);
    return {
      riskScore: Number(riskScore),
      tier: Number(tier) as RiskTier,
      tags: (tags as unknown as string[]).map((t) => {
        try {
          return decodeBytes32String(t);
        } catch {
          return t; // 非标准 bytes32 字符串时原样返回
        }
      }),
      lastUpdated: Number(lastUpdated),
      isSanctioned: sanctioned,
    };
  }

  /** 地址是否在制裁名单 */
  async isSanctioned(address: string): Promise<boolean> {
    return this.registry.isSanctioned(address);
  }

  /** 地址风险等级（RiskTier 枚举） */
  async getRiskTier(address: string): Promise<RiskTier> {
    const tier: bigint = await this.registry.getRiskTier(address);
    return Number(tier) as RiskTier;
  }

  /** 地址风险标签（bytes32 → 可读字符串） */
  async getTags(address: string): Promise<string[]> {
    const tags: string[] = await this.registry.getTags(address);
    return tags.map((t) => {
      try {
        return decodeBytes32String(t);
      } catch {
        return t;
      }
    });
  }

  // ── 事件监听 ────────────────────────────────────────────────────────────────

  /**
   * 监听 TransferValidated 事件（Guard 校验结果）。
   * @returns 退订函数
   */
  onTransferValidated(callback: TransferValidatedCallback): () => void {
    const listener: Listener = (
      asset: string,
      from: string,
      to: string,
      amount: bigint,
      decision: bigint,
      reason: string
    ) => {
      callback(asset, from, to, amount, Number(decision) as Decision, reason);
    };
    void this.engine.on('TransferValidated', listener);
    return () => {
      void this.engine.off('TransferValidated', listener);
    };
  }

  /**
   * 监听 SanctionAdded 事件（新增制裁地址）。
   * @returns 退订函数
   */
  onSanctionAdded(callback: SanctionAddedCallback): () => void {
    const listener: Listener = (account: string, reason: string) => {
      callback(account, reason);
    };
    void this.registry.on('SanctionAdded', listener);
    return () => {
      void this.registry.off('SanctionAdded', listener);
    };
  }

  /** 移除本 SDK 实例注册的全部事件监听 */
  removeAllListeners(): void {
    void this.engine.removeAllListeners();
    void this.registry.removeAllListeners();
  }
}

/* 文档默认地址集（Sepolia）。生产集成应传入自己的地址集。 */
export { SEPOLIA_ADDRESSES };

/* 枚举是运行时值（文档示例用 Decision.BLOCK），必须作值导出而非仅 type */
export { Decision, RiskTier };
export type { ContractAddresses, TransferValidation, RiskProfile };
