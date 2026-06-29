const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * FidesOrigin 合约自动验证脚本
 * 支持验证已部署的合约
 * 
 * 使用方法:
 *   npx hardhat run scripts/verify-contracts.js --network sepolia
 *   npx hardhat run scripts/verify-contracts.js --network mumbai
 *   
 * 或者直接指定合约地址:
 *   CONTRACT=FidesCompliance:0x... npx hardhat run scripts/verify-contracts.js --network sepolia
 */

// 网络配置
const NETWORK_CONFIGS = {
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
  },
  mumbai: {
    name: 'Polygon Mumbai Testnet',
    chainId: 80001,
    explorer: 'https://mumbai.polygonscan.com',
    apiKeyEnv: 'POLYGONSCAN_API_KEY',
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    explorer: 'https://polygonscan.com',
    apiKeyEnv: 'POLYGONSCAN_API_KEY',
  },
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    explorer: 'https://etherscan.io',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
  },
  bnb: {
    name: 'BNB Smart Chain',
    chainId: 56,
    explorer: 'https://bscscan.com',
    apiKeyEnv: 'BSCSCAN_API_KEY',
  },
  bnbTestnet: {
    name: 'BNB Testnet',
    chainId: 97,
    explorer: 'https://testnet.bscscan.com',
    apiKeyEnv: 'BSCSCAN_API_KEY',
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    explorer: 'https://arbiscan.io',
    apiKeyEnv: 'ARBITRUM_API_KEY',
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    explorer: 'https://optimistic.etherscan.io',
    apiKeyEnv: 'OPTIMISM_API_KEY',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    explorer: 'https://basescan.org',
    apiKeyEnv: 'BASESCAN_API_KEY',
  },
};

async function main() {
  const network = hre.network.name;
  const networkConfig = NETWORK_CONFIGS[network];
  
  if (!networkConfig) {
    console.error(`❌ Network ${network} not supported for verification`);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🔍 FidesOrigin Contract Verification');
  console.log('='.repeat(70));
  console.log(`📍 Network: ${networkConfig.name}`);
  console.log(`⛓️  Chain ID: ${networkConfig.chainId}`);
  console.log(`🔗 Explorer: ${networkConfig.explorer}`);
  console.log('='.repeat(70));

  // 检查 API Key
  const apiKey = process.env[networkConfig.apiKeyEnv];
  if (!apiKey) {
    console.error(`❌ Missing ${networkConfig.apiKeyEnv} environment variable`);
    process.exit(1);
  }

  // 获取要验证的合约列表
  const contractsToVerify = await getContractsToVerify(network);
  
  if (contractsToVerify.length === 0) {
    console.log('\n⚠️  No contracts to verify');
    console.log('   Run deployment script first or set CONTRACT env variable');
    process.exit(0);
  }

  console.log(`\n📋 Found ${contractsToVerify.length} contract(s) to verify:\n`);
  contractsToVerify.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} at ${c.address}`);
  });

  // 等待一段时间让区块被索引
  console.log('\n⏳ Waiting 15 seconds for block indexing...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // 验证每个合约
  const results = [];
  for (const contract of contractsToVerify) {
    const result = await verifyContract(contract);
    results.push(result);
  }

  // 打印结果摘要
  printSummary(results, networkConfig);

  // 更新部署文件
  await updateDeploymentFile(network, results);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Verification Complete!');
  console.log('='.repeat(70));
}

async function getContractsToVerify(network) {
  const contracts = [];

  // 1. 检查环境变量 CONTRACT (格式: ContractName:Address)
  if (process.env.CONTRACT) {
    const parts = process.env.CONTRACT.split(':');
    if (parts.length === 2) {
      contracts.push({
        name: parts[0],
        address: parts[1],
        constructorArgs: [],
      });
    }
    return contracts;
  }

  // 2. 从部署文件读取
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    if (deployment.contracts) {
      for (const [name, info] of Object.entries(deployment.contracts)) {
        contracts.push({
          name,
          address: info.address,
          constructorArgs: info.constructorArgs || [],
        });
      }
    }
  }

  return contracts;
}

async function verifyContract(contract) {
  console.log(`\n🔎 Verifying ${contract.name} at ${contract.address}...`);
  
  try {
    // 尝试验证
    await hre.run('verify:verify', {
      address: contract.address,
      constructorArguments: contract.constructorArgs,
    });
    
    console.log(`   ✅ ${contract.name} verified successfully!`);
    
    return {
      name: contract.name,
      address: contract.address,
      success: true,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    const errorMessage = error.message;
    
    // 检查是否是已验证的错误
    if (errorMessage.includes('Already Verified') || 
        errorMessage.includes('already verified')) {
      console.log(`   ✅ ${contract.name} is already verified`);
      return {
        name: contract.name,
        address: contract.address,
        success: true,
        alreadyVerified: true,
        timestamp: new Date().toISOString(),
      };
    }
    
    console.error(`   ❌ Verification failed: ${errorMessage}`);
    
    return {
      name: contract.name,
      address: contract.address,
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

function printSummary(results, networkConfig) {
  console.log('\n' + '='.repeat(70));
  console.log('📋 Verification Summary');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nTotal: ${results.length} | ✅ Success: ${successful.length} | ❌ Failed: ${failed.length}\n`);

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const alreadyVerified = result.alreadyVerified ? ' (already verified)' : '';
    console.log(`${status} ${result.name}${alreadyVerified}`);
    console.log(`   Address: ${result.address}`);
    console.log(`   URL: ${networkConfig.explorer}/address/${result.address}#code`);
    if (result.error) {
      console.log(`   Error: ${result.error.substring(0, 100)}...`);
    }
    console.log('');
  }
}

async function updateDeploymentFile(network, results) {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    return;
  }

  try {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    if (!deployment.contracts) {
      return;
    }

    // 更新每个合约的验证状态
    for (const result of results) {
      if (deployment.contracts[result.name]) {
        deployment.contracts[result.name].verified = result.success;
        if (result.success) {
          deployment.contracts[result.name].verifiedAt = result.timestamp;
        }
        if (result.error) {
          deployment.contracts[result.name].verifyError = result.error;
        }
      }
    }

    // 保存更新后的文件
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    console.log(`📝 Updated ${deploymentFile}`);
    
  } catch (error) {
    console.warn(`⚠️  Could not update deployment file: ${error.message}`);
  }
}

// 运行验证
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
