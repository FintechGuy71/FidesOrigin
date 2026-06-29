/**
 * V2.3 Upgrade Script — Fixes 61 three-party consensus audit issues
 *
 * Changes from V2.2:
 *   - C1: Added backward-compatible getProfile() function
 *   - H1: batchUpdateRiskProfiles now accepts tags parameter
 *   - H2: emergencySanction updates _lastUpdateTime
 *   - H3: emergencySanction emits RiskProfileUpdated event
 *   - H4: _updateTags / removeTag clean entityAddresses
 *   - D2-016: proposeUpgrade + UPGRADE_TIMELOCK constant
 *   - D1-AUDIT1-035: PolicyEngine versionHistory circular buffer fix
 *   - D1-AUDIT1-017: FidesBridgeReceiver future timestamp check
 *   - H5: RiskRegistryReader fail-closed
 *   - H6: QuarantineVault underflow protection
 *   - Various Medium/Low fixes
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-v2.3.js --network sepolia
 */

const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-v2.3.js --network sepolia');
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
  console.log('  V2.3.0 Upgrade — RiskRegistryV2');
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
  console.log('Deploying RiskRegistryV2 (V2.3.0)...');
  const V2 = await ethers.getContractFactory('RiskRegistryV2');
  const impl = await V2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('New implementation:', implAddr);

  // Verify code
  const code = await ethers.provider.getCode(implAddr);
  if (code.length < 100) throw new Error('Empty deployment');
  console.log('Code size:', (code.length - 2) / 2, 'bytes');

  // Upgrade (pure code swap — no initialization needed)
  console.log('');
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
    'function UPGRADE_TIMELOCK() view returns (uint256)',
  ], ethers.provider);

  console.log('VERSION:', await postCheck.VERSION());
  console.log('totalProfiles:', (await postCheck.totalProfiles()).toString());
  console.log('totalHighRisk:', (await postCheck.totalHighRisk()).toString());
  console.log('totalSanctioned:', (await postCheck.totalSanctioned()).toString());
  console.log('UPGRADE_TIMELOCK:', (await postCheck.UPGRADE_TIMELOCK()).toString());

  // Verify backward-compatible getProfile exists
  try {
    await postCheck.getProfile('0x0000000000000000000000000000000000000001');
    console.log('getProfile() backward compat: ✅');
  } catch (e) {
    console.log('getProfile() backward compat: ❌', e.message?.slice(0, 80));
  }

  // Data integrity check
  if (preTotal.toString() === (await postCheck.totalProfiles()).toString()) {
    console.log('Data integrity (totalProfiles): ✅');
  } else {
    console.log('⚠️  totalProfiles changed:', preTotal.toString(), '→', (await postCheck.totalProfiles()).toString());
  }

  if (preSanctioned.toString() === (await postCheck.totalSanctioned()).toString()) {
    console.log('Data integrity (totalSanctioned): ✅');
  } else {
    console.log('⚠️  totalSanctioned changed:', preSanctioned.toString(), '→', (await postCheck.totalSanctioned()).toString());
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  V2.3.0 Upgrade Complete ✅');
  console.log('═══════════════════════════════════════');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
