const hre = require('hardhat');
const ADDRESSES = require('../deployments/sepolia-latest.json').contracts;

/**
 * @title Etherscan 合约源码验证脚本
 * @notice 一键验证所有 Sepolia 合约
 * @dev 需要 ETHERSCAN_API_KEY 环境变量
 */

const CONTRACTS = [
  { name: 'RiskRegistry', address: ADDRESSES.RiskRegistry.address },
  { name: 'PolicyEngine', address: ADDRESSES.PolicyEngine.address },
  { name: 'ComplianceEngine', address: ADDRESSES.ComplianceEngine.address },
  { name: 'CompliantStableCoin', address: ADDRESSES.CompliantStableCoin.address },
  { name: 'CompliantSmartWallet', address: ADDRESSES.CompliantSmartWallet.address },
];

async function verifyAll() {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.error('❌ 错误: ETHERSCAN_API_KEY 未设置');
    console.log('   请前往 https://etherscan.io/myapikey 创建 API Key');
    console.log('   然后添加到 .env 文件: ETHERSCAN_API_KEY=your_key');
    process.exit(1);
  }

  console.log('🔍 Starting Etherscan verification for Sepolia contracts...\n');

  for (const { name, address } of CONTRACTS) {
    console.log(`📦 Verifying ${name} at ${address}...`);
    try {
      await hre.run('verify:verify', {
        address,
        network: 'sepolia',
      });
      console.log(`   ✅ ${name} verified successfully\n`);
    } catch (error) {
      if (error.message.includes('Already Verified')) {
        console.log(`   ℹ️  ${name} already verified\n`);
      } else {
        console.error(`   ❌ ${name} verification failed:`, error.message.slice(0, 200));
      }
    }
    // Etherscan API 限流：每秒 5 个请求
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n🏁 Verification complete!');
  console.log('   查看合约页面:');
  CONTRACTS.forEach(({ name, address }) => {
    console.log(`   - ${name}: https://sepolia.etherscan.io/address/${address}`);
  });
}

verifyAll().catch(console.error);
