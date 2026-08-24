// 部署 FidesOriginTimelock 到 Sepolia + H-1 路径前置（操作员 + 提议启用紧急模式）
// 用法: pnpm exec hardhat run scripts/deploy-timelock-sepolia.js --network sepolia
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('deployer:', deployer.address);
  console.log('balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH');

  const FidesOriginTimelock = await hre.ethers.getContractFactory('FidesOriginTimelock');
  // proposers/executors/admin 均为部署者（测试网单签；主网规划为多签）
  const tl = await FidesOriginTimelock.deploy([deployer.address], [deployer.address], deployer.address);
  await tl.waitForDeployment();
  const addr = await tl.getAddress();
  const deployTx = tl.deploymentTransaction();
  console.log('FidesOriginTimelock deployed:', addr);
  console.log('deploy tx:', deployTx.hash);

  // H-1 路径前置：注册紧急操作员 + 提议启用紧急模式（4h 后可执行切换）
  const t1 = await tl.addEmergencyOperator(deployer.address); await t1.wait();
  console.log('addEmergencyOperator:', t1.hash);
  const t2 = await tl.proposeEnableEmergencyMode(); await t2.wait();
  console.log('proposeEnableEmergencyMode:', t2.hash);
  const ts = await tl.emergencyModeChangeTimestamp();
  console.log('emergency mode executable at:', new Date(Number(ts) * 1000).toISOString());

  // 记录到本地部署文件（gitignore）
  const p = path.join(__dirname, '..', 'deployments', 'sepolia-timelock.json');
  fs.writeFileSync(p, JSON.stringify({
    version: 'v3.1.0', contract: 'FidesOriginTimelock', address: addr,
    deployTx: deployTx.hash, deployer: deployer.address,
    proposers: [deployer.address], executors: [deployer.address], admin: deployer.address,
    emergencyModeExecutableAt: Number(ts), timestamp: new Date().toISOString(),
  }, null, 2));
  console.log('record saved:', p);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
