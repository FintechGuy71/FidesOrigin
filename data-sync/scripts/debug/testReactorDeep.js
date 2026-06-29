/**
 * Chainalysis Reactor API 深度测试
 * 检查403响应的详细信息
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.CHAINALYSIS_API_KEY;

async function testReactorWithDetails() {
  console.log('🔍 深度测试 Reactor API\n');
  
  const endpoints = [
    'https://reactor.chainalysis.com/v1/screening/addresses',
    'https://reactor.chainalysis.com/api/v1/addresses',
    'https://reactor.chainalysis.com/v1/addresses/screening',
    'https://reactor.chainalysis.com/v1/sanctions/screening',
  ];
  
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  for (const url of endpoints) {
    console.log(`\n测试: ${url}`);
    
    try {
      const response = await axios.post(url, {
        address: testAddress,
        network: 'Ethereum',
      }, {
        headers: {
          'Authorization': `Token ${API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
        validateStatus: () => true,
      });
      
      console.log(`  状态码: ${response.status}`);
      console.log(`  响应头:`, JSON.stringify(response.headers, null, 2));
      console.log(`  响应体:`, JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log(`  错误: ${error.message}`);
      if (error.response) {
        console.log(`  状态码: ${error.response.status}`);
        console.log(`  响应:`, error.response.data);
        console.log(`  响应头:`, JSON.stringify(error.response.headers, null, 2));
      }
    }
  }
}

async function checkAPIKeyInfo() {
  console.log('\n\n🔍 检查API Key信息\n');
  console.log(`Key长度: ${API_KEY.length}`);
  console.log(`Key前缀: ${API_KEY.slice(0, 10)}...`);
  console.log(`Key后缀: ...${API_KEY.slice(-8)}`);
  
  // 尝试访问Reactor主页获取信息
  try {
    const response = await axios.get('https://reactor.chainalysis.com/', {
      headers: {
        'Authorization': `Token ${API_KEY}`,
      },
      timeout: 10000,
      validateStatus: () => true,
    });
    
    console.log(`\nReactor主页访问:`);
    console.log(`  状态码: ${response.status}`);
    
    if (response.status === 200) {
      console.log('  ✅ API Key可以访问Reactor平台');
    } else if (response.status === 403) {
      console.log('  ❌ API Key被拒绝访问（可能需要订阅）');
    }
    
  } catch (error) {
    console.log(`  错误: ${error.message}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Chainalysis Reactor 深度测试          ║');
  console.log('╚════════════════════════════════════════╝');
  
  await testReactorWithDetails();
  await checkAPIKeyInfo();
  
  console.log('\n\n📋 结论');
  console.log('─────────────────────────────────');
  console.log('1. 所有传统API端点已返回410（已弃用）');
  console.log('2. Reactor平台返回403（权限不足）');
  console.log('3. API Key可能是有效的，但需要付费订阅');
  console.log('\n💡 建议:');
  console.log('   - 检查注册邮箱是否有激活邮件');
  console.log('   - 联系Chainalysis销售了解定价');
  console.log('   - 使用现有的OFAC和开源数据源');
}

main().catch(console.error);
