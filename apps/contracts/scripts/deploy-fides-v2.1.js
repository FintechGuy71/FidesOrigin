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
