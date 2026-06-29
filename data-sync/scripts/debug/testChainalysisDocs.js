/**
 * Chainalysis API 重新测试
 * 基于文档的API模式尝试不同端点和认证方式
 */

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.CHAINALYSIS_API_KEY;

// 根据文档可能的API端点
const ENDPOINTS = [
  // 制裁筛查API（根据文档名称）
  { name: 'Sanctions API v1', url: 'https://api.chainalysis.com/api/v1/sanctions/screening', method: 'POST' },
  { name: 'Sanctions API v2', url: 'https://api.chainalysis.com/api/v2/sanctions/screening', method: 'POST' },
  { name: 'Sanctions Direct', url: 'https://api.chainalysis.com/sanctions/v1/screening', method: 'POST' },
  
  // Reactor平台API
  { name: 'Reactor Screening', url: 'https://reactor.chainalysis.com/api/v1/screening/addresses', method: 'POST' },
  { name: 'Reactor Sanctions', url: 'https://reactor.chainalysis.com/api/v1/sanctions/screening', method: 'POST' },
  
  // 其他可能的端点
  { name: 'API Direct', url: 'https://api.chainalysis.com/v1/sanctions/screening', method: 'POST' },
  { name: 'API Screening v2', url: 'https://api.chainalysis.com/api/v2/screening/addresses', method: 'POST' },
];

// 不同的认证头格式
const AUTH_METHODS = [
  { name: 'Token Auth', header: (key) => ({ 'Authorization': `Token ${key}` }) },
  { name: 'Bearer Auth', header: (key) => ({ 'Authorization': `Bearer ${key}` }) },
  { name: 'API Key Header', header: (key) => ({ 'X-API-Key': key }) },
  { name: 'Chainalysis Token', header: (key) => ({ 'Chainalysis-Token': key }) },
];

async function testEndpointWithAuth(endpoint, authMethod) {
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...authMethod.header(API_KEY),
  };
  
  try {
    const response = await axios({
      method: endpoint.method,
      url: endpoint.url,
      headers: headers,
      data: {
        address: testAddress,
        network: 'Ethereum',
        // 制裁API可能需要额外字段
        asset: 'ETH',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    
    return {
      success: response.status === 200,
      status: response.status,
      data: response.data,
      endpoint: endpoint.name,
      auth: authMethod.name,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      endpoint: endpoint.name,
      auth: authMethod.name,
    };
  }
}

async function testGETEndpoint(endpoint, authMethod) {
  const testAddress = '0x722122df12d4e14e13ac3b6895a86e84145b6967';
  
  const headers = {
    'Accept': 'application/json',
    ...authMethod.header(API_KEY),
  };
  
  try {
    const response = await axios({
      method: 'GET',
      url: endpoint.url,
      headers: headers,
      params: {
        address: testAddress,
        network: 'Ethereum',
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    
    return {
      success: response.status === 200,
      status: response.status,
      data: response.data,
      endpoint: endpoint.name,
      auth: authMethod.name,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      endpoint: endpoint.name,
      auth: authMethod.name,
    };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Chainalysis API 重新测试              ║');
  console.log('║   基于Sanctions API文档                 ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  console.log(`API Key: ${API_KEY.slice(0, 20)}...${API_KEY.slice(-4)}\n`);
  
  const allResults = [];
  
  // 测试所有端点 × 所有认证方式
  for (const endpoint of ENDPOINTS) {
    console.log(`\n🔍 测试端点: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    
    for (const authMethod of AUTH_METHODS) {
      process.stdout.write(`   ${authMethod.name}... `);
      
      const result = await testEndpointWithAuth(endpoint, authMethod);
      allResults.push(result);
      
      if (result.success) {
        console.log('✅ 成功！');
        console.log(`   响应:`, JSON.stringify(result.data, null, 2).slice(0, 300));
      } else if (result.status === 401) {
        console.log('❌ 认证失败 (401)');
      } else if (result.status === 404) {
        console.log('❌ 端点不存在 (404)');
      } else if (result.status === 410) {
        console.log('❌ 已弃用 (410)');
      } else if (result.code === 'ENOTFOUND') {
        console.log('❌ 域名不存在');
      } else {
        console.log(`❌ ${result.error || result.status}`);
      }
      
      // 短暂延迟避免被限流
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // 尝试GET方法
  console.log('\n\n🔍 测试GET方法');
  console.log('─────────────────────────────────');
  
  for (const endpoint of ENDPOINTS.slice(0, 3)) {
    for (const authMethod of AUTH_METHODS.slice(0, 2)) {
      const result = await testGETEndpoint(endpoint, authMethod);
      
      if (result.success || result.status !== 404) {
        console.log(`\n${endpoint.name} + ${authMethod.name}:`);
        console.log(`  状态: ${result.status}`);
        if (result.data) {
          console.log(`  响应:`, JSON.stringify(result.data).slice(0, 200));
        }
      }
      
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  // 汇总
  console.log('\n\n╔════════════════════════════════════════╗');
  console.log('║              测试结果汇总               ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const successful = allResults.filter(r => r.success);
  
  if (successful.length > 0) {
    console.log('✅ 成功的组合:');
    for (const r of successful) {
      console.log(`   - ${r.endpoint} + ${r.auth}`);
    }
  } else {
    console.log('❌ 没有找到可用的API端点\n');
    console.log('可能的原因:');
    console.log('   1. API Key需要激活（检查邮箱确认邮件）');
    console.log('   2. 需要企业账户才能访问API');
    console.log('   3. API地址或认证方式与文档不同');
    console.log('   4. 免费制裁筛查API已停止服务\n');
    
    // 检查特定错误
    const authFailures = allResults.filter(r => r.status === 401);
    const notFound = allResults.filter(r => r.status === 404 || r.code === 'ENOTFOUND');
    const deprecated = allResults.filter(r => r.status === 410);
    
    console.log('错误统计:');
    console.log(`   401 认证失败: ${authFailures.length} 次`);
    console.log(`   404 端点不存在: ${notFound.length} 次`);
    console.log(`   410 已弃用: ${deprecated.length} 次`);
  }
}

main().catch(console.error);
