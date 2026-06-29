const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * @title DailySyncService
 * @notice 每日风险数据同步服务
 * @dev 1. 抓取 OFAC SDN XML
 *    2. 合并本地缓存 + Chainalysis 数据
 *    3. 构建 Merkle Tree
 *    4. 更新链上 RiskRegistry
 * 
 * 运行: node data-sync/scripts/daily-sync.js [--dry-run]
 * 环境变量:
 *   - OFAC_URL: OFAC SDN XML URL (默认 Treasury 官方)
 *   - CHAINALYSIS_API_KEY: Chainalysis API Key
 *   - RPC_URL: 链节点
 *   - PRIVATE_KEY: 部署/更新钱包私钥
 *   - RISK_REGISTRY_ADDRESS: RiskRegistry 合约地址
 */

const CONFIG = {
  ofacUrl: process.env.OFAC_URL || 'https://www.treasury.gov/ofac/downloads/sdn.xml',
  chainalysisApiKey: process.env.CHAINALYSIS_API_KEY,
  rpcUrl: process.env.RPC_URL || 'https://rpc.sepolia.org',
  privateKey: process.env.SYNC_PRIVATE_KEY || process.env.PRIVATE_KEY,
  riskRegistryAddress: process.env.RISK_REGISTRY_ADDRESS || process.env.RISK_REGISTRY_CONTRACT,
  batchSize: parseInt(process.env.BATCH_SIZE) || 50,
  cacheDir: path.join(__dirname, '../cache'),
  logDir: path.join(__dirname, '../logs'),
};

// RiskRegistry ABI (只需要 update 相关函数)
const RISK_REGISTRY_ABI = [
  'function batchUpdateRiskProfiles(address[] calldata accounts, uint8[] calldata riskScores, uint8[] calldata tiers, bool[] calldata isSanctionedList) external',
  'function emergencySanction(address[] calldata accounts, string calldata reason) external',
  'function getRiskProfile(address account) external view returns (tuple(uint8 riskScore, uint8 tier, uint256 lastUpdated, bool isSanctioned))',
  'function isSanctioned(address account) external view returns (bool)',
  'event RiskProfileUpdated(address indexed account, uint8 riskScore, uint8 tier, bool isSanctioned)',
];

class DailySyncService {
  constructor() {
    this.riskDatabase = new Map(); // address -> { riskScore, tier, tags, source }
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    
    // 确保目录存在
    [CONFIG.cacheDir, CONFIG.logDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  async init() {
    console.log('🚀 DailySync initializing...');
    
    this.provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    
    if (CONFIG.privateKey) {
      this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
      console.log(`🔑 Operator: ${this.wallet.address}`);
      
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
    }
    
    if (CONFIG.riskRegistryAddress) {
      const signer = this.wallet || this.provider;
      this.contract = new ethers.Contract(CONFIG.riskRegistryAddress, RISK_REGISTRY_ABI, signer);
      console.log(`📋 RiskRegistry: ${CONFIG.riskRegistryAddress}`);
    }
    
    console.log('✅ Ready\n');
  }

  // ========== 1. 加载 OFAC 加密货币制裁地址 ==========
  /**
   * @dev OFAC 公开 XML/CSV/TXT 文件只包含实体名称，不含链上地址。
   *      加密货币制裁地址来自 OFAC 专项公告，变化频率低，静态维护为主。
   */
  async fetchOFAC() {
    console.log('📥 Loading OFAC crypto sanctions...');
    
    // 1. 加载本地静态列表（主要来源）
    const staticFile = path.join(CONFIG.cacheDir, 'ofac-crypto-sanctions.json');
    let addresses = [];
    
    if (fs.existsSync(staticFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(staticFile, 'utf8'));
        addresses = Array.isArray(data) ? data : data.addresses || [];
        console.log(`   📦 Static cache: ${addresses.length} addresses`);
      } catch (e) {
        console.warn('   ⚠️ Failed to load static OFAC cache');
      }
    }
    
    // 2. 尝试下载 OFAC sdnlist.txt 补充（通常没有加密地址，但试试）
    try {
      const txtUrl = 'https://www.treasury.gov/ofac/downloads/sdnlist.txt';
      const response = await axios.get(txtUrl, { timeout: 15000, responseType: 'text' });
      const text = response.data;
      
      const ethMatches = text.match(/0x[a-fA-F0-9]{40}/g) || [];
      const unique = [...new Set(ethMatches.map(a => a.toLowerCase()))];
      
      if (unique.length > 0) {
        console.log(`   📥 Download supplement: ${unique.length} addresses`);
        for (const addr of unique) {
          if (!addresses.find(a => a.address === addr)) {
            addresses.push({
              address: addr,
              source: 'OFAC_SDN_TXT',
              riskScore: 100,
              tier: 3,
              reason: 'OFAC Sanctioned',
            });
          }
        }
      }
    } catch (e) {
      console.log(`   ⏭️ TXT download skipped: ${e.message}`);
    }
    
    console.log(`   ✅ OFAC total: ${addresses.length} addresses`);
    return addresses;
  }

  extractCryptoAddress(str) {
    if (!str) return null;
    const ethMatch = str.match(/0x[a-fA-F0-9]{40}/);
    if (ethMatch) return ethMatch[0].toLowerCase();
    const tronMatch = str.match(/T[a-zA-Z0-9]{33}/);
    if (tronMatch) return tronMatch[0];
    return null;
  }

  // ========== 2. 加载本地缓存 ==========
  loadLocalCache() {
    const cacheFile = path.join(CONFIG.cacheDir, 'risk-database.json');
    if (!fs.existsSync(cacheFile)) return [];
    
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      console.log(`   📦 Local cache: ${data.length} addresses`);
      return data;
    } catch (e) {
      console.warn('   ⚠️ Failed to load local cache');
      return [];
    }
  }

  // ========== 3. 加载 Chainalysis 缓存 ==========
  loadChainalysisCache() {
    const cacheFile = path.join(CONFIG.cacheDir, 'chainalysis-sanctions.json');
    if (!fs.existsSync(cacheFile)) return [];
    
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const entries = Array.isArray(data) ? data : Object.values(data).flat();
      console.log(`   🔗 Chainalysis cache: ${entries.length} addresses`);
      return entries.map(e => ({
        address: (e.address || e).toLowerCase(),
        source: 'Chainalysis',
        riskScore: 95,
        tier: 3,
        reason: e.category || 'Sanctions',
      }));
    } catch (e) {
      console.warn('   ⚠️ Failed to load Chainalysis cache');
      return [];
    }
  }

  // ========== 4. 合并数据 ==========
  mergeData(sources) {
    console.log('\n🔀 Merging data sources...');
    
    const merged = new Map();
    
    for (const source of sources) {
      for (const item of source) {
        const addr = item.address.toLowerCase();
        const existing = merged.get(addr);
        
        if (!existing || item.riskScore > existing.riskScore) {
          merged.set(addr, {
            address: addr,
            riskScore: item.riskScore,
            tier: item.tier,
            sources: existing ? [...existing.sources, item.source] : [item.source],
            reasons: existing ? [...existing.reasons, item.reason] : [item.reason],
          });
        }
      }
    }
    
    const result = Array.from(merged.values());
    console.log(`   📊 Total unique: ${result.length}`);
    return result;
  }

  // ========== 5. 构建 Merkle Tree ==========
  buildMerkleTree(addresses) {
    console.log('\n🌲 Building Merkle Tree...');
    
    // 格式: [address, riskScore, tier]
    const values = addresses.map(a => [a.address, a.riskScore, a.tier]);
    
    const tree = StandardMerkleTree.of(values, ['address', 'uint8', 'uint8']);
    
    console.log(`   Root: ${tree.root}`);
    console.log(`   Leaves: ${tree.length}`);
    
    // 保存树到缓存
    const treeFile = path.join(CONFIG.cacheDir, 'merkle-tree.json');
    fs.writeFileSync(treeFile, JSON.stringify(tree.dump()));
    
    // 保存根到单独文件（供脚本读取）
    const rootFile = path.join(CONFIG.cacheDir, 'merkle-root-latest.txt');
    fs.writeFileSync(rootFile, tree.root);
    
    return tree;
  }

  // ========== 6. 同步到链上 ==========
  async syncToChain(addresses, dryRun = false) {
    if (!this.contract || !this.wallet) {
      console.log('\n⏭️ Skipping chain sync (no wallet/contract configured)');
      return { skipped: true };
    }
    
    console.log('\n⛓️ Syncing to chain...');
    
    if (dryRun) {
      console.log('   [DRY RUN] Would sync ${addresses.length} addresses');
      return { dryRun: true, count: addresses.length };
    }
    
    // 分批处理（每批最多 50 个，避免 gas limit）
    const batches = [];
    for (let i = 0; i < addresses.length; i += CONFIG.batchSize) {
      batches.push(addresses.slice(i, i + CONFIG.batchSize));
    }
    
    const results = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`   📤 Batch ${i + 1}/${batches.length} (${batch.length} addresses)`);
      
      const accounts = batch.map(a => a.address);
      const riskScores = batch.map(a => a.riskScore);
      const tiers = batch.map(a => a.tier);
      const sanctioned = batch.map(() => true);
      
      try {
        // 检查 gas
        const gasEstimate = await this.contract.batchUpdateRiskProfiles.estimateGas(
          accounts, riskScores, tiers, sanctioned
        );
        console.log(`      ⛽ Gas estimate: ${gasEstimate}`);
        
        const tx = await this.contract.batchUpdateRiskProfiles(
          accounts, riskScores, tiers, sanctioned,
          { gasLimit: gasEstimate * 12n / 10n } // +20% buffer
        );
        
        console.log(`      📝 TX: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`      ✅ Confirmed (block ${receipt.blockNumber}, gas: ${receipt.gasUsed})`);
        
        results.push({
          batch: i + 1,
          hash: receipt.hash,
          block: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
        });
        
        // 批次间延迟，避免节点限流
        if (i < batches.length - 1) {
          await this.sleep(3000);
        }
        
      } catch (e) {
        console.error(`      ❌ Batch failed: ${e.message}`);
        results.push({ batch: i + 1, error: e.message });
      }
    }
    
    return { batches: results.length, results };
  }

  // ========== 7. 保存最终数据库 ==========
  saveDatabase(addresses) {
    const dbFile = path.join(CONFIG.cacheDir, 'risk-database.json');
    fs.writeFileSync(dbFile, JSON.stringify(addresses, null, 2));
    console.log(`\n💾 Database saved: ${addresses.length} entries`);
  }

  // ========== 8. 写日志 ==========
  writeLog(summary) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(CONFIG.logDir, `sync-${timestamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify(summary, null, 2));
    console.log(`📝 Log: ${logFile}`);
  }

  // ========== 主流程 ==========
  async run(dryRun = false) {
    const startTime = Date.now();
    console.log('='.repeat(60));
    console.log('FidesOrigin Daily Risk Sync');
    console.log(new Date().toISOString());
    console.log('='.repeat(60));
    
    await this.init();
    
    // 1. 收集数据
    const ofacData = await this.fetchOFAC();
    const localData = this.loadLocalCache();
    const chainalysisData = this.loadChainalysisCache();
    
    // 2. 合并
    const merged = this.mergeData([ofacData, localData, chainalysisData]);
    
    if (merged.length === 0) {
      console.log('\n⚠️ No data to sync');
      return;
    }
    
    // 3. 构建 Merkle Tree
    const tree = this.buildMerkleTree(merged);
    
    // 4. 同步到链上
    const chainResult = await this.syncToChain(merged, dryRun);
    
    // 5. 保存
    this.saveDatabase(merged);
    
    // 6. 汇总
    const summary = {
      timestamp: new Date().toISOString(),
      dryRun,
      stats: {
        ofac: ofacData.length,
        local: localData.length,
        chainalysis: chainalysisData.length,
        merged: merged.length,
        unique: merged.length,
      },
      merkle: {
        root: tree.root,
        leaves: tree.length,
      },
      chain: chainResult,
      duration: Date.now() - startTime,
    };
    
    this.writeLog(summary);
    
    console.log('\n' + '='.repeat(60));
    console.log('Sync Complete');
    console.log(`⏱️ Duration: ${summary.duration}ms`);
    console.log(`📊 Addresses: ${summary.stats.merged}`);
    console.log(`🌲 Merkle Root: ${summary.merkle.root}`);
    console.log('='.repeat(60));
    
    return summary;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========== CLI ==========
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  const service = new DailySyncService();
  
  try {
    const result = await service.run(dryRun);
    process.exit(0);
  } catch (e) {
    console.error('\n💥 Fatal error:', e);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DailySyncService };
