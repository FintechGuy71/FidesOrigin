const { ethers } = require('hardhat');

/**
 * Grant ORACLE_ROLE to a data publisher address on RiskRegistry
 * 
 * Usage:
 *   npx hardhat run scripts/grant-role.js --network sepolia
 * 
 * Required env vars:
 *   ADMIN_PRIVATE_KEY - The deployer/admin private key (has DEFAULT_ADMIN_ROLE)
 *   PUBLISHER_ADDRESS - The address to grant ORACLE_ROLE to
 *   RISK_REGISTRY     - RiskRegistry proxy address (required, no default)
 */

async function main() {
  const riskRegistryAddress = process.env.RISK_REGISTRY;

  if (!riskRegistryAddress) {
    console.error('❌ RISK_REGISTRY env var required');
    console.error('   Example: RISK_REGISTRY=0x... PUBLISHER_ADDRESS=0x... npx hardhat run scripts/grant-role.js --network sepolia');
    process.exit(1);
  }
  const publisherAddress = process.env.PUBLISHER_ADDRESS;

  if (!publisherAddress) {
    console.error('❌ PUBLISHER_ADDRESS env var required');
    console.error('   Example: PUBLISHER_ADDRESS=0x... npx hardhat run scripts/grant-role.js --network sepolia');
    process.exit(1);
  }

  // Load contract
  const RiskRegistry = await ethers.getContractFactory('RiskRegistry');
  const registry = RiskRegistry.attach(riskRegistryAddress);

  // Get role hash
  const ORACLE_ROLE = await registry.ORACLE_ROLE();
  console.log('ORACLE_ROLE bytes32:', ORACLE_ROLE);

  // Check if already granted
  const hasRole = await registry.hasRole(ORACLE_ROLE, publisherAddress);
  if (hasRole) {
    console.log(`✅ ${publisherAddress} already has ORACLE_ROLE`);
    return;
  }

  // Check caller is admin
  const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
  const signer = (await ethers.getSigners())[0];
  const isAdmin = await registry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  
  console.log('Signer:', signer.address);
  console.log('Is Admin:', isAdmin);
  
  if (!isAdmin) {
    console.error('❌ Signer is not admin. Cannot grant roles.');
    process.exit(1);
  }

  // Grant role
  console.log(`Granting ORACLE_ROLE to ${publisherAddress}...`);
  const tx = await registry.grantRole(ORACLE_ROLE, publisherAddress);
  console.log('Transaction:', tx.hash);

  const receipt = await tx.wait();
  console.log('✅ ORACLE_ROLE granted successfully!');
  console.log('   Block:', receipt.blockNumber);
  console.log('   Gas used:', receipt.gasUsed.toString());

  // Verify
  const verified = await registry.hasRole(ORACLE_ROLE, publisherAddress);
  console.log('Verified:', verified);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
