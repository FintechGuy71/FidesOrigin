const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-proxy.js --network sepolia');
  process.exit(1);
}
const V2_IMPL = process.env.V2_IMPL_ADDRESS || '0x788c534acd7E377b86a2f7E9284C2f3b03DD749a';

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
  const [deployer] = await ethers.getSigners();
  console.log('Upgrading with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

  // Step 1: Upgrade proxy to V2
  console.log('\n=== Step 1: Upgrade Proxy ===');
  const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external', 'function getImplementation() view returns (address)'];
  const proxy = new ethers.Contract(PROXY, proxyAbi, deployer);

  // Try to get current implementation
  try {
    const adminAbi = ['function getImplementation() view returns (address)'];
    const admin = new ethers.Contract(PROXY, adminAbi, ethers.provider);
    const current = await admin.getImplementation();
    console.log('Current implementation:', current);
  } catch (e) {
    console.log('Cannot read current implementation (proxy may not have this selector)');
  }

  console.log('Upgrading to V2 implementation:', V2_IMPL);
  const tx = await proxy.upgradeToAndCall(V2_IMPL, '0x', { gasLimit: 500000 });
  console.log('Upgrade tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Upgrade confirmed! Block:', receipt.blockNumber, 'Gas:', receipt.gasUsed.toString());

  // Step 2: Initialize V2
  console.log('\n=== Step 2: Initialize V2 ===');
  const v2Abi = [
    'function initializeV2() external',
    'function VERSION() view returns (string)',
    'function totalProfiles() view returns (uint256)',
    'function totalSanctioned() view returns (uint256)',
    'function lastGlobalUpdate() view returns (uint256)',
    'function chainId() view returns (uint256)',
    'function isSanctioned(address) view returns (bool)',
  ];
  const v2 = new ethers.Contract(PROXY, v2Abi, deployer);

  const initTx = await v2.initializeV2({ gasLimit: 300000 });
  console.log('Initialize tx hash:', initTx.hash);
  await initTx.wait();
  console.log('V2 initialized!');

  // Step 3: Verify
  console.log('\n=== Step 3: Verify ===');
  console.log('VERSION:', await v2.VERSION());
  console.log('chainId:', (await v2.chainId()).toString());
  console.log('totalProfiles:', (await v2.totalProfiles()).toString());
  console.log('totalSanctioned:', (await v2.totalSanctioned()).toString());

  // Test isSanctioned on a known OFAC address
  const ofacAddr = '0xe950dc316b836e4eefb8308bf32bf7c72a1358ff';
  try {
    const sanctioned = await v2.isSanctioned(ofacAddr);
    console.log(`isSanctioned(${ofacAddr}):`, sanctioned);
  } catch (e) {
    console.log('isSanctioned check failed:', e.message);
  }

  console.log('\n✅ V2 Upgrade Complete!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
