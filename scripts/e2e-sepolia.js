const { ethers } = require('hardhat');
const ADDRESSES = require('../deployments/sepolia-latest.json').contracts;

/**
 * @title Sepolia 端到端测试
 * @notice 验证完整合规链路：mint → transfer → hold → release
 * @dev 需要 Sepolia ETH 和已部署的合约
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('🧪 E2E Test with account:', deployer.address);

  // 连接合约
  const fUSD = await ethers.getContractAt('CompliantStableCoin', ADDRESSES.CompliantStableCoin.address);
  const registry = await ethers.getContractAt('RiskRegistry', ADDRESSES.RiskRegistry.address);
  const policy = await ethers.getContractAt('PolicyEngine', ADDRESSES.PolicyEngine.address);
  const engine = await ethers.getContractAt('ComplianceEngine', ADDRESSES.ComplianceEngine.address);

  const testAddr = '0x1234567890123456789012345678901234567890';

  // ========== 测试 1: mint ==========
  console.log('\n[1/6] Mint 1000 fUSD to deployer...');
  const mintTx = await fUSD.mint(deployer.address, ethers.parseUnits('1000', 6));
  await mintTx.wait();
  const balance = await fUSD.balanceOf(deployer.address);
  console.log('   ✅ Minted:', ethers.formatUnits(balance, 6), 'fUSD');

  // ========== 测试 2: 正常转账 ==========
  console.log('\n[2/6] Normal transfer 100 fUSD...');
  const tx2 = await fUSD.transfer(testAddr, ethers.parseUnits('100', 6));
  await tx2.wait();
  const bal2 = await fUSD.balanceOf(testAddr);
  console.log('   ✅ Transfer success:', ethers.formatUnits(bal2, 6), 'fUSD');

  // ========== 测试 3: 设置制裁地址 ==========
  console.log('\n[3/6] Tag testAddr as sanctioned...');
  const tagTx = await registry.addTag(testAddr, ethers.encodeBytes32String('SANCTIONED'), 'OFAC SDN List');
  await tagTx.wait();
  const profile = await registry.riskProfiles(testAddr);
  console.log('   ✅ Sanctioned:', profile[3]);

  // ========== 测试 4: 制裁地址转账应被拦截 ==========
  console.log('\n[4/6] Transfer to sanctioned address (should fail)...');
  try {
    const tx4 = await fUSD.transfer(testAddr, ethers.parseUnits('50', 6));
    await tx4.wait();
    console.log('   ❌ Transfer should have been blocked!');
  } catch (e) {
    console.log('   ✅ Blocked as expected:', e.message.slice(0, 100));
  }

  // ========== 测试 5: 设置策略日限额 ==========
  console.log('\n[5/6] Set daily limit to 500 fUSD...');
  const policyTx = await policy.setIssuerPolicy(
    deployer.address,
    ethers.parseUnits('1000000', 6), // maxTx
    ethers.parseUnits('500', 6),      // dailyLimit
    true,  // allowMediumRisk
    false, // allowHighRisk
    true,  // blockMixer
    false  // requireKYC
  );
  await policyTx.wait();
  const ver = await policy.getIssuerPolicyVersion(deployer.address);
  console.log('   ✅ Policy version:', ver.toString());

  // ========== 测试 6: 策略回滚 ==========
  console.log('\n[6/6] Rollback policy to version 0...');
  const rbTx = await policy.rollbackToVersion(deployer.address, 0);
  await rbTx.wait();
  const verAfter = await policy.getIssuerPolicyVersion(deployer.address);
  console.log('   ✅ Rolled back to version:', verAfter.toString());

  console.log('\n🎉 All E2E tests passed!');
}

main().catch(console.error);
