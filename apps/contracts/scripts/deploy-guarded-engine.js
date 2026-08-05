const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying GuardedComplianceEngine with:", deployer.address);

  // Sepolia addresses
  const GUARD_ADDRESS = "0x57DfE2509E41AD44A20619bBB46594C455cdB8B6";
  const FALLBACK_ENGINE = "0x9303Df978467839B881b67Ad6C77756D00658A5A"; // DiamondComplianceEngine

  const GuardedEngine = await hre.ethers.getContractFactory("GuardedComplianceEngine");
  const engine = await GuardedEngine.deploy(GUARD_ADDRESS, FALLBACK_ENGINE);
  await engine.waitForDeployment();

  const address = await engine.getAddress();
  console.log("GuardedComplianceEngine deployed to:", address);

  // Verify on Etherscan (optional)
  console.log("To verify: npx hardhat verify --network sepolia", address, GUARD_ADDRESS, FALLBACK_ENGINE);
}

main().catch(console.error);
