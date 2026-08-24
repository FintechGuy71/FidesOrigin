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
      RiskRegistry: { address: "0x953f985f38f94d6159c0600d1f15D543895cE896", startBlock: 11550000 },
      ComplianceEngine: { address: "0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E", startBlock: 11550000 },
      PolicyEngine: { address: "0xCA12BB2daD2a6D429277823366D8C88a490EDDeA", startBlock: 11550000 },
      FidesCompliance: { address: "0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5", startBlock: 11550000 },
      CompliantStableCoin: { address: "0x2245A8FCf6aca017327eA8950Ba510e9596595E9", startBlock: 11550000 },
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
