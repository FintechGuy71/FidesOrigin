import deployments from "../../../packages/config/deployments.json";

const sepolia = deployments.networks.sepolia;

export const SEPOLIA_CHAIN_ID = sepolia.chainId;
export const RISK_REGISTRY_ADDRESS = sepolia.current.RiskRegistry;
export const MERKLE_RISK_REGISTRY_ADDRESS = sepolia.current.MerkleRiskRegistry;
export const POLICY_ENGINE_ADDRESS = sepolia.current.PolicyEngine;
export const COMPLIANCE_ENGINE_ADDRESS = sepolia.current.ComplianceEngine;
export const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/version/latest";
export const RELEASE_URL = "https://github.com/FintechGuy71/FidesOrigin/releases/latest";
export const RELEASE_EVIDENCE_URL =
  "https://github.com/FintechGuy71/FidesOrigin/releases/latest/download/fidesorigin-verification-evidence.zip";

export function etherscanAddress(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}
