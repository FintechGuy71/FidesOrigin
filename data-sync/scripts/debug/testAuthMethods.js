/**
 * Chainalysis API 端点测试 - 尝试不同方法和路径
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.CHAINALYSIS_API_KEY;

async function testWithGet() {
  console.log('🔍 测试 GET 方法...');
  
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  try {
    const response = await axios.get('https://reactor.chainalysis.com/v1/screening/addresses', {
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      params: {
        address: testAddress,
        network: 'Ethereum',
      },
      timeout: 30000,
    });
    
    console.log('✅ GET 成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log('❌ GET 失败:', error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应:', error.response.data);
    }
    return false;
  }
}

async function testWithBearer() {
  console.log('\n🔍 测试 Bearer Token 认证...');
  
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  try {
    const response = await axios.post('https://reactor.chainalysis.com/v1/screening/addresses', {
      address: testAddress,
      network: 'Ethereum',
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    
    console.log('✅ Bearer Token 成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log('❌ Bearer Token 失败:', error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
    }
    return false;
  }
}

async function testReactorRoot() {
  console.log('\n🔍 测试 Reactor 根路径...');
  
  try {
    const response = await axios.get('https://reactor.chainalysis.com/v1/', {
      headers: {
        'Authorization': `Token ${API_KEY}`,
      },
      timeout: 30000,
    });
    
    console.log('✅ 根路径成功！');
    console.log('响应:', JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log('❌ 根路径失败:', error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应:', error.response.data);
    }
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Chainalysis API 认证方法测试');
  console.log('========================================\n');
  
  await testWithGet();
  await testWithBearer();
  await testReactorRoot();
  
  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================');
}

main();
