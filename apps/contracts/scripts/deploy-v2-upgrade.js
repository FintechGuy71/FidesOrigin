const { ethers } = require("hardhat");

const PROXY = proxyAddress ;

async function main() {
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

  const ofacAddr = testAddr ;
  console.log(`isSanctioned(${ofacAddr}):`, await proxy.isSanctioned(ofacAddr));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
