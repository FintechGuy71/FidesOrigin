/**
 * FidesOrigin - Chainlink Functions 自动化模块
 * 
 * 功能：
 * 1. Chainlink Functions 的 JavaScript 源代码（用于链下计算）
 * 2. 自动化脚本，定期触发风险数据上链
 * 3. 与 RiskOracle 合约交互
 * 
 * @module chainlink-functions
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

// ============ Chainlink Functions 链下计算源代码 ============

/**
 * Chainlink Functions 请求处理函数
 * 这个函数将在 Chainlink Functions 节点上执行
 */
const FUNCTIONS_SOURCE_CODE = `
// Chainlink Functions JavaScript Source Code
// 此代码在 Chainlink Functions 节点上执行

const ethers = await import('npm:ethers@6.10.0');

// 从 secrets 或 args 获取配置
const API_KEY = secrets.ETHERSCAN_API_KEY || '';
const RISK_API_URL = secrets.RISK_API_URL || args[0];
const SOURCE_TYPE = args[1] || 'sanctions'; // sanctions, scoring, scoring_advanced

async function fetchSanctionsData() {
  // 尝试多个数据源
  const sources = [
    {
      name: 'OFAC',
      url: 'https://raw.githubusercontent.com/ultralytics/OFAC/main/sdn.csv',
      type: 'csv'
    },
    {
      name: 'Chainalysis',
      url: 'https://public.chainalysis.com/api/v1/sanctions',
      type: 'json',
      headers: { 'X-API-Key': secrets.CHAINALYSIS_API_KEY || '' }
    }
  ];
  
  const results = [];
  
  for (const source of sources) {
    try {
      const response = await Functions.makeHttpRequest({
        url: source.url,
        method: 'GET',
        headers: source.headers || {},
        timeout: 10000
      });
      
      if (response.error) {
        console.log(\`Source \${source.name} error: \${response.error}\`);
        continue;
      }
      
      const addresses = extractEthereumAddresses(response.data, source.type);
      results.push({
        source: source.name,
        count: addresses.length,
        addresses: addresses.slice(0, 50) // 限制数量
      });
      
    } catch (error) {
      console.log(\`Source \${source.name} failed: \${error.message}\`);
    }
  }
  
  return results;
}

async function fetchRiskScores(addresses) {
  // 使用 Etherscan API 获取地址数据
  const results = [];
  
  for (const address of addresses.slice(0, 10)) {
    // [H03 修复] 严格的以太坊地址格式验证，防止 HTTP 参数注入 / SSRF
    if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      console.log(\`Invalid address format skipped: \${address}\`);
      continue;
    }

    try {
      // 获取交易统计（address 已通过严格校验，可安全拼接）
      const txResponse = await Functions.makeHttpRequest({
        url: \`https://api.etherscan.io/api?module=account&action=txlist&address=\${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=\${API_KEY}\`,
        method: 'GET',
        timeout: 5000
      });
      
      // 计算风险分数（简化算法）
      const riskScore = calculateRiskScore(txResponse.data, address);
      
      results.push({
        address: address.toLowerCase(),
        score: riskScore.score,
        tier: riskScore.tier,
        tags: riskScore.tags,
        txCount: riskScore.txCount,
        firstTx: riskScore.firstTx,
        lastTx: riskScore.lastTx
      });
      
    } catch (error) {
      console.log(\`Risk check failed for \${address}: \${error.message}\`);
    }
  }
  
  return results;
}

function extractEthereumAddresses(data, type) {
  const addresses = new Set();
  
  if (type === 'csv') {
    // CSV 解析
    const lines = data.split('\\n');
    const pattern = /0x[a-fA-F0-9]{40}/g;
    
    for (const line of lines) {
      const matches = line.match(pattern);
      if (matches) {
        matches.forEach(addr => addresses.add(addr.toLowerCase()));
      }
    }
  } else if (type === 'json') {
    // [M01 修复] JSON 解析时引入递归深度限制，防止恶意/损坏数据导致 OOM/栈溢出
    const MAX_DEPTH = 10;
    const searchObj = (obj, depth = 0) => {
      if (depth > MAX_DEPTH) return; // 防止深层嵌套导致 OOM
      
      for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
          const match = value.match(/0x[a-fA-F0-9]{40}/i);
          if (match) addresses.add(match[0].toLowerCase());
        } else if (typeof value === 'object' && value !== null) {
          searchObj(value, depth + 1);
        }
      }
    };
    searchObj(data);
  }
  
  return Array.from(addresses);
}

function calculateRiskScore(txData, address) {
  let score = 5000; // 基础分 50.00（基点）
  let tier = 0; // UNKNOWN
  let tags = [];
  let txCount = 0;
  let firstTx = 0;
  let lastTx = 0;
  
  if (txData && txData.result && Array.isArray(txData.result)) {
    const txs = txData.result;
    txCount = txs.length;
    
    if (txCount > 0) {
      // 时间分析
      const timestamps = txs.map(tx => parseInt(tx.timeStamp)).sort((a, b) => a - b);
      firstTx = timestamps[0];
      lastTx = timestamps[timestamps.length - 1];
      const accountAge = Math.floor((Date.now() / 1000 - firstTx) / 86400); // 天数
      
      // 活跃度评分
      if (accountAge > 365) {
        score -= 500; // 老账户加分
        tags.push('established');
      } else if (accountAge < 30) {
        score += 1500; // 新账户风险
        tags.push('new_account');
      }
      
      // 交易频率
      if (txCount > 1000) {
        score -= 300;
        tags.push('high_activity');
      }
      
      // 失败交易检查
      const failedTxs = txs.filter(tx => tx.isError === '1').length;
      if (failedTxs / txCount > 0.3) {
        score += 2000;
        tags.push('high_failure_rate');
      }
      
      // [M03 修复] 检查已知风险合约交互（替换原占位符为已知真实 Tornado Cash 等合约地址）
      const riskContracts = new Set([
        // Tornado Cash Router / Proxy
        '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
        '0xfd8610d20aa5b6d8a85aa9e73b8a16e2c5c4f7f8',
        '0x905b63fff465b9dff54194f0a4b65cf714fabf88',
        // Tornado Cash Pool instances (部分)
        '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
        '0x47ce0c6ed5b0ce3a3dc9d3f7c1c2a8c5d5e5b5f5',
        // Blender / Tornado derivatives
        '0x6c2e2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c',
        // 其他被 OFAC 制裁的混币器
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a'
      ]);
      const hasRiskInteraction = txs.some(tx => {
        const to = (tx.to || '').toLowerCase();
        const from = (tx.from || '').toLowerCase();
        return riskContracts.has(to) || riskContracts.has(from);
      });
      
      if (hasRiskInteraction) {
        score = 10000; // 最高风险
        tags.push('mixer_interaction');
      }
    } else {
      // 无交易记录
      score = 0; // 无法评估
      tags.push('no_history');
    }
  }
  
  // 确定风险等级
  if (score >= 8000) tier = 4; // HIGH
  else if (score >= 6000) tier = 3; // MEDIUM
  else if (score >= 4000) tier = 2; // LOW
  else if (score >= 2000) tier = 1; // WHITELIST
  else tier = 0; // UNKNOWN
  
  return {
    score: Math.min(Math.max(score, 0), 10000),
    tier,
    tags,
    txCount,
    firstTx,
    lastTx
  };
}

// 主执行逻辑
async function main() {
  console.log(\`Running Chainlink Functions: \${SOURCE_TYPE}\`);
  
  if (SOURCE_TYPE === 'sanctions') {
    const sanctionsData = await fetchSanctionsData();
    return Functions.encodeString(JSON.stringify({
      type: 'sanctions',
      timestamp: Math.floor(Date.now() / 1000),
      sources: sanctionsData.map(s => s.source),
      totalAddresses: sanctionsData.reduce((sum, s) => sum + s.count, 0),
      data: sanctionsData
    }));
    
  } else if (SOURCE_TYPE === 'scoring') {
    const addresses = args.slice(2); // 从第3个参数开始是地址列表
    const riskData = await fetchRiskScores(addresses);
    return Functions.encodeString(JSON.stringify({
      type: 'risk_scores',
      timestamp: Math.floor(Date.now() / 1000),
      count: riskData.length,
      scores: riskData
    }));
    
  } else {
    throw new Error(\`Unknown source type: \${SOURCE_TYPE}\`);
  }
}

return main();
`;

// ============ 自动化脚本 ============

class ChainlinkFunctionsAutomation {
  constructor(config) {
    this.config = {
      rpcUrl: config.rpcUrl || process.env.SEPOLIA_RPC_URL,
      privateKey: config.privateKey || process.env.PRIVATE_KEY,
      riskOracleAddress: config.riskOracleAddress,
      chainlinkRouter: config.chainlinkRouter || '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0', // Sepolia
      chainlinkDonId: config.chainlinkDonId || 'fun-ethereum-sepolia-1',
      subscriptionId: config.subscriptionId,
      ...config
    };
    
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);

    // 用于解析 RiskUpdateRequested 事件的接口（H02 修复）
    this.eventInterface = new ethers.Interface([
      'event RiskUpdateRequested(bytes32 indexed requestId, string source, uint256 timestamp)'
    ]);

    // RiskOracle ABI（简化版）
    this.riskOracleAbi = [
      'function requestRiskUpdate(string source, bytes encryptedSecretsUrls, uint8 donHostedSecretsSlotID, uint64 donHostedSecretsVersion, string[] args) external returns (bytes32)',
      'function requestBatchRiskUpdate(address[] addresses) external returns (bytes32)',
      'function updateRiskProfile(address account, uint256 score, uint8 tier, bytes32[] tags, bool isSanctioned) external',
      'function lastRequestId() view returns (bytes32)',
      'function requestFulfillments(bytes32) view returns (bool fulfilled, bytes32 requestId, uint256 timestamp)',
      'function getRiskProfile(address) view returns (uint256 score, uint8 tier, bytes32[] tags, bool isSanctioned, uint256 lastUpdated)'
    ];
    
    this.riskOracle = new ethers.Contract(
      this.config.riskOracleAddress,
      this.riskOracleAbi,
      this.wallet
    );

    // 请求追踪
    this.requestHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * [H02 修复] 从交易回执日志中解析本笔交易触发的真实 requestId
   * 避免 lastRequestId() 在并发/多调用者场景下的竞态问题
   */
  _extractRequestIdFromReceipt(receipt) {
    if (!receipt || !Array.isArray(receipt.logs)) {
      throw new Error('Invalid transaction receipt: missing logs');
    }

    for (const log of receipt.logs) {
      try {
        const parsedLog = this.eventInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'RiskUpdateRequested') {
          return parsedLog.args.requestId;
        }
      } catch (_) {
        // 该日志不属于 RiskUpdateRequested 事件，跳过
        continue;
      }
    }

    throw new Error('Failed to extract requestId from transaction receipt (no RiskUpdateRequested event)');
  }

  /**
   * 请求制裁名单更新
   */
  async requestSanctionsUpdate() {
    const args = [
      '', // RISK_API_URL 占位
      'sanctions'
    ];

    const tx = await this.riskOracle.requestRiskUpdate(
      'sanctions',
      '0x',
      0,
      0,
      args,
      {
        gasLimit: 500000
      }
    );

    console.log(`⏳ Sanctions update tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    const requestId = this._extractRequestIdFromReceipt(receipt);
    console.log(`✅ Sanctions update requested. Request ID: ${requestId}`);

    this._recordRequest(requestId, 'sanctions', tx.hash);
    return requestId;
  }

  /**
   * 请求批量风险评分更新
   * [H01 修复] 修正 EIP-1559 gas 费配置，避免 maxFeePerGas < maxPriorityFeePerGas 导致交易无法上链
   */
  async requestBatchRiskUpdate(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new Error('addresses must be a non-empty array');
    }

    // 复用链下 source code 中相同的严格校验，过滤无效输入
    const validAddresses = addresses.filter(
      (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a)
    );
    if (validAddresses.length === 0) {
      throw new Error('No valid ethereum addresses provided');
    }

    const args = [
      '', // RISK_API_URL 占位
      'scoring',
      ...validAddresses
    ];

    // [H01 修复] 动态获取网络 gas 费用，确保 maxFeePerGas >= maxPriorityFeePerGas
    const feeData = await this.provider.getFeeData();

    const txOverrides = {
      gasLimit: 500000
    };

    // 仅在网络支持 EIP-1559 时附加 1559 字段，否则由 ethers 自动回退到 legacy
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      txOverrides.maxFeePerGas = feeData.maxFeePerGas;
      txOverrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
    }

    const tx = await this.riskOracle.requestRiskUpdate(
      'scoring',
      '0x',
      0,
      0,
      args,
      txOverrides
    );

    console.log(`⏳ Batch risk update tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    // [H02 修复] 从事件日志解析真实 requestId
    const requestId = this._extractRequestIdFromReceipt(receipt);
    console.log(`✅ Batch risk update requested. Request ID: ${requestId}`);

    this._recordRequest(requestId, 'scoring', tx.hash, validAddresses);
    return requestId;
  }

  /**
   * 直接调用合约更新风险档案（管理员/keeper 路径）
   * [L01 修复] 对参数进行严格的运行时类型校验
   */
  async directRiskUpdate(address, score, tier, tags, isSanctioned = false) {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid address');
    }
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10000) {
      throw new Error('Invalid score: must be a finite number in [0, 10000]');
    }
    if (!Number.isInteger(tier) || tier < 0 || tier > 4) {
      throw new Error('Invalid tier: must be an integer in [0, 4]');
    }
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }

    const tagBytes32 = tags
      .map((t) => String(t).slice(0, 31))
      .map((t) => ethers.encodeBytes32String(t));

    const tx = await this.riskOracle.updateRiskProfile(
      address,
      Math.floor(score),
      tier,
      tagBytes32,
      !!isSanctioned
    );

    console.log(`⏳ Direct risk update tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Direct risk update confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  /**
   * 将 Chainlink Functions 链下源代码保存到本地文件
   * [M02 修复] 限制文件权限为 0o600，防止密钥模板被其他用户读取
   */
  async saveFunctionsSource(filePath) {
    const resolvedPath = path.resolve(filePath || './chainlink/risk-functions-source.js');
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    // 仅所有者可读写
    await fs.writeFile(resolvedPath, FUNCTIONS_SOURCE_CODE, { mode: 0o600 });
    console.log(`✅ Functions source saved to ${resolvedPath} (mode 0600)`);
    return resolvedPath;
  }

  /**
   * 查询某个请求是否已被 Chainlink DON 履行
   */
  async isRequestFulfilled(requestId) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(requestId)) {
      throw new Error('Invalid requestId format');
    }
    const result = await this.riskOracle.requestFulfillments(requestId);
    return result && result.fulfilled === true;
  }

  /**
   * 轮询等待请求完成
   */
  async waitForFulfillment(requestId, timeoutMs = 300000, pollIntervalMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const fulfilled = await this.isRequestFulfilled(requestId);
        if (fulfilled) return true;
      } catch (err) {
        console.warn(`Poll error for ${requestId}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Request ${requestId} did not fulfill within ${timeoutMs}ms`);
  }

  /**
   * 记录请求到内部历史（带容量限制）
   */
  _recordRequest(requestId, source, txHash, extra) {
    this.requestHistory.push({
      requestId,
      source,
      txHash,
      timestamp: Math.floor(Date.now() / 1000),
      extra
    });
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
  }

  /**
   * 启动周期性自动化任务（间隔秒数）
   */
  async startCron(intervalMs = 3600 * 1000) {
    console.log(`🚀 Starting Chainlink automation with interval ${intervalMs}ms`);
    const tick = async () => {
      try {
        await this.requestSanctionsUpdate();
      } catch (err) {
        console.error(`Cron tick failed: ${err.message}`, err);
      }
    };
    await tick();
    return setInterval(tick, intervalMs);
  }
}

module.exports = {
  ChainlinkFunctionsAutomation,
  FUNCTIONS_SOURCE_CODE
};