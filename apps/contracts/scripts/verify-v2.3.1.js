const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/verify-v2.3.1.js --network sepolia');
  process.exit(1);
}

async function main() {
  const v2 = new ethers.Contract(PROXY, [
    "function VERSION() view returns (string)",
    "function totalProfiles() view returns (uint256)",
    "function totalHighRisk() view returns (uint256)",
    "function totalSanctioned() view returns (uint256)",
    "function isSanctioned(address) view returns (bool)",
    "function getRiskProfile(address) view returns (uint8,uint8,bytes32[],uint256,bool)",
  ], ethers.provider);

  console.log("VERSION:", await v2.VERSION());
  console.log("totalProfiles:", (await v2.totalProfiles()).toString());
  console.log("totalHighRisk:", (await v2.totalHighRisk()).toString());
  console.log("totalSanctioned:", (await v2.totalSanctioned()).toString());

  const TEST_ADDRESS = process.env.TEST_ADDRESS;
  if (!TEST_ADDRESS) {
    console.error('❌ TEST_ADDRESS env var required');
    process.exit(1);
  }
  console.log(`isSanctioned(${TEST_ADDRESS}):`, await v2.isSanctioned(TEST_ADDRESS));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
