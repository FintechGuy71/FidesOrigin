// [2026-09-20 #3] R3 升级端到端验证：发一笔真实 checkAddressCompliance 交易，
// 触发 Diamond（ComplianceCoreFacet）的 ComplianceCheckPerformed 事件，
// 证明升级后事件发射路径工作，并供 subgraph 索引验证。
const { ethers } = require("hardhat");

const ADMIN = "0x5F6Ae278e7a62E64F9F467a91B693f372b84a374";
const DIAMOND = "0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E";
// ComplianceCoreFacet ABI（仅需 checkAddressCompliance）
const ABI = [
  "function checkAddressCompliance(address addr) returns (bool isCompliant, uint256 riskScore, string reason)",
  "event ComplianceCheckPerformed(address indexed addr, uint256 indexed riskScore, bool indexed isCompliant, uint256 timestamp, uint256 blockNumber, bytes32 checkType)",
];
// 一个已知会被评估的地址（用 RiskRegistry 里有档案的或任意地址）
const TEST_ADDR = "0x1111111111111111111111111111111111111111";

async function main() {
  const [signer] = await ethers.getSigners();
  if (signer.address.toLowerCase() !== ADMIN.toLowerCase()) {
    throw new Error("signer != ADMIN");
  }
  const diamond = new ethers.Contract(DIAMOND, ABI, signer);

  console.log("发送 checkAddressCompliance(%s) ...", TEST_ADDR);
  const tx = await diamond.checkAddressCompliance(TEST_ADDR);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("status:", receipt.status, "block:", receipt.blockNumber, "gasUsed:", receipt.gasUsed.toString());

  // 解析事件
  const events = receipt.logs
    .map((log) => { try { return diamond.interface.parseLog(log); } catch { return null; } })
    .filter((e) => e && e.name === "ComplianceCheckPerformed");
  if (events.length === 0) {
    console.log("WARN: 未捕获到 ComplianceCheckPerformed 事件（检查 facet 是否切换成功）");
  } else {
    const e = events[0];
    console.log("EVENT ComplianceCheckPerformed:", JSON.stringify({
      addr: e.args.addr,
      riskScore: e.args.riskScore.toString(),
      isCompliant: e.args.isCompliant,
      timestamp: e.args.timestamp.toString(),
      blockNumber: e.args.blockNumber.toString(),
    }));
  }
  console.log("\n验证要点：");
  console.log("1. tx status=1 → 升级后 checkAddressCompliance 可正常调用（D-H2/facet 切换生效）");
  console.log("2. ComplianceCheckPerformed 事件已发射 → subgraph handleComplianceCheckPerformed 可索引");
  console.log("3. 稍后查 subgraph complianceChecks 实体应出现本 tx 记录");
}

main().catch((e) => { console.error(e); process.exit(1); });
