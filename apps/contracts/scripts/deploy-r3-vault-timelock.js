// R3 补部署：QuarantineVault（含 D-M1 批量释放修复）+ FidesOriginTimelock（含 D-M2 executor 授权修复）
// 两个都是不可升级合约，链上存量为零（已勘察：0 记录/0 ETH/0 TUSD），直接重部署。
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ADMIN = "0x5F6Ae278e7a62E64F9F467a91B693f372b84a374";

async function main() {
  const [signer] = await ethers.getSigners();
  if (signer.address.toLowerCase() !== ADMIN.toLowerCase()) throw new Error("signer != ADMIN");
  console.log("signer:", signer.address, "balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH");

  // 1. QuarantineVault（无构造参数，全角色归部署者）
  const QV = await ethers.getContractFactory("QuarantineVault");
  const qv = await QV.deploy();
  await qv.waitForDeployment();
  const qvAddr = await qv.getAddress();
  console.log("QuarantineVault deployed:", qvAddr);

  // 2. FidesOriginTimelock(proposers=[admin], executors=[admin], admin=admin)
  //    修复版构造函数会给 executor 授 CANCELLER_ROLE（紧急取消路径不再恒 revert）
  const TL = await ethers.getContractFactory("FidesOriginTimelock");
  const tl = await TL.deploy([ADMIN], [ADMIN], ADMIN);
  await tl.waitForDeployment();
  const tlAddr = await tl.getAddress();
  console.log("FidesOriginTimelock deployed:", tlAddr);

  // 链上自检
  const CANCELLER = ethers.keccak256(ethers.toUtf8Bytes("CANCELLER_ROLE"));
  const ok = await tl.hasRole(CANCELLER, ADMIN);
  console.log("new timelock hasRole(CANCELLER, admin):", ok);
  if (!ok) throw new Error("CANCELLER_ROLE 未授予——D-M2 修复未生效，中止");

  const out = {
    timestamp: new Date().toISOString(),
    QuarantineVault: qvAddr,
    FidesOriginTimelock: tlAddr,
    notes: "R3 补部署：D-M1 批量释放单条失败不再整批回滚；D-M2 executor 持 CANCELLER_ROLE",
  };
  const outPath = path.join(__dirname, "..", "deployments", "r3-redeploy.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("written:", outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
