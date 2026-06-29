#!/usr/bin/env node

/**
 * 检查系统状态和数据库统计
 * 用法: node scripts/checkStatus.js
 */

const { DatabaseService } = require('../src/services/databaseService');
const { RiskDataSyncService } = require('../src/syncService');

async function main() {
  console.log('FidesOrigin - 系统状态检查\n');
  console.log('========================================\n');
  
  const db = new DatabaseService();
  
  try {
    // 1. 数据源状态
    console.log('【数据源状态】');
    const service = new RiskDataSyncService();
    const dsStatus = await service.getDataSourceStatus();
    for (const [name, status] of Object.entries(dsStatus)) {
      console.log(`  ${name}: ${status.available ? '✅ 可用' : '❌ 不可用'} ${status.hasApiKey ? '(有API Key)' : ''}`);
    }
    
    // 2. 数据库统计
    console.log('\n【数据库统计】');
    const stats = await db.getStats();
    console.log(`  总地址数: ${stats.total}`);
    console.log(`  ├─ 黑名单: ${stats.blacklist}`);
    console.log(`  ├─ 灰名单: ${stats.graylist}`);
    console.log(`  ├─ 白名单: ${stats.whitelist}`);
    console.log(`  └─ 待同步: ${stats.unsynced}`);
    
    // 3. 最近同步记录
    console.log('\n【最近同步记录】');
    const logs = await db.getRecentLogs(5);
    if (logs.length === 0) {
      console.log('  暂无同步记录');
    } else {
      for (const log of logs) {
        const time = log.timestamp.toISOString().slice(0, 19).replace('T', ' ');
        const status = log.status === 'SUCCESS' ? '✅' : (log.status === 'PARTIAL' ? '⚠️' : '❌');
        console.log(`  ${status} [${time}] ${log.source}: 新增${log.newCount} 更新${log.updatedCount}`);
      }
    }
    
    console.log('\n========================================');
    console.log('检查完成');
    
  } catch (error) {
    console.error('检查失败:', error.message);
  } finally {
    await db.disconnect();
  }
}

main();
