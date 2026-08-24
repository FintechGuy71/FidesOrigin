// H-1 链上实证续跑脚本（阶段2/3）
// 阶段2（紧急模式可执行后）: executeEmergencyModeChange + scheduleEmergency
// 阶段3（紧急操作就绪后，+4h）: execute 执行该紧急操作
// 用法: pnpm exec hardhat run scripts/verify-timelock-h1.js --network sepolia -- --phase 2
require('dotenv').config();
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

const PHASE = (process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : '2');
const UPDATE_DELAY_SIG = 'updateDelay(uint256)';
const STATE = path.join(__dirname, '..', 'deployments', 'timelock-h1-state.json');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const rec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployments', 'sepolia-timelock.json')));
  const tl = await hre.ethers.getContractAt('FidesOriginTimelock', rec.address, deployer);
  console.log('timelock:', rec.address, '| phase:', PHASE, '| deployer:', deployer.address);

  // 目标操作：timelock 自调用 updateDelay(2 days)——无实际变更的安全操作
  const data = tl.interface.encodeFunctionData(UPDATE_DELAY_SIG, [2 * 24 * 3600]);
  const predecessor = hre.ethers.ZeroHash;
  const salt = hre.ethers.id('fidesorigin-h1-verification-2026-08-25');
  const opId = await tl.hashOperation(rec.address, 0n, data, predecessor, salt);
  console.log('operation id:', opId);

  if (PHASE === '2') {
    const em = await tl.emergencyMode();
    if (!em) {
      const ts = await tl.emergencyModeChangeTimestamp();
      const now = Math.floor(Date.now() / 1000);
      if (Number(ts) > now) throw new Error(`紧急模式切换未到期，可执行时间 ${new Date(Number(ts) * 1000).toISOString()}`);
      const t = await tl.executeEmergencyModeChange(); await t.wait();
      console.log('executeEmergencyModeChange:', t.hash);
    }
    console.log('emergencyMode =', await tl.emergencyMode());

    const t2 = await tl.scheduleEmergency(rec.address, 0n, data, predecessor, salt);
    await t2.wait();
    console.log('scheduleEmergency (H-1 原必败路径):', t2.hash);
    const readyAt = await tl.getTimestamp(opId);
    console.log('op readyAt:', new Date(Number(readyAt) * 1000).toISOString());
    fs.writeFileSync(STATE, JSON.stringify({ opId, salt, data, scheduledTx: t2.hash, readyAt: Number(readyAt) }, null, 2));
    console.log('state saved. 阶段3 请在 readyAt 之后运行 --phase 3');
  } else if (PHASE === '3') {
    const st = JSON.parse(fs.readFileSync(STATE));
    const ready = await tl.isEmergencyOperationReady(st.opId);
    if (!ready) {
      const ts = await tl.getTimestamp(st.opId);
      throw new Error(`操作未就绪，readyAt=${new Date(Number(ts) * 1000).toISOString()}`);
    }
    const t = await tl.execute(rec.address, 0n, st.data, predecessor, st.salt);
    await t.wait();
    console.log('execute (紧急操作已执行):', t.hash);
    const done = await tl.getTimestamp(st.opId);
    console.log('op timestamp after execute:', done.toString(), '(1=DONE)');
    // 收尾：提议关闭紧急模式（4h 后需 executeEmergencyModeChange 生效，属正常治理流程）
    const t3 = await tl.proposeDisableEmergencyMode(); await t3.wait();
    console.log('proposeDisableEmergencyMode:', t3.hash);
    console.log('H-1 链上实证完成 ✅');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.shortMessage || e.message); process.exit(1); });
