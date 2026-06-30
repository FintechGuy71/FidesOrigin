const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade-v2.2.js --network sepolia');
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
  console.log('Deploying V2.2.0...');
  console.log('Signer:', signer.address);

  const V2 = await ethers.getContractFactory('RiskRegistryV2');
  const impl = await V2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('V2.2 Implementation:', implAddr);

  // Check code exists
  const code = await ethers.provider.getCode(implAddr);
  if (code.length < 100) throw new Error('Empty deployment');
  console.log('Code size:', (code.length - 2) / 2);

  // Upgrade (NO init call — just pure code swap)
  const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external'];
  const proxy = new ethers.Contract(PROXY, proxyAbi, signer);
  const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
  console.log('Upgrade tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Status:', receipt.status);

  // Verify
  const v2 = new ethers.Contract(PROXY, [
    'function VERSION() view returns (string)',
    'function totalProfiles() view returns (uint256)',
    'function totalHighRisk() view returns (uint256)',
    'function totalSanctioned() view returns (uint256)',
    'function isSanctioned(address) view returns (bool)',
    'function getRiskProfile(address) view returns (uint8,uint8,bytes32[],uint256,bool)',
  ], ethers.provider);

  console.log('VERSION:', await v2.VERSION());
  console.log('totalProfiles:', (await v2.totalProfiles()).toString());
  console.log('totalHighRisk:', (await v2.totalHighRisk()).toString());
  console.log('totalSanctioned:', (await v2.totalSanctioned()).toString());

  const TEST_ADDRESS = process.env.TEST_ADDRESS;
  if (!TEST_ADDRESS) {
    console.error('❌ TEST_ADDRESS env var required');
    process.exit(1);
  }
  console.log('isSanctioned(OFAC):', await v2.isSanctioned(TEST_ADDRESS));

  // Test a ScamSniffer address too
  console.log('isSanctioned(Scam):', await v2.isSanctioned('0x101ce0cedd142f199c9ef61739ae59b6611a0fc0'));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
