/**
 * FidesOrigin — Shared Chain Configuration
 *
 * Single source of truth for all chain-related settings.
 * Keep this in sync with apps/subgraph/networks.json.
 */

export interface ChainConfig {
  id: number;
  name: string;
  rpcEnv: string;
  fallbackRpc: string;
  explorer: string;
  subgraph: string;
  contracts: Record<string, { address: string; startBlock: number }>;
  isTestnet: boolean;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: "Ethereum Mainnet",
    rpcEnv: "ETHEREUM_MAINNET_RPC",
    fallbackRpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io",
    subgraph: "fidesorigin/ethereum",
    contracts: {
      RiskRegistry: { address: "0x0000000000000000000000000000000000000000", startBlock: 0 },
      ComplianceEngine: { address: "0x0000000000000000000000000000000000000000", startBlock: 0 },
      PolicyEngine: { address: "0x0000000000000000000000000000000000000000", startBlock: 0 },
      FidesCompliance: { address: "0x0000000000000000000000000000000000000000", startBlock: 0 },
      CompliantStableCoin: { address: "0x0000000000000000000000000000000000000000", startBlock: 0 },
    },
    isTestnet: false,
  },
  sepolia: {
    id: 11155111,
    name: "Sepolia Testnet",
    rpcEnv: "SEPOLIA_RPC",
    fallbackRpc: "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    subgraph: "fidesorigin/sepolia",
    contracts: {
      RiskRegistry: { address: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc", startBlock: 7650000 },
      ComplianceEngine: { address: "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC", startBlock: 7650000 },
      PolicyEngine: { address: "0x87089F67A61F9643796AE154663A6a9F21196b38", startBlock: 7650000 },
      FidesCompliance: { address: "0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594", startBlock: 7800000 },
      CompliantStableCoin: { address: "0xb47a6520740a54B375e6F3B22bC316B4b02bFbCF", startBlock: 7800000 },
    },
    isTestnet: true,
  },
  hardhat: {
    id: 31337,
    name: "Hardhat Local",
    rpcEnv: "HARDAT_RPC",
    fallbackRpc: "http://127.0.0.1:8545",
    explorer: "",
    subgraph: "",
    contracts: {},
    isTestnet: true,
  },
} as const;

export type ChainName = keyof typeof SUPPORTED_CHAINS;

/** Helper: get chain by name */
export function getChain(name: ChainName): ChainConfig {
  const chain = SUPPORTED_CHAINS[name];
  if (!chain) throw new Error(`Unknown chain: ${name}`);
  return chain;
}

/** Helper: get chain by numeric chain ID */
export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
}

/** Helper: get RPC URL from env or fallback */
export function getRpcUrl(chainName: ChainName): string {
  const chain = getChain(chainName);
  return process.env[chain.rpcEnv] || chain.fallbackRpc;
}

/** Testnet chains */
export const TESTNET_CHAINS = Object.values(SUPPORTED_CHAINS).filter(
  (c) => c.isTestnet && c.id !== 31337
);

/** Mainnet chains */
export const MAINNET_CHAINS = Object.values(SUPPORTED_CHAINS).filter(
  (c) => !c.isTestnet
);
