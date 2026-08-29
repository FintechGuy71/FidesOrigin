/**
 * ============================================================================
 * [DEPRECATED] 历史遗留脚本（v2.x/v3.0.x 时代），仅作历史记录保留。
 * 引用已弃用的旧合约地址/实现，切勿执行（会操作错误的合约）。
 * 现役部署/升级请参考 scripts/deploy-full.js（v3.1.0 权威脚本集）。
 * ============================================================================
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying FidesOrigin Layer 1 + 3 contracts...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy RiskRegistry (mock for Layer 1)
  const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
  const riskRegistry = await RiskRegistry.deploy();
  await riskRegistry.waitForDeployment();
  console.log("✅ RiskRegistry:", await riskRegistry.getAddress());

  // Deploy PreTransactionGuard
  const Guard = await ethers.getContractFactory("PreTransactionGuard");
  const guard = await Guard.deploy(await riskRegistry.getAddress());
  await guard.waitForDeployment();
  console.log("✅ PreTransactionGuard:", await guard.getAddress());

  // Deploy RiskRegistryV3
  const RegistryV3 = await ethers.getContractFactory("RiskRegistryV3");
  const registryV3 = await RegistryV3.deploy();
  await registryV3.waitForDeployment();
  await registryV3.initialize(deployer.address);
  console.log("✅ RiskRegistryV3:", await registryV3.getAddress());

  // Deploy PolicyEngineV2
  const PolicyV2 = await ethers.getContractFactory("PolicyEngineV2");
  const policyV2 = await PolicyV2.deploy();
  await policyV2.waitForDeployment();
  await policyV2.initialize(deployer.address);
  console.log("✅ PolicyEngineV2:", await policyV2.getAddress());

  // Quick smoke test
  console.log("\n🧪 Smoke tests:");
  
  // Grant operator role to deployer for testing
  await guard.grantRole(await guard.OPERATOR_ROLE(), deployer.address);
  console.log("  Granted OPERATOR_ROLE to deployer");

  const r = await guard.assessAddress(deployer.address);
  console.log("  Unknown address:", r.action === 0 ? "ALLOW" : r.action === 2 ? "BLOCK" : "WARN", "(score:", r.riskScore.toString() + ")");

  await guard.updateSanctionedCache("0x0000000000000000000000000000000000000001", true);
  const r2 = await guard.assessAddress("0x0000000000000000000000000000000000000001");
  console.log("  Sanctioned address:", r2.action === 2 ? "BLOCK" : "ALLOW", "(score:", r2.riskScore.toString() + ")");

  const txIntent = { from: deployer.address, to: "0x0000000000000000000000000000000000000001", value: 0 };
  const r3 = await guard.assessTransaction(txIntent);
  console.log("  Transaction to sanctioned:", r3.action === 2 ? "BLOCK" : "ALLOW");

  console.log("\n✨ All contracts deployed and verified!");
  console.log("\n--- Deployment Summary ---");
  console.log("RiskRegistry:", await riskRegistry.getAddress());
  console.log("PreTransactionGuard:", await guard.getAddress());
  console.log("RiskRegistryV3:", await registryV3.getAddress());
  console.log("PolicyEngineV2:", await policyV2.getAddress());
}

main().catch(console.error);
