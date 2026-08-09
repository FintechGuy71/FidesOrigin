#!/usr/bin/env node
/**
 * MinimalRiskOracle — Sepolia 部署脚本
 * 
 * 用途：部署精简版 RiskOracle（仅 deferredCount 监控）到 Sepolia 测试网
 * 后续可迁移到完整 RiskOracle
 * 
 * 执行方式：
 *   npx hardhat run scripts/deploy-minimal-riskoracle-sepolia.js --network sepolia
 */

const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FidesOrigin — MinimalRiskOracle Sepolia Deployment");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Network: sepolia (chainId=${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log();

  // 部署 MinimalRiskOracle
  console.log("━━━ Deploying MinimalRiskOracle ━━━");
  const MinimalRiskOracle = await ethers.getContractFactory("MinimalRiskOracle");
  const riskOracle = await MinimalRiskOracle.deploy(deployer.address);
  await riskOracle.waitForDeployment();
  const riskOracleAddress = await riskOracle.getAddress();
  console.log(`✅ MinimalRiskOracle deployed: ${riskOracleAddress}`);
  console.log(`   Tx: ${riskOracle.deploymentTransaction().hash}`);

  // 验证部署
  console.log();
  console.log("━━━ Verification ━━━");
  console.log(`DeferredCount: ${await riskOracle.deferredCount()}`);
  console.log(`Has ADMIN_ROLE: ${await riskOracle.hasRole(await riskOracle.ADMIN_ROLE(), deployer.address)}`);

  // 保存部署记录
  const deploymentRecord = {
    network: 'sepolia',
    chainId: 11155111,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MinimalRiskOracle: {
        address: riskOracleAddress,
        txHash: riskOracle.deploymentTransaction().hash,
        note: 'Minimal version for deferredCount monitoring. Full RiskOracle to be deployed later.'
      }
    }
  };

  const recordPath = path.join(__dirname, '..', 'deployments', `minimal-riskoracle-sepolia-${Date.now()}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`\n📄 Deployment record saved: ${recordPath}`);

  // 输出更新指令
  console.log();
  console.log("━━━ Next Steps ━━━");
  console.log("1. Add RiskOracle to packages/config/deployments.json:");
  console.log(`   "RiskOracle": "${riskOracleAddress}"`);
  console.log("2. Add to data-publisher/.env:");
  console.log(`   RISK_ORACLE_ADDRESS=${riskOracleAddress}`);
  console.log("3. Update subgraph.yaml to include RiskOracle data source (optional)");
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
