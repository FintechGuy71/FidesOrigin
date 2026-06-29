#!/usr/bin/env node

/**
 * 综合数据导入脚本
 * 同时导入多个数据源
 */

const { PrismaClient } = require('@prisma/client');
const { OpenSourceAdapter } = require('../src/adapters/openSourceEnhancedAdapter');
const { EtherscanAdapter } = require('../src/adapters/etherscanAdapter');
const { OFACSimpleAdapter } = require('../src/adapters/ofacSimpleAdapter');
const { ChainalysisAdapter } = require('../src/adapters/chainalysisAdapter');
require('dotenv').config();

const prisma = new PrismaClient();

class ComprehensiveDataImporter {
  constructor() {
    this.adapters = {
      opensource: new OpenSourceAdapter(),
      etherscan: new EtherscanAdapter(),
      ofac: new OFACSimpleAdapter(),
      chainalysis: new ChainalysisAdapter(),
    };
    
    this.stats = {
      totalImported: 0,
      newCount: 0,
      updatedCount: 0,
      bySource: {},
      byCategory: {
        BLACKLIST: 0,
        GRAYLIST: 0,
        WHITELIST: 0,
      },
    };
  }

  async importAll() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   FidesOrigin - 综合风险数据导入        ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    const startTime = Date.now();
    
    // 1. 导入开源数据源
    await this.importOpenSource();
    
    // 2. 导入Etherscan数据（如果配置了API Key）
    await this.importEtherscan();
    
    // 3. 导入OFAC数据
    await this.importOFAC();
    
    // 4. 导入Chainalysis数据（备用地址）
    await this.importChainalysis();
    
    // 打印统计
    await this.printStats(startTime);
    
    await prisma.$disconnect();
  }

  async importOpenSource() {
    console.log('\n📦 数据源 1/4: 开源风险地址库');
    console.log('─────────────────────────────────');
    
    try {
      const addresses = await this.adapters.opensource.fetchAllRiskAddresses();
      const result = await this.saveToDatabase(addresses, 'OpenSource');
      
      this.stats.bySource['OpenSource'] = result;
      console.log(`   ✅ 完成: 新增 ${result.newCount}, 更新 ${result.updatedCount}`);
      
    } catch (error) {
      console.error(`   ❌ 失败:`, error.message);
    }
  }

  async importEtherscan() {
    console.log('\n📦 数据源 2/4: Etherscan标签');
    console.log('─────────────────────────────────');
    
    if (!this.adapters.etherscan.isAvailable()) {
      console.log('   ⏭️  跳过: API Key未配置');
      console.log('   💡 提示: 在.env中设置 ETHERSCAN_API_KEY');
      return;
    }
    
    try {
      const addresses = await this.adapters.etherscan.fetchKnownRiskAddresses();
      const result = await this.saveToDatabase(addresses, 'Etherscan');
      
      this.stats.bySource['Etherscan'] = result;
      console.log(`   ✅ 完成: 新增 ${result.newCount}, 更新 ${result.updatedCount}`);
      
    } catch (error) {
      console.error(`   ❌ 失败:`, error.message);
    }
  }

  async importOFAC() {
    console.log('\n📦 数据源 3/4: OFAC SDN官方名单');
    console.log('─────────────────────────────────');
    
    try {
      // 使用简单适配器获取已知地址
      const addresses = this.adapters.opensource.getOFACAddresses();
      const result = await this.saveToDatabase(addresses, 'OFAC');
      
      this.stats.bySource['OFAC'] = result;
      console.log(`   ✅ 完成: 新增 ${result.newCount}, 更新 ${result.updatedCount}`);
      
    } catch (error) {
      console.error(`   ❌ 失败:`, error.message);
    }
  }

  async importChainalysis() {
    console.log('\n📦 数据源 4/4: Chainalysis（备用）');
    console.log('─────────────────────────────────');
    
    try {
      const addresses = await this.adapters.chainalysis.fetchSanctions();
      const result = await this.saveToDatabase(addresses, 'Chainalysis');
      
      this.stats.bySource['Chainalysis'] = result;
      console.log(`   ✅ 完成: 新增 ${result.newCount}, 更新 ${result.updatedCount}`);
      
    } catch (error) {
      console.error(`   ❌ 失败:`, error.message);
    }
  }

  async saveToDatabase(addresses, source) {
    let newCount = 0;
    let updatedCount = 0;
    
    for (const addr of addresses) {
      try {
        const existing = await prisma.riskAddress.findUnique({
          where: { address: addr.address },
        });
        
        if (existing) {
          // 更新
          await prisma.riskAddress.update({
            where: { address: addr.address },
            data: {
              category: addr.category,
              riskScore: addr.riskScore,
              label: addr.label,
              sources: this.mergeSources(existing.sources, addr.sources),
              tags: this.mergeSources(existing.tags, addr.tags),
              metadata: this.mergeMetadata(existing.metadata, addr.metadata),
              updatedAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          // 创建
          await prisma.riskAddress.create({
            data: addr,
          });
          newCount++;
        }
        
        // 统计分类
        this.stats.byCategory[addr.category] = (this.stats.byCategory[addr.category] || 0) + 1;
        
      } catch (error) {
        console.error(`   保存失败 ${addr.address}:`, error.message);
      }
    }
    
    this.stats.totalImported += addresses.length;
    this.stats.newCount += newCount;
    this.stats.updatedCount += updatedCount;
    
    return { newCount, updatedCount, total: addresses.length };
  }

  mergeSources(existing, new_) {
    const existingArr = JSON.parse(existing || '[]');
    const newArr = JSON.parse(new_ || '[]');
    return JSON.stringify([...new Set([...existingArr, ...newArr])]);
  }

  mergeMetadata(existing, new_) {
    const existingObj = existing ? JSON.parse(existing) : {};
    const newObj = new_ ? JSON.parse(new_) : {};
    return JSON.stringify({ ...existingObj, ...newObj, updatedAt: new Date().toISOString() });
  }

  async printStats(startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 获取数据库最新统计
    const totalInDb = await prisma.riskAddress.count();
    const blacklistCount = await prisma.riskAddress.count({ where: { category: 'BLACKLIST' } });
    const graylistCount = await prisma.riskAddress.count({ where: { category: 'GRAYLIST' } });
    const whitelistCount = await prisma.riskAddress.count({ where: { category: 'WHITELIST' } });
    const pendingSync = await prisma.riskAddress.count({ where: { syncedToChain: false } });
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║            导入完成统计                 ║');
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log(`⏱️  耗时: ${duration} 秒\n`);
    
    console.log('📊 数据源详情:');
    for (const [source, stats] of Object.entries(this.stats.bySource)) {
      console.log(`   ${source}: 新增 ${stats.newCount}, 更新 ${stats.updatedCount}`);
    }
    
    console.log('\n📈 数据库统计:');
    console.log(`   总地址数: ${totalInDb}`);
    console.log(`   ├─ 黑名单: ${blacklistCount}`);
    console.log(`   ├─ 灰名单: ${graylistCount}`);
    console.log(`   ├─ 白名单: ${whitelistCount}`);
    console.log(`   └─ 待同步: ${pendingSync}`);
    
    // 记录同步日志
    await prisma.syncLog.create({
      data: {
        source: 'Comprehensive_Import',
        addressesCount: this.stats.totalImported,
        newCount: this.stats.newCount,
        updatedCount: this.stats.updatedCount,
        status: 'SUCCESS',
        details: JSON.stringify({
          duration: `${duration}s`,
          bySource: this.stats.bySource,
          byCategory: this.stats.byCategory,
        }),
      },
    });
    
    console.log('\n✅ 所有数据已导入完成！');
    console.log('\n下一步:');
    console.log('   1. 运行链上同步: node scripts/syncToChain.js');
    console.log('   2. 查看系统状态: node scripts/checkStatus.js\n');
  }
}

// 运行导入
const importer = new ComprehensiveDataImporter();
importer.importAll().catch(console.error);
