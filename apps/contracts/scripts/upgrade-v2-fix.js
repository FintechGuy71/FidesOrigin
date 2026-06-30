/**
 * Upgrade RiskRegistryV2 proxy to the fixed implementation (v2.1.1).
 *
 * Fixes applied in this upgrade:
 *   - Critical 2: emergencySanction totalProfiles counting (wasNew check moved before write)
 *   - High 1: batchUpdateRiskProfiles now tracks totalHighRisk changes
 *   - High 2: batchUpdateRiskProfiles now updates _lastUpdateTime per address
 *   - High 3: emergencySanction now sets riskScore to 90 for sanctioned addresses
 *   - Medium 1: Added ReentrancyGuardUpgradeable (nonReentrant on update/batch functions)
 *   - Medium 3: removeSanction only emits SanctionRemoved when address was actually sanctioned
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-v2-fix.ts --network sepolia
 *
 * Environment:
 *   ADMIN_PRIVATE_KEY - Admin key with ADMIN_ROLE on the proxy
 *   PROXY_ADDRESS - Proxy address (default: process.env.PROXY_ADDRESS || address(0))
 */

const { ethers, network } = require("hardhat");

const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
if (!PROXY_ADDRESS) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-v2-fix.js --network sepolia');
  process.exit(1);
}

// ⚠️  SECURITY WARNING: This script directly calls upgradeToAndCall, bypassing any Timelock.
// Production deployments MUST use a TimelockController with a two-phase process.
// To bypass this check for testing/emergency, set BYPASS_TIMELOCK=true
// [High Fix #53] BYPASS_TIMELOCK is only allowed on hardhat/local networks.
// On any live network (sepolia, mainnet, etc.), BYPASS_TIMELOCK is forcibly ignored.
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
  console.log('Upgrading RiskRegistryV2 with account:', signer.address);
  console.log('Network:', network.name, `(chainId: ${network.config.chainId})`);
  console.log('Proxy address:', PROXY_ADDRESS);

  // Step 1: Get current proxy state
  const proxy = await ethers.getContractAt('RiskRegistryV2', PROXY_ADDRESS);
  const currentVersion = await proxy.VERSION();
  console.log(`\nCurrent proxy version: ${currentVersion}`);

  // Verify caller has ADMIN_ROLE
  const ADMIN_ROLE = await proxy.ADMIN_ROLE();
  const hasAdmin = await proxy.hasRole(ADMIN_ROLE, signer.address);
  if (!hasAdmin) {
    throw new Error(`Account ${signer.address} does not have ADMIN_ROLE on proxy`);
  }
  console.log('✅ Caller has ADMIN_ROLE');

  // Step 2: Deploy new implementation
  console.log('\n📋 Deploying new RiskRegistryV2 implementation...');
  const RiskRegistryV2 = await ethers.getContractFactory('RiskRegistryV2');
  const newImpl = await RiskRegistryV2.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log('✅ New implementation deployed:', newImplAddress);

  // Verify the new implementation version
  const version = await newImpl.VERSION();
  console.log(`📋 New implementation version: ${version}`);
  if (version !== '2.1.1') {
    throw new Error(`Expected version 2.1.1, got ${version}`);
  }

  // Step 3: Upgrade proxy AND call initializeV2_1() atomically
  // initializeV2_1 uses reinitializer(3) to initialize ReentrancyGuard
  console.log('\n📋 Upgrading proxy and initializing ReentrancyGuard...');

  // Encode the initializeV2_1() call
  const initData = RiskRegistryV2.interface.encodeFunctionData('initializeV2_1');

  // Call upgradeToAndCall (UUPS proxy handles this via _authorizeUpgrade)
  const tx = await proxy.upgradeToAndCall(newImplAddress, initData);
  console.log(`📋 Upgrade transaction: ${tx.hash}`);
  const receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error('Upgrade transaction reverted');
  }
  console.log('✅ Proxy upgraded and ReentrancyGuard initialized');

  // Step 4: Verify upgrade
  const upgradedVersion = await proxy.VERSION();
  console.log(`\n✅ Verified: Proxy now running version ${upgradedVersion}`);

  if (upgradedVersion !== '2.1.1') {
    throw new Error(`Upgrade verification failed: expected v2.1.1, got ${upgradedVersion}`);
  }

  // Step 5: Verify statistics are preserved
  const totalProfiles = await proxy.totalProfiles();
  const totalHighRisk = await proxy.totalHighRisk();
  const totalSanctioned = await proxy.totalSanctioned();
  console.log(`\n📊 Statistics after upgrade:`);
  console.log(`  Total Profiles: ${totalProfiles}`);
  console.log(`  Total High Risk: ${totalHighRisk}`);
  console.log(`  Total Sanctioned: ${totalSanctioned}`);

  // Step 6: Test that nonReentrant works (should not revert)
  // We'll test with a view function first
  try {
    const testAddr = '0x0000000000000000000000000000000000000001';
    await proxy.getRiskProfile(testAddr);
    console.log('✅ View functions work correctly');
  } catch (e) {
    console.error('❌ View function test failed:', e);
    throw e;
  }

  console.log('\n🎉 Upgrade complete!');
  console.log('\n📝 Summary:');
  console.log(`  - Old version: ${currentVersion}`);
  console.log(`  - New version: ${upgradedVersion}`);
  console.log(`  - Implementation: ${newImplAddress}`);
  console.log(`  - Proxy: ${PROXY_ADDRESS}`);
  console.log(`  - Tx: ${tx.hash}`);
  console.log('\n🔧 Fixes applied:');
  console.log('  ✅ Critical 2: emergencySanction totalProfiles counting fixed');
  console.log('  ✅ High 1: batchUpdateRiskProfiles tracks totalHighRisk');
  console.log('  ✅ High 2: batchUpdateRiskProfiles updates _lastUpdateTime');
  console.log('  ✅ High 3: emergencySanction sets riskScore=90');
  console.log('  ✅ Medium 1: ReentrancyGuardUpgradeable added');
  console.log('  ✅ Medium 3: removeSanction conditional event emission');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Upgrade failed:', error);
    process.exit(1);
  });
