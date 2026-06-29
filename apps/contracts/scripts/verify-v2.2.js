const { ethers } = require("hardhat");

async function main() {
  const v2 = new ethers.Contract(proxyAddress || "process.env.PROXY_ADDRESS", [
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
  console.log("isSanctioned(OFAC):", await v2.isSanctioned("process.env.TEST_ADDRESS"));
  console.log("isSanctioned(Scam):", await v2.isSanctioned("0x101ce0cedd142f199c9ef61739ae59b6611a0fc0"));

  // Check a known profile
  const profile = await v2.getRiskProfile("process.env.TEST_ADDRESS");
  console.log("OFAC profile:", { riskScore: profile[0], tier: profile[1], lastUpdated: profile[3].toString(), isSanctioned: profile[4] });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
