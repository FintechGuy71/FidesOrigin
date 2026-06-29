/**
 * Chainalysis API 测试和调试脚本
 * 尝试不同的端点
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.CHAINALYSIS_API_KEY;

// 测试不同的端点
const ENDPOINTS = [
  { name: 'Reactor API', url: 'https://reactor.chainalysis.com/v1/screening/addresses', method: 'POST' },
  { name: 'Legacy API', url: 'https://api.chainalysis.com/api/v1/screening/addresses', method: 'POST' },
  { name: 'Screening API', url: 'https://screening.chainalysis.com/v1/screening/addresses', method: 'POST' },
];

async function testEndpoint(endpoint) {
  console.log(`\n🔍 测试: ${endpoint.name}`);
  console.log(`   URL: ${endpoint.url}`);
  console.log(`   Method: ${endpoint.method}`);
  
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        address: testAddress,
        network: 'Ethereum',
      },
      timeout: 30000,
    });
    
    console.log(`   ✅ 成功！状态码: ${response.status}`);
    console.log(`   响应:`, JSON.stringify(response.data, null, 2));
    return { success: true, endpoint };
    
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
    }
    return { success: false, endpoint, error: error.message };
  }
}

async function main() {
  console.log('========================================');
  console.log('Chainalysis API 端点测试');
  console.log('========================================');
  
  for (const endpoint of ENDPOINTS) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

main();
