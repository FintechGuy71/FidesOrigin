// [M-1/M-2 FIX] StandardMerkleTree 已弃用（leaf 格式与链上合约不兼容），改用共享 merkleBuilder
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { scoreToTier } = require('../src/merkleBuilder');

/**
 * [P1-7 FIX] 从 SDN_ADVANCED.XML 结构化提取 EVM 制裁地址。
 * 两步过滤：① 只取字典中名为「Digital Currency Address - *」的 Feature 块
 * （ETH/USDT/USDC/BSC/ARB…——USDT/USDC 等 ERC-20 地址与 ETH 同地址空间，必须覆盖；
 * 实证：OFAC 会把同一地址按币种拆成不同 FeatureTypeID，如 345=ETH、887=USDT）；
 * ② 块内只捕 0x+40hex 形态（XBT/XMR/LTC 等非 EVM 币种天然被格式滤掉）。
 * 原实现对 ~200MB 全文正则，任何 40 位 hex（参考编号/哈希）都会被当作制裁地址写链。
 */
function extractEvmAddresses(xml) {
  // 1. 字典区：FeatureTypeID → 名称（<FeatureType ID="345" ...>Digital Currency Address - ETH</FeatureType>）
  const typeNameById = new Map();
  for (const m of xml.matchAll(/<FeatureType ID="(\d+)"[^>]*>([^<]*)<\/FeatureType>/g)) {
    typeNameById.set(m[1], m[2].trim());
  }
  // 2. 逐 Feature 块过滤提取
  const out = new Set();
  const chunks = xml.split(/<Feature\s/i);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const gt = chunk.indexOf('>');
    if (gt < 0) continue;
    const idMatch = chunk.slice(0, gt).match(/FeatureTypeID="(\d+)"/);
    if (!idMatch) continue;
    const name = typeNameById.get(idMatch[1]) || '';
    if (!name.startsWith('Digital Currency Address')) continue;
    const m = chunk.match(/0x[a-fA-F0-9]{40}/g);
    if (m) for (const a of m) out.add(a.toLowerCase());
  }
  return [...out];
}

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
  // MerkleRiskRegistry（v3.1.0 现役）：管道建树后推根上链
  merkleRegistryAddress: process.env.MERKLE_REGISTRY_ADDRESS || '0x31A034efbe22eDc1a78ceb37F52BA869D869c33B',
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
  'function getSanctionedAddresses() external view returns (address[] memory)',
  'event RiskProfileUpdated(address indexed addr, uint256 riskScore, uint8 tier, bool isSanctioned)',
  'event BatchUpdateCompleted(uint256 successCount, uint256 gasUsed)',
];

// MerkleRiskRegistry ABI（v3.1.0 现役）
const MERKLE_REGISTRY_ABI = [
  'function updateMerkleRoot(bytes32 newRoot) external',
  'function merkleRoot() view returns (bytes32)',
  'function lastOracleRootUpdate() view returns (uint256)',
  'event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot, uint256 timestamp, string version)',
];

class DailySyncService {
  constructor() {
    this.riskDatabase = new Map(); // address -> { riskScore, tier, tags, source }
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    // [P1-1] OFAC 主源（SDN_ADVANCED）是否成功产出：false 时禁止下架 diff（防数据源故障被误判为大面积下架）
    this.primarySourceOk = false;
    // [HMT 接入] 次源（OFSI）健康位。下架 diff 的公式是「链上全集 − 今日名单」，
    // 因此**任一**参与源当天抓取失败，其独有地址都会落进"下架集"被清零。
    // HMT 独有 2 个地址（OFAC 未覆盖），一旦 HMT 某天挂掉就会被误删、次日又加回，
    // 形成写链抖动。故次源也必须纳入下架保护，与主源同等对待。
    this.hmtSourceOk = false;
    
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

    if (CONFIG.merkleRegistryAddress) {
      const signer = this.wallet || this.provider;
      this.merkleContract = new ethers.Contract(CONFIG.merkleRegistryAddress, MERKLE_REGISTRY_ABI, signer);
      console.log(`🌲 MerkleRiskRegistry: ${CONFIG.merkleRegistryAddress}`);
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
      // [P1-7 FIX] 结构化解析（「Digital Currency Address - *」特征块内提 0x 形态），替代全文档正则
      const unique = extractEvmAddresses(response.data);
      if (unique.length === 0) {
        // 结构解析归零 = OFAC 格式变更（常态百余个 EVM 地址）。按数据源故障处理：
        // 抛错走 catch 回退静态源，同时 primarySourceOk=false 会阻止下架 diff 误删
        throw new Error('SDN_ADVANCED structured parse yielded 0 EVM addresses (OFAC format changed?)');
      }
      this.primarySourceOk = true;
      console.log(`   📥 OFAC SDN_ADVANCED: ${unique.length} EVM addresses (official, daily-fresh)`);
      for (const addr of unique) {
        addresses.push({
          address: addr,
          source: 'OFAC_SDN_ADVANCED',
          riskScore: 100,
          reason: 'OFAC Sanctioned',
        });
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

  // ========== 1b. 加载英国 OFSI（HMT）制裁名单 ==========
  /**
   * @dev OFSI ConList.csv 是英国综合制裁名单（约 2 万条记录），加密钱包地址写在
   *      Other Information 自由文本中。三个必须注意的点：
   *      ① 首行是元数据（"Last Updated","<date>"），真表头在其后 —— 用
   *         findHeaderLine 按列名定位，不硬编码行号（OFSI 改版会静默失效，
   *         这正是原 HMTAdapter 产出 0 条的根因）。
   *      ② 真实列名是 Address 1..6 / Other Information / Name 1..6 / Group ID，
   *         不是 Address / Remarks。
   *      ③ 地址提取复用 sanctions-sync 的 extractCryptoAddresses（带格式校验、去重）。
   *      当前产量小（6 个 EVM 地址，其中 2 个为 OFAC 未覆盖的净新增），
   *      但它是每日更新的官方源，OFSI 后续新增的加密地址会自动进入。
   */
  async fetchHMT() {
    console.log('📥 Loading HMT/OFSI (UK) crypto sanctions...');
    let addresses = [];
    // 静态后备快照路径：与 OFAC 的 ofac-eth-source.txt 同模式。
    // 每次成功产出后落盘，供端点故障时兜底，防止其独有地址当天进不了名单。
    const snapshotFile = path.join(CONFIG.cacheDir, 'hmt-eth-source.txt');

    const url = process.env.HMT_URL
      || 'https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv';
    try {
      const response = await axios.get(url, {
        timeout: 120000,
        responseType: 'text',
        maxContentLength: 200 * 1024 * 1024,
        maxBodyLength: 200 * 1024 * 1024,
      });

      const {
        parseCSV, findHeaderLine, HMT_KNOWN_COLUMNS, extractCryptoAddresses,
      } = require('../sanctions-sync');

      const headerLine = findHeaderLine(response.data.split('\n'), HMT_KNOWN_COLUMNS);
      const records = parseCSV(response.data, { headerLine });
      console.log(`   📄 HMT records: ${records.length} (header line ${headerLine})`);

      // 只有成功解析出记录才置健康位。0 条记录意味着 CSV 结构变了或抓到了空内容
      // （这正是原实现的静默失败形态），此时必须让下架 diff 停摆，不能放行。
      if (records.length > 0) this.hmtSourceOk = true;

      // OFSI 用别名行重复同一实体（如 AYASH / AYYASH 两行都列了同一批钱包），
      // 同一地址会被多行重复命中 —— 先去重再入列，否则 hmt 统计虚高（10 vs 实际 6）。
      const seen = new Set();
      for (const r of records) {
        const remarks = r['Other Information'] || '';
        const fullAddress = [
          r['Address 1'], r['Address 2'], r['Address 3'],
          r['Address 4'], r['Address 5'], r['Address 6'],
          r['Post/Zip Code'], r['Country'],
        ].filter(Boolean).join(', ');

        const crypto = extractCryptoAddresses(`${remarks} ${fullAddress}`);
        for (const raw of (crypto.ethereum || [])) {
          const addr = raw.toLowerCase();
          if (seen.has(addr)) continue;
          seen.add(addr);
          addresses.push({
            address: addr,
            source: 'HMT_OFSI',
            riskScore: 100,
            reason: 'UK OFSI Sanctioned',
          });
        }
      }

      // 落盘静态后备快照（健康位已置，说明本次产出可信）
      if (this.hmtSourceOk) {
        try {
          fs.writeFileSync(snapshotFile, addresses.map(a => a.address).join('\n') + '\n');
        } catch (e) {
          console.log(`   ⚠️ HMT snapshot write failed: ${e.message}`);
        }
      }
    } catch (e) {
      // 端点故障 → 回退静态后备快照，避免其独有地址当天完全消失。
      // [Q13 FIX] 快照无时间戳语义上的"新鲜度"保证 —— 陈旧快照若照常置健康位，
      // 会放行下架 diff、掩盖"OFSI 今天真删了某地址"。故加年龄上限：超龄快照
      // 仍可用作兜底名单（保住筛查覆盖），但**不置健康位**，下架当日停摆并告警。
      console.log(`   ⚠️ HMT/OFSI fetch failed: ${e.message} — falling back to static snapshot`);
      try {
        if (fs.existsSync(snapshotFile)) {
          const lines = fs.readFileSync(snapshotFile, 'utf8').split('\n')
            .map(l => l.trim().toLowerCase())
            .filter(l => /^0x[a-f0-9]{40}$/.test(l));
          console.log(`   📦 HMT static snapshot: ${lines.length} addresses`);
          for (const addr of lines) {
            addresses.push({
              address: addr,
              source: 'HMT_OFSI_STATIC',
              riskScore: 100,
              reason: 'UK OFSI Sanctioned (static snapshot)',
            });
          }
          if (lines.length > 0) {
            const ageMs = Date.now() - fs.statSync(snapshotFile).mtimeMs;
            const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48h
            if (ageMs <= SNAPSHOT_MAX_AGE_MS) {
              this.hmtSourceOk = true;
            } else {
              console.log(
                `   ⚠️ HMT snapshot is stale (${Math.round(ageMs / 3600000)}h > 48h)` +
                ` — using as fallback list but NOT marking source healthy, delisting paused`
              );
            }
          }
        } else {
          console.log('   ⚠️ No HMT snapshot available');
        }
      } catch (e2) {
        console.log(`   ⚠️ HMT snapshot load failed: ${e2.message}`);
      }
    }
    console.log(`   ✅ HMT/OFSI: ${addresses.length} addresses`);
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
            // [P1-2 FIX] tier 统一由 score 推导（scoreToTier：100→4 CRITICAL），
            // 消灭源端硬编码 tier:3 导致的链上档案/Merkle leaf/引擎语义三方漂移
            tier: scoreToTier(item.riskScore),
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

  // ========== 6b. 推 Merkle 根上链（D-1） ==========
  // MerkleRiskRegistry.updateMerkleRoot 需 ADMIN_ROLE（deployer 持有）。
  // 幂等：根未变化时跳过写链；失败返回 { error } 由 main() 转成非零退出码。
  async syncMerkleRoot(tree, dryRun = false) {
    if (!this.merkleContract || !this.wallet) {
      console.log('\n⏭️ Skipping merkle root push (no wallet/merkle contract configured)');
      return { skipped: true };
    }

    console.log('\n🌲 Pushing Merkle root on-chain...');

    if (dryRun) {
      console.log(`   [DRY RUN] Would push merkle root ${tree.root}`);
      return { dryRun: true, root: tree.root };
    }

    try {
      const onchainRoot = await this.merkleContract.merkleRoot();
      console.log(`   🔎 On-chain root: ${onchainRoot}`);

      if (onchainRoot.toLowerCase() === tree.root.toLowerCase()) {
        console.log('   ✅ Root unchanged, skip');
        return { unchanged: true, root: tree.root };
      }

      const gasEstimate = await this.merkleContract.updateMerkleRoot.estimateGas(tree.root);
      console.log(`   ⛽ Gas estimate: ${gasEstimate}`);

      const tx = await this.merkleContract.updateMerkleRoot(tree.root, {
        gasLimit: gasEstimate * 12n / 10n, // +20% buffer，与批次写链一致
      });
      console.log(`   📝 TX: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`   ✅ Root updated (block ${receipt.blockNumber}, gas: ${receipt.gasUsed})`);

      return {
        root: tree.root,
        previousRoot: onchainRoot,
        hash: receipt.hash,
        block: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (e) {
      console.error(`   ❌ Merkle root push failed: ${e.message}`);
      return { error: e.message, root: tree.root };
    }
  }

  // ========== 6c. 制裁下架传播（P1-1） ==========
  // 管道原本只增不删：OFAC delist 后链上与后端库永久残留（误封 + 法律风险）。
  // 策略：链上制裁全集 − 今日名单 = 下架集；逐地址 updateRiskProfile(0, UNKNOWN, [], false)
  // （保留审计轨迹并触发 RiskProfileUpdated 供 subgraph 索引；合约内部自动从 sanctionedAddresses 移除）。
  // 保护：仅在 OFAC 主源成功产出时执行 diff——主源故障走静态后备时，下架集必然是假的。
  async syncDelisted(merged, dryRun = false) {
    if (!this.contract || !this.wallet) {
      return { skipped: true };
    }
    if (!this.primarySourceOk) {
      console.log('\n⚠️ OFAC 主源未成功产出，跳过下架 diff（防数据源故障误判为大面积下架）');
      return { skipped: true, reason: 'primary-source-down' };
    }
    if (!this.hmtSourceOk) {
      // HMT 有 2 个 OFAC 未覆盖的独有地址，它一挂这些地址就会落进下架集被清零
      console.log('\n⚠️ HMT/OFSI 次源未成功产出，跳过下架 diff（防其独有地址被误判为下架）');
      return { skipped: true, reason: 'hmt-source-down' };
    }

    console.log('\n🔎 Checking for delisted addresses...');

    let onchain;
    try {
      onchain = await this.contract.getSanctionedAddresses();
    } catch (e) {
      // 读链失败不猜、不删：告警并跳过（下架是破坏性操作，宁缺毋滥）
      console.error(`   ❌ 读取链上制裁名单失败：${e.message} —— 跳过下架步骤`);
      return { skipped: true, reason: 'read-failed' };
    }

    const current = new Set(merged.map(a => a.address.toLowerCase()));
    const delisted = onchain.map(a => a.toLowerCase()).filter(a => !current.has(a));

    if (delisted.length === 0) {
      console.log('   ✅ 无下架地址');
      return { delisted: 0, addresses: [] };
    }

    console.log(`   🗑️ ${delisted.length} 个地址已不在最新名单，执行链上下架：`);

    if (dryRun) {
      for (const a of delisted) console.log(`      [DRY RUN] Would delist ${a}`);
      return { dryRun: true, delisted: delisted.length, addresses: delisted };
    }

    const results = [];
    for (const addr of delisted) {
      try {
        const tx = await this.contract.updateRiskProfile(addr, 0, 0, [], false);
        const receipt = await tx.wait();
        console.log(`      ✅ Delisted ${addr} (tx ${receipt.hash})`);
        results.push({ address: addr, hash: receipt.hash, status: receipt.status });
      } catch (e) {
        console.error(`      ❌ Delist failed ${addr}: ${e.message}`);
        results.push({ address: addr, error: e.message });
      }
    }

    return { delisted: delisted.length, addresses: delisted, results };
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
    // [P1-1] 主源健康时昨日快照不参与合并——它就是昨天的合并结果，
    // 并入会让已下架地址自我复活；主源故障时它才作为后备参与。
    const localData = this.primarySourceOk ? [] : this.loadLocalCache();
    const chainalysisData = this.loadChainalysisCache();
    // 英国 OFSI（HMT）—— 官方制裁源，与 OFAC 同权（riskScore 100）。
    // 失败时返回空数组并告警，不阻断主源；但会把 hmtSourceOk 置 false 触发下架保护。
    const hmtData = await this.fetchHMT();

    // 2. 合并
    const merged = this.mergeData([ofacData, localData, chainalysisData, hmtData]);
    
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

    // 4a. 推 Merkle 根上链（D-1：MerkleRiskRegistry.updateMerkleRoot，幂等）
    const merkleResult = await this.syncMerkleRoot(tree, dryRun);

    // 4b. 制裁下架传播（P1-1：链上制裁集 diff 今日名单，下架地址置 sanctioned=false）
    const delistResult = await this.syncDelisted(merged, dryRun);

    // 4c. 同步到后端 DB（Neon address_risks）——让 demo/address-check 的后端视角与链上一致
    if (!dryRun) {
      const { pushToBackendDb } = require('./push-to-backend-db');
      try {
        // 下架地址一并推送（置 score=0/清空 tags），DB 视角与链上同步移除
        await pushToBackendDb(merged, delistResult.addresses || []);
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
        hmt: hmtData.length,
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
      merkleOnChain: merkleResult,
      delist: delistResult,
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
    const merkleError = result?.merkleOnChain?.error;
    const delistFailures = (result?.delist?.results || []).filter((r) => r.error);
    if (!dryRun && (failedBatches.length > 0 || merkleError || delistFailures.length > 0)) {
      if (failedBatches.length > 0) {
        console.error(`\n❌ ${failedBatches.length}/${result.chain.results.length} batches failed:`);
        for (const f of failedBatches) {
          console.error(`   Batch ${f.batch}: ${f.error}`);
        }
      }
      if (merkleError) {
        console.error(`\n❌ Merkle root push failed: ${merkleError}`);
      }
      if (delistFailures.length > 0) {
        console.error(`\n❌ ${delistFailures.length} delist ops failed:`);
        for (const f of delistFailures) {
          console.error(`   ${f.address}: ${f.error}`);
        }
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
