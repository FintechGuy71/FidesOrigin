/**
 * Minimal ABI for the RiskRegistry proxy contract.
 * Covers risk scoring, profiling, and sanctions lookup.
 *
 * Matches RiskRegistryV2.sol `getRiskProfile` which returns:
 *   (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool isSanctioned)
 */
export const RISK_REGISTRY_ABI = [
  {
    name: "getRiskScore",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "score", type: "uint256" }],
  },
  {
    name: "getRiskProfile",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      { name: "riskScore", type: "uint8" },
      { name: "tier", type: "uint8" },
      { name: "tags", type: "bytes32[]" },
      { name: "lastUpdated", type: "uint256" },
      { name: "isSanctioned", type: "bool" },
    ],
  },
  {
    name: "isSanctioned",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "flagged", type: "bool" }],
  },
  {
    name: "batchUpdateRiskProfiles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "accounts", type: "address[]" },
      { name: "riskScores", type: "uint8[]" },
      { name: "tiers", type: "uint8[]" },
      { name: "isSanctionedList", type: "bool[]" },
      { name: "tags", type: "bytes32[][]" },
    ],
    outputs: [],
  },
  {
    name: "totalProfiles",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "VERSION",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/**
 * Minimal ABI for the PolicyEngine proxy contract.
 * Covers transaction evaluation.
 *
 * [C2-fix] Fixed evaluateTransaction return values to match PolicyEngine.sol:
 *   returns (uint8 tier, uint256 riskScore, uint8 decision, string reason)
 */
export const POLICY_ENGINE_ABI = [
  {
    name: "evaluateTransaction",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "issuer", type: "address" },
    ],
    outputs: [
      { name: "tier", type: "uint8" },
      { name: "riskScore", type: "uint256" },
      { name: "decision", type: "uint8" },
      { name: "reason", type: "string" },
    ],
  },
] as const;
