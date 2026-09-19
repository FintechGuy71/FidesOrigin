// R3 升级：execute 阶段（48h 时间锁到期后执行）
// 执行 UUPS upgradeToAndCall × 3 + diamondCut × 1
// 用法：ADMIN_PRIVATE_KEY=0x... node_modules/.bin/hardhat run scripts/upgrade-r3-execute.js --network sepolia
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
const rec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "r3-upgrade-proposals.json"), "utf8"));

const UUPS_ABI = [
  "function upgradeToAndCall(address newImplementation, bytes data) payable",
  "function implementationToProposal(address) view returns (bytes32)",
  "function upgradeProposals(bytes32) view returns (uint256)",
];
const CUT_ABI = [
  "function diamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)",
];
const LOUPE_ABI = ["function facetFunctionSelectors(address facet) view returns (bytes4[])"];

async function main() {
  const [signer] = await ethers.getSigners();
  if (signer.address.toLowerCase() !== ADMIN.toLowerCase()) throw new Error("signer != ADMIN");

  // ── UUPS 升级 × 3 ──────────────────────────────────────────────────
  // 提案 ID 方案按合约而异（2026-09-19 预检发现）：
  //   RiskRegistry / FidesCompliance → implementationToProposal(newImpl) 映射
  //   PolicyEngine → keccak256(abi.encode(newImpl, chainId)) 计算值
  const CHAIN_ID = 11155111n;
  for (const name of ["RiskRegistry", "PolicyEngine", "FidesCompliance"]) {
    const proxy = new ethers.Contract(ADDR[name], UUPS_ABI, signer);
    const newImpl = rec.implementations[name];
    let pid;
    try {
      pid = await proxy.implementationToProposal(newImpl);
    } catch {
      // PolicyEngine：无映射，按源码规则计算
      pid = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"], [newImpl, CHAIN_ID]
      ));
    }
    if (pid === ethers.ZeroHash) { console.log(name, "无提案或已执行，跳过"); continue; }
    const after = await proxy.upgradeProposals(pid);
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < after) {
      console.log(name, "时间锁未到期，还需", Number(after - now), "秒");
      continue;
    }
    const tx = await proxy.upgradeToAndCall(newImpl, "0x");
    const receipt = await tx.wait();
    console.log("upgraded", name, "->", newImpl, "tx:", receipt.hash);
  }

  // ── Diamond cut ────────────────────────────────────────────────────
  const loupe = new ethers.Contract(ADDR.Diamond, LOUPE_ABI, signer);
  const cuts = [];
  for (const name of Object.keys(rec.facets)) {
    const raw = await loupe.facetFunctionSelectors(rec.oldFacets[name]);
    cuts.push([rec.facets[name], 1, [...raw].map(String)]);
  }
  const cutter = new ethers.Contract(ADDR.Diamond, CUT_ABI, signer);
  const tx = await cutter.diamondCut(cuts, ethers.ZeroAddress, "0x");
  const receipt = await tx.wait();
  console.log("diamondCut executed tx:", receipt.hash);
  console.log("DONE —— 全部升级已生效");
}

main().catch((e) => { console.error(e); process.exit(1); });
