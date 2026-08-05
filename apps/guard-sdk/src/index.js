import { ethers } from 'ethers';
const { Contract, JsonRpcProvider } = ethers;

export const FIDES_GUARD_ABI = [
  "function assessAddress(address addr) view returns (uint8 action, uint256 riskScore, uint256 confidence, string reason)",
  "function assessTransaction(tuple(address from, address to, uint256 value) intent) view returns (uint8 action, uint256 riskScore, uint256 confidence, string reason)",
  "function assessBatch(address[] addrs) view returns (uint8[] actions, uint256[] scores)",
  "function sanctionedCache(address) view returns (bool)",
  "function updateSanctionedCache(address addr, bool sanctioned)",
  "function blockThreshold() view returns (uint256)",
  "function warnThreshold() view returns (uint256)"
];

// Hardhat local / Sepolia testnet addresses (update after real deployment)
export const GUARD_ADDRESSES = {
  hardhat: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  sepolia: null // To be filled after Sepolia deployment
};

export class FidesGuard {
  constructor(providerOrUrl, guardAddress) {
    const provider = typeof providerOrUrl === 'string' 
      ? new JsonRpcProvider(providerOrUrl) 
      : providerOrUrl;
    this.contract = new Contract(guardAddress, FIDES_GUARD_ABI, provider);
    this.cache = new Map();
    this.cacheTTL = 3600000; // 1 hour
  }

  async checkAddress(addr) {
    const cached = this.cache.get(addr.toLowerCase());
    if (cached && Date.now() - cached.time < this.cacheTTL) return cached.result;
    
    const result = await this.contract.assessAddress.staticCall(addr);
    const parsed = {
      action: Number(result.action),
      riskScore: Number(result.riskScore),
      confidence: Number(result.confidence),
      reason: result.reason
    };
    this.cache.set(addr.toLowerCase(), { result: parsed, time: Date.now() });
    return parsed;
  }

  async checkTransaction(from, to, value = 0) {
    const result = await this.contract.assessTransaction.staticCall({ from, to, value });
    return {
      action: Number(result.action),
      riskScore: Number(result.riskScore),
      confidence: Number(result.confidence),
      reason: result.reason
    };
  }

  async intercept(from, to, value = 0) {
    const result = await this.checkTransaction(from, to, value);
    if (result.action === 2) {
      throw new Error(`FidesOrigin BLOCKED: ${result.reason} (score: ${result.riskScore})`);
    }
    if (result.action === 1) {
      console.warn(`FidesOrigin WARNING: ${result.reason} (score: ${result.riskScore})`);
    }
    return result;
  }

  clearCache() { this.cache.clear(); }
}

export default FidesGuard;
