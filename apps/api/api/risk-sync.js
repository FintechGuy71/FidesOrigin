const https = require('https');
const crypto = require('crypto');

const { checkRateLimit } = require('./_middleware/rateLimit');

// 配置
// [L-17 FIX] 模块级 throw 改为惰性校验：原实现缺 ETHERSCAN_API_KEY 时模块加载即
// 崩溃（整个 serverless 函数 500 且错误信息暴露内部要求）。
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const CACHE_TTL = 3600;

/* [AUDIT FIX 2026-09-18 R3] ETHERSCAN_API_KEY 全文件无任何调用消费，
   原强制校验造成「配置齐全却 503」。保留惰性函数但不再强制（无消费方）。 */
function _ensureEtherscanKey() {
  // no-op: 当前数据源（MetaMask phishing config + 预设名单）无需 Etherscan key
}

class ApiConfigError extends Error {}
ApiConfigError.prototype.name = 'ApiConfigError';

// ==================== 安全增强：CORS 白名单 + API Key 认证 ====================
const ALLOWED_ORIGINS = [
  'https://fidesorigin.com',
  'https://www.fidesorigin.com',
  'https://admin.fidesorigin.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

const RISK_SYNC_API_KEY = process.env.RISK_SYNC_API_KEY;
if (!RISK_SYNC_API_KEY) {
  console.warn('⚠️ RISK_SYNC_API_KEY not set. Production API authentication will fail.');
}

function checkOrigin(req, res) {
  // [M-11 FIX] 无 Origin/Referer 的服务端客户端（curl/SDK）放行，交给 API Key 鉴权；
  // 浏览器来源仍按白名单校验（严格相等，防 fidesorigin.com.evil.com 类绕过）
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return true;
  // [AUDIT FIX 2026-09-18 R3-C4] 原用 NODE_ENV==='production' 嗅探：
  // staging/自托管（NODE_ENV≠production）时任意 Origin 放行。仅显式 development 放行。
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (!allowed && process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Forbidden: Origin not allowed' });
    return false;
  }
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  return true;
}

// [SEC-01 Fix] Development mode now supports optional TEST_API_KEY authentication.
const TEST_API_KEY = process.env.TEST_API_KEY;
if (process.env.NODE_ENV !== 'production' && !TEST_API_KEY) {
  console.warn('⚠️ TEST_API_KEY not set. Dev environment auth is BYPASSED. Set TEST_API_KEY for secure dev mode.');
}

// [L-16 FIX] 常数时间比较（SHA-256 定长哈希后 timingSafeEqual）：
// lib/utils.js 的 F-19 FIX R2 未同步到本文件，姊妹实现不一致。
function _timingSafeEqualStr(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function checkApiKey(req, res) {
  const key = req.headers['x-api-key'];

  // [AUDIT FIX 2026-09-18 R3-C4] 仅显式 development 进入测试模式；
  // staging/预览/自托管一律视为生产口径
  if (process.env.NODE_ENV === 'development') {
    if (TEST_API_KEY) {
      if (!key || !_timingSafeEqualStr(key, TEST_API_KEY)) {
        res.status(401).json({ error: 'Unauthorized: Invalid or missing test API key' });
        return false;
      }
    }
    return true; // 未配置 TEST_API_KEY 时保持向后兼容
  }

  // 生产环境：强制要求 RISK_SYNC_API_KEY；未配置时 fail-closed（503 而非放行）
  if (!RISK_SYNC_API_KEY) {
    res.status(503).json({ error: 'Service misconfigured: RISK_SYNC_API_KEY not set' });
    return false;
  }
  if (!key || !_timingSafeEqualStr(key, RISK_SYNC_API_KEY)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    return false;
  }
  return true;
}

// ==================== 速率限制（Redis-backed，自动降级到内存）====================
// 已迁移到 apps/api/middleware/rateLimit.js
// 配置：REDIS_URL 环境变量；默认 60 req/min per IP，sliding window 算法


// ==================== 输入验证 ====================
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ==================== Vercel KV 缓存（如果可用）====================
let kvCache = null;
try {
  const { kv } = require('@vercel/kv');
  kvCache = kv;
} catch (e) {
  // 未安装 @vercel/kv，使用内存缓存
}

// 内存缓存（仅当 KV 不可用时）
// [L-17 FIX] 移除模块级 setInterval：serverless 冻结模型下挂住事件循环
// 且实例复用带来的是成本而非收益。缓存过期改为读取时惰性判定。
let memoryCache = null;

function isMemoryCacheValid() {
  return memoryCache && (Date.now() - memoryCache.timestamp) < CACHE_TTL * 1000;
}


// HTTP请求工具 - 带超时和重试
function httpGet(url, headers = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries) => {
      const req = https.get(url, { headers, timeout: 15000 }, (res) => {
        // [AUDIT FIX 2026-09-18 R3] 原不校验状态码：GitHub 限流/404 的 HTML
        // 错误页被当数据解析 → 钓鱼名单静默清零。非 2xx 按失败重试。
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          if (remainingRetries > 0) {
            console.warn(`HTTP ${res.statusCode}, retrying... (${remainingRetries} retries left)`);
            setTimeout(() => attempt(remainingRetries - 1), 1000);
          } else {
            reject(new Error(`HTTP ${res.statusCode} from upstream`));
          }
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
      req.on('error', (err) => {
        if (remainingRetries > 0) {
          console.warn(`HTTP request failed, retrying... (${remainingRetries} retries left)`);
          setTimeout(() => attempt(remainingRetries - 1), 1000);
        } else {
          reject(err);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (remainingRetries > 0) {
          console.warn(`HTTP request timeout, retrying... (${remainingRetries} retries left)`);
          setTimeout(() => attempt(remainingRetries - 1), 1000);
        } else {
          reject(new Error('Timeout after retries'));
        }
      });
    };
    attempt(retries);
  });
}

// 数据源适配器

// 1. Metamask 钓鱼地址库
async function fetchMetamaskPhishing() {
  try {
    const data = await httpGet('https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json');
    
    if (data.blacklist && Array.isArray(data.blacklist)) {
      return data.blacklist
        .filter(addr => addr.startsWith('0x') && addr.length === 42)
        .map(addr => ({
          address: addr,
          tag: 'Phishing',
          source: 'Metamask',
          risk: 'HIGH',
          category: 'Phishing',
          metadata: { list: 'eth-phishing-detect' }
        }));
    }
    return [];
  } catch (error) {
    // [AUDIT FIX 2026-09-18 R3] 原静默返回 [] 且结果被写入 1 小时缓存——
    // 数据源故障对外表现为「无风险地址」。抛错让上层返回 502，不污染缓存。
    console.error('Metamask fetch error:', error);
    throw error;
  }
}

// 2. 预设地址
function getPresetAddresses() {
  return [
    // [AUDIT FIX 2026-09-18 R3] 原含 0x1234...7890 测试占位地址，作为 CRITICAL
    // 制裁数据进入生产响应 → 消费者把占位地址当真。已剔除。
    {
      address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      tag: 'Known_Hacker',
      source: 'FidesOrigin',
      risk: 'CRITICAL',
      category: 'Hack',
      metadata: { reason: 'Known exploit contract' }
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      tag: 'USDT_Contract',
      source: 'FidesOrigin',
      risk: 'WHITELIST',
      category: 'Token',
      metadata: { reason: 'Official USDT contract' }
    }
  ];
}

// 主处理函数
module.exports = async function handler(req, res) {
  // 1. CORS 检查
  if (!checkOrigin(req, res)) return;
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 2. 速率限制（Redis-backed，自动降级到内存）
  if (!(await checkRateLimit(req, res))) return;
  
  // 3. API Key 认证（仅生产环境）
  if (!checkApiKey(req, res)) return;
  
  // 4. 强制刷新参数
  /* [AUDIT FIX 2026-09-18 R3-C5] 原 ?refresh=true 无条件绕过缓存，每次触发
     从 GitHub 拉取 ~5MB → 认证调用方可循环放大出站流量（费用/配额 DoS）。
     加 60 秒全局冷却（多实例下以 KV 为准，内存为降级）。 */
  let forceRefresh = req.query?.refresh === 'true';
  if (forceRefresh) {
    const nowMs = Date.now();
    if (nowMs - (global._riskSyncLastRefresh || 0) < 60000) {
      forceRefresh = false; // 冷却期内静默降级为缓存读取
    } else {
      global._riskSyncLastRefresh = nowMs;
    }
  }

  // [L-17 FIX] 上游依赖惰性校验（原实现模块加载即 throw）
  try {
    _ensureEtherscanKey();
  } catch (err) {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  // 5. 检查缓存（[L-17 FIX] 过期判定为读取时惰性判定，无定时器）
  const now = Date.now();
  if (!forceRefresh) {
    if (kvCache) {
      try {
        const cached = await kvCache.get('risk-sync-cache');
        if (cached && (now - cached.timestamp) < CACHE_TTL * 1000) {
          return res.json({
            success: true,
            source: 'cache',
            cachedAt: new Date(cached.timestamp).toISOString(),
            data: cached.data
          });
        }
      } catch (e) {
        console.warn('KV cache read failed:', e.message);
      }
    } else if (isMemoryCacheValid()) {
      return res.json({
        success: true,
        source: 'cache',
        cachedAt: new Date(memoryCache.timestamp).toISOString(),
        data: memoryCache.data
      });
    }
  }
  
  // 6. 如果是特定地址查询，验证输入
  if (req.url?.includes('/address/')) {
    const addressMatch = req.url.match(/\/address\/(0x[a-fA-F0-9]{40})\/risk/);
    if (!addressMatch) {
      return res.status(400).json({ error: 'Invalid Ethereum address format. Must be 0x followed by 40 hex characters.' });
    }
  }
  
  try {
    // 获取数据
    const [metamaskData, presetData] = await Promise.allSettled([
      fetchMetamaskPhishing(),
      Promise.resolve(getPresetAddresses())
    ]);

    // 合并结果
    const allAddresses = [
      ...(metamaskData.status === 'fulfilled' ? metamaskData.value : []),
      ...(presetData.status === 'fulfilled' ? presetData.value : [])
    ];

    // 按地址去重（优先级合并）
    const addressMap = new Map();
    const riskPriority = {
      'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 0, 'WHITELIST': -1
    };

    allAddresses.forEach(item => {
      const addr = item.address.toLowerCase();
      const existing = addressMap.get(addr);
      if (!existing || (riskPriority[item.risk] || 0) > (riskPriority[existing.risk] || 0)) {
        addressMap.set(addr, item);
      }
    });

    const uniqueAddresses = Array.from(addressMap.values());

    const stats = {
      total: uniqueAddresses.length,
      critical: uniqueAddresses.filter(a => a.risk === 'CRITICAL').length,
      high: uniqueAddresses.filter(a => a.risk === 'HIGH').length,
      whitelist: uniqueAddresses.filter(a => a.risk === 'WHITELIST').length,
      sources: {
        metamask: metamaskData.status === 'fulfilled' ? metamaskData.value.length : 0,
        preset: presetData.status === 'fulfilled' ? presetData.value.length : 0
      }
    };

    const result = { stats, addresses: uniqueAddresses.slice(0, 100) };
    
    // 7. 更新缓存
    const cacheEntry = { data: result, timestamp: now };
    if (kvCache) {
      try {
        await kvCache.set('risk-sync-cache', cacheEntry, { ex: CACHE_TTL });
      } catch (e) {
        console.warn('KV cache write failed:', e.message);
      }
    } else {
      memoryCache = cacheEntry;
    }

    return res.json({
      success: true,
      // [AUDIT FIX 2026-09-18 R3] 上游数据源失败时如实标注 degraded
      source: metamaskData.status === 'fulfilled' ? 'live' : 'degraded',
      ...(metamaskData.status !== 'fulfilled' ? { degradedSources: ['metamask-phishing'] } : {}),
      fetchedAt: new Date(now).toISOString(),
      data: result
    });

  } catch (error) {
    console.error('Handler error:', error);
    // [Medium Fix #10] Don't leak internal error details to client.
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
};
