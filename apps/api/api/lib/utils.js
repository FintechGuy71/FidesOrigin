// ─────────────────────────────────────────────────────────────────────────────
// FidesOrigin API – Shared Utilities
// Extracted from risk-sync.js, extended for v1 REST API routes
//
// [H-4/H-5 FIX R2-FULL] 鉴权与存储重构：
//   1. 显式 AUTH_REQUIRED 配置替代 NODE_ENV 嗅探（原实现非 production 即全放行）
//   2. API Key 按作用域分级：RISK_SYNC_API_KEY（只读）/ RULES_ADMIN_API_KEY（读写），
//      服务端强制执行——原实现读写共用同一把静态 Key，前端"只读 key"约定无技术强制
//   3. 规则存储接入 Vercel KV（无 KV 时降级内存并显式警告）——原实现为纯内存，
//      serverless 多实例下规则随机丢失/互不可见
//   4. CORS：无 Origin 头的服务端客户端（curl/SDK）放行，凭 API Key 鉴权——
//      原实现生产环境对一切非浏览器请求 403，与服务端 SDK 集成直接矛盾
//   5. 限流统一走 middleware/rateLimit.js（Redis 后端）——原 v1 端点使用
//      实例本地内存限流，多实例下形同虚设
//   6. IP 提取默认仅信任 TCP 对端地址；TRUST_PROXY=true 时才信任代理头
//      （原实现客户端可伪造 x-real-ip / x-forwarded-for 无限绕过限流）
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

// ==================== Environment & Config ====================
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const RISK_SYNC_API_KEY = process.env.RISK_SYNC_API_KEY;       // 只读作用域
const RULES_ADMIN_API_KEY = process.env.RULES_ADMIN_API_KEY;   // 读写作用域（规则管理）

// [H-5 FIX] 显式鉴权开关：默认开启。设 AUTH_REQUIRED=false 可在本地开发关闭
// （会打印显著警告）。不再依赖 NODE_ENV 隐式判定。
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== 'false';

// [M-12 FIX] 代理头信任开关：默认不信任（仅取 TCP 对端地址）。
// 部署在已知会剥离/覆写客户端代理头的平台（Vercel 等）时可设 TRUST_PROXY=true。
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

const CACHE_TTL = 3600; // seconds
const KNOWN_CHAIN_IDS = new Set([
  1, 10, 25, 56, 137, 250, 42161, 43114, 8453, 7777777, 324, 59144, 5000, 42220, 33139,
  5, 11155111, 80001, 421613, 84532, 17000, 1440002,
]);
const CHAIN_ID_TO_NAME = {
  1: 'ethereum', 10: 'optimism', 56: 'bsc', 137: 'polygon',
  42161: 'arbitrum', 8453: 'base', 324: 'zksync', 59144: 'linea',
};
const ALLOWED_ORIGINS = [
  'https://fidesorigin.com',
  'https://www.fidesorigin.com',
  'https://admin.fidesorigin.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

if (!AUTH_REQUIRED) {
  console.warn(
    '⚠️ [SECURITY] AUTH_REQUIRED=false — 所有端点（含规则写操作）当前无鉴权。' +
    '仅限本地开发；切勿在生产部署中设置该值。'
  );
}
if (AUTH_REQUIRED && !RISK_SYNC_API_KEY) {
  console.warn('⚠️ RISK_SYNC_API_KEY not set — read-scope authentication will fail.');
}
if (AUTH_REQUIRED && !RULES_ADMIN_API_KEY) {
  console.warn(
    '⚠️ RULES_ADMIN_API_KEY not set — rules write operations will be rejected ' +
    'in authenticated mode (fail-closed).'
  );
}

// ==================== CORS ====================
/**
 * [M-11 FIX] Origin 校验语义修正：
 *   - 无 Origin/Referer 头（服务端 SDK、curl、移动端）→ 放行，鉴权交给 API Key
 *   - 有 Origin 头（浏览器）→ 白名单校验，跨站浏览器请求拒绝
 * 原实现把"无 Origin"当作不允许来源，生产环境 403 在鉴权之前执行，
 * 导致服务端 SDK 集成完全不可用。
 */
function checkOrigin(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return true; // 非浏览器客户端：由 API Key 鉴权

  const allowed = ALLOWED_ORIGINS.some(
    (allowedOrigin) => origin === allowedOrigin || origin.startsWith(allowedOrigin + '/')
  );
  if (!allowed) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Origin not allowed' });
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  return true;
}

// ==================== API Key Auth (scoped) ====================
// [F-19 FIX R2 + H-4 FIX] 常数时间比较 + 作用域分级
function _timingSafeEqualStr(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

const SCOPE = {
  READ: 'read',
  WRITE: 'write',
  // 公开只读通道：免 key，仅用于显式声明为 public 的端点；
  // 保护由 CORS 白名单 + 全局限流 + 端点内自带的更严限流 + GET-only 组成
  PUBLIC: 'public',
};

function _extractToken(req) {
  const auth = req.headers.authorization || '';
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  return bearerMatch ? bearerMatch[1] : req.headers['x-api-key'];
}

/**
 * [H-4 FIX] 作用域化鉴权：
 *   READ  → RISK_SYNC_API_KEY 或 RULES_ADMIN_API_KEY（管理 Key 天然可读）
 *   WRITE → 仅 RULES_ADMIN_API_KEY
 * 原实现读写共用 RISK_SYNC_API_KEY：只读 key 一旦从前端/SDK 泄露即可篡改全部合规规则。
 */
function checkApiKey(req, res, requiredScope = SCOPE.READ) {
  if (!AUTH_REQUIRED) return true;
  // 公开只读通道：免 key。仅允许显式声明 SCOPE.PUBLIC 的端点使用；
  // 端点自身必须强制 GET-only 并施加更严的限流
  if (requiredScope === SCOPE.PUBLIC) return true;

  const token = _extractToken(req);
  if (!token) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing API key' });
    return false;
  }

  if (requiredScope === SCOPE.WRITE) {
    if (!RULES_ADMIN_API_KEY || !_timingSafeEqualStr(token, RULES_ADMIN_API_KEY)) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Admin API key required for write operations' });
      return false;
    }
    return true;
  }

  const isReadKey = RISK_SYNC_API_KEY && _timingSafeEqualStr(token, RISK_SYNC_API_KEY);
  const isAdminKey = RULES_ADMIN_API_KEY && _timingSafeEqualStr(token, RULES_ADMIN_API_KEY);
  if (!isReadKey && !isAdminKey) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or missing API key' });
    return false;
  }
  return true;
}

// ==================== Input Validation ====================
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function normalizeAddress(address) {
  return address.toLowerCase();
}

function isValidChainId(chainId) {
  if (chainId === undefined || chainId === null) return false;
  const id = Number(chainId);
  if (!Number.isInteger(id) || id <= 0 || id > 0xffffffff) return false;
  return true;
}

function getChainName(chainId) {
  return CHAIN_ID_TO_NAME[Number(chainId)] || 'ethereum';
}

// ==================== Error Helpers ====================
function sendError(res, status, code, message, details) {
  const body = { code, message };
  if (details) body.details = details;
  return res.status(status).json(body);
}

// ==================== HTTP GET Helper ====================
const https = require('https');
function httpGet(url, headers = {}, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const req = https.get(url, { headers, timeout: 15000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
      req.on('error', (err) => {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 1000);
        } else {
          reject(err);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 1000);
        } else {
          reject(new Error('Timeout after retries'));
        }
      });
    };
    attempt(retries);
  });
}

// ==================== Data Sources ====================
async function fetchMetamaskPhishing() {
  try {
    const data = await httpGet(
      'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json'
    );
    if (data.blacklist && Array.isArray(data.blacklist)) {
      return data.blacklist
        .filter((addr) => addr.startsWith('0x') && addr.length === 42)
        .map((addr) => ({
          address: addr.toLowerCase(),
          tag: 'Phishing',
          source: 'Metamask',
          risk: 'HIGH',
          category: 'Phishing',
          metadata: { list: 'eth-phishing-detect' },
        }));
    }
    return [];
  } catch (error) {
    console.error('Metamask fetch error:', error.message);
    return [];
  }
}

function getPresetAddresses() {
  return [
    {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7'.toLowerCase(),
      tag: 'USDT_Contract',
      source: 'FidesOrigin',
      risk: 'WHITELIST',
      category: 'Token',
      metadata: { reason: 'Official USDT contract' },
    },
  ];
}

// In-memory cache for risk data
let _riskDataCache = null;
let _riskDataFetchedAt = 0;

async function getRiskData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _riskDataCache && now - _riskDataFetchedAt < CACHE_TTL * 1000) {
    return _riskDataCache;
  }
  const [metamask, presets] = await Promise.allSettled([fetchMetamaskPhishing(), Promise.resolve(getPresetAddresses())]);
  const all = [
    ...(metamask.status === 'fulfilled' ? metamask.value : []),
    ...(presets.status === 'fulfilled' ? presets.value : []),
  ];
  const map = new Map();
  const riskPriority = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0, WHITELIST: -1 };
  all.forEach((item) => {
    const addr = item.address.toLowerCase();
    const existing = map.get(addr);
    if (!existing || (riskPriority[item.risk] || 0) > (riskPriority[existing.risk] || 0)) {
      map.set(addr, item);
    }
  });
  _riskDataCache = { map, list: Array.from(map.values()) };
  _riskDataFetchedAt = now;
  return _riskDataCache;
}

// ==================== Risk Assessment Engine ====================
/**
 * [M-13 FIX] 移除伪造评分：
 * 原实现对未知地址返回 `hash(address) % 100` 的伪风险分与编造的交易统计，
 * 调用方若未检查 heuristicEstimate 字段会基于噪声做出 block/allow 决策。
 * 修复：未知地址显式返回 level='unknown'、score=0、confidence=0，
 * 不再输出任何虚构数值；已知地址的真实名单数据保持不变。
 */
function computeRiskScore(address, riskData) {
  const normalized = normalizeAddress(address);
  const known = riskData.map.get(normalized);

  if (!known) {
    return {
      score: 0,
      level: 'unknown',
      confidence: 0,
      knownAddress: false,
      flags: [{
        id: 'no-profile',
        name: 'No Risk Profile',
        category: 'Data',
        severity: 'info',
        description: 'Address is not present in any configured risk data source. No assessment can be made.',
      }],
      addressType: 'unknown',
    };
  }

  if (known.risk === 'CRITICAL') {
    return {
      score: 95,
      level: 'critical',
      confidence: 0.95,
      knownAddress: true,
      flags: [{
        id: 'known-critical',
        name: known.tag,
        category: known.category,
        severity: 'critical',
        description: known.metadata?.reason || 'Known critical risk address',
        metadata: known.metadata,
      }],
      addressType: known.category === 'Token' ? 'contract' : 'wallet',
    };
  }
  if (known.risk === 'HIGH') {
    return {
      score: 85,
      level: 'high',
      confidence: 0.9,
      knownAddress: true,
      flags: [{
        id: 'known-high',
        name: known.tag,
        category: known.category,
        severity: 'high',
        description: known.metadata?.reason || 'Known high risk address',
        metadata: known.metadata,
      }],
      addressType: 'wallet',
    };
  }
  if (known.risk === 'WHITELIST') {
    return {
      score: 5,
      level: 'low',
      confidence: 0.99,
      knownAddress: true,
      flags: [{
        id: 'whitelisted',
        name: known.tag,
        category: known.category,
        severity: 'low',
        description: known.metadata?.reason || 'Verified safe address',
        metadata: known.metadata,
      }],
      addressType: 'contract',
    };
  }

  return {
    score: 0,
    level: 'unknown',
    confidence: 0,
    knownAddress: false,
    flags: [],
    addressType: 'unknown',
  };
}

function buildRiskCheckResult(address, chainId, riskData) {
  const chain = getChainName(chainId);
  const assessment = computeRiskScore(address, riskData);
  const now = new Date().toISOString();
  return {
    address: normalizeAddress(address),
    chain,
    overallScore: assessment.score,
    overallLevel: assessment.level,
    knownAddress: assessment.knownAddress,
    scores: [
      { score: assessment.score, level: assessment.level, confidence: assessment.confidence, category: 'overall' },
    ],
    flags: assessment.flags,
    addressType: assessment.addressType,
    timestamp: now,
    relatedEntities: assessment.flags.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      riskLevel: f.severity,
      description: f.description,
    })),
    // [M-13 FIX] 未知地址不再返回编造的交易统计；真实统计数据待接入
    // 链上索引（Blockscout/subgraph）后填充
    transactionStats: assessment.knownAddress ? null : null,
  };
}

function buildAddressRisk(address, chainId, riskData) {
  const chain = getChainName(chainId);
  const assessment = computeRiskScore(address, riskData);
  const now = new Date().toISOString();
  return {
    address: normalizeAddress(address),
    chain,
    type: assessment.addressType,
    risk: {
      score: assessment.score,
      level: assessment.level,
      confidence: assessment.confidence,
      knownAddress: assessment.knownAddress,
      category: 'overall',
    },
    flags: assessment.flags,
    entities: assessment.flags.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      riskLevel: f.severity,
      description: f.description,
    })),
    // [M-13 FIX] 不再输出编造统计（原实现：hash % 10000 的伪交易数/伪交易量）
    stats: null,
    assessedAt: now,
  };
}

// ==================== Rules Store (KV-backed, memory fallback) ====================
// [H-5 FIX] 规则存储接入 Vercel KV：
// 原实现为模块级内存对象——serverless 多实例下新建规则随机丢失、
// 互不可见，且实例回收后重置为默认规则。持久化优先 Vercel KV
// （@vercel/kv 已在 risk-sync.js 使用），未配置时降级内存并显著警告。
const RULES_KV_KEY = 'fidesorigin:rules:v1';
const RULES_KV_ID_KEY = 'fidesorigin:rules:nextid:v1';

let _kv = null;
try {
  const { kv } = require('@vercel/kv');
  _kv = kv;
} catch {
  // @vercel/kv 未安装 — 内存降级
}

const memoryRulesStore = {
  rules: [],
  nextId: 1,
};

if (!_kv) {
  console.warn(
    '⚠️ [RULES] @vercel/kv unavailable — rules store falls back to in-memory. ' +
    'In serverless deployments rules will NOT persist across invocations/instances. ' +
    'Configure Vercel KV (KV_REST_API_URL / KV_REST_API_TOKEN) for production.'
  );
}

function generateRuleId() {
  const id = memoryRulesStore.nextId;
  memoryRulesStore.nextId += 1;
  return `rule_${id}`;
}

async function _loadRules() {
  if (_kv) {
    try {
      const rules = await _kv.get(RULES_KV_KEY);
      if (Array.isArray(rules)) {
        memoryRulesStore.rules = rules;
      }
      const nextId = await _kv.get(RULES_KV_ID_KEY);
      if (Number.isInteger(nextId) && nextId > memoryRulesStore.nextId) {
        memoryRulesStore.nextId = nextId;
      }
    } catch (err) {
      console.error('[RULES] KV load failed, using memory snapshot:', err.message);
    }
  }
  return memoryRulesStore.rules;
}

async function _persistRules() {
  if (_kv) {
    try {
      await _kv.set(RULES_KV_KEY, memoryRulesStore.rules);
      await _kv.set(RULES_KV_ID_KEY, memoryRulesStore.nextId);
    } catch (err) {
      console.error('[RULES] KV persist failed:', err.message);
    }
  }
}

async function getRules() {
  return _loadRules();
}

async function addRule(rule) {
  await _loadRules();
  memoryRulesStore.rules.push(rule);
  await _persistRules();
  return rule;
}

async function updateRule(id, mutator) {
  await _loadRules();
  const idx = memoryRulesStore.rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = mutator(memoryRulesStore.rules[idx]);
  await _persistRules();
  return updated;
}

async function deleteRule(id) {
  await _loadRules();
  const idx = memoryRulesStore.rules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  memoryRulesStore.rules.splice(idx, 1);
  await _persistRules();
  return true;
}

// [H-5 FIX R3] 默认规则初始化改为 KV 感知的异步流程：
// 原实现仅检查实例内存（冷实例必为空），导致每个冷启动都把 3 条默认规则
// 异步写回 KV，覆盖已持久化的自定义规则（与 deleteRule 的 _loadRules 竞态）。
async function initDefaultRules() {
  await _loadRules();
  if (memoryRulesStore.rules.length === 0) {
    const now = new Date().toISOString();
    memoryRulesStore.rules.push(
      {
        id: generateRuleId(),
        name: 'Block Critical Risk Addresses',
        description: 'Automatically block transactions to addresses with critical risk score',
        status: 'active',
        priority: 100,
        conditions: [
          { field: 'risk.score', operator: 'greater_than', value: 90 },
        ],
        actions: [
          { type: 'block', params: { reason: 'Critical risk score exceeded' } },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateRuleId(),
        name: 'Flag High Risk for Review',
        description: 'Flag transactions to high risk addresses for manual review',
        status: 'active',
        priority: 50,
        conditions: [
          { field: 'risk.score', operator: 'greater_than', value: 70 },
        ],
        actions: [
          { type: 'review', params: { reason: 'High risk address requires review' } },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateRuleId(),
        name: 'Allow Whitelisted Addresses',
        description: 'Allow all transactions to known safe addresses',
        status: 'active',
        priority: 200,
        conditions: [
          { field: 'risk.level', operator: 'equals', value: 'low' },
        ],
        actions: [
          { type: 'allow', params: { reason: 'Known safe address' } },
        ],
        createdAt: now,
        updatedAt: now,
      }
    );
    // 默认规则仅在存储为空时初始化（首次启动），持久化交给下一次写操作或显式调用
    _persistRules().catch(() => {});
  }
}

// ==================== Middleware Wrapper ====================
// [M-12 FIX] 限流统一使用 middleware/rateLimit.js（Redis 后端 + 内存降级）。
// 该模块为惰性加载：v1 端点与 risk-sync 共享同一实现与配置。
let _rateLimit;
function getRateLimiter() {
  if (!_rateLimit) {
    try {
      _rateLimit = require('../middleware/rateLimit');
    } catch {
      _rateLimit = null;
    }
  }
  return _rateLimit;
}

function withMiddleware(handler, requiredScope = SCOPE.READ) {
  return async function (req, res) {
    // 1. CORS（浏览器来源校验；服务端客户端放行）
    if (!checkOrigin(req, res)) return;
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    // 2. Rate limit（Redis 后端统一实现）
    const limiter = getRateLimiter();
    if (limiter) {
      const allowed = await limiter.checkRateLimit(req, res);
      if (!allowed) return;
    }
    // 3. Auth（作用域分级）
    if (!checkApiKey(req, res, requiredScope)) return;
    // 4. JSON body parsing for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-type']?.includes('application/json')) {
      await parseBody(req);
    }
    // 5. Run handler
    try {
      return await handler(req, res);
    } catch (err) {
      // 校验类错误映射为 400（而非笼统 500）
      if (err && (err.name === 'ValidationError' || err.statusCode === 400)) {
        return sendError(res, 400, 'BAD_REQUEST', err.message || 'Invalid request');
      }
      console.error('Handler error:', err);
      return sendError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error');
    }
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit [SEC-FIX]
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        return reject(new Error('Request body too large'));
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }
      resolve();
    });
    req.on('error', reject);
  });
}

// ==================== Exports ====================
module.exports = {
  ALLOWED_ORIGINS,
  SCOPE,
  checkOrigin,
  checkApiKey,
  isValidEthereumAddress,
  normalizeAddress,
  isValidChainId,
  getChainName,
  sendError,
  httpGet,
  fetchMetamaskPhishing,
  getPresetAddresses,
  getRiskData,
  computeRiskScore,
  buildRiskCheckResult,
  buildAddressRisk,
  getRules,
  addRule,
  updateRule,
  deleteRule,
  generateRuleId,
  initDefaultRules,
  withMiddleware,
  parseBody,
};
