/**
 * Chainalysis API 测试和数据抓取脚本
 * 测试API连接并尽可能获取数据
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// 已知的潜在高风险地址列表（用于筛查）
const KNOWN_ADDRESSES = [
  // Tornado Cash — OFAC sanctioned (2022-08-08)
  '0x722122df12d4e14e13ac3b6895a86e84145b6967',
  '0x12d66f87a04a9e2207cec48758f6511208c6b5a3',
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
  '0x910cbd523d972eb0a6f4cae4618ad62622b39db2',
  '0xdd4c48c0b24039969fc16d1cdf626eab821d3384',
  '0xa160cdab225685da1d56a342b7840210e4115505',
  // Blender.io — OFAC sanctioned (2022-05-06)
  '0x1da5821544e25c636c1417ba96de4cf6d2f9b5a4',
  '0x2f389ce8bd8c8b68a5e32926dda3e29db752f0e8',
  // Lazarus Group / DPRK — OFAC sanctioned (2022-04-14)
  '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4d59',
  '0xe7aa314c7f4c79e3b231a5f6c3d94c2472f107b5',
  // Sinbad.io — OFAC sanctioned (2023-11-29)
  '0x7f367cc41522ce07553e823bf3be79a889debe1b',
  // 已知的其他高风险地址
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT Contract (reference)
];

class ChainalysisDataFetcher {
  constructor() {
    this.apiKey = process.env.CHAINALYSIS_API_KEY;
    // Chainalysis Sanctions Screening API (free tier)
    this.baseURL = 'https://api.chainalysis.com/api/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    
    // 频率限制：免费版 5000 requests / 5 minutes
    this.rateLimitDelay = 200; // 5 req/sec safe
    this.requestCount = 0;
  }

  /**
   * 测试API连接
   */
  async testConnection() {
    console.log('🔍 测试 Chainalysis API 连接...\n');
    
    try {
      // 使用一个已知地址测试
      const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
      
      const response = await this.client.post('/sanctions/screening', {
        address: testAddress,
        network: 'Ethereum',
      });
      
      console.log('✅ API 连接成功！');
      console.log('📊 API 响应示例:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('❌ API 连接失败:', error.message);
      if (error.response) {
        console.error('状态码:', error.response.status);
        console.error('响应:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * 筛查地址列表
   */
  async screenAddresses(addresses) {
    console.log(`\n📤 开始筛查 ${addresses.length} 个地址...`);
    console.log(`⏱️  预计耗时: ${Math.ceil(addresses.length * 1.1)} 秒\n`);
    
    const sanctionedAddresses = [];
    const errors = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      try {
        const result = await this.screenAddress(address);
        
        if (result && result.isSanctioned) {
          sanctionedAddresses.push(result);
          console.log(`✅ [${i + 1}/${addresses.length}] ${address.slice(0, 20)}... - 制裁名单！`);
        } else {
          console.log(`⭕ [${i + 1}/${addresses.length}] ${address.slice(0, 20)}... - 正常`);
        }
        
        this.requestCount++;
        
      } catch (error) {
        errors.push({ address, error: error.message });
        console.log(`❌ [${i + 1}/${addresses.length}] ${address.slice(0, 20)}... - 错误: ${error.message}`);
      }
      
      // 频率限制
      if (i < addresses.length - 1) {
        await this.sleep(this.rateLimitDelay);
      }
    }
    
    console.log(`\n📊 筛查完成:`);
    console.log(`   总请求: ${this.requestCount}`);
    console.log(`   制裁地址: ${sanctionedAddresses.length}`);
    console.log(`   错误: ${errors.length}`);
    
    return { sanctionedAddresses, errors };
  }

  /**
   * 筛查单个地址
   */
  async screenAddress(address) {
    try {
      const response = await this.client.post('/sanctions/screening', {
        address: address,
        network: 'Ethereum',
      });
      
      const data = response.data;
      
      // Chainalysis v1 response: { identifications: [...] }
      const ids = data.identifications || [];
      
      if (ids.length > 0) {
        return {
          address: address.toLowerCase(),
          chain: 'ethereum',
          category: 'BLACKLIST',
          label: 'sanctioned',
          riskScore: 100,
          isSanctioned: true,
          tags: JSON.stringify(ids.map(s => s.category || s.list || 'OFAC')),
          sources: JSON.stringify(['Chainalysis']),
          metadata: JSON.stringify({
            identifications: ids,
            screenedAt: new Date().toISOString(),
          }),
        };
      }
      
      return null; // 未被制裁
      
    } catch (error) {
      // 404 或 200 with empty = 未制裁
      if (error.response?.status === 404 || error.response?.status === 200) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 保存到数据库
   */
  async saveToDatabase(addresses) {
    console.log(`\n💾 保存 ${addresses.length} 个制裁地址到数据库...`);
    
    let newCount = 0;
    let updatedCount = 0;
    
    for (const addr of addresses) {
      try {
        const existing = await prisma.riskAddress.findUnique({
          where: { address: addr.address },
        });
        
        if (existing) {
          // 更新
          await prisma.riskAddress.update({
            where: { address: addr.address },
            data: {
              category: addr.category,
              riskScore: addr.riskScore,
              sources: this.mergeSources(existing.sources, addr.sources),
              metadata: this.mergeMetadata(existing.metadata, addr.metadata),
              updatedAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          // 创建
          await prisma.riskAddress.create({
            data: addr,
          });
          newCount++;
        }
      } catch (error) {
        console.error(`保存失败 ${addr.address}:`, error.message);
      }
    }
    
    // 记录同步日志
    await prisma.syncLog.create({
      data: {
        source: 'Chainalysis_API',
        addressesCount: addresses.length,
        newCount: newCount,
        updatedCount: updatedCount,
        status: 'SUCCESS',
        details: JSON.stringify({ apiRequests: this.requestCount }),
      },
    });
    
    console.log(`✅ 保存完成: 新增 ${newCount}, 更新 ${updatedCount}`);
    return { newCount, updatedCount };
  }

  mergeSources(existing, new_) {
    const existingArr = JSON.parse(existing || '[]');
    const newArr = JSON.parse(new_ || '[]');
    return JSON.stringify([...new Set([...existingArr, ...newArr])]);
  }

  mergeMetadata(existing, new_) {
    const existingObj = existing ? JSON.parse(existing) : {};
    const newObj = new_ ? JSON.parse(new_) : {};
    return JSON.stringify({ ...existingObj, ...newObj, updatedAt: new Date().toISOString() });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('Chainalysis API 测试与数据抓取');
  console.log('========================================\n');
  
  const fetcher = new ChainalysisDataFetcher();
  
  // 1. 测试API连接
  const testResult = await fetcher.testConnection();
  
  if (!testResult.success) {
    console.error('\n❌ API 测试失败，退出');
    process.exit(1);
  }
  
  // 2. 筛查地址列表
  console.log('\n========================================');
  console.log('开始筛查地址列表');
  console.log('========================================');
  
  const { sanctionedAddresses, errors } = await fetcher.screenAddresses(KNOWN_ADDRESSES);
  
  // 3. 保存到数据库
  if (sanctionedAddresses.length > 0) {
    await fetcher.saveToDatabase(sanctionedAddresses);
  }
  
  // 4. 打印最终统计
  console.log('\n========================================');
  console.log('最终结果');
  console.log('========================================');
  
  const stats = await prisma.riskAddress.aggregate({
    _count: { address: true },
    _sum: { riskScore: true },
  });
  
  const blacklistCount = await prisma.riskAddress.count({
    where: { category: 'BLACKLIST' }
  });
  
  console.log(`📊 数据库统计:`);
  console.log(`   总地址数: ${stats._count.address}`);
  console.log(`   黑名单数: ${blacklistCount}`);
  console.log(`   本次筛查: ${KNOWN_ADDRESSES.length} 个地址`);
  console.log(`   发现制裁: ${sanctionedAddresses.length} 个`);
  console.log(`   API请求: ${fetcher.requestCount} 次`);
  
  if (sanctionedAddresses.length > 0) {
    console.log('\n🚨 制裁地址列表:');
    for (const addr of sanctionedAddresses) {
      const metadata = JSON.parse(addr.metadata || '{}');
      console.log(`   ${addr.address.slice(0, 30)}... - ${metadata.entity || 'Unknown'}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ 完成！');
}

main().catch(console.error);
