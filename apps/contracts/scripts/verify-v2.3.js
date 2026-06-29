const { ethers } = require("hardhat");
const PROXY = process.env.PROXY_ADDRESS;
if (!PROXY) {
  console.error('❌ PROXY_ADDRESS env var required');
  console.error('   Example: PROXY_ADDRESS=0x... npx hardhat run scripts/verify-v2.3.js --network sepolia');
  process.exit(1);
}

async function main() {
  const c = new ethers.Contract(PROXY, [
    "function VERSION() view returns (string)",
    "function totalProfiles() view returns (uint256)",
    "function totalSanctioned() view returns (uint256)",
    "function isSanctioned(address) view returns (bool)",
    "function getProfile(address) view returns (uint256,address,uint32,uint8,uint8,bool,bool,bytes32[])",
    "function getRiskProfile(address) view returns (uint8,uint8,bytes32[],uint256,bool)",
  ], ethers.provider);

  console.log("VERSION:", await c.VERSION());
  console.log("totalProfiles:", (await c.totalProfiles()).toString());
  console.log("totalSanctioned:", (await c.totalSanctioned()).toString());
  console.log("isSanctioned:", await c.isSanctioned("0xe950dc316b836e4eefb8308bf32bf7c72a1358ff"));

  const p = await c.getProfile("0xe950dc316b836e4eefb8308bf32bf7c72a1358ff");
  console.log("getProfile (V1 compat): score=" + p[0] + " tier=" + p[3] + " sanctioned=" + p[5] + " exists=" + p[6] + " tags=" + p[7].length);

  const r = await c.getRiskProfile("0xe950dc316b836e4eefb8308bf32bf7c72a1358ff");
  console.log("getRiskProfile (V2): score=" + r[0] + " tier=" + r[1] + " sanctioned=" + r[4]);

  console.log("\n✅ V2.3.0 proxy verification complete");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
