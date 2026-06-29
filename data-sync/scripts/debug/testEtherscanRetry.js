/**
 * Etherscan API 测试 - 带重试
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.ETHERSCAN_API_KEY;

async function testWithRetry(retries = 3) {
  console.log('测试 Etherscan API...\n');
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`尝试 ${i + 1}/${retries}...`);
      
      const response = await axios.get('https://api.etherscan.io/api', {
        params: {
          module: 'stats',
          action: 'ethprice',
          apikey: API_KEY,
        },
        timeout: 15000,
      });
      
      console.log('✅ 成功！');
      console.log('响应:', JSON.stringify(response.data, null, 2));
      return true;
      
    } catch (error) {
      console.log(`❌ 失败: ${error.message}`);
      
      if (i < retries - 1) {
        console.log('等待3秒后重试...\n');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  
  return false;
}

async function main() {
  const success = await testWithRetry(3);
  
  if (!success) {
    console.log('\n⚠️ 网络连接可能有问题');
    console.log('建议:');
    console.log('1. 检查网络连接');
    console.log('2. Etherscan API可能需要更长的超时时间');
    console.log('3. 继续用现有数据源（已有19个地址）');
  }
}

main();
