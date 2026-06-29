const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * FidesOrigin Mumbai 测试网部署脚本
 * 部署合约:
 *   - FidesCompliance.sol
 *   - TestUSD.sol (测试稳定币)
 * 
 * 使用方法:
 *   npx hardhat run scripts/deploy-mumbai.js --network mumbai
 * 
 * 环境变量要求:
 *   - PRIVATE_KEY: 部署钱包私钥
 *   - POLYGON_MUMBAI_RPC: Mumbai RPC 节点
 *   - POLYGONSCAN_API_KEY: Polygonscan API Key (用于验证)
 */

// 网络配置
const NETWORK_CONFIG = {
  name: 'Polygon Mumbai Testnet',
  network: 'mumbai',
  chainId: 80001,
  explorer: 'https://mumbai.polygonscan.com',
  confirmations: 5,
  verify: true,
};

// 部署记录
const deployments = {};

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 FidesOrigin Mumbai Testnet Deployment');
  console.log('='.repeat(70));
  console.log(`📍 Network: ${NETWORK_CONFIG.name}`);
  console.log(`⛓️  Chain ID: ${NETWORK_CONFIG.chainId}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // 验证环境变量
  validateEnvironment();

  // 获取部署者
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log(`\n👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} MATIC`);

  // 检查余额
  if (balance < hre.ethers.parseEther('0.1')) {
    console.warn('⚠️  Low balance detected! Deployment may fail.');
    console.warn('   Get Mumbai MATIC from: https://faucet.polygon.technology/');
  }

  console.log('\n' + '-'.repeat(70));
  console.log('📦 Deploying Contracts...');
  console.log('-'.repeat(70));

  // 1. 部署 FidesCompliance
  await deployFidesCompliance(deployer);

  // 2. 部署 TestUSD
  await deployTestUSD(deployer);

  // 3. 配置合约关系
  await configureContracts(deployer);

  // 4. 保存部署信息
  await saveDeploymentInfo(deployer);

  // 5. 验证合约
  await verifyContracts();

  // 打印部署摘要
  printDeploymentSummary();

  console.log('\n' + '='.repeat(70));
  console.log('✅ Mumbai Deployment Complete!');
  console.log('='.repeat(70));
}

function validateEnvironment() {
  const required = ['PRIVATE_KEY', 'POLYGON_MUMBAI_RPC'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }
  
  if (!process.env.POLYGONSCAN_API_KEY) {
    console.warn('⚠️  POLYGONSCAN_API_KEY not set, contract verification will be skipped');
    NETWORK_CONFIG.verify = false;
  }
}

async function deployFidesCompliance(deployer) {
  console.log('\n🔨 Deploying FidesCompliance...');
  
  try {
    const FidesCompliance = await hre.ethers.getContractFactory('FidesCompliance');
    
    // 估算 Gas
    const deploymentGas = await hre.ethers.provider.estimateGas(
      await FidesCompliance.getDeployTransaction()
    );
    const gasPrice = await hre.ethers.provider.getFeeData();
    const estimatedCost = deploymentGas * (gasPrice.gasPrice || 0n);
    
    console.log(`   ⛽ Estimated Gas: ${deploymentGas.toString()}`);
    console.log(`   💵 Estimated Cost: ${hre.ethers.formatEther(estimatedCost)} MATIC`);
    
    // 部署合约
    const contract = await FidesCompliance.deploy();
    
    console.log(`   📤 Transaction: ${contract.deploymentTransaction().hash}`);
    console.log(`   ⏳ Waiting for ${NETWORK_CONFIG.confirmations} confirmations...`);
    
    // 等待确认
    await contract.deploymentTransaction().wait(NETWORK_CONFIG.confirmations);
    
    const address = await contract.getAddress();
    const receipt = await hre.ethers.provider.getTransactionReceipt(
      contract.deploymentTransaction().hash
    );
    
    // 获取 ABI
    const artifact = await hre.artifacts.readArtifact('FidesCompliance');
    
    deployments.FidesCompliance = {
      name: 'FidesCompliance',
      address,
      abi: artifact.abi,
      deployer: deployer.address,
      transactionHash: contract.deploymentTransaction().hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      constructorArgs: [],
      timestamp: new Date().toISOString(),
      verified: false,
    };
    
    console.log(`   ✅ FidesCompliance deployed at: ${address}`);
    console.log(`   🔢 Block: ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
    
    // 获取初始统计信息
    try {
      const stats = await contract.getStats();
      console.log(`   📊 Initial Stats:`);
      console.log(`      - Risk Profiles: ${stats[0].toString()}`);
      console.log(`      - Total Rules: ${stats[1].toString()}`);
      console.log(`      - Active Rules: ${stats[2].toString()}`);
    } catch (e) {
      // 忽略错误
    }
    
    return contract;
  } catch (error) {
    console.error(`   ❌ Failed to deploy FidesCompliance:`, error.message);
    throw error;
  }
}

async function deployTestUSD(deployer) {
  console.log('\n🔨 Deploying TestUSD...');
  
  try {
    const TestUSD = await hre.ethers.getContractFactory('TestUSD');
    
    // 估算 Gas
    const deploymentGas = await hre.ethers.provider.estimateGas(
      await TestUSD.getDeployTransaction()
    );
    const gasPrice = await hre.ethers.provider.getFeeData();
    const estimatedCost = deploymentGas * (gasPrice.gasPrice || 0n);
    
    console.log(`   ⛽ Estimated Gas: ${deploymentGas.toString()}`);
    console.log(`   💵 Estimated Cost: ${hre.ethers.formatEther(estimatedCost)} MATIC`);
    
    // 部署合约
    const contract = await TestUSD.deploy();
    
    console.log(`   📤 Transaction: ${contract.deploymentTransaction().hash}`);
    console.log(`   ⏳ Waiting for ${NETWORK_CONFIG.confirmations} confirmations...`);
    
    // 等待确认
    await contract.deploymentTransaction().wait(NETWORK_CONFIG.confirmations);
    
    const address = await contract.getAddress();
    const receipt = await hre.ethers.provider.getTransactionReceipt(
      contract.deploymentTransaction().hash
    );
    
    // 获取 ABI
    const artifact = await hre.artifacts.readArtifact('TestUSD');
    
    deployments.TestUSD = {
      name: 'TestUSD',
      address,
      abi: artifact.abi,
      deployer: deployer.address,
      transactionHash: contract.deploymentTransaction().hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      constructorArgs: [],
      timestamp: new Date().toISOString(),
      verified: false,
    };
    
    console.log(`   ✅ TestUSD deployed at: ${address}`);
    console.log(`   🔢 Block: ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
    
    // 获取合约信息
    try {
      const info = await contract.getContractInfo();
      console.log(`   📊 Token Info:`);
      console.log(`      - Name: ${info[0]}`);
      console.log(`      - Symbol: ${info[1]}`);
      console.log(`      - Decimals: ${info[2]}`);
      console.log(`      - Total Supply: ${hre.ethers.formatUnits(info[3], 18)} TUSD`);
    } catch (e) {
      // 忽略错误
    }
    
    return contract;
  } catch (error) {
    console.error(`   ❌ Failed to deploy TestUSD:`, error.message);
    throw error;
  }
}

async function configureContracts(deployer) {
  console.log('\n' + '-'.repeat(70));
  console.log('⚙️  Configuring Contracts...');
  console.log('-'.repeat(70));

  // 配置 FidesCompliance
  if (deployments.FidesCompliance) {
    try {
      const FidesCompliance = await hre.ethers.getContractAt(
        'FidesCompliance',
        deployments.FidesCompliance.address
      );

      console.log('\n🔧 Configuring FidesCompliance...');
      
      // 创建示例规则
      console.log('   📝 Creating sample compliance rule...');
      
      const ruleCondition = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256'],
        [hre.ethers.parseEther('1000'), 86400] // 1000 tokens, 24 hours
      );
      
      const ruleAction = hre.ethers.AbiCoder.defaultAbiCoder().encode(
        ['bool', 'string'],
        [true, 'Transaction within limits']
      );
      
      const tx = await FidesCompliance.createRule(
        'Transaction Limit Rule',
        0, // TRANSACTION_LIMIT
        1, // priority
        ruleCondition,
        ruleAction,
        'Maximum 1000 tokens per transaction'
      );
      await tx.wait();
      console.log('   ✅ Sample rule created');

    } catch (error) {
      console.warn('   ⚠️  Could not configure FidesCompliance:', error.message);
    }
  }

  console.log('   ✅ Configuration complete');
}

async function saveDeploymentInfo(deployer) {
  console.log('\n' + '-'.repeat(70));
  console.log('💾 Saving Deployment Info...');
  console.log('-'.repeat(70));

  // 确保 deployments 目录存在
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // 创建部署记录
  const deploymentRecord = {
    network: NETWORK_CONFIG.network,
    chainId: NETWORK_CONFIG.chainId,
    networkName: NETWORK_CONFIG.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    explorer: NETWORK_CONFIG.explorer,
    rpcUrl: process.env.POLYGON_MUMBAI_RPC,
    contracts: deployments,
  };

  // 保存 mumbai.json
  const mumbaiFile = path.join(deploymentsDir, 'mumbai.json');
  fs.writeFileSync(mumbaiFile, JSON.stringify(deploymentRecord, null, 2));
  console.log(`   📄 Saved: ${mumbaiFile}`);

  // 更新 .env.example 中的合约地址
  updateEnvExample();

  console.log('   ✅ Deployment info saved');
}

function updateEnvExample() {
  const envPath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // 更新或添加合约地址
    for (const [name, deployment] of Object.entries(deployments)) {
      const envVar = `MUMBAI_${name.toUpperCase()}_ADDRESS`;
      const envLine = `${envVar}=${deployment.address}`;
      
      if (envContent.includes(`${envVar}=`)) {
        envContent = envContent.replace(new RegExp(`${envVar}=.*`, 'g'), envLine);
      } else {
        envContent += `\n${envLine}`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('   📝 Updated .env.example with contract addresses');
  }
}

async function verifyContracts() {
  if (!NETWORK_CONFIG.verify || !process.env.POLYGONSCAN_API_KEY) {
    console.log('\n⏭️  Skipping contract verification (no API key)');
    return;
  }

  console.log('\n' + '-'.repeat(70));
  console.log('🔍 Verifying Contracts on Polygonscan...');
  console.log('-'.repeat(70));

  // 等待区块被索引
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
      deployment.verifiedAt = new Date().toISOString();
      
    } catch (error) {
      console.warn(`   ⚠️  ${name} verification failed:`, error.message);
      deployment.verified = false;
      deployment.verifyError = error.message;
    }
  }

  // 更新保存的部署信息
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const mumbaiFile = path.join(deploymentsDir, 'mumbai.json');
  if (fs.existsSync(mumbaiFile)) {
    const deploymentRecord = JSON.parse(fs.readFileSync(mumbaiFile, 'utf8'));
    deploymentRecord.contracts = deployments;
    fs.writeFileSync(mumbaiFile, JSON.stringify(deploymentRecord, null, 2));
  }
}

function printDeploymentSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📋 Deployment Summary');
  console.log('='.repeat(70));
  console.log(`Network: ${NETWORK_CONFIG.name}`);
  console.log(`Chain ID: ${NETWORK_CONFIG.chainId}`);
  console.log(`Explorer: ${NETWORK_CONFIG.explorer}`);
  console.log('\nDeployed Contracts:');
  
  for (const [name, deployment] of Object.entries(deployments)) {
    console.log(`\n  📄 ${name}:`);
    console.log(`     Address: ${deployment.address}`);
    console.log(`     Tx Hash: ${deployment.transactionHash}`);
    console.log(`     Block: ${deployment.blockNumber}`);
    console.log(`     Gas Used: ${deployment.gasUsed}`);
    if (deployment.verified) {
      console.log(`     Verified: ✅`);
    }
    console.log(`     URL: ${NETWORK_CONFIG.explorer}/address/${deployment.address}`);
  }

  console.log('\n' + '='.repeat(70));
  
  // 打印环境变量
  console.log('\n📝 Environment Variables:');
  console.log('-'.repeat(70));
  for (const [name, deployment] of Object.entries(deployments)) {
    const envVar = `MUMBAI_${name.toUpperCase()}_ADDRESS`;
    console.log(`${envVar}=${deployment.address}`);
  }
  console.log('-'.repeat(70));
}

// 运行部署
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    console.error(error.stack);
    process.exit(1);
  });
