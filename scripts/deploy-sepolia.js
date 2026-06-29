const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * FidesOrigin Sepolia 测试网部署脚本
 * 部署合约:
 *   - FidesCompliance.sol
 *   - TestUSD.sol (测试稳定币)
 *
 * 使用方法:
 *   npx hardhat run scripts/deploy-sepolia.js --network sepolia
 *
 * 环境变量要求:
 *   - PRIVATE_KEY: 部署钱包私钥
 *   - ETHEREUM_SEPOLIA_RPC: Sepolia RPC 节点
 *   - ETHERSCAN_API_KEY: Etherscan API Key (用于验证)
 */

// 网络配置
const NETWORK_CONFIG = {
  name: 'Sepolia Testnet',
  network: 'sepolia',
  chainId: 11155111,
  explorer: 'https://sepolia.etherscan.io',
  confirmations: 5,
  verify: true,
};

// 部署记录
const deployments = {};

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 FidesOrigin Sepolia Testnet Deployment');
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
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);

  // 检查余额
  if (balance < hre.ethers.parseEther('0.01')) {
    console.warn('⚠️  Low balance detected! Deployment may fail.');
    console.warn('   Get Sepolia ETH from: https://sepoliafaucet.com');
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
  console.log('✅ Sepolia Deployment Complete!');
  console.log('='.repeat(70));
}

function validateEnvironment() {
  const required = ['PRIVATE_KEY', 'ETHEREUM_SEPOLIA_RPC'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  // 校验 PRIVATE_KEY 格式（不输出明文）
  const pk = process.env.PRIVATE_KEY;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.error('❌ PRIVATE_KEY format invalid (expect 0x + 64 hex chars)');
    process.exit(1);
  }

  // 校验 RPC URL 合法性
  const rpc = process.env.ETHEREUM_SEPOLIA_RPC;
  try {
    const u = new URL(rpc);
    if (u.protocol !== 'https:') {
      console.warn('⚠️  RPC not over HTTPS');
    }
  } catch {
    console.error('❌ ETHEREUM_SEPOLIA_RPC is not a valid URL');
    process.exit(1);
  }

  if (!process.env.ETHERSCAN_API_KEY) {
    console.warn('⚠️  ETHERSCAN_API_KEY not set, contract verification will be skipped');
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
    const fee = gasPrice.gasPrice ?? gasPrice.maxFeePerGas ?? 0n;
    if (fee === 0n) console.warn('   ⚠️  Unable to estimate fee (gasPrice null)');
    const estimatedCost = deploymentGas * fee;

    console.log(`   ⛽ Estimated Gas: ${deploymentGas.toString()}`);
    console.log(`   💵 Estimated Cost: ${hre.ethers.formatEther(estimatedCost)} ETH`);

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
      console.warn(`   ⚠️  getStats() unavailable: ${e.shortMessage || e.message}`);
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
    const fee = gasPrice.gasPrice ?? gasPrice.maxFeePerGas ?? 0n;
    if (fee === 0n) console.warn('   ⚠️  Unable to estimate fee (gasPrice null)');
    const estimatedCost = deploymentGas * fee;

    console.log(`   ⛽ Estimated Gas: ${deploymentGas.toString()}`);
    console.log(`   💵 Estimated Cost: ${hre.ethers.formatEther(estimatedCost)} ETH`);

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
      console.warn(`   ⚠️  getContractInfo() unavailable: ${e.shortMessage || e.message}`);
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
        ['uint8'],
        [1] // Action type: RESTRICT
      );

      const tx = await FidesCompliance.addRule(
        'Sample Rule',
        1, // Rule type
        ruleCondition,
        ruleAction
      );
      await tx.wait();

      console.log('   ✅ Sample compliance rule created');
    } catch (e) {
      console.warn(`   ⚠️  Configuration error: ${e.shortMessage || e.message}`);
    }
  }

  // 配置 TestUSD - 设置合规合约地址
  if (deployments.TestUSD && deployments.FidesCompliance) {
    try {
      const TestUSD = await hre.ethers.getContractAt(
        'TestUSD',
        deployments.TestUSD.address
      );

      console.log('\n🔧 Configuring TestUSD...');

      console.log('   🔗 Setting ComplianceContract...');
      const tx = await TestUSD.setComplianceContract(deployments.FidesCompliance.address);
      await tx.wait();

      console.log('   💰 Minting test tokens...');
      const mintTx = await TestUSD.mint(deployer.address, hre.ethers.parseEther('100000'));
      await mintTx.wait();

      console.log('   ✅ Minted 100,000 TUSD to deployer');
    } catch (e) {
      console.warn(`   ⚠️  Configuration error: ${e.shortMessage || e.message}`);
    }
  }
}

/**
 * 安全获取 RPC URL 的主机名（剥离认证信息）
 */
function safeHost(url) {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return '<invalid rpc url>';
  }
}

async function saveDeploymentInfo(deployer) {
  console.log('\n' + '-'.repeat(70));
  console.log('💾 Saving Deployment Info...');
  console.log('-'.repeat(70));

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  // recursive: true 在目录已存在时不抛错，直接调用即可
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const sepoliaFile = path.join(deploymentsDir, 'sepolia.json');

  const deploymentRecord = {
    network: NETWORK_CONFIG.network,
    chainId: NETWORK_CONFIG.chainId,
    networkName: NETWORK_CONFIG.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    explorer: NETWORK_CONFIG.explorer,
    // 仅记录主机，剥离认证信息 / API Key
    rpcHost: safeHost(process.env.ETHEREUM_SEPOLIA_RPC),
    contracts: deployments,
  };

  // 原子写入：先写临时文件，再重命名覆盖
  const tmp = sepoliaFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(deploymentRecord, null, 2));
  fs.renameSync(tmp, sepoliaFile);

  console.log(`   ✅ Deployment info saved to ${sepoliaFile}`);

  // 更新 .env.example（使用安全的逐行替换，避免正则注入）
  updateEnvExample();
}

/**
 * 安全设置环境变量行（逐行替换，避免正则注入）
 */
function setEnvLine(content, key, value) {
  const lines = content.split(/\r?\n/);
  let found = false;
  const out = lines.map(line => {
    const idx = line.indexOf(`${key}=`);
    if (idx === 0 || (idx > 0 && /\s/.test(line[idx - 1]))) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) out.push(`${key}=${value}`);
  return out.join('\n');
}

function updateEnvExample() {
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  if (!fs.existsSync(envExamplePath)) {
    console.log('   ⚠️  .env.example not found, skipping');
    return;
  }

  let envContent = fs.readFileSync(envExamplePath, 'utf8');

  for (const [name, deployment] of Object.entries(deployments)) {
    const envVar = `${name.toUpperCase()}_ADDRESS`;
    // 校验地址格式
    if (!hre.ethers.isAddress(deployment.address)) {
      throw new Error(`Invalid contract address for ${name}: ${deployment.address}`);
    }
    envContent = setEnvLine(envContent, envVar, deployment.address);
  }

  // 原子写入
  const tmp = envExamplePath + '.tmp';
  fs.writeFileSync(tmp, envContent);
  fs.renameSync(tmp, envExamplePath);

  console.log('   ✅ .env.example updated');
}

async function verifyContracts() {
  if (!NETWORK_CONFIG.verify) {
    console.log('\n⏭️  Skipping contract verification (ETHERSCAN_API_KEY not set)');
    return;
  }

  console.log('\n' + '-'.repeat(70));
  console.log('🔍 Verifying Contracts...');
  console.log('-'.repeat(70));

  const sepoliaFile = path.join(__dirname, '..', 'deployments', 'sepolia.json');

  for (const [name, deployment] of Object.entries(deployments)) {
    try {
      console.log(`\n   🔍 Verifying ${name}...`);

      // 等待 Etherscan 索引
      await new Promise(resolve => setTimeout(resolve, 30000));

      await hre.run('verify:verify', {
        address: deployment.address,
        constructorArguments: deployment.constructorArgs,
      });

      deployment.verified = true;
      console.log(`   ✅ ${name} verified`);
    } catch (e) {
      const errMessage = e.message || String(e);
      if (errMessage.toLowerCase().includes('already verified')) {
        deployment.verified = true;
        console.log(`   ℹ️  ${name} already verified`);
      } else {
        console.error(`   ❌ Failed to verify ${name}: ${errMessage}`);
      }
    }
  }

  // 更新验证状态（原子写入，避免竞态损坏）
  try {
    const deploymentRecord = JSON.parse(fs.readFileSync(sepoliaFile, 'utf8'));
    deploymentRecord.contracts = deployments;
    const tmp = sepoliaFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(deploymentRecord, null, 2));
    fs.renameSync(tmp, sepoliaFile);
  } catch (e) {
    console.warn(`   ⚠️  Failed to update verification status: ${e.message}`);
  }
}

function printDeploymentSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Deployment Summary');
  console.log('='.repeat(70));

  for (const [name, deployment] of Object.entries(deployments)) {
    console.log(`\n  📦 ${name}`);
    console.log(`     Address: ${deployment.address}`);
    console.log(`     Tx: ${deployment.transactionHash}`);
    console.log(`     Block: ${deployment.blockNumber}`);
    console.log(`     Gas: ${deployment.gasUsed}`);
    console.log(`     Verified: ${deployment.verified ? '✅' : '❌'}`);
    console.log(`     Explorer: ${NETWORK_CONFIG.explorer}/address/${deployment.address}`);
  }

  console.log('\n' + '='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed!');
    console.error(error);
    process.exit(1);
  });