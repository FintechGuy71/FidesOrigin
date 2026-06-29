/**
 * FidesOrigin - 风险数据同步主控模块
 * 
 * 整合制裁名单同步 + Chainlink Functions 自动化
 * 
 * @module risk-sync-master
 */

const { SanctionsDataManager } = require('./sanctions-sync');
const { ChainlinkFunctionsAutomation } = require('./chainlink-automation');

class RiskSyncMaster {
  constructor(config) {
    this.config = config;
    this.sanctionsManager = new SanctionsDataManager();
    this.chainlinkAutomation = new ChainlinkFunctionsAutomation(config);
  }
  
  async init() {
    await this.sanctionsManager.init();
    console.log('✅ RiskSyncMaster initialized');
  }
  
  /**
   * 执行完整同步流程
   */
  async executeFullSync() {
    console.log('\n' + '='.repeat(60));
    console.log('FidesOrigin Risk Data Full Sync');
    console.log('Start Time:', new Date().toISOString());
    console.log('='.repeat(60) + '\n');
    
    const report = {
      startTime: new Date().toISOString(),
      steps: []
    };
    
    try {
      // Step 1: 获取制裁名单数据
      console.log('🔄 Step 1/4: Fetching sanctions data from all sources...');
      const sanctionsResult = await this.sanctionsManager.fetchAll();
      report.steps.push({
        name: 'sanctions_fetch',
        status: 'success',
        details: {
          sources: Object.keys(sanctionsResult.sources),
          totalEntries: sanctionsResult.merged.total,
          withCrypto: sanctionsResult.merged.withCrypto
        }
      });
      
      // Step 2: 获取以太坊制裁地址
      console.log('\n🔄 Step 2/4: Extracting Ethereum addresses...');
      const ethAddresses = await this.sanctionsManager.getEthereumSanctionsList();
      console.log(`   Found ${ethAddresses.length} Ethereum sanctioned addresses`);
      report.steps.push({
        name: 'extract_ethereum',
        status: 'success',
        details: { count: ethAddresses.length }
      });
      
      // Step 3: 同步到链上
      console.log('\n🔄 Step 3/4: Syncing to blockchain...');
      const syncResults = await this.chainlinkAutomation.syncSanctionsToChain(ethAddresses);
      report.steps.push({
        name: 'blockchain_sync',
        status: 'success',
        details: {
          success: syncResults.success.length,
          failed: syncResults.failed.length
        }
      });
      
      // Step 4: 触发 Chainlink Functions
      console.log('\n🔄 Step 4/4: Triggering Chainlink Functions verification...');
      const clRequest = await this.chainlinkAutomation.requestSanctionsUpdate();
      report.steps.push({
        name: 'chainlink_request',
        status: 'success',
        details: {
          requestId: clRequest.requestId,
          txHash: clRequest.txHash
        }
      });
      
      report.endTime = new Date().toISOString();
      report.status = 'success';
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ Full Sync Completed Successfully');
      console.log('='.repeat(60));
      
      return report;
      
    } catch (error) {
      report.endTime = new Date().toISOString();
      report.status = 'failed';
      report.error = error.message;
      
      console.error('\n' + '='.repeat(60));
      console.error('❌ Full Sync Failed');
      console.error('Error:', error.message);
      console.error('='.repeat(60));
      
      throw error;
    }
  }
  
  /**
   * 快速检查 - 仅验证数据获取
   */
  async quickCheck() {
    console.log('\n🔍 Quick Check: Sanctions Data Sources\n');
    
    const results = await this.sanctionsManager.fetchAll();
    
    const ethList = await this.sanctionsManager.getEthereumSanctionsList();
    
    return {
      sources: results.sources,
      totalAddresses: results.merged.total,
      ethereumAddresses: ethList.length,
      timestamp: new Date().toISOString()
    };
  }
}

// ============ 导出 ============

module.exports = {
  RiskSyncMaster
};

// CLI 执行
if (require.main === module) {
  (async () => {
    const config = {
      rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      privateKey: process.env.PRIVATE_KEY,
      riskOracleAddress: process.env.RISK_ORACLE_ADDRESS,
      subscriptionId: process.env.CHAINLINK_SUBSCRIPTION_ID
    };
    
    const master = new RiskSyncMaster(config);
    await master.init();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case '--full':
        await master.executeFullSync();
        break;
      case '--check':
        const result = await master.quickCheck();
        console.log('\nQuick Check Result:');
        console.log(JSON.stringify(result, null, 2));
        break;
      default:
        console.log(`
FidesOrigin Risk Sync Master

Usage:
  node risk-sync-master.js [command]

Commands:
  --full      Execute full synchronization
  --check     Quick check (fetch data only)

Environment Variables:
  SEPOLIA_RPC_URL
  PRIVATE_KEY
  RISK_ORACLE_ADDRESS
  CHAINLINK_SUBSCRIPTION_ID
        `);
    }
    
    process.exit(0);
  })();
}
