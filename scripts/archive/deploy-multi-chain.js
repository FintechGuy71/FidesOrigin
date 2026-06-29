const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * FidesOrigin 多链部署脚本
 * 支持 Ethereum、Polygon、BNB Chain 等多条链
 * 
 * 使用方法:
 *   npx hardhat run scripts/deploy-multi-chain.js --network sepolia
 *   npx hardhat run scripts/deploy-multi-chain.js --network polygon
 *   npx hardhat run scripts/deploy-multi-chain.js --network bnb
 */

// 合约列表
const CONTRACTS = {
  FidesCompliance: {
    name: 'FidesCompliance',
    artifact: 'FidesCompliance',
    constructorArgs: [],
  },
  RiskRegistry: {
    name: 'RiskRegistry',
    artifact: 'RiskRegistry',
    constructorArgs: [],
  },
};

// 网络配置
const NETWORK_CONFIG = {
  // Ethereum
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    explorer: 'https://etherscan.io',
    confirmations: 5,
    verify: true,
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io',
    confirmations: 3,
    verify: true,
  },
  goerli: {
    name: 'Goerli Testnet',
    chainId: 5,
    explorer: 'https://goerli.etherscan.io',
    confirmations: 3,
    verify: true,
  },
  
  // Polygon
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    explorer: 'https://polygonscan.com',
    confirmations: 10,
    verify: true,
  },
  mumbai: {
    name: 'Polygon Mumbai',
    chainId: 80001,
    explorer: 'https://mumbai.polygonscan.com',
    confirmations: 5,
    verify: true,
  },
  
  // BNB Chain
  bnb: {
    name: 'BNB Smart Chain',
    chainId: 56,
    explorer: 'https://bscscan.com',
    confirmations: 10,
    verify: true,
  },
  bnbTestnet: {
    name: 'BNB Testnet',
    chainId: 97,
    explorer: 'https://testnet.bscscan.com',
    confirmations: 5,
    verify: true,
  },
  
  // Layer 2
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    explorer: 'https://arbiscan.io',
    confirmations: 10,
    verify: true,
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    explorer: 'https://optimistic.etherscan.io',
    confirmations: 10,
    verify: true,
  },
  base: {
    name: 'Base',
    chainId: 8453,
    explorer: 'https://basescan.org',
    confirmations: 10,
    verify: true,
  },
  
  // Local
  hardhat: {
    name: 'Hardhat Local',
    chainId: 31337,
    explorer: '',
    confirmations: 1,
    verify: false,
  },
  localhost: {
    name: 'Localhost',
    chainId: 31337,
    explorer: '',
    confirmations: 1,
    verify: false,
  },
};

// 部署记录
const deployments = {};

async function main() {
  const network = hre.network.name;
  const networkConfig = NETWORK_CONFIG[network];
  
  if (!networkConfig) {
    console.warn(`⚠️  Network ${network} not in config, using defaults`);
  }
  
  const config = networkConfig || {
    name: network,
    chainId: hre.network.config.chainId,
    explorer: '',
    confirmations: 1,
    verify: false,
  };

  console.log('='.repeat(60));
  console.log('🚀 FidesOrigin Multi-Chain Deployment');
  console.log('='.repeat(60));
  console.log(`📍 Network: ${config.name} (${network})`);
  console.log(`⛓️  Chain ID: ${config.chainId}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // 获取部署者
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log(`\n👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);
  console.log(`🎯 Gas Price: ${hre.network.config.gasPrice || 'auto'}`);

  // 检查余额
  if (balance < hre.ethers.parseEther('0.001') && network !== 'hardhat') {
    console.warn('⚠️  Low balance detected! Deployment may fail.');
  }

  console.log('\n' + '-'.repeat(60));
  console.log('📦 Deploying Contracts...');
  console.log('-'.repeat(60));

  // 部署所有合约
  for (const [key, contractInfo] of Object.entries(CONTRACTS)) {
    await deployContract(contractInfo, config, deployer);
  }

  // 设置合约间关系（如果需要）
  await configureContracts(config, deployer);

  // 保存部署信息
  await saveDeploymentInfo(network, config);

  // 验证合约
  if (config.verify && network !== 'hardhat') {
    await verifyContracts(network, config);
  }

  // 打印部署摘要
  printDeploymentSummary(network, config);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Deployment Complete!');
  console.log('='.repeat(60));
}

async function deployContract(contractInfo, config, deployer) {
  const { name, artifact, constructorArgs } = contractInfo;
  
  console.log(`\n🔨 Deploying ${name}...`);
  
  try {
    // 获取合约工厂
    const ContractFactory = await hre.ethers.getContractFactory(artifact);
    
    // 估算 Gas
    const deploymentGas = await hre.ethers.provider.estimateGas(
      await ContractFactory.getDeployTransaction(...constructorArgs)
    );
    const gasPrice = await hre.ethers.provider.getFeeData();
    const estimatedCost = deploymentGas * (gasPrice.gasPrice || 0n);
    
    console.log(`   ⛽ Estimated Gas: ${deploymentGas.toString()}`);
    console.log(`   💵 Estimated Cost: ${hre.ethers.formatEther(estimatedCost)} ETH`);
    
    // 部署合约
    const contract = await ContractFactory.deploy(...constructorArgs);
    
    console.log(`   📤 Transaction: ${contract.deploymentTransaction().hash}`);
    console.log(`   ⏳ Waiting for ${config.confirmations} confirmations...`);
    
    // 等待确认
    await contract.deploymentTransaction().wait(config.confirmations);
    
    const address = await contract.getAddress();
    const receipt = await hre.ethers.provider.getTransactionReceipt(
      contract.deploymentTransaction().hash
    );
    
    // 保存部署信息
    deployments[name] = {
      name,
      address,
      deployer: deployer.address,
      transactionHash: contract.deploymentTransaction().hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      constructorArgs,
      timestamp: new Date().toISOString(),
    };
    
    console.log(`   ✅ ${name} deployed at: ${address}`);
    console.log(`   🔢 Block: ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
    
    return contract;
  } catch (error) {
    console.error(`   ❌ Failed to deploy ${name}:`, error.message);
    throw error;
  }
}

async function configureContracts(config, deployer) {
  console.log('\n' + '-'.repeat(60));
  console.log('⚙️  Configuring Contracts...');
  console.log('-'.repeat(60));

  // 如果有 FidesCompliance 合约，配置初始设置
  if (deployments.FidesCompliance) {
    try {
      const FidesCompliance = await hre.ethers.getContractAt(
        'FidesCompliance',
        deployments.FidesCompliance.address
      );

      console.log('\n🔧 Configuring FidesCompliance...');
      
      // 获取统计信息
      const stats = await FidesCompliance.getStats();
      console.log('   📊 Initial Stats:');
      console.log(`      - Risk Profiles: ${stats[0].toString()}`);
      console.log(`      - Total Rules: ${stats[1].toString()}`);
      console.log(`      - Active Rules: ${stats[2].toString()}`);
      console.log(`      - Strict Mode: ${stats[7]}`);
      console.log(`      - Audit Mode: ${stats[8]}`);

      // 配置链支持（如果需要）
      const currentChainId = config.chainId;
      console.log(`   ⛓️  Current Chain ID: ${currentChainId}`);

    } catch (error) {
      console.warn('   ⚠️  Could not configure FidesCompliance:', error.message);
    }
  }

  // 如果有 RiskRegistry 合约，配置初始设置
  if (deployments.RiskRegistry) {
    try {
      const RiskRegistry = await hre.ethers.getContractAt(
        'RiskRegistry',
        deployments.RiskRegistry.address
      );

      console.log('\n🔧 Configuring RiskRegistry...');
      
      // 获取分类统计
      const stats = await RiskRegistry.getCategoryStats();
      console.log('   📊 Category Stats:');
      console.log(`      - Unknown: ${stats[0].toString()}`);
      console.log(`      - Whitelist: ${stats[1].toString()}`);
      console.log(`      - Graylist: ${stats[2].toString()}`);
      console.log(`      - Blacklist: ${stats[3].toString()}`);

      // 获取当前 Merkle Root
      const merkleRoot = await RiskRegistry.currentMerkleRoot();
      console.log(`   🔗 Current Merkle Root: ${merkleRoot}`);

    } catch (error) {
      console.warn('   ⚠️  Could not configure RiskRegistry:', error.message);
    }
  }

  console.log('   ✅ Configuration complete');
}

async function saveDeploymentInfo(network, config) {
  console.log('\n' + '-'.repeat(60));
  console.log('💾 Saving Deployment Info...');
  console.log('-'.repeat(60));

  // 确保 deployments 目录存在
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // 获取部署者地址
  const [deployer] = await hre.ethers.getSigners();

  // 创建部署记录
  const deploymentRecord = {
    network,
    chainId: config.chainId,
    networkName: config.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployments,
    explorer: config.explorer,
  };

  // 保存网络特定部署文件
  const timestamp = new Date().toISOString().split('T')[0];
  const networkFile = path.join(deploymentsDir, `${network}-${timestamp}.json`);
  fs.writeFileSync(networkFile, JSON.stringify(deploymentRecord, null, 2));
  console.log(`   📄 Network deployment: ${networkFile}`);

  // 保存网络最新部署
  const networkLatestFile = path.join(deploymentsDir, `${network}-latest.json`);
  fs.writeFileSync(networkLatestFile, JSON.stringify(deploymentRecord, null, 2));
  console.log(`   📄 Network latest: ${networkLatestFile}`);

  // 更新全局部署索引
  const indexFile = path.join(deploymentsDir, 'index.json');
  let index = {};
  if (fs.existsSync(indexFile)) {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  }
  index[network] = {
    chainId: config.chainId,
    latest: deploymentRecord.timestamp,
    contracts: Object.keys(deployments).reduce((acc, key) => {
      acc[key] = deployments[key].address;
      return acc;
    }, {}),
  };
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  console.log(`   📄 Deployment index: ${indexFile}`);

  // 保存为最新部署
  const latestFile = path.join(deploymentsDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(deploymentRecord, null, 2));
  console.log(`   📄 Latest deployment: ${latestFile}`);

  console.log('   ✅ Deployment info saved');
}

async function verifyContracts(network, config) {
  console.log('\n' + '-'.repeat(60));
  console.log('🔍 Verifying Contracts...');
  console.log('-'.repeat(60));

  // 等待一段时间让区块被索引
  console.log('⏳ Waiting 30 seconds for block indexing...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  for (const [name, deployment] of Object.entries(deployments)) {
    try {
      console.log(`\n🔎 Verifying ${name} at ${deployment.address}...`);
      
      await hre.run('verify:verify', {
        address: deployment.address,
        constructorArguments: deployment.constructorArgs,
      });
      
      console.log(`   ✅ ${name} verified!`);
      deployment.verified = true;
      
    } catch (error) {
      console.warn(`   ⚠️  ${name} verification failed:`, error.message);
      deployment.verified = false;
      deployment.verifyError = error.message;
    }
  }

  // 更新保存的部署信息
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const latestFile = path.join(deploymentsDir, 'latest.json');
  const deploymentRecord = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  deploymentRecord.contracts = deployments;
  fs.writeFileSync(latestFile, JSON.stringify(deploymentRecord, null, 2));
}

function printDeploymentSummary(network, config) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 Deployment Summary');
  console.log('='.repeat(60));
  console.log(`Network: ${config.name} (${network})`);
  console.log(`Chain ID: ${config.chainId}`);
  console.log(`Explorer: ${config.explorer}`);
  console.log('\nDeployed Contracts:');
  
  for (const [name, deployment] of Object.entries(deployments)) {
    console.log(`\n  📄 ${name}:`);
    console.log(`     Address: ${deployment.address}`);
    console.log(`     Tx Hash: ${deployment.transactionHash}`);
    console.log(`     Block: ${deployment.blockNumber}`);
    console.log(`     Gas Used: ${deployment.gasUsed}`);
    if (deployment.verified !== undefined) {
      console.log(`     Verified: ${deployment.verified ? '✅' : '❌'}`);
    }
    if (config.explorer) {
      console.log(`     URL: ${config.explorer}/address/${deployment.address}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  
  // 打印环境变量模板
  console.log('\n📝 Environment Variables (add to .env):');
  console.log('-'.repeat(60));
  for (const [name, deployment] of Object.entries(deployments)) {
    const envVar = `${network.toUpperCase()}_${name.toUpperCase()}_ADDRESS`;
    console.log(`${envVar}=${deployment.address}`);
  }
  console.log('-'.repeat(60));
}

// 运行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    console.error(error.stack);
    process.exit(1);
  });
