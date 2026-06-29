const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const API_KEYS = [
  'ABQJNS57VYBYH7K3MSCQB4TWKVSB54QPXC',
  'IW7DG5MV445CEWHBP5FQCYZTXHQJN6RGV9'
];

const ETHERSCAN_HOST = 'api.etherscan.io';

console.log('═══════════════════════════════════════════════');
console.log('      Etherscan API 详细诊断测试 v2.0');
console.log('═══════════════════════════════════════════════\n');

// 1. 基础网络连通性测试
console.log('【测试1】基础网络连通性');
console.log('─────────────────────────────────');

try {
  const pingResult = execSync('ping -c 3 api.etherscan.io 2>&1 || echo "ping失败"', { encoding: 'utf8', timeout: 15000 });
  console.log('Ping 结果:', pingResult.includes('0 received') ? '❌ 无法ping通' : '✅ 可以ping通');
  console.log(pingResult);
} catch (e) {
  console.log('❌ Ping 测试失败:', e.message);
}

// 2. DNS解析测试
console.log('\n【测试2】DNS解析测试');
console.log('─────────────────────────────────');
try {
  const dnsResult = execSync('nslookup api.etherscan.io 2>&1 || echo "nslookup失败"', { encoding: 'utf8' });
  console.log(dnsResult);
} catch (e) {
  console.log('❌ DNS测试失败:', e.message);
}

// 3. curl直接测试（带详细输出）
console.log('\n【测试3】curl 直连测试（无SSL验证）');
console.log('─────────────────────────────────');
try {
  const curlResult = execSync(
    'curl -v -k --max-time 30 "https://api.etherscan.io/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&tag=latest&apikey=ABQJNS57VYBYH7K3MSCQB4TWKVSB54QPXC" 2>&1 || echo "curl失败"',
    { encoding: 'utf8', timeout: 35000 }
  );
  console.log(curlResult.substring(0, 3000));
} catch (e) {
  console.log('❌ curl测试失败:', e.message);
}

// 4. 使用 Node.js https 模块测试
function testWithNode(key, index) {
  return new Promise((resolve) => {
    console.log(`\n【测试4.${index + 1}】Node.js HTTPS 测试 - Key ${index + 1}`);
    console.log('─────────────────────────────────');
    
    const url = `/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&tag=latest&apikey=${key}`;
    
    const options = {
      hostname: ETHERSCAN_HOST,
      port: 443,
      path: url,
      method: 'GET',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Node.js Etherscan-Test)',
        'Accept': 'application/json'
      }
    };

    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      const duration = Date.now() - startTime;
      console.log(`  状态码: ${res.statusCode}`);
      console.log(`  响应时间: ${duration}ms`);
      console.log(`  响应头:`, JSON.stringify(res.headers, null, 2).substring(0, 500));
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`  响应体长度: ${data.length} 字符`);
        console.log(`  响应内容: ${data.substring(0, 500)}`);
        
        try {
          const json = JSON.parse(data);
          console.log(`  ✅ JSON解析成功: ${json.message || json.result}`);
          resolve({ success: true, duration, key: key.substring(0, 10) + '...' });
        } catch (e) {
          console.log(`  ⚠️ 非JSON响应: ${e.message}`);
          resolve({ success: false, error: 'Invalid JSON', duration });
        }
      });
    });

    req.on('timeout', () => {
      console.log(`  ❌ 请求超时 (30秒)`);
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.on('error', (e) => {
      console.log(`  ❌ 请求错误: ${e.code} - ${e.message}`);
      resolve({ success: false, error: e.code, message: e.message });
    });

    console.log(`  发送请求到: https://${ETHERSCAN_HOST}${url.replace(key, key.substring(0, 10) + '...')}`);
    req.end();
  });
}

// 5. 测试 HTTP (非HTTPS)
function testHttp(key) {
  return new Promise((resolve) => {
    console.log(`\n【测试5】HTTP (非加密) 测试`);
    console.log('─────────────────────────────────');
    
    // Etherscan 不支持 HTTP，但测试一下重定向行为
    const options = {
      hostname: ETHERSCAN_HOST,
      port: 80,
      path: `/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&tag=latest&apikey=${key}`,
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      console.log(`  状态码: ${res.statusCode} (${res.statusMessage})`);
      console.log(`  Location: ${res.headers.location || '无重定向'}`);
      resolve({ success: res.statusCode === 301 || res.statusCode === 302 });
    });

    req.on('error', (e) => {
      console.log(`  ❌ HTTP错误: ${e.message}`);
      resolve({ success: false, error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

// 6. 代理测试函数
function testWithProxy(key, proxyUrl) {
  return new Promise((resolve) => {
    console.log(`\n【测试6】通过代理测试: ${proxyUrl}`);
    console.log('─────────────────────────────────');
    
    const url = new URL(proxyUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: `https://api.etherscan.io/api?module=account&action=balance&address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&tag=latest&apikey=${key}`,
      method: 'GET',
      timeout: 15000,
      headers: {
        'Host': 'api.etherscan.io'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`  状态码: ${res.statusCode}`);
        console.log(`  响应: ${data.substring(0, 300)}`);
        resolve({ success: res.statusCode === 200 });
      });
    });

    req.on('error', (e) => {
      console.log(`  ❌ 代理错误: ${e.message}`);
      resolve({ success: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

// 执行所有测试
async function runTests() {
  console.log('\n═══════════════════════════════════════════════\n');
  
  const results = [];
  
  for (let i = 0; i < API_KEYS.length; i++) {
    const result = await testWithNode(API_KEYS[i], i);
    results.push(result);
  }
  
  await testHttp(API_KEYS[0]);
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('              测试结果汇总');
  console.log('═══════════════════════════════════════════════');
  results.forEach((r, i) => {
    console.log(`Key ${i + 1}: ${r.success ? '✅ 成功' : '❌ 失败'} (${r.error || r.duration + 'ms'})`);
  });
  
  // 诊断建议
  console.log('\n═══════════════════════════════════════════════');
  console.log('              诊断分析');
  console.log('═══════════════════════════════════════════════');
  
  const allFailed = results.every(r => !r.success);
  if (allFailed) {
    console.log('\n🚨 所有Key都连接失败，问题排查:');
    console.log('   1. 如果错误是 "ETIMEDOUT" 或 "ECONNREFUSED"');
    console.log('      → 服务器网络被限制，无法访问Etherscan');
    console.log('   2. 如果错误是 "UNABLE_TO_VERIFY_LEAF_SIGNATURE"');
    console.log('      → SSL证书问题，可以尝试设置 NODE_TLS_REJECT_UNAUTHORIZED=0');
    console.log('   3. 如果错误是 "ENOTFOUND"');
    console.log('      → DNS解析失败');
    console.log('\n💡 解决方案:');
    console.log('   - 方案1: 配置HTTP/HTTPS代理');
    console.log('   - 方案2: 在能访问Etherscan的机器上部署');
    console.log('   - 方案3: 使用第三方节点服务 (Alchemy/Infura)');
  }
}

runTests().catch(console.error);
