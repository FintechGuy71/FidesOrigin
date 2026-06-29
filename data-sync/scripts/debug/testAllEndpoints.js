/**
 * Chainalysis API 测试 - 尝试不同的API路径
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.CHAINALYSIS_API_KEY;

// 可能的API端点
const ENDPOINTS = [
  { name: 'Screening API v1', url: 'https://screening.chainalysis.com/v1/screening/addresses', method: 'POST' },
  { name: 'Screening API v2', url: 'https://screening.chainalysis.com/v2/screening/addresses', method: 'POST' },
  { name: 'API v1', url: 'https://api.chainalysis.com/v1/screening/addresses', method: 'POST' },
  { name: 'API Screening', url: 'https://api.chainalysis.com/screening/v1/addresses', method: 'POST' },
  { name: 'Legacy API', url: 'https://api.chainalysis.com/api/v1/screening/addresses', method: 'POST' },
];

async function testEndpoint(endpoint) {
  console.log(`\n🔍 测试: ${endpoint.name}`);
  console.log(`   URL: ${endpoint.url}`);
  
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: {
        address: testAddress,
        network: 'Ethereum',
      },
      timeout: 30000,
      validateStatus: () => true, // 不抛出错误，返回所有状态码
    });
    
    console.log(`   状态码: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ 成功！`);
      console.log(`   响应:`, JSON.stringify(response.data, null, 2).slice(0, 500));
      return { success: true, endpoint, data: response.data };
    } else if (response.status === 404) {
      console.log(`   ❌ 端点不存在`);
    } else if (response.status === 401) {
      console.log(`   ❌ 认证失败`);
    } else if (response.status === 410) {
      console.log(`   ❌ 已弃用`);
    } else {
      console.log(`   响应:`, JSON.stringify(response.data).slice(0, 200));
    }
    
    return { success: false, endpoint, status: response.status };
    
  } catch (error) {
    console.log(`   ❌ 错误: ${error.message}`);
    if (error.code === 'ENOTFOUND') {
      console.log(`   域名不存在`);
    }
    return { success: false, endpoint, error: error.message };
  }
}

async function main() {
  console.log('========================================');
  console.log('Chainalysis API 端点全面测试');
  console.log('========================================');
  
  const results = [];
  
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    await new Promise(r => setTimeout(r, 1000)); // 间隔1秒
  }
  
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  
  const working = results.filter(r => r.success);
  
  if (working.length > 0) {
    console.log('\n✅ 可用的端点:');
    for (const r of working) {
      console.log(`   - ${r.endpoint.name}: ${r.endpoint.url}`);
    }
  } else {
    console.log('\n❌ 没有找到可用的API端点');
    console.log('\n可能的原因:');
    console.log('   1. Chainalysis免费API已停止服务');
    console.log('   2. 需要企业级账户才能访问API');
    console.log('   3. API Key需要激活或验证');
    console.log('   4. API地址已变更');
  }
}

main();
