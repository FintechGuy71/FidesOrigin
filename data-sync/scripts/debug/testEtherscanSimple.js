/**
 * Etherscan API 简单测试
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.ETHERSCAN_API_KEY;

async function testAPI() {
  console.log('测试 Etherscan API...');
  console.log(`API Key: ${API_KEY.slice(0, 10)}...${API_KEY.slice(-4)}\n`);
  
  try {
    const response = await axios.get('https://api.etherscan.io/api', {
      params: {
        module: 'account',
        action: 'balance',
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        tag: 'latest',
        apikey: API_KEY,
      },
      timeout: 30000,
    });
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data.status === '1') {
      console.log('\n✅ API Key 有效！');
    } else {
      console.log('\n❌ API 返回错误:', response.data.message);
      console.log('   可能原因: API Key未激活或已过期');
    }
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应:', error.response.data);
    }
  }
}

testAPI();
