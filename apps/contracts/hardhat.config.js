require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
// [WORKAROUND] @openzeppelin/hardhat-upgrades requires @openzeppelin/upgrades-core which
// is a pnpm workspace dependency. In npm-only environments, the transitive deps don't resolve.
// Now enabled since we are in a pnpm workspace:
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();

// [HIGH-9 FIX] 私钥加载与安全验证
function validateAndLoadPrivateKey() {
    const key = process.env.ADMIN_PRIVATE_KEY;
    if (!key) {
        console.warn("[HIGH-9] ADMIN_PRIVATE_KEY not set. Sepolia deployment will require explicit key.");
        return null;
    }

    // 1. 格式验证: 必须是 0x + 64 个 hex 字符
    if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
        throw new Error(
            "[HIGH-9] ADMIN_PRIVATE_KEY format invalid. Expected 0x + 64 hex chars. " +
            "Got length: " + key.length
        );
    }

    // 2. 已知危险私钥黑名单（Hardhat 默认账户等）
    const DANGEROUS_KEYS = [
        // Hardhat default accounts (first 5)
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
        // All-zeros (unsafe placeholder)
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    ];
    const keyLower = key.toLowerCase();
    if (DANGEROUS_KEYS.includes(keyLower)) {
        throw new Error(
            "[HIGH-9] ADMIN_PRIVATE_KEY matches a known test/private key. " +
            "This key is publicly known and MUST NOT be used on any network. " +
            "Use a fresh, randomly-generated key."
        );
    }

    // 3. 尝试派生地址并验证
    try {
        const { Wallet } = require("ethers");
        const wallet = new Wallet(key);
        console.log("[HIGH-9] Loaded deployer address:", wallet.address);
    } catch (e) {
        throw new Error("[HIGH-9] Failed to derive address from ADMIN_PRIVATE_KEY: " + e.message);
    }

    return key;
}

const ADMIN_KEY = validateAndLoadPrivateKey();

// Shared chain configuration — keep in sync with packages/config/src/chains.ts
const CHAINS = {
  hardhat: { chainId: 31337, allowUnlimitedContractSize: true },
  sepolia: {
    url: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    chainId: 11155111,
    // [HIGH-9 FIX] accounts 使用经过验证的 ADMIN_KEY
    accounts: ADMIN_KEY ? [ADMIN_KEY] : [],
  },
};

module.exports = {
  solidity: {
    version: '0.8.26',
    settings: {
      viaIR: true,
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
        runs: 1,
        details: {
          constantOptimizer: true,
          orderLiterals: true,
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: 'dhfoDgvulfnTUtnIf',
          },
        },
      },
      viaIR: true,
      metadata: {
        bytecodeHash: 'none',
      },
    },
  },
  networks: CHAINS,
  // [CI-FIX-2026-08-24] Etherscan 源码验证支持（scripts/verify-v3.1.0-sepolia.js）。
  // API key 经环境变量/CI secret 注入，不落盘。
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: { timeout: 60000 },
};
