#!/usr/bin/env node

/**
 * 一次性历史数据导入脚本
 * 用法: node scripts/importHistoricalData.js [--source=ofac|chainalysis|opensource]
 */

const { RiskDataSyncService } = require('../src/syncService');

async function main() {
  console.log('FidesOrigin - 历史风险数据导入工具\n');
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const sourceArg = args.find(arg => arg.startsWith('--source='));
  const source = sourceArg ? sourceArg.split('=')[1] : null;
  
  const service = new RiskDataSyncService();
  
  try {
    if (source) {
      // 只同步指定数据源
      console.log(`只同步数据源: ${source}\n`);
      const result = await service.syncSingleSource(source);
      
      if (result.success) {
        console.log(`\n✅ ${source} 同步完成`);
      } else {
        console.error(`\n❌ ${source} 同步失败`);
        process.exit(1);
      }
    } else {
      // 全量导入
      const result = await service.runHistoricalImport();
      
      if (!result.success) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

main();
