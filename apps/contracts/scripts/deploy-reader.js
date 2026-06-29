const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS || '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying Reader with:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

  const Reader = await ethers.getContractFactory('RiskRegistryReader');
  const reader = await Reader.deploy(PROXY, { gasLimit: 1000000 });
  await reader.waitForDeployment();
  
  const addr = await reader.getAddress();
  console.log('RiskRegistryReader deployed to:', addr);
  
  // Verify
  const ofacAddr = process.env.TEST_ADDRESS || '0xe950dc316b836e4eefb8308bf32bf7c72a1358ff';
  const isSanctioned = await reader.isSanctioned(ofacAddr);
  console.log(`isSanctioned(${ofacAddr}):`, isSanctioned);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
