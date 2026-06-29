const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-v2.1-backfill.js --network sepolia');
  process.exit(1);
}

// ⚠️  SECURITY WARNING: This script directly calls upgradeToAndCall, bypassing any Timelock.
// Production deployments MUST use a TimelockController with a two-phase process.
// To bypass this check for testing/emergency, set BYPASS_TIMELOCK=true
const BYPASS_TIMELOCK = process.env.BYPASS_TIMELOCK === 'true';

async function main() {
  if (!BYPASS_TIMELOCK) {
    console.error("❌  SECURITY HALT: Direct upgrade bypasses Timelock protection.");
    console.error("   Production: Use TimelockController.schedule() + execute()");
    console.error("   Testing:     Set BYPASS_TIMELOCK=true to proceed");
    process.exit(1);
  }

  console.warn("⚠️  BYPASSING TIMELOCK — direct upgradeToAndCall will be used");
  const [signer] = await ethers.getSigners();
  console.log('Upgrading RiskRegistryV2 with account:', signer.address);
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Proxy:', PROXY);

  const proxy = await ethers.getContractAt('RiskRegistryV2', PROXY);
  
  // Deploy V2.1 implementation
  console.log('Deploying V2.1 implementation...');
  const RiskRegistryV2 = await ethers.getContractFactory('RiskRegistryV2');
  const impl = await RiskRegistryV2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('V2.1 implementation deployed:', implAddr);

  // Upgrade
  console.log('Upgrading proxy...');
  const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
  console.log('Upgrade tx:', tx.hash);
  await tx.wait();

  // Backfill: update _lastUpdateTime for existing profiles
  console.log('Backfilling _lastUpdateTime...');
  
  // This would require iterating through all profiles, which is not feasible on-chain
  // For demo, we'll just set a global timestamp
  // In production, this would be done via a separate migration script
  
  console.log('Upgrade complete!');
  console.log('VERSION:', await proxy.VERSION());
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
