const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/deploy-reader.js --network sepolia');
  process.exit(1);
}

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
  const TEST_ADDRESS = process.env.TEST_ADDRESS;
  if (!TEST_ADDRESS) {
    console.error('❌ TEST_ADDRESS env var required');
    process.exit(1);
  }
  const isSanctioned = await reader.isSanctioned(TEST_ADDRESS);
  console.log(`isSanctioned(${TEST_ADDRESS}):`, isSanctioned);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
