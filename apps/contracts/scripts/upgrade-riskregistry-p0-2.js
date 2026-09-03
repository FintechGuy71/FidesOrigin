// [P0-2] RiskRegistry UUPS 升级——批量路径补发 RiskProfileUpdated
// 步骤 1/2：部署新 implementation + proposeUpgrade（48h 时间锁开始计时）
//   npx hardhat run scripts/upgrade-riskregistry-p0-2.js --network sepolia
// 步骤 2/2（48h 后，时间锁到期）执行升级：
//   UPGRADE_EXECUTE_IMPL=0x8C8717A933e31cF216E3a726ee9940c46742ea5D npx hardhat run scripts/upgrade-riskregistry-p0-2.js --network sepolia
const hre = require('hardhat');

const PROXY = '0x953f985f38f94d6159c0600d1f15D543895cE896';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const execImpl = process.env.UPGRADE_EXECUTE_IMPL;
  if (execImpl) {
    // 步骤 2/2：时间锁到期后执行升级（_authorizeUpgrade 校验提案存在且到期）
    const proxy = await hre.ethers.getContractAt('RiskRegistry', PROXY);
    console.log('Executing upgrade to', execImpl, '...');
    const tx = await proxy.upgradeToAndCall(execImpl, '0x');
    const receipt = await tx.wait();
    console.log('✅ Upgraded. TX:', receipt.hash, 'block', receipt.blockNumber);
    // 升级后立即验证：EIP-1967 实现槽应指向新实现
    const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const implNow = await hre.ethers.provider.getStorage(PROXY, implSlot);
    console.log('impl slot now:', '0x' + implNow.slice(26));
    return;
  }

  // 步骤 1/2：部署新实现 + 提案
  console.log('Deploying new RiskRegistry implementation...');
  const Factory = await hre.ethers.getContractFactory('RiskRegistry');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('✅ New implementation:', implAddr);

  const proxy = await hre.ethers.getContractAt('RiskRegistry', PROXY);
  console.log('Proposing upgrade (48h timelock)...');
  const tx = await proxy.proposeUpgrade(implAddr);
  const receipt = await tx.wait();
  console.log('✅ proposeUpgrade TX:', receipt.hash, 'block', receipt.blockNumber);
  console.log('⏰ 48h 后执行: UPGRADE_EXECUTE_IMPL=' + implAddr + ' npx hardhat run scripts/upgrade-riskregistry-p0-2.js --network sepolia');
}

main().then(() => process.exit(0)).catch((e) => { console.error('💥', e.message); process.exit(1); });
