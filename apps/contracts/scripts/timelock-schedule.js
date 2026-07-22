const { ethers } = require("hardhat");

const PROXIES = {
  RiskRegistry: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
  PolicyEngine: "0x87089F67A61F9643796AE154663A6a9F21196b38",
};

const NEW_IMPLS = {
  RiskRegistry: "0xc818cE20302Aa8F5261E8F073e48AFFbAc19822D",
  PolicyEngine: "0x3DDBAcB16a8515a7a95c940445cD78234331d05D",
};

async function main() {
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);
  
  // 1. Timelock schedule for RiskRegistry upgrade
  console.log('\n━━━ Timelock Schedule: RiskRegistry Upgrade ━━━');
  try {
    const timelockAddr = await getTimelockAddress('RiskRegistry');
    const timelock = await ethers.getContractAt('FidesOriginTimelock', timelockAddr, signer);
    
    const target = PROXIES.RiskRegistry;
    const value = 0;
    const data = new ethers.Interface(['function upgradeTo(address)']).encodeFunctionData('upgradeTo', [NEW_IMPLS.RiskRegistry]);
    const predecessor = ethers.ZeroHash;
    const salt = ethers.id('RiskRegistry_v3.0.4_upgrade');
    const delay = 48 * 3600; // 48 hours
    
    const tx = await timelock.schedule(target, value, data, predecessor, salt, delay);
    console.log('Schedule tx:', tx.hash);
    await tx.wait();
    console.log('✅ RiskRegistry upgrade scheduled! Execute after:', new Date(Date.now() + delay * 1000).toISOString());
  } catch (e) {
    console.error('❌ RiskRegistry schedule failed:', e.message);
  }
  
  // 2. Timelock schedule for PolicyEngine upgrade
  console.log('\n━━━ Timelock Schedule: PolicyEngine Upgrade ━━━');
  try {
    const timelockAddr = await getTimelockAddress('PolicyEngine');
    const timelock = await ethers.getContractAt('FidesOriginTimelock', timelockAddr, signer);
    
    const target = PROXIES.PolicyEngine;
    const value = 0;
    const data = new ethers.Interface(['function upgradeTo(address)']).encodeFunctionData('upgradeTo', [NEW_IMPLS.PolicyEngine]);
    const predecessor = ethers.ZeroHash;
    const salt = ethers.id('PolicyEngine_v3.0.4_upgrade');
    const delay = 48 * 3600;
    
    const tx = await timelock.schedule(target, value, data, predecessor, salt, delay);
    console.log('Schedule tx:', tx.hash);
    await tx.wait();
    console.log('✅ PolicyEngine upgrade scheduled! Execute after:', new Date(Date.now() + delay * 1000).toISOString());
  } catch (e) {
    console.error('❌ PolicyEngine schedule failed:', e.message);
  }
  
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Timelock Schedule Complete!');
  console.log('  Set a reminder for 48 hours to execute.');
  console.log('══════════════════════════════════════════════════');
}

async function getTimelockAddress(contractName) {
  // Try to get timelock from contract storage or known addresses
  // For now, use deployer address as fallback (in test env)
  return '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
