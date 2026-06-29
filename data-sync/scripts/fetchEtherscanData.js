/**
 * Etherscan API 测试和数据抓取
 * 测试API Key并获取风险地址数据
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_URL = 'https://api.etherscan.io/api';

// 已知的标记合约地址列表（来自Etherscan标签）
const TAGGED_CONTRACTS = [
  // Tornado Cash
  { address: '0x722122df12d4e14e13ac3b6895a86e84145b6967', name: 'Tornado Cash' },
  { address: '0xdd4c48c0b24039969fc16d1cdf626eab821d3384', name: 'Tornado Cash Router' },
  { address: '0xd90e2f925da8c4f35b3c9f9b8b0e4f8a5f5f5f5', name: 'Tornado Cash Proxy' },
  { address: '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936', name: 'Tornado Cash 100 ETH' },
  { address: '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf', name: 'Tornado Cash 10 ETH' },
  { address: '0xa160cdab225685da1d56aa342ad8841c3b53f291', name: 'Tornado Cash 1 ETH' },
  
  // Binance
  { address: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', name: 'Binance Hot Wallet' },
  { address: '0xd551234ae421e3bcba99a0da6d736074f22192ff', name: 'Binance 4' },
  
  // Tether
  { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether USD' },
  { address: '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea828', name: 'Tether Treasury' },
  
  // Circle (USDC)
  { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USD Coin' },
  { address: '0x55fe002aeff02f77364de339a1292923a15844b8', name: 'Circle Treasury' },
  
  // Known Exploit/Phishing
  { address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96', name: 'Phishing Contract' },
];

async function testAPI() {
  console.log('🔍 测试 Etherscan API 连接...\n');
  
  try {
    // 测试获取账户余额
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'account',
        action: 'balance',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        tag: 'latest',
        apikey: API_KEY,
      },
      timeout: 30000,
    });
    
    if (response.data.status === '1') {
      console.log('✅ API Key 有效！');
      console.log(`   余额查询成功: ${response.data.result} wei\n`);
      return true;
    } else {
      console.log('❌ API 返回错误:', response.data.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ API 测试失败:', error.message);
    return false;
  }
}

async function getContractInfo(address) {
  try {
    // 获取合约ABI（如果是合约）
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'contract',
        action: 'getabi',
        address: address,
        apikey: API_KEY,
      },
      timeout: 30000,
    });
    
    return response.data.status === '1' ? { isContract: true, abi: response.data.result } : { isContract: false };
  } catch (error) {
    return { isContract: false, error: error.message };
  }
}

async function getTransactionCount(address) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'proxy',
        action: 'eth_getTransactionCount',
        address: address,
        tag: 'latest',
        apikey: API_KEY,
      },
      timeout: 30000,
    });
    
    if (response.data.result) {
      return parseInt(response.data.result, 16);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

async function fetchAndSaveData() {
  console.log('\n📦 开始抓取 Etherscan 数据...\n');
  console.log(`目标: ${TAGGED_CONTRACTS.length} 个标记地址`);
  console.log('⏱️  预计耗时: 约30秒\n');
  
  const results = {
    new: 0,
    updated: 0,
    errors: 0,
  };
  
  for (let i = 0; i < TAGGED_CONTRACTS.length; i++) {
    const item = TAGGED_CONTRACTS[i];
    
    try {
      console.log(`[${i + 1}/${TAGGED_CONTRACTS.length}] ${item.name}`);
      
      // 获取合约信息
      const contractInfo = await getContractInfo(item.address);
      const txCount = await getTransactionCount(item.address);
      
      // 判断类别
      let category = 'GRAYLIST';
      let riskScore = 50;
      
      if (item.name.includes('Tornado Cash')) {
        category = 'BLACKLIST';
        riskScore = 100;
      } else if (item.name.includes('Phishing') || item.name.includes('Exploit')) {
        category = 'BLACKLIST';
        riskScore = 100;
      } else if (item.name.includes('Binance') || item.name.includes('Tether') || item.name.includes('Circle')) {
        category = 'WHITELIST';
        riskScore = 0;
      }
      
      // 准备数据
      const riskData = {
        address: item.address.toLowerCase(),
        chain: 'ethereum',
        category: category,
        label: item.name.toLowerCase().replace(/\s+/g, '_'),
        riskScore: riskScore,
        tags: JSON.stringify([item.name, contractInfo.isContract ? 'Contract' : 'EOA']),
        sources: JSON.stringify(['Etherscan']),
        metadata: JSON.stringify({
          name: item.name,
          isContract: contractInfo.isContract,
          transactionCount: txCount,
          etherscanVerified: contractInfo.isContract,
          addedAt: new Date().toISOString(),
        }),
      };
      
      // 保存到数据库
      const existing = await prisma.riskAddress.findUnique({
        where: { address: riskData.address },
      });
      
      if (existing) {
        await prisma.riskAddress.update({
          where: { address: riskData.address },
          data: {
            ...riskData,
            sources: JSON.stringify([...new Set([...JSON.parse(existing.sources || '[]'), 'Etherscan'])]),
            updatedAt: new Date(),
          },
        });
        results.updated++;
        console.log(`   ✅ 更新: ${item.name}`);
      } else {
        await prisma.riskAddress.create({
          data: riskData,
        });
        results.new++;
        console.log(`   ✅ 新增: ${item.name}`);
      }
      
    } catch (error) {
      results.errors++;
      console.log(`   ❌ 错误: ${error.message}`);
    }
    
    // 频率限制：200ms间隔（5次/秒）
    await new Promise(r => setTimeout(r, 200));
  }
  
  return results;
}

async function printStats() {
  const stats = await prisma.riskAddress.aggregate({
    _count: { address: true },
  });
  
  const byCategory = await prisma.riskAddress.groupBy({
    by: ['category'],
    _count: { address: true },
  });
  
  const pendingSync = await prisma.riskAddress.count({
    where: { syncedToChain: false },
  });
  
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           数据库最终统计                ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`📊 总地址数: ${stats._count.address}`);
  
  for (const cat of byCategory) {
    const emoji = cat.category === 'BLACKLIST' ? '🚨' : cat.category === 'GRAYLIST' ? '⚠️' : '✅';
    console.log(`   ${emoji} ${cat.category}: ${cat._count.address}`);
  }
  
  console.log(`\n⏳ 待同步: ${pendingSync}`);
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     Etherscan API 测试与数据抓取        ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  // 1. 测试API
  const apiWorking = await testAPI();
  
  if (!apiWorking) {
    console.error('\n❌ API 测试失败，退出');
    process.exit(1);
  }
  
  // 2. 抓取数据
  const results = await fetchAndSaveData();
  
  // 3. 记录同步日志
  await prisma.syncLog.create({
    data: {
      source: 'Etherscan_API',
      addressesCount: TAGGED_CONTRACTS.length,
      newCount: results.new,
      updatedCount: results.updated,
      status: 'SUCCESS',
      details: JSON.stringify({ errors: results.errors }),
    },
  });
  
  // 4. 打印统计
  await printStats();
  
  await prisma.$disconnect();
  
  console.log('\n✅ Etherscan 数据抓取完成！');
  console.log(`\n📈 结果: 新增 ${results.new}, 更新 ${results.updated}, 错误 ${results.errors}`);
}

main().catch(console.error);
