require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();

// [Low Fix #64] Default RPC URL for sepolia. In production, always set SEPOLIA_RPC env var
// to a dedicated node provider (Alchemy, Infura) for reliability and rate-limit protection.
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: '0.8.26',
    settings: {
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
        runs: 200,
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
  networks: {
    hardhat: { chainId: 31337, allowUnlimitedContractSize: true },
    sepolia: {
      url: SEPOLIA_RPC,
      chainId: 11155111,
      // [High Fix #38] SECURITY WARNING: Using raw private key for sepolia deployment.
      // TODO: Migrate to AWS KMS or GCP KMS-based signer for production deployments.
      // See: https://docs.ethers.org/v6/api/providers/#Wallet
      // Never use a mainnet private key in this configuration.
      accounts: ADMIN_KEY ? [ADMIN_KEY] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: { timeout: 60000 },
};
