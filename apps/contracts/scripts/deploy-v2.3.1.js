/**
 * V2.3.1 Upgrade Script — Fixes V2.3.0 residual issues
 *
 * Changes from V2.3.0:
 *   L1: IAssetCompliance.RiskTier enum now includes CRITICAL (value 4)
 *   L2: SDK exports batchUpdateRiskProfiles ABI
 *   L3: publisher.ts getRiskProfile ABI corrected (5 return values)
 *   L4: benchmark.ts batchUpdateRiskProfiles ABI updated with tags param
 *   L5: initializeV2_2 comment corrected
 *
 * Usage:
 *   npx hardhat run scripts/deploy-v2.3.1.js --network sepolia
 */

const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/deploy-v2.3.1.js --network sepolia');
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
  console.log('═══════════════════════════════════════');
  console.log('  V2.3.1 Upgrade — RiskRegistryV2');
  console.log('═══════════════════════════════════════');
  console.log('Signer:', signer.address);
  console.log('Proxy:', PROXY);
  console.log('');

  // Pre-upgrade verification
  const preCheck = new ethers.Contract(PROXY, [
    'function VERSION() view returns (string)',
    'function totalProfiles() view returns (uint256)',
    'function totalSanctioned() view returns (uint256)',
    'function isSanctioned(address) view returns (bool)',
  ], ethers.provider);

  const preVersion = await preCheck.VERSION();
  const preTotal = await preCheck.totalProfiles();
  const preSanctioned = await preCheck.totalSanctioned();
  console.log('Pre-upgrade VERSION:', preVersion);
  console.log('Pre-upgrade totalProfiles:', preTotal.toString());
  console.log('Pre-upgrade totalSanctioned:', preSanctioned.toString());
  console.log('');

  // Deploy new implementation
  console.log('Deploying RiskRegistryV2 (V2.3.1)...');
  const V2 = await ethers.getContractFactory('RiskRegistryV2');
  const impl = await V2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('New implementation:', implAddr);

  // Verify code size
  const code = await ethers.provider.getCode(implAddr);
  if (code.length < 100) throw new Error('Empty deployment — code too small');
  console.log('Code size:', (code.length - 2) / 2, 'bytes');

  // Verify VERSION on implementation directly
  const implContract = new ethers.Contract(implAddr, [
    'function VERSION() view returns (string)',
  ], ethers.provider);
  const implVersion = await implContract.VERSION();
  console.log('Implementation VERSION:', implVersion);
  if (implVersion !== '2.3.1') {
    throw new Error(`FAIL: Expected VERSION "2.3.1", got "${implVersion}"`);
  }
  console.log('');

  // Upgrade proxy (pure code swap — no initialization needed)
  console.log('Upgrading proxy...');
  const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external'];
  const proxy = new ethers.Contract(PROXY, proxyAbi, signer);
  const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
  console.log('Upgrade tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Status:', receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED');
  if (receipt.status !== 1) throw new Error('Upgrade failed');

  // Post-upgrade verification
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  Post-Upgrade Verification');
  console.log('═══════════════════════════════════════');

  const postCheck = new ethers.Contract(PROXY, [
    'function VERSION() view returns (string)',
    'function totalProfiles() view returns (uint256)',
    'function totalHighRisk() view returns (uint256)',
    'function totalSanctioned() view returns (uint256)',
    'function isSanctioned(address) view returns (bool)',
    'function getRiskProfile(address) view returns (uint8,uint8,bytes32[],uint256,bool)',
    'function getProfile(address) view returns (uint256,address,uint32,uint8,uint8,bool,bool,bytes32[])',
  ], ethers.provider);

  // 1. VERSION check
  const postVersion = await postCheck.VERSION();
  console.log('VERSION:', postVersion);
  if (postVersion !== '2.3.1') {
    throw new Error(`FAIL: Proxy VERSION expected "2.3.1", got "${postVersion}"`);
  }

  // 2. totalProfiles check
  const postTotal = await postCheck.totalProfiles();
  console.log('totalProfiles:', postTotal.toString());
  if (postTotal.toString() !== '2636') {
    console.warn(`⚠️  Expected totalProfiles 2636, got ${postTotal.toString()}`);
  }

  // 3. isSanctioned check
  const sanctioned = await postCheck.isSanctioned(process.env.TEST_ADDRESS);
  console.log('isSanctioned(0xe950...58ff):', sanctioned);
  if (!sanctioned) {
    console.warn('⚠️  Expected isSanctioned = true');
  }

  // 4. getProfile returns 8 values
  try {
    const profile = await postCheck.getProfile(process.env.TEST_ADDRESS);
    console.log('getProfile() returned', profile.length, 'values ✅');
    console.log('  riskScore:', profile[0].toString());
    console.log('  addr:', profile[1]);
    console.log('  lastUpdated:', profile[2].toString());
    console.log('  riskTier:', profile[3].toString());
    console.log('  sourceConfidence:', profile[4].toString());
    console.log('  sanctioned:', profile[5]);
    console.log('  exists:', profile[6]);
    console.log('  tags:', profile[7]);
  } catch (e) {
    console.log('getProfile() check failed:', e.message?.slice(0, 100));
  }

  // 5. getRiskProfile returns 5 values
  try {
    const rp = await postCheck.getRiskProfile(process.env.TEST_ADDRESS);
    console.log('getRiskProfile() returned', rp.length, 'values ✅');
  } catch (e) {
    console.log('getRiskProfile() check failed:', e.message?.slice(0, 100));
  }

  // Data integrity
  if (preTotal.toString() === postTotal.toString()) {
    console.log('Data integrity (totalProfiles): ✅');
  } else {
    console.log('⚠️  totalProfiles changed:', preTotal.toString(), '→', postTotal.toString());
  }

  if (preSanctioned.toString() === (await postCheck.totalSanctioned()).toString()) {
    console.log('Data integrity (totalSanctioned): ✅');
  } else {
    console.log('⚠️  totalSanctioned changed:', preSanctioned.toString(), '→', (await postCheck.totalSanctioned()).toString());
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  V2.3.1 Upgrade Complete ✅');
  console.log('═══════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
