#!/usr/bin/env node
/**
 * ============================================================================
 * [DEPRECATED] 历史遗留脚本（v2.x/v3.0.x 时代），仅作历史记录保留。
 * 引用已弃用的旧合约地址/实现，切勿执行（会操作错误的合约）。
 * 现役部署/升级请参考 scripts/deploy-full.js（v3.1.0 权威脚本集）。
 * ============================================================================
 */

/**
 * RiskOracleLite — Sepolia 部署脚本
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

const CHAINLINK_CONFIG = {
  sepolia: {
    router: '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0',
    donId: '0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000',
  }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FidesOrigin — RiskOracleLite Sepolia Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const deploymentsPath = path.join(__dirname, '..', '..', '..', 'packages', 'config', 'deployments.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  const riskRegistryAddress = deployments.networks.sepolia.current.RiskRegistry;
  console.log(`RiskRegistry: ${riskRegistryAddress}`);

  const { router, donId } = CHAINLINK_CONFIG.sepolia;
  let subscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    console.log("⚠️  CHAINLINK_SUBSCRIPTION_ID not set, using placeholder 0");
    subscriptionId = 0;
  }

  console.log("━━━ Deploying RiskOracleLite ━━━");
  const RiskOracleLite = await ethers.getContractFactory("RiskOracleLite");
  const riskOracle = await RiskOracleLite.deploy(router, donId, subscriptionId, riskRegistryAddress);
  await riskOracle.waitForDeployment();
  const address = await riskOracle.getAddress();
  console.log(`✅ RiskOracleLite deployed: ${address}`);
  console.log(`   Tx: ${riskOracle.deploymentTransaction().hash}`);

  console.log("━━━ Verification ━━━");
  console.log(`VERSION: ${await riskOracle.VERSION()}`);
  console.log(`Owner: ${await riskOracle.owner()}`);
  console.log(`DeferredCount: ${await riskOracle.deferredCount()}`);

  // Save record
  const record = {
    network: 'sepolia',
    chainId: 11155111,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RiskOracleLite: {
        address,
        txHash: riskOracle.deploymentTransaction().hash,
        constructorArgs: { router, donId, subscriptionId, riskRegistry: riskRegistryAddress }
      }
    }
  };
  const recordPath = path.join(__dirname, '..', 'deployments', `riskoracle-lite-sepolia-${Date.now()}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

  console.log("\n━━━ Next Steps ━━━");
  console.log(`1. Update deployments.json: "RiskOracle": "${address}"`);
  console.log(`2. Update data-publisher/.env: RISK_ORACLE_ADDRESS=${address}`);
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch((error) => { console.error(error); process.exit(1); });
