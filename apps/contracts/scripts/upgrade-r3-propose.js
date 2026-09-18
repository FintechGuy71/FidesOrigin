// [AUDIT FIX 2026-09-18 R3] 第三轮审计合约修复的部署+提案脚本（propose 阶段）
// 升级路径：UUPS 代理 × 3（RiskRegistry/PolicyEngine/FidesCompliance）
//         + Diamond facet 替换 × 3（Wallet/Asset/Loupe）
// 全部走 48h 时间锁：本脚本只做 deploy + propose，execute 由 upgrade-r3-execute.js 在 48h 后执行
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ADMIN = "0x5F6Ae278e7a62E64F9F467a91B693f372b84a374";
const ADDR = {
  RiskRegistry: "0x953f985f38f94d6159c0600d1f15D543895cE896",
  PolicyEngine: "0xCA12BB2daD2a6D429277823366D8C88a490EDDeA",
  FidesCompliance: "0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5",
  Diamond: "0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E",
};
const OLD_FACETS = {
  WalletComplianceFacet: "0x3C99EF323832FB723A6eff4A43B03A03b8CC3917",
  AssetComplianceFacet: "0xD80Ccee6167818E307bbAF436060003EeB6e415d",
  DiamondLoupeFacet: "0x3d9C891145226Bc49D43a82Ec3cc95Ff526EBeE3",
};

// FacetCutAction: Add=0, Replace=1, Remove=2
const UUPS_ABI = [
  "function proposeUpgrade(address newImplementation) returns (bytes32)",
  "function upgradeTimelockDelay() view returns (uint256)",
];
const CUT_ABI = [
  "function proposeDiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)",
];
const LOUPE_ABI = [
  "function facetFunctionSelectors(address facet) view returns (bytes4[])",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("signer:", signer.address);
  if (signer.address.toLowerCase() !== ADMIN.toLowerCase()) {
    throw new Error("signer != expected ADMIN " + ADMIN);
  }
  const bal = await ethers.provider.getBalance(signer.address);
  console.log("balance:", ethers.formatEther(bal), "ETH");

  const out = { timestamp: new Date().toISOString(), implementations: {}, facets: {}, proposals: {} };

  // ── 1. 部署 UUPS 新实现 ─────────────────────────────────────────────
  for (const name of ["RiskRegistry", "PolicyEngine", "FidesCompliance"]) {
    const F = await ethers.getContractFactory(name);
    const impl = await F.deploy();
    await impl.waitForDeployment();
    const addr = await impl.getAddress();
    console.log("deployed impl", name, addr);
    out.implementations[name] = addr;
  }

  // ── 2. UUPS proposeUpgrade × 3 ──────────────────────────────────────
  for (const name of ["RiskRegistry", "PolicyEngine", "FidesCompliance"]) {
    const proxy = new ethers.Contract(ADDR[name], UUPS_ABI, signer);
    const delay = await proxy.upgradeTimelockDelay().catch(() => 48n * 3600n);
    const tx = await proxy.proposeUpgrade(out.implementations[name]);
    const receipt = await tx.wait();
    console.log("proposed upgrade", name, "tx:", receipt.hash, "executeAfter:", new Date(Number(Date.now() / 1000 + Number(delay)) * 1000).toISOString());
    out.proposals[name] = { tx: receipt.hash, newImpl: out.implementations[name], delaySeconds: Number(delay) };
  }

  // ── 3. 部署新 facets ────────────────────────────────────────────────
  for (const name of Object.keys(OLD_FACETS)) {
    const F = await ethers.getContractFactory(name);
    const facet = await F.deploy();
    await facet.waitForDeployment();
    const addr = await facet.getAddress();
    console.log("deployed facet", name, addr);
    out.facets[name] = addr;
  }

  // ── 4. proposeDiamondCut（Replace 三个 facet 的全部 selectors）──────
  const loupe = new ethers.Contract(ADDR.Diamond, LOUPE_ABI, signer);
  const cuts = [];
  for (const name of Object.keys(OLD_FACETS)) {
    const selectors = await loupe.facetFunctionSelectors(OLD_FACETS[name]);
    console.log(name, "old facet selectors:", selectors.length);
    cuts.push({
      facetAddress: out.facets[name],
      action: 1, // Replace
      functionSelectors: selectors,
    });
  }
  const cutter = new ethers.Contract(ADDR.Diamond, CUT_ABI, signer);
  const tx = await cutter.proposeDiamondCut(cuts, ethers.ZeroAddress, "0x");
  const receipt = await tx.wait();
  console.log("proposed diamondCut tx:", receipt.hash, "(48h 后可执行)");
  out.proposals.DiamondCut = { tx: receipt.hash, cuts: cuts.map(c => ({ facetAddress: c.facetAddress, action: c.action, functionSelectors: c.functionSelectors })) };

  const outPath = path.join(__dirname, "..", "deployments", "r3-upgrade-proposals.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("written:", outPath);
  console.log("DONE —— 48h 后执行 upgrade-r3-execute.js");
}

main().catch((e) => { console.error(e); process.exit(1); });
