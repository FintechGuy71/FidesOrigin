const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/deploy-v2-upgrade.js --network sepolia');
  process.exit(1);
}

// ⚠️  SECURITY WARNING: This script directly calls upgradeToAndCall, bypassing any Timelock.
// Production deployments MUST use a TimelockController with a two-phase process.
// To bypass this check for testing/emergency, set BYPASS_TIMELOCK=true
// [High Fix #53] BYPASS_TIMELOCK is only allowed on hardhat/local networks.
const _network = hre ? (hre.network ? hre.network.name : 'unknown') : 'unknown';
const BYPASS_TIMELOCK = process.env.BYPASS_TIMELOCK === 'true' && _network === 'hardhat';

async function main() {
  if (!BYPASS_TIMELOCK) {
    console.error("❌  SECURITY HALT: Direct upgrade bypasses Timelock protection.");
    console.error("   Production: Use TimelockController.schedule() + execute()");
    console.error("   Testing:     Set BYPASS_TIMELOCK=true to proceed");
    process.exit(1);
  }

  console.warn("⚠️  BYPASSING TIMELOCK — direct upgradeToAndCall will be used");
  const [signer] = await ethers.getSigners();
  console.log('Deploying V2 implementation...');
  console.log('Signer:', signer.address);

  const RiskRegistryV2 = await ethers.getContractFactory('RiskRegistryV2');
  const impl = await RiskRegistryV2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('V2 implementation deployed:', implAddr);

  console.log('Upgrading proxy to V2 implementation...');
  const proxy = await ethers.getContractAt('RiskRegistryV2', PROXY);
  const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
  console.log('Upgrade tx:', tx.hash);
  await tx.wait();

  // Initialize V2
  console.log('Initializing V2...');
  const initTx = await proxy.initializeV2({ gasLimit: 300000 });
  console.log('Init tx:', initTx.hash);
  await initTx.wait();

  // Verify
  console.log('VERSION:', await proxy.VERSION());
  console.log('chainId:', (await proxy.chainId()).toString());
  console.log('totalProfiles:', (await proxy.totalProfiles()).toString());
  console.log('totalSanctioned:', (await proxy.totalSanctioned()).toString());

  const TEST_ADDRESS = process.env.TEST_ADDRESS;
  if (!TEST_ADDRESS) {
    console.error('❌ TEST_ADDRESS env var required');
    process.exit(1);
  }
  console.log(`isSanctioned(${TEST_ADDRESS}):`, await proxy.isSanctioned(TEST_ADDRESS));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
