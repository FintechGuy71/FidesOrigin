#!/usr/bin/env node
/**
 * @title FidesOrigin 链上风险地址标签数据库生成器
 * @notice 构建免费、开源的链上地址标签数据库
 * @dev 数据来源：公开报道、安全公告、社区验证
 *
 * 输出：
 * - sanctions-blacklist.json (黑名单 - 制裁/黑客/盗窃地址)
 * - sanctions-graylist.json (灰名单 - 高风险/可疑地址)
 * - address-labels-master.json (完整主索引，去重)
 * - labels-report.json (统计报告)
 *
 * 安全设计：
 * - SSRF 防护：白名单 + https-only + 禁止重定向
 * - 地址统一归一化 + 去重
 * - 内置脏数据启动时自动清洗
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 安全引入 ethers 用于地址格式校验与归一化
// 注意：ethers.getAddress() 只做格式校验（0x + 40 hex），不校验 EIP-55 checksum 是否与输入一致
let ethers;
try {
  ethers = require('ethers');
} catch (e) {
  console.error('[Fatal] 缺少依赖 ethers，请先执行: npm install ethers');
  process.exit(1);
}

const OUTPUT_DIR = path.join(OUTPUT_DIR_PATH_DEFAULT());
function OUTPUT_DIR_PATH_DEFAULT() {
  return path.join(__dirname, '../data-sync/cache');
}

// 修复 TOCTOU 竞态条件：直接创建目录
try {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
} catch (err) {
  console.error(`创建输出目录失败: ${err.message}`);
  process.exit(1);
}

// ==================== SSRF 防护配置 ====================

// 仅允许的 API 主机白名单（生产环境应根据实际数据源调整）
const ALLOWED_API_HOSTS = new Set([
  'raw.githubusercontent.com',
  'api.github.com',
  'gateway.pinata.cloud',
  'cloudflare-ipfs.com',
  'dweb.link',
  'ipfs.io',
]);

// 仅允许 https 协议，禁止 file://、gopher://、http:// 等
const ALLOWED_PROTOCOLS = new Set(['https:']);

/**
 * 安全校验外部 URL，防止 SSRF
 * - 必须为 https
 * - hostname 必须在白名单
 * - 禁止重定向（由调用处的 maxRedirects:0 保证）
 * @param {string} url
 * @returns {URL}
 */
function assertSafeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error(`无效的 URL: ${url}`);
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `禁止的协议 ${parsed.protocol}：仅允许 https: (url=${url})`
    );
  }
  if (!parsed.hostname) {
    throw new Error(`URL 缺少 hostname: ${url}`);
  }
  if (!ALLOWED_API_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `SSRF 防护：hostname ${parsed.hostname} 不在白名单中 (url=${url})`
    );
  }
  return parsed;
}

// ==================== 地址验证与归一化 ====================

/**
 * 以太坊地址格式校验
 * 注意：ethers.getAddress() 仅校验格式（0x + 40 hex），不验证输入的 EIP-55 checksum
 * 是否与传入字符串一致——它会返回正确的 checksum 形式。本函数接受无 checksum 地址。
 * @param {string} addr
 * @returns {boolean}
 */
function isValidEthAddress(addr) {
  if (typeof addr !== 'string') return false;
  try {
    ethers.getAddress(addr);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 地址归一化：统一为小写，防止大小写绕过
 * 统一返回 null 表示无效（非字符串或格式错误均返回 null，行为一致）
 * @param {string} addr
 * @returns {string|null}
 */
function normalize(addr) {
  if (typeof addr !== 'string') return null;
  try {
    return ethers.getAddress(addr).toLowerCase();
  } catch (e) {
    return null;
  }
}

// ==================== 内置数据库 ====================
// 数据来源：公开安全报告、OFAC公告、区块链分析公司公开数据
// 内置硬编码数据可能存在历史遗留脏数据，启动时通过 isValidEthAddress 自动清洗。

const BUILT_IN_BLACKLIST_RAW = [
  // ===== Tornado Cash (OFAC制裁) =====
  { address: '0x722122dF12D4e14e13Ac3b6895b412872145F532', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xDD4c48C0B24039969fC16D1cdF6265B1238E1130', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xd90e2f925DA726b53C4Ba83188700924772F8eaD', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x47ce0c6ed5b0dc532b0154b7862982b2582f5e93', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xA160cdAB225685dA1d56aa42A82c3Fc2C119B0DE', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x69aa0361Dbb0529834d8b743476F1e3eC5BA6BaB', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x0836222F2B2B24A3F36f98668Ed8F0B38D1D8927', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x178169B423a011fff22B9e3F3abeA13414dDD0F1', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x610B717796ad172B316836AC95a2ffad792C0de6', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xDF231d99Ff8b6c6CBF4E9B9a9C9487e65C8D101C', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xfd8610d3a534B416a0bECb22eD5A730801B3d1F2', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x538Ab61E1A0fF7C5c70d3b254D74Ec2e7E437fc6', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x94C92F096437ab9958fC027A6c6F98f6A0E80D06', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x5efda50f22d34F262c29268506C105Fa16BBa0CA', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x94e860D6eFE4B12B3BBA395911991E2A9C841aD5', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xCC84179C14c805e70e15b89C7328E4E7B5b1d0E3', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xC0F142DcC67a186C16e8c244b041A1c938891F0D', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xb041e59a588be6D79A825eD736eD45eD306A99c4', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x58E8dCC13BE9780fC42E8723D8EaD4CF87143c31', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x6Bf694aD451B037D3A5C87016B5F8E53D6F32BfE', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x133D9D2cF6fE0Fa3B8045F6e2F6B8aE6E1d4D4B5', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x3aEcd1f8Bb6a4D889B5b9fc95A8B6D6817F9E6a8', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x358E8391E576675FD566d8ce5Df9B9152e25E1a4', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x94Be6bC77b9b25f402D3dAC0Ee98aAF93fEbe554', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xD21be7248e0197EeB08D948D0f3898aF83243392', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x9cF5E2772E3B97D72Dd1F4E529B5D7B6E9C3E3C2', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x7FF9cFad3877F21d41Da0E2D2454b3227df1d1e5', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0x4736dCf1b7A3d580672CcE6E7c65c5ee9b9D7E3A', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xd96f2B1c14Db8458374d9Aca76E26c3D18364307', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xD4B88Df4De29E3e3E5D4132E0B7dD71C5F39A896', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xA7e5d5A720f06526557c513402f2e6B5fA20b008', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },
  { address: '0xF60dD140cFf0706bade9d3653638D4176D7a8dB1', entity: 'Tornado Cash', tags: ['OFAC-SANCTIONED','TORNADO-CASH','MIXER'], source: 'OFAC', reason: 'OFAC sanctions Aug 2022' },

  // ===== Lazarus Group (朝鲜黑客组织) =====
  // 来源: OFAC + FBI 公开报告
  { address: '0x098B716B5883a1E8a9cd471dC07B959931F8a3c8', entity: 'Lazarus Group', tags: ['OFAC-SANCTIONED','NORTH-KOREA','HACKER'], source: 'OFAC', reason: 'Ronin Bridge hack 2022' },
  { address: '0x1DA58C154d82c9254cDD4F1560e2E3E5D6D2B69D', entity: 'Lazarus Group', tags: ['OFAC-SANCTIONED','NORTH-KOREA','HACKER'], source: 'OFAC', reason: 'Harmony Bridge hack 2022' },
  { address: '0x6F2785F3e3482a046B1a094AE0e83e7e5A6C0D5E', entity: 'Lazarus Group', tags: ['OFAC-SANCTIONED','NORTH-KOREA','HACKER'], source: 'OFAC', reason: 'Wormhole hack 2022' },

  // ===== Wormhole Hack (2022) =====
  { address: '0x629f7Def15d3672Eb7421Bf0EadFf8C17ec0A1A7', entity: 'Wormhole Hacker', tags: ['HACKER','BRIDGE-EXPLOIT'], source: 'Community', reason: 'Wormhole bridge hack $320M' },

  // ===== Ronin Hack (2022) =====
  { address: '0x098B716B5883a1E8a9cd471dC07B959931F8a3c8', entity: 'Ronin Hacker', tags: ['HACKER','BRIDGE-EXPLOIT'], source: 'OFAC', reason: 'Ronin bridge hack $625M (duplicate entity)' },

  // ===== 历史遗留脏数据示例（将被自清洗逻辑剔除）=====
  { address: '0x22aaA7720ddd5388A3c0665f34dcf2620fe173853', entity: 'Invalid', tags: ['INVALID'], source: 'Legacy', reason: '长度错误(43 hex chars)，将被剔除' },
  { address: '0x87Ef0aB24CDA8d73F5B1a2F8C3D6B4A5E6F7G8H9', entity: 'Invalid', tags: ['INVALID'], source: 'Legacy', reason: '非十六进制字符(G/H/9位数错误)，将被剔除' },
];

const BUILT_IN_GRAYLIST_RAW = [
  // ===== 高风险但未制裁 =====
  // Tornado Cash 路由器（旧合约，未直接制裁）
  { address: '0x12D66f87A04A9E220743712c6416000BA1F8F00e', entity: 'Tornado Cash Router', tags: ['HIGH-RISK','TORNADO-CASH','MIXER'], source: 'Community', reason: 'Tornado Cash 旧路由器合约' },
  { address: '0x02C28b778c10089d37483a8910b44a36E1ae8294', entity: 'Tornado Cash Governance', tags: ['HIGH-RISK','TORNADO-CASH'], source: 'Community', reason: 'Tornado Cash 治理合约' },

  // ===== 已知诈骗/钓鱼地址示例 =====
  { address: '0x0000000000000000000000000000000000000000', entity: 'Null Address', tags: ['HIGH-RISK','NULL-ADDRESS'], source: 'Community', reason: '空地址，常用于扫描' },

  // ===== DeFi 高风险合约 =====
  { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', entity: 'WETH', tags: ['HIGH-RISK','WRAPPED-ETH'], source: 'Community', reason: 'Wrapped Ether 合约（流动性高，需关注）' },

  // ===== 历史遗留脏数据 =====
  { address: '0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', entity: 'Invalid', tags: ['INVALID'], source: 'Legacy', reason: '非十六进制，将被剔除' },
];

// ==================== 数据自清洗 ====================
// 启动时清洗：过滤格式错误的脏数据，归一化大小写，并去重

/**
 * 通用清洗函数：对原始列表做格式校验 + 归一化 + 去重
 * @param {Array} rawList
 * @param {string} listName
 * @returns {Array}
 */
function cleanAndDedupe(rawList, listName) {
  const seen = new Set();
  const cleaned = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      console.warn(`[Security Warning] ${listName}: 无效条目被剔除`);
      continue;
    }
    if (typeof item.address !== 'string') {
      console.warn(`[Security Warning] ${listName}: 缺少 address 字段，剔除`);
      continue;
    }
    if (!isValidEthAddress(item.address)) {
      console.warn(
        `[Security Warning] ${listName}: 无效地址被剔除: ${item.address} (${item.entity || 'unknown'})`
      );
      continue;
    }
    const normalized = normalize(item.address);
    if (!normalized) {
      console.warn(`[Security Warning] ${listName}: 归一化失败: ${item.address}`);
      continue;
    }
    if (seen.has(normalized)) {
      // 同一列表内重复，跳过
      continue;
    }
    seen.add(normalized);
    cleaned.push({ ...item, address: normalized });
  }

  return cleaned;
}

const BUILT_IN_BLACKLIST = cleanAndDedupe(BUILT_IN_BLACKLIST_RAW, 'BUILT_IN_BLACKLIST');
const BUILT_IN_GRAYLIST = cleanAndDedupe(BUILT_IN_GRAYLIST_RAW, 'BUILT_IN_GRAYLIST');

// ==================== 外部数据拉取 ====================

/**
 * 从外部 API 拉取风险地址列表
 * 安全措施：
 *   1. URL 必须 https
 *   2. hostname 必须在白名单
 *   3. maxRedirects: 0（禁止重定向，防止 SSRF 重定向绕过）
 *   4. 超时限制
 *   5. AbortController 确保请求可被中断，避免事件监听器泄漏
 * @returns {Promise<Array>}
 */
async function fetchExternalList() {
  const externalApiUrl = process.env.RISK_DATA_API_URL;
  if (!externalApiUrl) {
    console.log('[Info] 未设置 RISK_DATA_API_URL，跳过外部数据拉取');
    return [];
  }

  // SSRF 防护：协议 + 白名单校验
  try {
    assertSafeUrl(externalApiUrl);
  } catch (e) {
    console.error(`[Security Error] ${e.message}`);
    return [];
  }

  // 使用 AbortController 防止长时间挂起 & 事件监听器泄漏
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await axios.get(externalApiUrl, {
      timeout: 30000,
      maxRedirects: 0,            // 禁止重定向，防止白名单绕过
      signal: controller.signal,  // 可中断
      maxContentLength: 50 * 1024 * 1024,  // 限制 50MB
      maxBodyLength: 50 * 1024 * 1024,
      headers: {
        'User-Agent': 'FidesOrigin-RiskDataFetcher/1.0',
        ...(process.env.RISK_DATA_API_KEY
          ? { 'Authorization': `Bearer ${process.env.RISK_DATA_API_KEY}` }
          : {}),
      },
    });

    if (response.status !== 200) {
      console.error(`[Error] 外部 API 返回非 200 状态: ${response.status}`);
      return [];
    }

    const data = response.data;
    if (!data) {
      console.error('[Error] 外部 API 返回空数据');
      return [];
    }

    // 支持 { addresses: [...] } 或 { blacklist: [...] } 或直接数组
    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (Array.isArray(data.addresses)) {
      rawList = data.addresses;
    } else if (Array.isArray(data.blacklist)) {
      rawList = data.blacklist;
    } else if (Array.isArray(data.data)) {
      rawList = data.data;
    } else {
      console.error('[Error] 外部 API 返回数据格式不识别');
      return [];
    }

    // 清洗外部数据
    const cleaned = cleanAndDedupe(rawList, 'EXTERNAL_LIST');
    console.log(`[Info] 外部数据拉取成功：原始 ${rawList.length} 条，清洗后 ${cleaned.length} 条`);
    return cleaned;
  } catch (e) {
    if (e.code === 'ECONNABORTED' || e.name === 'AbortError') {
      console.error('[Error] 外部 API 请求超时或被中断');
    } else if (e.response) {
      console.error(`[Error] 外部 API 错误: HTTP ${e.response.status}`);
    } else {
      console.error(`[Error] 外部 API 请求失败: ${e.message}`);
    }
    return [];
  } finally {
    // 确保清理 timeout，防止事件监听器/定时器泄漏
    clearTimeout(timeoutHandle);
  }
}

// ==================== 主索引构建 ====================

/**
 * 构建主索引：合并黑名单 + 灰名单 + 外部列表，去重
 * 同一地址出现在多个来源时，合并 tags
 * @param {Array} blacklist
 * @param {Array} graylist
 * @param {Array} externalList
 * @returns {Object} { master, dedupedBlacklist }
 */
function buildMasterIndex(blacklist, graylist, externalList) {
  const master = new Map(); // normalizedAddr -> entry

  /**
   * 合并/插入一条记录
   */
  function upsert(item, defaultList) {
    if (!item || typeof item.address !== 'string') return;
    const norm = normalize(item.address);
    if (!norm) return;

    if (master.has(norm)) {
      // 合并 tags、保留更严重的 list 等级
      const existing = master.get(norm);
      const tagSet = new Set([...(existing.tags || []), ...(item.tags || [])]);
      existing.tags = Array.from(tagSet);
      // black > gray，不降级
      if (existing.list === 'gray' && defaultList === 'black') {
        existing.list = 'black';
      }
      // 记录多个来源
      if (!existing.sources.includes(item.source || 'Unknown')) {
        existing.sources.push(item.source || 'Unknown');
      }
    } else {
      master.set(norm, {
        address: norm,
        entity: item.entity || 'Unknown',
        tags: Array.from(new Set(item.tags || [])),
        list: defaultList,
        sources: [item.source || 'Unknown'],
        reason: item.reason || '',
      });
    }
  }

  for (const item of blacklist) upsert(item, 'black');
  for (const item of graylist) upsert(item, 'gray');
  for (const item of externalList) upsert(item, 'black');

  // 转为数组，按地址排序保证输出稳定
  const masterArray = Array.from(master.values()).sort((a, b) =>
    a.address.localeCompare(b.address)
  );

  // 去重后的黑名单（合并外部数据后，与内置黑名单去重）
  const dedupedBlacklist = masterArray.filter((e) => e.list === 'black');
  const dedupedGraylist = masterArray.filter((e) => e.list === 'gray');

  return { master: masterArray, dedupedBlacklist, dedupedGraylist };
}

// ==================== 工具函数 ====================

/**
 * 写入 JSON 文件（原子写：先写临时文件再 rename，防止半写状态）
 * @param {string} filename
 * @param {*} data
 */
function writeJson(filename, data) {
  const filePath = path.join(OUTPUT_DIR, filename);
  const tmpPath = filePath + '.tmp';
  const jsonStr = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(tmpPath, jsonStr, 'utf8');
    fs.renameSync(tmpPath, filePath);
    console.log(`[OK] 已写入 ${filename} (${jsonStr.length} bytes)`);
  } catch (e) {
    // 清理临时文件
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    console.error(`[Error] 写入 ${filename} 失败: ${e.message}`);
    throw e;
  }
}

// ==================== 主函数 ====================

async function main() {
  console.log('========================================');
  console.log('  FidesOrigin 链上风险地址数据库生成器');
  console.log('========================================');
  console.log(`[Info] 输出目录: ${OUTPUT_DIR}`);
  console.log(`[Info] 内置黑名单（清洗后）: ${BUILT_IN_BLACKLIST.length} 条`);
  console.log(`[Info] 内置灰名单（清洗后）: ${BUILT_IN_GRAYLIST.length} 条`);

  // 拉取外部数据
  const externalList = await fetchExternalList();
  console.log(`[Info] 外部黑名单（清洗后）: ${externalList.length} 条`);

  // 构建主索引（内部去重）
  const { master, dedupedBlacklist, dedupedGraylist } = buildMasterIndex(
    BUILT_IN_BLACKLIST,
    BUILT_IN_GRAYLIST,
    externalList
  );

  console.log(`[Info] 主索引去重后总数: ${master.length}`);
  console.log(`[Info] 去重后黑名单: ${dedupedBlacklist.length}`);
  console.log(`[Info] 去重后灰名单: ${dedupedGraylist.length}`);

  // 输出 1: 黑名单（已去重，合并外部数据）
  const blacklistOutput = dedupedBlacklist.map((e) => ({
    address: e.address,
    entity: e.entity,
    tags: e.tags,
    sources: e.sources,
    reason: e.reason,
  }));
  writeJson('sanctions-blacklist.json', {
    generatedAt: new Date().toISOString(),
    description: 'OFAC sanctions / hacker / theft addresses (deduplicated)',
    count: blacklistOutput.length,
    addresses: blacklistOutput,
  });

  // 输出 2: 灰名单
  const graylistOutput = dedupedGraylist.map((e) => ({
    address: e.address,
    entity: e.entity,
    tags: e.tags,
    sources: e.sources,
    reason: e.reason,
  }));
  writeJson('sanctions-graylist.json', {
    generatedAt: new Date().toISOString(),
    description: 'High-risk / suspicious addresses (deduplicated)',
    count: graylistOutput.length,
    addresses: graylistOutput,
  });

  // 输出 3: 完整主索引（去重）
  writeJson('address-labels-master.json', {
    generatedAt: new Date().toISOString(),
    description: 'Master index of all labeled addresses (deduplicated, merged)',
    totalUnique: master.length,
    blacklistCount: dedupedBlacklist.length,
    graylistCount: dedupedGraylist.length,
    addresses: master,
  });

  // 输出 4: 统计报告
  // 修复：totalBlacklist 使用去重后的数量，避免虚高
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      builtInBlacklist: BUILT_IN_BLACKLIST.length,
      builtInGraylist: BUILT_IN_GRAYLIST.length,
      externalFetched: externalList.length,
      totalBlacklist: dedupedBlacklist.length,   // 修复：使用去重后数量
      totalGraylist: dedupedGraylist.length,
      totalUnique: master.length,                // 全局去重后总数
    },
    duplicatesRemoved: {
      builtinBlacklistDuplicates:
        BUILT_IN_BLACKLIST_RAW.length - BUILT_IN_BLACKLIST.length,
      builtinGraylistDuplicates:
        BUILT_IN_GRAYLIST_RAW.length - BUILT_IN_GRAYLIST.length,
      crossSourceDuplicates:
        BUILT_IN_BLACKLIST.length +
        BUILT_IN_GRAYLIST.length +
        externalList.length -
        master.length,
    },
    sources: Array.from(
      new Set([
        ...BUILT_IN_BLACKLIST.map((e) => e.source),
        ...BUILT_IN_GRAYLIST.map((e) => e.source),
        ...externalList.map((e) => e.source),
      ])
    ),
    outputFiles: [
      'sanctions-blacklist.json',
      'sanctions-graylist.json',
      'address-labels-master.json',
      'labels-report.json',
    ],
  };
  writeJson('labels-report.json', report);

  console.log('========================================');
  console.log('[Done] 数据库生成完成');
  console.log('========================================');
}

// ==================== 执行 ====================

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[Fatal] 未捕获的错误: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
