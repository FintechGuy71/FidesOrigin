const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/recovery-v220.js --network sepolia');
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
  console.log('Recovery: deploying fresh V2.2.0 (no reinitializer needed)');
  console.log('Signer:', signer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(signer.address)), 'ETH');

  // Deploy the original V2.2.0 implementation
  const RiskRegistryV2 = await ethers.getContractFactory('RiskRegistryV2');
  
  // Deploy fresh implementation
  const impl = await RiskRegistryV2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('New fresh implementation:', implAddr);

  // Try direct upgrade (no init call)
  const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external'];
  const proxy = new ethers.Contract(PROXY, proxyAbi, signer);
  
  console.log('Upgrading to fresh impl...');
  try {
    const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
    console.log('Upgrade tx:', tx.hash);
    const receipt = await tx.wait();
    console.log('Status:', receipt.status);
  } catch(e) {
    console.log('Upgrade failed:', e.message);
    return;
  }

  // Test raw call
  const VERSION_SELECTOR = '0x54fd4d50';
  const result = await ethers.provider.call({ to: PROXY, data: VERSION_SELECTOR });
  console.log('VERSION raw:', result);

  // Test isSanctioned
  const TEST_ADDRESS = process.env.TEST_ADDRESS;
  if (!TEST_ADDRESS) {
    console.error('❌ TEST_ADDRESS env var required');
    process.exit(1);
  }
  const data = '0x9948b18d000000000000000000000000' + TEST_ADDRESS.slice(2);
  const result2 = await ethers.provider.call({ to: PROXY, data });
  console.log('isSanctioned raw:', result2);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
