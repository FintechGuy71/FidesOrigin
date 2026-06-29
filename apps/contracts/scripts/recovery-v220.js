const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS || '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';

async function main() {
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
  const testAddr = process.env.TEST_ADDRESS || '0xe950dc316b836e4eefb8308bf32bf7c72a1358ff';
  const data = '0x9948b18d000000000000000000000000' + testAddr.slice(2);
  const result2 = await ethers.provider.call({ to: PROXY, data });
  console.log('isSanctioned raw:', result2);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
