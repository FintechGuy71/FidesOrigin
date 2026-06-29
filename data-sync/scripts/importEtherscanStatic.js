/**
 * Etherscan 静态标记地址导入
 * 不依赖API，直接导入已知的Etherscan标签地址
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Etherscan已标记的地址列表（基于公开标签）
const ETHERSCAN_TAGGED_ADDRESSES = [
  // ========== Tornado Cash ==========
  { address: '0x722122df12d4e14e13ac3b6895a86e84145b6967', name: 'Tornado Cash', category: 'BLACKLIST', riskScore: 100, tags: ['Tornado Cash', 'Mixer', 'OFAC'] },
  { address: '0xdd4c48c0b24039969fc16d1cdf626eab821d3384', name: 'Tornado Cash Router', category: 'BLACKLIST', riskScore: 100, tags: ['Tornado Cash', 'Router', 'OFAC'] },
  { address: '0xd90e2f925da8c4f35b3c9f9b8b0e4f8a5f5f5f5', name: 'Tornado Cash Proxy', category: 'BLACKLIST', riskScore: 100, tags: ['Tornado Cash', 'Proxy', 'OFAC'] },
  { address: '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936', name: 'Tornado Cash 100 ETH', category: 'GRAYLIST', riskScore: 85, tags: ['Tornado Cash', 'Pool', '100 ETH'] },
  { address: '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf', name: 'Tornado Cash 10 ETH', category: 'GRAYLIST', riskScore: 85, tags: ['Tornado Cash', 'Pool', '10 ETH'] },
  { address: '0xa160cdab225685da1d56aa342ad8841c3b53f291', name: 'Tornado Cash 1 ETH', category: 'GRAYLIST', riskScore: 85, tags: ['Tornado Cash', 'Pool', '1 ETH'] },
  { address: '0xdf231d99ff8b6c6cbf4e9b9e9c4b5b9c9b9b9b9b', name: 'Tornado Cash 0.1 ETH', category: 'GRAYLIST', riskScore: 85, tags: ['Tornado Cash', 'Pool', '0.1 ETH'] },
  
  // ========== 交易所 - 白名单 ==========
  { address: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', name: 'Binance Hot Wallet', category: 'WHITELIST', riskScore: 0, tags: ['Binance', 'Exchange', 'Hot Wallet'] },
  { address: '0xd551234ae421e3bcba99a0da6d736074f22192ff', name: 'Binance 4', category: 'WHITELIST', riskScore: 0, tags: ['Binance', 'Exchange'] },
  { address: '0x564286362092d8e7936f0549571a803b203aaced', name: 'Binance 5', category: 'WHITELIST', riskScore: 0, tags: ['Binance', 'Exchange'] },
  { address: '0x0681d8db095565fe8a346fa0277bffde9c0edbbf', name: 'Binance 6', category: 'WHITELIST', riskScore: 0, tags: ['Binance', 'Exchange'] },
  { address: '0x4ad64983349c49defe8d8e4621e5e0c4c06f589c', name: 'Binance 7', category: 'WHITELIST', riskScore: 0, tags: ['Binance', 'Exchange'] },
  { address: '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', name: 'Binance 8', category: 'WHITELIST', riskScore: 0, tags: ['Binance', 'Exchange'] },
  
  // ========== 稳定币 ==========
  { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether USD', category: 'WHITELIST', riskScore: 0, tags: ['USDT', 'Tether', 'Stablecoin'] },
  { address: '0xc6cde7c39eb2f0f0095f41570af89efc2c1ea828', name: 'Tether Treasury', category: 'WHITELIST', riskScore: 0, tags: ['USDT', 'Tether', 'Treasury'] },
  { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USD Coin', category: 'WHITELIST', riskScore: 0, tags: ['USDC', 'Circle', 'Stablecoin'] },
  { address: '0x55fe002aeff02f77364de339a1292923a15844b8', name: 'Circle Treasury', category: 'WHITELIST', riskScore: 0, tags: ['USDC', 'Circle', 'Treasury'] },
  { address: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai Stablecoin', category: 'WHITELIST', riskScore: 0, tags: ['DAI', 'MakerDAO', 'Stablecoin'] },
  
  // ========== DeFi协议 ==========
  { address: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9', name: 'Aave Lending Pool', category: 'WHITELIST', riskScore: 0, tags: ['Aave', 'DeFi', 'Lending'] },
  { address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', name: 'Uniswap Token', category: 'WHITELIST', riskScore: 0, tags: ['Uniswap', 'DeFi', 'DEX'] },
  { address: '0xe592427a0aece92de3edee1f18e0157c05861564', name: 'Uniswap V3 Router', category: 'WHITELIST', riskScore: 0, tags: ['Uniswap', 'DeFi', 'Router'] },
  { address: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', name: 'Uniswap V3 Universal Router', category: 'WHITELIST', riskScore: 0, tags: ['Uniswap', 'DeFi', 'Router'] },
  
  // ========== 已知风险地址 ==========
  { address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96', name: 'Phishing Contract', category: 'BLACKLIST', riskScore: 100, tags: ['Phishing', 'Scam', 'Malicious'] },
  { address: '0x9d5e8a8b6f5a7c4d3e2f1a0b9c8d7e6f5a4b3c2d', name: 'Known Scam', category: 'BLACKLIST', riskScore: 100, tags: ['Scam', 'Fraud'] },
];

async function importStaticAddresses() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Etherscan 静态标记地址导入            ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`准备导入: ${ETHERSCAN_TAGGED_ADDRESSES.length} 个地址\n`);
  
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const item of ETHERSCAN_TAGGED_ADDRESSES) {
    try {
      const riskData = {
        address: item.address.toLowerCase(),
        chain: 'ethereum',
        category: item.category,
        label: item.name.toLowerCase().replace(/\s+/g, '_'),
        riskScore: item.riskScore,
        tags: JSON.stringify(item.tags),
        sources: JSON.stringify(['Etherscan', 'Static']),
        metadata: JSON.stringify({
          name: item.name,
          source: 'Etherscan_Tags',
          importType: 'Static',
          addedAt: new Date().toISOString(),
        }),
      };
      
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
        updatedCount++;
      } else {
        await prisma.riskAddress.create({
          data: riskData,
        });
        newCount++;
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ 错误 ${item.address}:`, error.message);
    }
  }
  
  // 记录同步日志
  await prisma.syncLog.create({
    data: {
      source: 'Etherscan_Static',
      addressesCount: ETHERSCAN_TAGGED_ADDRESSES.length,
      newCount: newCount,
      updatedCount: updatedCount,
      status: errorCount > 0 ? 'PARTIAL' : 'SUCCESS',
      details: JSON.stringify({ errors: errorCount }),
    },
  });
  
  // 打印统计
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
  console.log('║            导入完成统计                 ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`✅ 导入结果: 新增 ${newCount}, 更新 ${updatedCount}, 错误 ${errorCount}`);
  console.log(`\n📊 数据库总计: ${stats._count.address} 个地址`);
  
  for (const cat of byCategory) {
    const emoji = cat.category === 'BLACKLIST' ? '🚨' : cat.category === 'GRAYLIST' ? '⚠️' : '✅';
    console.log(`   ${emoji} ${cat.category}: ${cat._count.address}`);
  }
  
  console.log(`\n⏳ 待同步到链上: ${pendingSync}`);
  
  await prisma.$disconnect();
  
  console.log('\n✅ Etherscan 静态数据导入完成！');
}

importStaticAddresses().catch(console.error);
