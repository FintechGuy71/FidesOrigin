/**
 * Etherscan API 调试测试
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.ETHERSCAN_API_KEY;

async function testAPI() {
  console.log('测试 Etherscan API...');
  console.log(`API Key长度: ${API_KEY.length}`);
  console.log(`API Key: ${API_KEY}\n`);
  
  try {
    const url = `https://api.etherscan.io/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&tag=latest&apikey=${API_KEY}`;
    console.log('请求URL:', url.slice(0, 100) + '...\n');
    
    const response = await axios.get(url, {
      timeout: 30000,
    });
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.error('错误类型:', error.code);
    
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应头:', JSON.stringify(error.response.headers, null, 2));
      console.error('响应体:', error.response.data);
    }
    
    if (error.request) {
      console.error('请求已发送但未收到响应');
    }
  }
}

testAPI();
