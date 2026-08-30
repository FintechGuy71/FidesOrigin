// [M-1/M-2 FIX] StandardMerkleTree 已弃用（leaf 格式与链上合约不兼容），改用共享 merkleBuilder
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
 * @dev 1. 抓取 OFAC SDN_ADVANCED.XML（主源，Feature/VersionDetail 内含链上地址）
 *    2. 合并本地缓存 + Chainalysis 数据
 *    3. 构建 Merkle Tree
 *    4. 更新链上 RiskRegistry
 *
 * 运行: node data-sync/scripts/daily-sync.js [--dry-run]
 * 环境变量:
 *   - OFAC_ADVANCED_URL: OFAC SDN_ADVANCED.XML 主源（fetchOFAC 内读取）
 *   - CHAINALYSIS_API_KEY: Chainalysis API Key
 *   - RPC_URL: 链节点
 *   - PRIVATE_KEY: 部署/更新钱包私钥
 *   - RISK_REGISTRY_ADDRESS: RiskRegistry 合约地址
 */

const CONFIG = {
  chainalysisApiKey: process.env.CHAINALYSIS_API_KEY,
  rpcUrl: process.env.RPC_URL || 'https://rpc.sepolia.org',
  privateKey: process.env.SYNC_PRIVATE_KEY || process.env.PRIVATE_KEY,
  riskRegistryAddress: process.env.RISK_REGISTRY_ADDRESS || process.env.RISK_REGISTRY_CONTRACT,
  batchSize: parseInt(process.env.BATCH_SIZE) || 50,
  cacheDir: path.join(__dirname, '../cache'),
  logDir: path.join(__dirname, '../logs'),
};

// RiskRegistry ABI（与链上 v3.1.0 合约签名对齐）
// [AUDIT-FIX] 三处历史漂移修正：
//   1. getRiskProfile 真实返回 5 值（score/tier/tags/lastUpdated/sanctioned），原 4 字段 tuple 为旧版
//   2. emergencySanction 在当前合约中不存在（来自旧版 ABI），删除
//   3. RiskProfileUpdated 事件第二参为 uint256（原声明 uint8 导致 topic0 永远对不上）
const RISK_REGISTRY_ABI = [
  'function batchUpdateRiskProfiles(address[] calldata accounts, uint8[] calldata riskScores, uint8[] calldata tiers, bool[] calldata isSanctionedList, bytes32[][] calldata tags) external',
  'function updateRiskProfile(address addr, uint8 riskScore, uint8 tier, bytes32[] calldata tags, bool sanctioned) external',
  'function getRiskProfile(address account) external view returns (uint8 riskScore, uint8 tier, bytes32[] tags, uint256 lastUpdated, bool sanctioned)',
  'function isSanctioned(address account) external view returns (bool)',
  'event RiskProfileUpdated(address indexed addr, uint256 riskScore, uint8 tier, bool isSanctioned)',
  'event BatchUpdateCompleted(uint256 successCount, uint256 gasUsed)',
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
    let addresses = [];

    // 0. 主源：OFAC 官方 SDN_ADVANCED.XML（每日更新，Feature/VersionDetail 内含链上地址）
    const advUrl = process.env.OFAC_ADVANCED_URL
      || 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML';
    try {
      const response = await axios.get(advUrl, {
        timeout: 120000,
        responseType: 'text',
        maxContentLength: 200 * 1024 * 1024,
        maxBodyLength: 200 * 1024 * 1024,
      });
      const matches = response.data.match(/0x[a-fA-F0-9]{40}/g) || [];
      const unique = [...new Set(matches.map(a => a.toLowerCase()))];
      if (unique.length > 0) {
        console.log(`   📥 OFAC SDN_ADVANCED: ${unique.length} ETH addresses (official, daily-fresh)`);
        for (const addr of unique) {
          addresses.push({
            address: addr,
            source: 'OFAC_SDN_ADVANCED',
            riskScore: 100,
            tier: 3,
            reason: 'OFAC Sanctioned',
          });
        }
      }
    } catch (e) {
      console.log(`   ⚠️ SDN_ADVANCED fetch failed: ${e.message} — falling back to static sources`);
    }

    // 1. 加载本地静态列表（后备来源：ofac-crypto-sanctions.json 或 ofac-eth-source.txt）
    const staticFile = path.join(CONFIG.cacheDir, 'ofac-crypto-sanctions.json');
    const txtSourceFile = path.join(CONFIG.cacheDir, 'ofac-eth-source.txt');

    if (fs.existsSync(staticFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(staticFile, 'utf8'));
        const cached = Array.isArray(data) ? data : data.addresses || [];
        console.log(`   📦 Static cache: ${cached.length} addresses`);
        for (const entry of cached) {
          const addr = (entry.address || entry).toLowerCase();
          if (!addresses.find(a => a.address === addr)) {
            addresses.push({
              address: addr,
              source: entry.source || 'STATIC_CACHE',
              riskScore: entry.riskScore ?? 100,
              tier: entry.tier ?? 3,
              reason: entry.reason || 'OFAC Sanctioned',
            });
          }
        }
      } catch (e) {
        console.warn('   ⚠️ Failed to load static OFAC cache');
      }
    } else if (fs.existsSync(txtSourceFile)) {
      // ofac-eth-source.txt：每行一个地址的既有快照
      const lines = fs.readFileSync(txtSourceFile, 'utf8').split('\n')
        .map(l => l.trim().toLowerCase())
        .filter(l => /^0x[a-f0-9]{40}$/.test(l));
      console.log(`   📦 Static snapshot (ofac-eth-source.txt): ${lines.length} addresses`);
      for (const addr of lines) {
        if (!addresses.find(a => a.address === addr)) {
          addresses.push({
            address: addr,
            source: 'STATIC_SNAPSHOT',
            riskScore: 100,
            tier: 3,
            reason: 'OFAC Sanctioned',
          });
        }
      }
    }

    // 2. 尝试下载 OFAC sdnlist.txt 补充（通常没有加密地址，但试试）
    // [AUDIT-FIX] 移除 sdnlist.txt 补充源：OFAC 已迁移下载端点，该 URL 现返回 404
    // （2026-08-31 实测），且历史上的 SDN 文本版本就不含加密货币地址——每次运
    // 行白等最长 15 秒超时。主源 SDN_ADVANCED.XML + 本地静态后备已完整覆盖。

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
  // [M-1/M-2 FIX] 改用共享 merkleBuilder（规范 leaf + OZ MerkleProof 兼容树）：
  // 原实现使用 @openzeppelin/merkle-tree 的 StandardMerkleTree —— 其 leaf 为
  // 单哈希 keccak256(abi.encode(...)) 且内部节点带排序/前缀，与仓库内合约的
  // 双哈希类型化 leaf + MerkleProof.verify 完全不兼容（链上永远验证不过）。
  buildMerkleTree(addresses) {
    console.log('\n🌲 Building Merkle Tree...');

    const { buildMerkleTree: buildTree, dumpTree } = require('../src/merkleBuilder');
    const tree = buildTree(addresses);

    console.log(`   Root: ${tree.root}`);
    console.log(`   Leaves: ${tree.count}`);

    // 保存树到缓存
    const treeFile = path.join(CONFIG.cacheDir, 'merkle-tree.json');
    fs.writeFileSync(treeFile, dumpTree(tree));

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
      // [AUDIT-FIX] 原为单引号字符串内的 ${} 字面量（永不插值）
      console.log(`   [DRY RUN] Would sync ${addresses.length} addresses`);
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
      // 合约签名第 5 参：每地址的 tags 数组（当前为空集合，后续可挂来源标签）
      const tags = batch.map(() => []);
      
      try {
        // 检查 gas
        const gasEstimate = await this.contract.batchUpdateRiskProfiles.estimateGas(
          accounts, riskScores, tiers, sanctioned, tags
        );
        console.log(`      ⛽ Gas estimate: ${gasEstimate}`);
        
        const tx = await this.contract.batchUpdateRiskProfiles(
          accounts, riskScores, tiers, sanctioned, tags,
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
      // [AUDIT-FIX] 0 条数据不再静默成功：主源 SDN_ADVANCED.XML 常态应有百余个
      // 在册地址，归零几乎必然意味着全部数据源故障（端点迁移/网络问题）。
      // 原实现静默 return（exit 0），GitHub Actions 显示 success，故障不可见。
      // 静默跳过链上写入的同时，抛出让 workflow 反映 failure，提示排查数据源。
      console.error('\n💥 No data to sync — all sources empty (SDN_ADVANCED + static caches).');
      console.error('   This almost certainly indicates a data source failure, not an empty list.');
      throw new Error('No sanction addresses collected from any source — aborting (suspected data source outage)');
    }
    
    // 3. 构建 Merkle Tree
    const tree = this.buildMerkleTree(merged);
    
    // 4. 同步到链上
    const chainResult = await this.syncToChain(merged, dryRun);

    // 4b. 同步到后端 DB（Neon address_risks）——让 demo/address-check 的后端视角与链上一致
    if (!dryRun) {
      const { pushToBackendDb } = require('./push-to-backend-db');
      try {
        await pushToBackendDb(merged);
      } catch (e) {
        // 后端库同步失败不阻断主流程（链上已是事实源），告警并继续
        console.error('   ⚠️ Backend DB sync failed (chain 已是事实源，明日重试):', e.message);
      }
    }

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
        leaves: tree.count,
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

    // [AUDIT-FIX] 写链失败不再被吞成 exit 0：
    // 原实现 syncToChain 的每个 batch 失败被 try/catch 捕获后仅打印，
    // main() 无条件 process.exit(0)——GitHub Actions 永远显示 success，
    // 失败完全不可见（实证：run #15 三笔 tx 全 revert 仍 success）。
    // 现在只要有 batch error，就以非零码退出，让 workflow conclusion=failure。
    const failedBatches = (result?.chain?.results || []).filter((r) => r.error);
    if (!dryRun && failedBatches.length > 0) {
      console.error(`\n❌ ${failedBatches.length}/${result.chain.results.length} batches failed:`);
      for (const f of failedBatches) {
        console.error(`   Batch ${f.batch}: ${f.error}`);
      }
      process.exit(1);
    }

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
