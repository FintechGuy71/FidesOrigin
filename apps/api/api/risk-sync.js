const https = require('https');

// 配置
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
if (!ETHERSCAN_API_KEY) {
  throw new Error('ETHERSCAN_API_KEY environment variable is required');
}
const CACHE_TTL = 3600;

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
  console.warn('⚠️ RISK_SYNC_API_KEY not set. API authentication is disabled in development mode only.');
}

function checkOrigin(req, res) {
  // [High Fix] Use strict equality instead of startsWith to prevent bypass like fidesorigin.com.evil.com
  const origin = req.headers.origin || req.headers.referer || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (!allowed && process.env.NODE_ENV === 'production') {
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

function checkApiKey(req, res) {
  if (process.env.NODE_ENV !== 'production') return true; // 开发环境跳过
  const key = req.headers['x-api-key'];
  if (!RISK_SYNC_API_KEY || key !== RISK_SYNC_API_KEY) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    return false;
  }
  return true;
}

// ==================== 速率限制（内存版，生产环境建议用 Redis）====================
const requestCounts = new Map(); // IP -> { count, resetTime }
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分钟
const RATE_LIMIT_MAX = 60; // 每分钟60请求

function checkRateLimit(req, res) {
  // [High Fix] More robust IP extraction — prefer Vercel's x-real-ip, validate format
  const rawIp = req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  // Strip IPv6 prefix from IPv4-mapped addresses
  const ip = rawIp.replace(/^::ffff:/, '');
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    return false;
  }
  return true;
}

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

// 内存缓存（仅当 KV 不可用时）- 带TTL清理
let memoryCache = null;
let cacheLastCleaned = Date.now();
const CACHE_CLEAN_INTERVAL = 3600000; // 1小时清理一次

function cleanupExpiredCache() {
  const now = Date.now();
  if (memoryCache && (now - memoryCache.timestamp) > CACHE_TTL * 1000) {
    memoryCache = null;
  }
  // [High Fix] Also prune expired entries from rate limit map to prevent memory leak
  for (const [key, val] of requestCounts.entries()) {
    if (now > val.resetTime) {
      requestCounts.delete(key);
    }
  }
  cacheLastCleaned = now;
}

// 定期清理
setInterval(cleanupExpiredCache, CACHE_CLEAN_INTERVAL);


// HTTP请求工具 - 带超时和重试
function httpGet(url, headers = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (remainingRetries) => {
      const req = https.get(url, { headers, timeout: 15000 }, (res) => {
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
    console.error('Metamask fetch error:', error);
    return [];
  }
}

// 2. 预设地址
function getPresetAddresses() {
  return [
    {
      address: '0x1234567890123456789012345678901234567890',
      tag: 'Test_Blacklist',
      source: 'FidesOrigin',
      risk: 'CRITICAL',
      category: 'Sanctions',
      metadata: { reason: 'Test address for development' }
    },
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
  
  // 2. 速率限制
  if (!checkRateLimit(req, res)) return;
  
  // 3. API Key 认证（仅生产环境）
  if (!checkApiKey(req, res)) return;
  
  // 4. 强制刷新参数
  const forceRefresh = req.query?.refresh === 'true';
  
  // 定期清理内存缓存，防止泄漏
  cleanupExpiredCache();
  
  // 5. 检查缓存
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
    } else if (memoryCache && (now - memoryCache.timestamp) < CACHE_TTL * 1000) {
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
      source: 'live',
      fetchedAt: new Date(now).toISOString(),
      data: result
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
};
