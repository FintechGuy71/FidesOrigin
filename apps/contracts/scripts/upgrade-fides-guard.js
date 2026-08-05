const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Upgrading FidesCompliance with Guard support:", deployer.address);

  // Sepolia existing addresses
  const FIDES_COMPLIANCE_PROXY = "0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707";
  const GUARD_ADDRESS = "0x57DfE2509E41AD44A20619bBB46594C455cdB8B6";

  // Deploy new implementation
  const FidesCompliance = await hre.ethers.getContractFactory("FidesCompliance");
  const newImpl = await FidesCompliance.deploy();
  await newImpl.waitForDeployment();
  console.log("New implementation:", await newImpl.getAddress());

  // Upgrade proxy
  const proxy = await hre.ethers.getContractAt("FidesCompliance", FIDES_COMPLIANCE_PROXY);
  
  // Check if deployer has ADMIN_ROLE
  const hasRole = await proxy.hasRole(await proxy.ADMIN_ROLE(), deployer.address);
  console.log("Has ADMIN_ROLE:", hasRole);

  if (hasRole) {
    // Propose upgrade
    await proxy.proposeUpgrade(await newImpl.getAddress());
    console.log("Upgrade proposed. Waiting 48 hours...");
    
    // Note: In production, wait 48 hours then call executeUpgrade()
    // For testing, we can skip if using a test timelock
  } else {
    console.log("Deployer does not have ADMIN_ROLE. Cannot upgrade.");
  }
}

main().catch(console.error);
