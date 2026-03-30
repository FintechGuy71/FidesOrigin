require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org';
const GOERLI_RPC = process.env.GOERLI_RPC || 'https://rpc.goerli.eth.gateway.fm';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: SEPOLIA_RPC,
        enabled: false,
      },
    },
    sepolia: {
      url: SEPOLIA_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      gasPrice: 'auto',
    },
    goerli: {
      url: GOERLI_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 5,
      gasPrice: 'auto',
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    outputFile: 'gas-report.txt',
    noColors: true,
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};
