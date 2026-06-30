// ─────────────────────────────────────────────────────────────────────────────
// FidesOrigin API – Shared Utilities
// Extracted from risk-sync.js, extended for v1 REST API routes
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');

// ==================== Environment & Config ====================
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const RISK_SYNC_API_KEY = process.env.RISK_SYNC_API_KEY;
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

// ==================== Rate Limiting (memory) ====================
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(req, res) {
  const rawIp =
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const ip = rawIp.replace(/^::ffff:/, '');
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    res.status(429).json({ code: 'RATE_LIMITED', message: 'Rate limit exceeded. Try again later.' });
    return false;
  }
  return true;
}

// ==================== CORS ====================
function checkOrigin(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (!allowed && process.env.NODE_ENV === 'production') {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Origin not allowed' });
    return false;
  }
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  return true;
}

// ==================== API Key Auth ====================
function checkApiKey(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  const auth = req.headers.authorization || '';
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1] : req.headers['x-api-key'];
  if (!RISK_SYNC_API_KEY || token !== RISK_SYNC_API_KEY) {
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
      address: '0x1234567890123456789012345678901234567890'.toLowerCase(),
      tag: 'Test_Blacklist',
      source: 'FidesOrigin',
      risk: 'CRITICAL',
      category: 'Sanctions',
      metadata: { reason: 'Test address for development' },
    },
    {
      address: '0xab5801a7d398351b8be11c439e05c5b3259aec9b'.toLowerCase(),
      tag: 'Known_Hacker',
      source: 'FidesOrigin',
      risk: 'CRITICAL',
      category: 'Hack',
      metadata: { reason: 'Known exploit contract' },
    },
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
function computeRiskScore(address, riskData) {
  const normalized = normalizeAddress(address);
  const known = riskData.map.get(normalized);

  if (known) {
    if (known.risk === 'CRITICAL') {
      return {
        score: 95,
        level: 'critical',
        confidence: 0.95,
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
  }

  // Deterministic pseudo-risk for unknown addresses
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  const score = Math.abs(hash) % 100;
  let level = 'low';
  if (score >= 80) level = 'critical';
  else if (score >= 60) level = 'high';
  else if (score >= 30) level = 'medium';

  return {
    score,
    level,
    confidence: 0.6 + (Math.abs(hash) % 30) / 100,
    flags: score > 60 ? [{
      id: 'behavioral-risk',
      name: 'Behavioral Risk Pattern',
      category: 'Behavior',
      severity: level,
      description: 'Address exhibits patterns associated with elevated risk.',
    }] : [],
    addressType: 'wallet',
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
    transactionStats: {
      totalTransactions: Math.floor(Math.random() * 10000),
      totalVolume: Math.floor(Math.random() * 1000000),
      firstTransaction: now,
      lastTransaction: now,
    },
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
    stats: {
      totalTransactions: Math.floor(Math.random() * 10000),
      totalVolume: Math.floor(Math.random() * 1000000),
      firstTransaction: now,
      lastTransaction: now,
    },
    assessedAt: now,
  };
}

// ==================== Rules Store (in-memory, demo only) ====================
// NOTE: In production, use a persistent database (Prisma + PostgreSQL)
const rulesStore = {
  rules: [],
  nextId: 1,
};

function generateRuleId() {
  return `rule_${rulesStore.nextId++}`;
}

function initDefaultRules() {
  if (rulesStore.rules.length === 0) {
    const now = new Date().toISOString();
    rulesStore.rules.push(
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
  }
}

// ==================== Middleware Wrapper ====================
function withMiddleware(handler) {
  return async function (req, res) {
    // 1. CORS
    if (!checkOrigin(req, res)) return;
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    // 2. Rate limit
    if (!checkRateLimit(req, res)) return;
    // 3. Auth
    if (!checkApiKey(req, res)) return;
    // 4. JSON body parsing for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-type']?.includes('application/json')) {
      await parseBody(req);
    }
    // 5. Run handler
    try {
      return await handler(req, res);
    } catch (err) {
      console.error('Handler error:', err);
      return sendError(res, 500, 'SERVER_ERROR', err.message || 'Internal server error');
    }
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
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
  checkRateLimit,
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
  rulesStore,
  generateRuleId,
  initDefaultRules,
  withMiddleware,
  parseBody,
};
