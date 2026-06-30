/**
 * @deprecated 此文件为旧版 SDK Client 实现，不再维护。
 * [HIGH Fix #5] 请使用 packages/sdk/src/client.ts 中的新版本。
 * 
 * 新版本提供更完善的类型支持、React Hooks 集成、
 * 更安全的认证流程和更健壮的错误处理。
 * 
 * 迁移指南：
 * - import { FidesOriginClient } from '@fidesorigin/sdk'
 * - 配置方式：new FidesOriginClient({ apiKey: '...', baseUrl: '...' })
 */
import { Contract, JsonRpcProvider, isAddress } from "ethers";
import type { Provider } from "ethers";
import { RISK_REGISTRY_ABI, POLICY_ENGINE_ABI } from "./abi";
import type {
  FidesClientConfig,
  NetworkConfig,
  RiskProfile,
  TransactionEvaluation,
  TransactionRequest,
  RiskTier,
} from "./types";

/**
 * Built-in Sepolia testnet configuration.
 */
export const SEPOLIA_CONFIG: NetworkConfig = {
  provider: "https://ethereum-sepolia-rpc.publicnode.com",
  riskRegistry: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
  policyEngine: "0x87089F67A61F9643796AE154663A6a9F21196b38",
  chainId: 11155111,
};

/**
 * Built-in Holesky testnet configuration.
 */
export const HOLESKY_CONFIG: NetworkConfig = {
  provider: "https://ethereum-holesky-rpc.publicnode.com",
  riskRegistry: "0x0000000000000000000000000000000000000000", // Placeholder — update with real address
  policyEngine: "0x0000000000000000000000000000000000000000", // Placeholder — update with real address
  chainId: 17000,
};

/**
 * Built-in Goerli testnet configuration.
 * @deprecated Goerli was deprecated in 2024. Use Sepolia or Holesky instead.
 */
export const GOERLI_CONFIG: NetworkConfig = {
  provider: "https://ethereum-goerli-rpc.publicnode.com",
  riskRegistry: "0x0000000000000000000000000000000000000000",
  policyEngine: "0x0000000000000000000000000000000000000000",
  chainId: 5,
};

/**
 * FidesOrigin SDK client for on-chain risk intelligence.
 *
 * @example
 * ```ts
 * import { FidesClient } from "@fidesorigin/sdk";
 *
 * const client = new FidesClient({ network: "sepolia" });
 * const sanctioned = await client.isSanctioned("0x...");
 * ```
 */
export class FidesClient {
  private readonly provider: Provider;
  private readonly riskRegistry: Contract;
  private readonly policyEngine: Contract;
  private readonly networkConfig: NetworkConfig;

  /**
   * Create a new FidesClient instance.
   *
   * @param config - Client configuration object
   */
  constructor(config: FidesClientConfig = {}) {
    this.networkConfig = this.resolveConfig(config);

    this.provider = new JsonRpcProvider(this.networkConfig.provider);

    this.riskRegistry = new Contract(
      this.networkConfig.riskRegistry,
      RISK_REGISTRY_ABI,
      this.provider
    );

    this.policyEngine = new Contract(
      this.networkConfig.policyEngine,
      POLICY_ENGINE_ABI,
      this.provider
    );
  }

  /**
   * Determine the effective network configuration from user input.
   */
  private resolveConfig(config: FidesClientConfig): NetworkConfig {
    const network = config.network ?? (config.provider ? "custom" : "sepolia");

    switch (network) {
      case "sepolia":
        return {
          ...SEPOLIA_CONFIG,
          ...config,
        };
      case "holesky":
        return {
          ...HOLESKY_CONFIG,
          ...config,
        };
      case "goerli":
        return {
          ...GOERLI_CONFIG,
          ...config,
        };
      case "custom":
      default: {
        if (!config.provider || !config.riskRegistry || !config.policyEngine) {
          throw new Error(
            "Custom network requires 'provider', 'riskRegistry', and 'policyEngine' addresses."
          );
        }
        return config as NetworkConfig;
      }
    }
  }

  /**
   * Validate that a string is a checksummed Ethereum address.
   */
  private validateAddress(address: string, name: string): void {
    if (!isAddress(address)) {
      throw new Error(
        `FidesClient: invalid ${name} "${address}" — expected a checksummed Ethereum address.`
      );
    }
  }

  /**
   * Check whether a given address is flagged as sanctioned.
   *
   * @param address - Ethereum address to check
   * @returns `true` if sanctioned, otherwise `false`
   */
  async isSanctioned(address: string): Promise<boolean> {
    this.validateAddress(address, "address");
    try {
      return (await this.riskRegistry.isSanctioned(address)) as boolean;
    } catch (err) {
      throw this.wrapError("isSanctioned", err);
    }
  }

  /**
   * Retrieve the full risk profile for a given address.
   *
   * @param address - Ethereum address to profile
   * @returns RiskProfile including score, tier, sanctions flag, tags, and lastUpdated
   */
  async getRiskProfile(address: string): Promise<RiskProfile> {
    this.validateAddress(address, "address");
    try {
      const [riskScore, tier, tags, lastUpdated, isSanctioned] =
        (await this.riskRegistry.getRiskProfile(address)) as [
          number,
          number,
          string[],
          bigint,
          boolean
        ];

      return {
        riskScore: Number(riskScore),
        tier: Math.min(4, Math.max(0, Number(tier))) as RiskTier,
        sanctioned: isSanctioned,
        tags: tags ?? [],
        lastUpdated: Number(lastUpdated),
      };
    } catch (err) {
      throw this.wrapError("getRiskProfile", err);
    }
  }

  /**
   * Get the raw numerical risk score for an address (0-100).
   *
   * @param address - Ethereum address
   * @returns Risk score as a number
   */
  async getRiskScore(address: string): Promise<number> {
    this.validateAddress(address, "address");
    try {
      const score = (await this.riskRegistry.getRiskScore(address)) as bigint;
      return Number(score);
    } catch (err) {
      throw this.wrapError("getRiskScore", err);
    }
  }

  /**
   * Evaluate a transaction against on-chain risk policies (read-only).
   *
   * @param tx - Transaction parameters
   * @returns Evaluation result including allow/deny, risk score, and reason
   */
  async evaluateTransaction(
    tx: TransactionRequest
  ): Promise<TransactionEvaluation> {
    this.validateAddress(tx.from, "tx.from");
    this.validateAddress(tx.to, "tx.to");
    if (tx.token) {
      this.validateAddress(tx.token, "tx.token");
    }

    try {
      const token = tx.token ?? "0x0000000000000000000000000000000000000000";
      const [allowed, riskScore, reason] =
        (await this.policyEngine.evaluateTransaction(
          tx.from,
          tx.to,
          tx.amount,
          token
        )) as [boolean, bigint, string];

      return {
        allowed,
        riskScore: Number(riskScore),
        reason: reason || null,
      };
    } catch (err) {
      throw this.wrapError("evaluateTransaction", err);
    }
  }

  /**
   * Verify that the connected provider matches the expected chain ID.
   * Throws if a mismatch is detected.
   */
  async verifyNetwork(): Promise<void> {
    if (this.networkConfig.chainId === undefined) {
      // [MEDIUM Fix #12] 未知 chainId 时发出警告
      console.warn(
        '[FidesOrigin SDK Warning] chainId is undefined. ' +
        'Network verification is skipped. This may lead to unexpected behavior. ' +
        'Please specify chainId in your network configuration.'
      );
      return;
    }
    const network = await this.provider.getNetwork();
    const expected = BigInt(this.networkConfig.chainId);
    if (network.chainId !== expected) {
      throw new Error(
        `FidesClient: chain ID mismatch — expected ${this.networkConfig.chainId}, ` +
          `but connected to ${network.chainId}. Please verify your RPC endpoint.`
      );
    }
  }

  /**
   * Returns the underlying ethers Provider for advanced use cases.
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Returns the active network configuration.
   */
  getNetworkConfig(): Readonly<NetworkConfig> {
    return Object.freeze({ ...this.networkConfig });
  }

  /**
   * Wrap a contract call error with a descriptive message.
   */
  private wrapError(method: string, err: unknown): Error {
    if (err instanceof Error) {
      return new Error(`FidesClient.${method} failed: ${err.message}`);
    }
    return new Error(`FidesClient.${method} failed: ${String(err)}`);
  }
}
