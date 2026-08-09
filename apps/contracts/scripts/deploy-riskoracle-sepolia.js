#!/usr/bin/env node
/**
 * RiskOracle — Sepolia 部署脚本
 * 
 * 用途：部署 RiskOracle 合约到 Sepolia 测试网
 * 
 * 前置条件：
 *   1. Sepolia 测试网账户有足够 ETH（建议 > 0.1 ETH）
 *   2. 已设置 ADMIN_PRIVATE_KEY 环境变量
 *   3. 已有 Chainlink Functions subscription（如没有，脚本会提示创建方式）
 * 
 * 执行方式：
 *   npx hardhat run scripts/deploy-riskoracle-sepolia.js --network sepolia
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Chainlink Functions Sepolia 配置
const CHAINLINK_CONFIG = {
  sepolia: {
    router: '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0',
    donId: '0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000', // fun-ethereum-sepolia-1
  }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FidesOrigin — RiskOracle Sepolia Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: sepolia (chainId=${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log();

  // 加载现有部署地址
  const deploymentsPath = path.join(__dirname, '..', '..', '..', 'packages', 'config', 'deployments.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  const sepolia = deployments.networks.sepolia;

  const riskRegistryAddress = sepolia.current.RiskRegistry;
  if (!riskRegistryAddress) {
    throw new Error('RiskRegistry address not found in deployments.json');
  }
  console.log(`RiskRegistry: ${riskRegistryAddress}`);

  // Chainlink Functions 配置
  const { router, donId } = CHAINLINK_CONFIG.sepolia;
  console.log(`Chainlink Router: ${router}`);
  console.log(`DON ID: ${donId}`);

  // Subscription ID — 从环境变量读取，或提示用户
  let subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    console.log();
    console.log("⚠️  CHAINLINK_SUBSCRIPTION_ID not set.");
    console.log("   You need a Chainlink Functions subscription to deploy RiskOracle.");
    console.log();
    console.log("   To create one:");
    console.log("   1. Go to https://functions.chain.link/sepolia");
    console.log("   2. Connect wallet: 0x5F6Ae278e7a62E64F9F467a91B693f372b84a374");
    console.log("   3. Create a new subscription (needs ~2 LINK + some Sepolia ETH)");
    console.log("   4. Set CHAINLINK_SUBSCRIPTION_ID=<id> and re-run this script");
    console.log();
    console.log("   Alternatively, set a placeholder subscriptionId for testing:");
    console.log("   CHAINLINK_SUBSCRIPTION_ID=1234 npx hardhat run scripts/deploy-riskoracle-sepolia.js --network sepolia");
    console.log();
    console.log("   For now, creating a mock/deployable version with subscriptionId=0 (non-functional)...");
    subscriptionId = 0;
  }
  console.log(`Subscription ID: ${subscriptionId}`);
  console.log();

  // 部署 RiskOracle
  console.log("━━━ Deploying RiskOracle ━━━");
  const RiskOracle = await ethers.getContractFactory("RiskOracle");
  const riskOracle = await RiskOracle.deploy(
    router,
    donId,
    subscriptionId,
    riskRegistryAddress
  );
  await riskOracle.waitForDeployment();
  const riskOracleAddress = await riskOracle.getAddress();
  console.log(`✅ RiskOracle deployed: ${riskOracleAddress}`);
  console.log(`   Tx: ${riskOracle.deploymentTransaction().hash}`);

  // 验证部署
  console.log();
  console.log("━━━ Verification ━━━");
  const owner = await riskOracle.owner();
  const rr = await riskOracle.riskRegistry();
  console.log(`Owner: ${owner}`);
  console.log(`RiskRegistry: ${rr}`);
  console.log(`DeferredCount: ${await riskOracle.deferredCount()}`);

  // 保存部署记录
  const deploymentRecord = {
    network: 'sepolia',
    chainId: 11155111,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RiskOracle: {
        address: riskOracleAddress,
        txHash: riskOracle.deploymentTransaction().hash,
        constructorArgs: {
          router,
          donId,
          subscriptionId,
          riskRegistry: riskRegistryAddress
        }
      }
    }
  };

  const recordPath = path.join(__dirname, '..', 'deployments', `riskoracle-sepolia-${Date.now()}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`\n📄 Deployment record saved: ${recordPath}`);

  // 输出更新 deployments.json 的指令
  console.log();
  console.log("━━━ Next Steps ━━━");
  console.log("1. Add RiskOracle to packages/config/deployments.json:");
  console.log(`   "RiskOracle": "${riskOracleAddress}"`);
  console.log("2. Add to data-publisher/.env:");
  console.log(`   RISK_ORACLE_ADDRESS=${riskOracleAddress}`);
  console.log("3. If subscriptionId=0, create a real Chainlink subscription and re-deploy");
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
