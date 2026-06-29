// FidesOrigin Admin 核心配置文件
// 网络配置、合约地址、API 端点
// [安全修复] Critical: 合约地址零占位符 → 环境变量 + 启动校验
// [安全修复] High: API Key/Subgraph ID 硬编码 → 环境变量注入
// [安全修复] High: 配置对象可变 → 深度冻结 + 原型链保护

// ==================== 安全加载 dotenv（仅 Node.js） ====================

if (typeof require !== 'undefined') {
  try {
    require('dotenv').config();
  } catch (_e) {
    /* dotenv 未安装时忽略（如前端打包场景） */
  }
}

// ==================== 环境变量读取（兼容 Node.js / 浏览器打包） ====================

const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {};

// ==================== [Critical] 合约地址校验 ====================

/**
 * 校验合约地址非零且格式合法
 * @param {string} addr - 合约地址
 * @param {string} networkName - 网络名称（用于错误提示）
 * @returns {string} 校验通过的地址
 */
function validateContractAddress(addr, networkName) {
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  if (!addr || addr === ZERO_ADDRESS) {
    throw new Error(
      `[CONFIG FATAL] ${networkName} 合约地址未配置（仍为零地址占位符）。\n` +
      `请通过环境变量 ${networkName.toUpperCase()}_CONTRACT_ADDR 注入真实地址后再启动。\n` +
      `继续使用零地址将导致资金永久丢失且不可逆。`
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error(`[CONFIG FATAL] ${networkName} 合约地址格式非法: ${addr}`);
  }

  return addr;
}

// ==================== [Critical] 必需环境变量校验 ====================

const REQUIRED_ENV = [
  'SEPOLIA_CONTRACT_ADDR',
  'MAINNET_CONTRACT_ADDR',
  'ALCHEMY_API_KEY',
  'SUBGRAPH_ID'
];

const _missing = REQUIRED_ENV.filter((key) => !ENV[key]);
if (_missing.length > 0) {
  throw new Error(
    `[BOOTSTRAP FATAL] 以下必需环境变量未配置，拒绝启动:\n` +
    _missing.map((k) => `  - ${k}`).join('\n') +
    `\n请复制 .env.example 为 .env 并填入真实值。`
  );
}

// ==================== [High] 从环境变量注入敏感配置 ====================

const SEPOLIA_CONTRACT_ADDR = validateContractAddress(
  ENV.SEPOLIA_CONTRACT_ADDR,
  'sepolia'
);

const MAINNET_CONTRACT_ADDR = validateContractAddress(
  ENV.MAINNET_CONTRACT_ADDR,
  'mainnet'
);

const ALCHEMY_API_KEY = ENV.ALCHEMY_API_KEY;
const SUBGRAPH_ID = ENV.SUBGRAPH_ID;

// ==================== 配置对象 ====================

const CONFIG = {
  // 版本信息
  version: '0.4.0',
  network: 'sepolia',

  // 区块链网络配置
  networks: {
    sepolia: {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: 'https://rpc.sepolia.org',
      explorerUrl: 'https://sepolia.etherscan.io',
      contractAddress: SEPOLIA_CONTRACT_ADDR
    },
    mainnet: {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      explorerUrl: 'https://etherscan.io',
      contractAddress: MAINNET_CONTRACT_ADDR
    }
  },

  // API 配置
  api: {
    baseUrl: '/api/v1',
    timeout: 30000,
    retryAttempts: 3
  },

  // The Graph Subgraph 配置
  subgraph: {
    url: `https://api.studio.thegraph.com/query/${SUBGRAPH_ID}/fidesorigin/sepolia`,
    pollingInterval: 30000
  },

  // 风险等级配置
  riskLevels: {
    low: { min: 0, max: 30, color: '#22c55e', label: '低风险' },
    medium: { min: 30, max: 70, color: '#f59e0b', label: '中风险' },
    high: { min: 70, max: 100, color: '#ef4444', label: '高风险' }
  },

  // 标签配置
  tags: {
    vip: { color: '#f59e0b', label: 'VIP' },
    normal: { color: '#22c55e', label: '普通' },
    grey: { color: '#94a3b8', label: '灰名单' },
    black: { color: '#ef4444', label: '黑名单' },
    admin: { color: '#8b5cf6', label: '管理员' },
    operator: { color: '#06b6d4', label: '操作员' }
  },

  // 限额默认配置 (TUSD)
  limits: {
    vip: { daily: 100000, single: 50000 },
    normal: { daily: 10000, single: 5000 },
    grey: { daily: 1000, single: 500 },
    black: { daily: 0, single: 0 }
  },

  // 时间锁配置
  timelock: {
    minDelay: 86400, // 1天 (秒)
    maxDelay: 2592000, // 30天 (秒)
    gracePeriod: 1209600 // 14天 (秒)
  },

  // 多签配置
  multisig: {
    required: 2, // 需要签名数
    total: 3 // 总签名者数
  },

  // 缓存配置
  cache: {
    riskScoreTTL: 300, // 5分钟
    transactionTTL: 300,
    addressTTL: 600 // 10分钟
  },

  // 告警配置
  alerts: {
    cooldownPeriod: 300, // 5分钟冷却期
    maxAlertsPerHour: 10
  }
};

// ==================== [High] 深度冻结 — 不可变性保护 ====================

/**
 * 递归冻结对象所有层级，防止运行时篡改
 * （防止 prototype pollution 等攻击静默修改合约地址等关键参数）
 * @param {object} obj - 待冻结对象
 * @returns {object} 冻结后的对象
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

// 应用深度冻结
deepFreeze(CONFIG);

// 防止原型链污染
if (CONFIG.__proto__) {
  Object.freeze(CONFIG.__proto__);
}
try {
  Object.freeze(Object.prototype);
} catch (_e) {
  /* 某些环境可能已冻结 */
}

// ==================== 导出配置 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}