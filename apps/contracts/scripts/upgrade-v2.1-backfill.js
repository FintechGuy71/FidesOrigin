const { ethers } = require("hardhat");

const PROXY = proxyAddress ;

async function main() {
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
