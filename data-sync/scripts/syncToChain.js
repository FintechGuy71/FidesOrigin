#!/usr/bin/env node

/**
 * 链上同步脚本
 * 用法: node scripts/syncToChain.js [--check]
 */

const { BlockchainSyncService } = require('../src/services/blockchainService');

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  
  const service = new BlockchainSyncService();
  
  if (checkOnly) {
    // 只检查状态
    await service.checkChainStatus();
  } else {
    // 执行同步
    console.log('FidesOrigin - 链上数据同步\n');
    const result = await service.syncToChain(20);
    
    if (result.success) {
      console.log('\n✅ 同步完成！');
      if (result.synced > 0) {
        console.log(`📊 同步了 ${result.synced} 个地址到链上`);
      }
    } else {
      console.error('\n❌ 同步失败:', result.error);
      
      if (result.error === 'WALLET_NOT_CONFIGURED') {
        console.log('\n💡 提示: 请在 .env 文件中配置 SYNC_PRIVATE_KEY');
        console.log('   格式: SYNC_PRIVATE_KEY=0x...');
      }
      
      if (result.error === 'CONTRACT_NOT_CONFIGURED') {
        console.log('\n💡 提示: 请在 .env 文件中配置 RISK_REGISTRY_CONTRACT');
        console.log('   格式: RISK_REGISTRY_CONTRACT=0x...');
      }
      
      process.exit(1);
    }
  }
}

main();
