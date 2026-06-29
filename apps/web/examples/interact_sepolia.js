/**
 * FidesOrigin 智能合约交互示例 (JavaScript/TypeScript Ethers.js v6)
 * 
 * 使用方法:
 *   npm install ethers dotenv
 *   node examples/interact_sepolia.js
 * 
 * 环境变量 (添加到 .env 文件):
 *   PRIVATE_KEY=your_private_key
 *   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Sepolia 网络配置
const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia Testnet',
  rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
  explorer: 'https://sepolia.etherscan.io',
};

class FidesOriginClient {
  /**
   * FidesOrigin 智能合约交互客户端
   * @param {string} privateKey - 钱包私钥
   * @param {string} rpcUrl - RPC 节点 URL
   */
  constructor(privateKey = null, rpcUrl = null) {
    this.privateKey = privateKey || process.env.PRIVATE_KEY;
    if (!this.privateKey) {
      throw new Error('Private key is required. Set PRIVATE_KEY environment variable.');
    }

    // 初始化 Provider
    this.rpcUrl = rpcUrl || SEPOLIA_CONFIG.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    // 初始化 Wallet
    this.wallet = new ethers.Wallet(this.privateKey, this.provider);
    this.address = this.wallet.address;

    // 加载合约
    this._loadContracts();
  }

  /**
   * 从部署文件加载合约
   */
  _loadContracts() {
    try {
      const deploymentPath = path.join(__dirname, '..', 'deployments', 'sepolia.json');
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      const contracts = deployment.contracts || {};

      // 加载 FidesCompliance
      if (contracts.FidesCompliance) {
        const fcInfo = contracts.FidesCompliance;
        this.fidesCompliance = new ethers.Contract(
          fcInfo.address,
          fcInfo.abi,
          this.wallet
        );
        console.log(`📄 FidesCompliance: ${fcInfo.address}`);
      }

      // 加载 TestUSD
      if (contracts.TestUSD) {
        const tusdInfo = contracts.TestUSD;
        this.testUSD = new ethers.Contract(
          tusdInfo.address,
          tusdInfo.abi,
          this.wallet
        );
        console.log(`📄 TestUSD: ${tusdInfo.address}`);
      }
    } catch (error) {
      console.warn('⚠️  Could not load contracts:', error.message);
      this.fidesCompliance = null;
      this.testUSD = null;
    }
  }

  /**
   * 连接到网络
   */
  async connect() {
    const network = await this.provider.getNetwork();
    const balance = await this.provider.getBalance(this.address);
    
    console.log(`✅ Connected to ${SEPOLIA_CONFIG.name}`);
    console.log(`👤 Account: ${this.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
    
    return {
      network: network.name,
      chainId: Number(network.chainId),
      balance: ethers.formatEther(balance),
    };
  }

  // ==================== 以太坊基础操作 ====================

  /**
   * 获取 ETH 余额
   * @param {string} address - 地址 (可选，默认使用当前账户)
   * @returns {Promise<string>} ETH 余额
   */
  async getEthBalance(address = null) {
    const addr = address || this.address;
    const balance = await this.provider.getBalance(addr);
    return ethers.formatEther(balance);
  }

  /**
   * 发送 ETH
   * @param {string} to - 接收地址
   * @param {string} amountEth - ETH 金额
   * @returns {Promise<string>} 交易哈希
   */
  async sendEth(to, amountEth) {
    const tx = await this.wallet.sendTransaction({
      to,
      value: ethers.parseEther(amountEth.toString()),
    });

    console.log(`📤 ETH transfer sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

    return tx.hash;
  }

  // ==================== TestUSD 代币操作 ====================

  /**
   * 获取 TUSD 余额
   * @param {string} address - 地址 (可选，默认使用当前账户)
   * @returns {Promise<string>} TUSD 余额
   */
  async getTUSDBalance(address = null) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const addr = address || this.address;
    const balance = await this.testUSD.balanceOf(addr);
    return ethers.formatUnits(balance, 18);
  }

  /**
   * 转账 TUSD
   * @param {string} to - 接收地址
   * @param {string} amount - TUSD 金额
   * @returns {Promise<string>} 交易哈希
   */
  async transferTUSD(to, amount) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const tx = await this.testUSD.transfer(to, amountWei);

    console.log(`📤 TUSD transfer sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

    return tx.hash;
  }

  /**
   * 授权 TUSD 额度
   * @param {string} spender - 授权地址
   * @param {string} amount - 授权金额
   * @returns {Promise<string>} 交易哈希
   */
  async approveTUSD(spender, amount) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const tx = await this.testUSD.approve(spender, amountWei);

    console.log(`📤 TUSD approval sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

    return tx.hash;
  }

  /**
   * 获取授权额度
   * @param {string} owner - 所有者地址
   * @param {string} spender - 被授权地址
   * @returns {Promise<string>} 授权额度
   */
  async getAllowance(owner, spender) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const allowance = await this.testUSD.allowance(owner, spender);
    return ethers.formatUnits(allowance, 18);
  }

  /**
   * 获取 TUSD 合约信息
   * @returns {Promise<Object>} 合约信息
   */
  async getTUSDInfo() {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const info = await this.testUSD.getContractInfo();
    return {
      name: info[0],
      symbol: info[1],
      decimals: Number(info[2]),
      totalSupply: ethers.formatUnits(info[3], 18),
      vipCount: Number(info[4]),
      greyCount: Number(info[5]),
      blackCount: Number(info[6]),
      paused: info[7],
    };
  }

  /**
   * 获取用户限额信息
   * @param {string} address - 用户地址
   * @returns {Promise<Object>} 限额信息
   */
  async getLimitInfo(address = null) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const addr = address || this.address;
    const info = await this.testUSD.getLimitInfo(addr);
    
    const riskLevels = ['UNKNOWN', 'VIP', 'NORMAL', 'GREY', 'BLACK'];
    
    return {
      level: riskLevels[Number(info[0])] || 'UNKNOWN',
      dailyLimit: ethers.formatUnits(info[1], 18),
      singleLimit: ethers.formatUnits(info[2], 18),
      usedToday: ethers.formatUnits(info[3], 18),
      remainingToday: ethers.formatUnits(info[4], 18),
    };
  }

  /**
   * 从水龙头获取测试代币
   * @returns {Promise<string>} 交易哈希
   */
  async faucet() {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const tx = await this.testUSD.faucet();

    console.log(`📤 Faucet request sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Received 1000 TUSD (block ${receipt.blockNumber})`);

    return tx.hash;
  }

  // ==================== FidesCompliance 合规操作 ====================

  /**
   * 获取合规合约统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getComplianceStats() {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    const stats = await this.fidesCompliance.getStats();
    return {
      totalRiskProfiles: Number(stats[0]),
      totalRules: Number(stats[1]),
      activeRules: Number(stats[2]),
      totalAuditLogs: Number(stats[3]),
      dailyTxCount: Number(stats[4]),
      dailyTxVolume: ethers.formatUnits(stats[5], 18),
      isPaused: stats[6],
      strictMode: stats[7],
      auditMode: stats[8],
    };
  }

  /**
   * 查询地址风险画像
   * @param {string} address - 要查询的地址
   * @returns {Promise<Object>} 风险画像
   */
  async getRiskProfile(address) {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    const profile = await this.fidesCompliance.getRiskProfile(address);
    const riskLevels = ['UNKNOWN', 'WHITELIST', 'LOW', 'MEDIUM', 'HIGH', 'BLACKLIST'];

    return {
      level: riskLevels[Number(profile[0])] || 'UNKNOWN',
      score: Number(profile[1]),
      tags: profile[2],
      lastUpdated: Number(profile[3]) * 1000, // 转换为毫秒时间戳
      updatedBy: profile[4],
      reasonHash: profile[5],
      exists: profile[6],
    };
  }

  /**
   * 检查地址是否在黑名单
   * @param {string} address - 要检查的地址
   * @returns {Promise<boolean>}
   */
  async isBlacklisted(address) {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    return await this.fidesCompliance.isBlacklisted(address);
  }

  /**
   * 检查地址是否在白名单
   * @param {string} address - 要检查的地址
   * @returns {Promise<boolean>}
   */
  async isWhitelisted(address) {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    return await this.fidesCompliance.isWhitelisted(address);
  }

  /**
   * 评估交易合规性
   * @param {string} fromAddr - 发送地址
   * @param {string} toAddr - 接收地址
   * @param {string} amount - 金额
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateTransaction(fromAddr, toAddr, amount) {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const result = await this.fidesCompliance.evaluateTransaction(
      fromAddr,
      toAddr,
      amountWei
    );

    return {
      compliant: result[0],
      reason: result[1],
    };
  }

  /**
   * 获取当前链配置
   * @returns {Promise<Object>} 链配置
   */
  async getCurrentChainConfig() {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    const config = await this.fidesCompliance.getCurrentChainConfig();
    return {
      chainId: Number(config[0]),
      name: config[1],
      supported: config[2],
      confirmationBlocks: Number(config[3]),
      maxTransactionValue: ethers.formatUnits(config[4], 18),
      requiresKYC: config[5],
    };
  }

  // ==================== 管理功能（需要特定角色） ====================

  /**
   * 更新风险画像 (需要 OPERATOR_ROLE)
   * @param {string} address - 目标地址
   * @param {number} level - 风险等级 (0-5)
   * @param {number} score - 风险分数 (0-10000)
   * @param {string[]} tags - 标签数组
   * @param {string} reasonHash - 原因哈希
   * @returns {Promise<string>} 交易哈希
   */
  async updateRiskProfile(address, level, score, tags, reasonHash) {
    if (!this.fidesCompliance) {
      throw new Error('FidesCompliance contract not loaded');
    }

    const tx = await this.fidesCompliance.updateRiskProfile(
      address,
      level,
      score,
      tags,
      reasonHash
    );

    console.log(`📤 Risk profile update sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

    return tx.hash;
  }

  /**
   * 给地址打标签 (TestUSD - 需要 OPERATOR_ROLE)
   * @param {string} address - 目标地址
   * @param {number} level - 风险等级 (0-4)
   * @param {string} reason - 原因
   * @returns {Promise<string>} 交易哈希
   */
  async tagAddress(address, level, reason) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const tx = await this.testUSD.tagAddress(address, level, reason);

    console.log(`📤 Address tagging sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

    return tx.hash;
  }

  /**
   * 移除地址标签 (TestUSD - 需要 OPERATOR_ROLE)
   * @param {string} address - 目标地址
   * @returns {Promise<string>} 交易哈希
   */
  async untagAddress(address) {
    if (!this.testUSD) {
      throw new Error('TestUSD contract not loaded');
    }

    const tx = await this.testUSD.untagAddress(address);

    console.log(`📤 Address untagging sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

    return tx.hash;
  }
}

// ==================== 示例用法 ====================

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 FidesOrigin JavaScript SDK Demo');
  console.log('='.repeat(70));

  try {
    // 初始化客户端
    const client = new FidesOriginClient();
    await client.connect();

    console.log('\n' + '-'.repeat(70));
    console.log('💰 代币余额');
    console.log('-'.repeat(70));

    const ethBalance = await client.getEthBalance();
    console.log(`ETH Balance: ${ethBalance} ETH`);

    if (client.testUSD) {
      const tusdBalance = await client.getTUSDBalance();
      console.log(`TUSD Balance: ${tusdBalance} TUSD`);

      console.log('\n' + '-'.repeat(70));
      console.log('📊 TUSD 合约信息');
      console.log('-'.repeat(70));
      const info = await client.getTUSDInfo();
      for (const [key, value] of Object.entries(info)) {
        console.log(`  ${key}: ${value}`);
      }

      console.log('\n' + '-'.repeat(70));
      console.log('🔒 限额信息');
      console.log('-'.repeat(70));
      const limitInfo = await client.getLimitInfo();
      for (const [key, value] of Object.entries(limitInfo)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    if (client.fidesCompliance) {
      console.log('\n' + '-'.repeat(70));
      console.log('📊 合规合约统计');
      console.log('-'.repeat(70));
      const stats = await client.getComplianceStats();
      for (const [key, value] of Object.entries(stats)) {
        console.log(`  ${key}: ${value}`);
      }

      console.log('\n' + '-'.repeat(70));
      console.log('🔍 风险画像查询');
      console.log('-'.repeat(70));
      const profile = await client.getRiskProfile(client.address);
      for (const [key, value] of Object.entries(profile)) {
        console.log(`  ${key}: ${value}`);
      }

      console.log('\n' + '-'.repeat(70));
      console.log('⛓️ 当前链配置');
      console.log('-'.repeat(70));
      const chainConfig = await client.getCurrentChainConfig();
      for (const [key, value] of Object.entries(chainConfig)) {
        console.log(`  ${key}: ${value}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Demo Complete!');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { FidesOriginClient, SEPOLIA_CONFIG };
