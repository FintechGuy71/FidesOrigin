/**
 * ============================================================================
 * [DEPRECATED] 历史遗留脚本（v2.x/v3.0.x 时代），仅作历史记录保留。
 * 引用已弃用的旧合约地址/实现，切勿执行（会操作错误的合约）。
 * 现役部署/升级请参考 scripts/deploy-full.js（v3.1.0 权威脚本集）。
 * ============================================================================
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying FidesCompliance V2.1 (Guard Integrated):", deployer.address);

  // Deploy new implementation
  const FidesCompliance = await hre.ethers.getContractFactory("FidesCompliance");
  const newImpl = await FidesCompliance.deploy();
  await newImpl.waitForDeployment();
  
  const address = await newImpl.getAddress();
  console.log("✅ New implementation deployed:", address);
  console.log("");
  console.log("=== Upgrade Steps (48h timelock) ===");
  console.log("1. Propose upgrade:");
  console.log(`   npx hardhat run scripts/execute-upgrade.js --network sepolia`);
  console.log("   (Set PROPOSAL_IMPL=" + address + " in .env)");
  console.log("");
  console.log("2. Wait 48 hours");
  console.log("");
  console.log("3. Execute upgrade:");
  console.log(`   npx hardhat run scripts/execute-upgrade.js --network sepolia`);
  console.log("   (Set EXECUTE_IMPL=" + address + " in .env)");
  console.log("");
  console.log("4. Enable Guard after upgrade:");
  console.log(`   npx hardhat run scripts/enable-guard.js --network sepolia`);
}

main().catch(console.error);
