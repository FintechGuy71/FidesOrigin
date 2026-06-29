/**
 * 风险数据同步服务
 * 协调各个数据源适配器，进行数据聚合和存储
 */

const crypto = require('crypto');
const { OFACSimpleAdapter } = require('./adapters/ofacSimpleAdapter');
const { ChainalysisAdapter } = require('./adapters/chainalysisAdapter');
const { OpenSourceEnhancedAdapter } = require('./adapters/openSourceEnhancedAdapter');
const { EtherscanAdapter } = require('./adapters/etherscanAdapter');
const { DatabaseService } = require('./services/databaseService');
require('dotenv').config();

class RiskDataSyncService {
  constructor() {
    this.db = new DatabaseService();
    
    // 初始化适配器
    this.adapters = {
      ofac: new OFACSimpleAdapter(),
      chainalysis: new ChainalysisAdapter(process.env.CHAINALYSIS_API_KEY),
      opensource: new OpenSourceEnhancedAdapter(),
      etherscan: new EtherscanAdapter(),
    };
  }

  /**
   * 运行一次性导入（历史数据）
   */
  async runHistoricalImport() {
    console.log('\n========================================');
    console.log('FidesOrigin 历史数据一次性导入');
    console.log('开始时间:', new Date().toISOString());
    console.log('========================================\n');

    const results = {};

    try {
      // 1. OFAC SDN 数据
      console.log('【数据源 1/3】OFAC SDN 官方制裁名单');
      const ofacAddresses = await this.adapters.ofac.fetchSanctions();
      if (ofacAddresses.length > 0) {
        results.ofac = await this.db.saveAddresses(ofacAddresses, 'OFAC_SDN');
      }

      // 2. Chainalysis 数据
      console.log('\n【数据源 2/3】Chainalysis Sanctions');
      const chainalysisAddresses = await this.adapters.chainalysis.fetchSanctions();
      if (chainalysisAddresses.length > 0) {
        results.chainalysis = await this.db.saveAddresses(chainalysisAddresses, 'Chainalysis');
      }

      // 3. 开源社区数据
      console.log('\n【数据源 3/3】开源社区');
      const openSourceAddresses = await this.adapters.opensource.fetchAllRiskAddresses();
      if (openSourceAddresses.length > 0) {
        results.opensource = await this.db.saveAddresses(openSourceAddresses, 'OpenSource');
      }

      // 打印统计
      console.log('\n========================================');
      console.log('导入完成！');
      console.log('========================================');
      
      const stats = await this.db.getStats();
      console.log('\n数据库统计:');
      console.log(`  总地址数: ${stats.total}`);
      console.log(`  黑名单: ${stats.blacklist}`);
      console.log(`  灰名单: ${stats.graylist}`);
      console.log(`  白名单: ${stats.whitelist}`);
      console.log(`  待同步: ${stats.unsynced}`);

      console.log('\n各数据源导入详情:');
      for (const [source, result] of Object.entries(results)) {
        if (result) {
          console.log(`  ${source}: 新增 ${result.newCount}, 更新 ${result.updatedCount}`);
        }
      }

      return { success: true, stats, results };

    } catch (error) {
      // [High Fix] Don't leak internal error details to callers
      const errorId = crypto.randomUUID();
      console.error(`[errorId=${errorId}] 导入失败:`, error);
      return {
        success: false,
        errorId,
        message: '历史数据导入失败，请联系管理员并提供 errorId',
      };
    } finally {
      await this.db.disconnect();
    }
  }

  /**
   * 运行单个数据源同步
   */
  async syncSingleSource(sourceName) {
    const adapter = this.adapters[sourceName];
    if (!adapter) {
      throw new Error(`未知数据源: ${sourceName}`);
    }

    console.log(`\n【同步】${sourceName}`);
    const addresses = await adapter.fetchSanctions();
    
    if (addresses.length === 0) {
      console.log(`  无新数据`);
      return { success: true, count: 0 };
    }

    const result = await this.db.saveAddresses(addresses, sourceName);
    console.log(`  完成: 新增 ${result.newCount}, 更新 ${result.updatedCount}`);
    
    return { success: true, ...result };
  }

  /**
   * 获取数据源状态
   */
  async getDataSourceStatus() {
    const status = {};
    
    for (const [name, adapter] of Object.entries(this.adapters)) {
      status[name] = {
        available: true,
        hasApiKey: !!process.env.CHAINALYSIS_API_KEY || name !== 'chainalysis',
      };
    }
    
    return status;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const service = new RiskDataSyncService();
  
  // 默认运行历史数据导入
  service.runHistoricalImport().then(result => {
    if (result.success) {
      console.log('\n✅ 历史数据导入成功完成！');
      process.exit(0);
    } else {
      console.error('\n❌ 导入失败:', result.error);
      process.exit(1);
    }
  });
}

module.exports = { RiskDataSyncService };
