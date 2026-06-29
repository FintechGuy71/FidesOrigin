import hre, { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * FidesOrigin 合约部署脚本 (TypeScript)
 *
 * 功能：
 * 1. 读取部署配置
 * 2. 按依赖顺序部署合约
 * 3. 保存部署地址到文件
 * 4. 自动更新 subgraph 配置
 * 5. 生成部署报告
 *
 * 使用方式：
 *   npx tsx scripts/deploy-contracts.ts --network sepolia
 *   npx tsx scripts/deploy-contracts.ts --network polygon --verify
 */

interface NetworkConfig {
  name: string;
  chainId: number;
  rpcEnv: string;
  explorer: string;
  gasPrice?: string;
}

interface ContractConfig {
  name: string;
  args?: any[];
  dependsOn?: string[];
  verify?: boolean;
}

interface DeploymentResult {
  name: string;
  address: string;
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  constructorArgs: any[];
  verified: boolean;
  timestamp: string;
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcEnv: 'ETHEREUM_SEPOLIA_RPC',
    explorer: 'https://sepolia.etherscan.io',
  },
  holesky: {
    name: 'Holesky Testnet',
    chainId: 17000,
    rpcEnv: 'HOLESKY_RPC',
    explorer: 'https://holesky.etherscan.io',
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcEnv: 'POLYGON_MAINNET_RPC',
    explorer: 'https://polygonscan.com',
    gasPrice: '50',
  },
  amoy: {
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    rpcEnv: 'AMOY_RPC',
    explorer: 'https://amoy.polygonscan.com',
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcEnv: 'ARBITRUM_RPC',
    explorer: 'https://arbiscan.io',
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcEnv: 'OPTIMISM_RPC',
    explorer: 'https://optimistic.etherscan.io',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcEnv: 'BASE_RPC',
    explorer: 'https://basescan.org',
  },
  bnb: {
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcEnv: 'BNB_MAINNET_RPC',
    explorer: 'https://bscscan.com',
  },
  bnbTestnet: {
    name: 'BNB Testnet',
    chainId: 97,
    rpcEnv: 'BNB_TESTNET_RPC',
    explorer: 'https://testnet.bscscan.com',
  },
};

const CONTRACTS: ContractConfig[] = [
  { name: 'RiskRegistry', args: [], verify: true },
  { name: 'PolicyEngine', args: [], dependsOn: ['RiskRegistry'], verify: true },
  { name: 'ComplianceEngine', args: [], dependsOn: ['RiskRegistry', 'PolicyEngine'], verify: true },
  { name: 'CompliantStablecoin', args: [], dependsOn: ['ComplianceEngine'], verify: true },
  { name: 'CompliantSmartWallet', args: [], dependsOn: ['ComplianceEngine'], verify: true },
  { name: 'FidesCompliance', args: [], dependsOn: ['ComplianceEngine'], verify: true },
  { name: 'QuarantineVault', args: [], dependsOn: ['ComplianceEngine'], verify: true },
];

async function main() {
  const network = process.argv.find(arg => arg.startsWith('--network'))?.split('=')[1] || 'sepolia';
  const shouldVerify = process.argv.includes('--verify');
  const dryRun = process.argv.includes('--dry-run');

  const networkConfig = NETWORK_CONFIGS[network];
  if (!networkConfig) {
    console.error(`❌ Unsupported network: ${network}`);
    console.log('Supported networks:', Object.keys(NETWORK_CONFIGS).join(', '));
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🚀 FidesOrigin Contract Deployment');
  console.log('='.repeat(70));
  console.log(`📍 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
  console.log(`🔗 Explorer: ${networkConfig.explorer}`);
  console.log(`🔍 Verify: ${shouldVerify ? 'Yes' : 'No'}`);
  console.log(`🧪 Dry Run: ${dryRun ? 'Yes' : 'No'}`);
  console.log('='.repeat(70));

  if (dryRun) {
    console.log('\n📋 Dry run mode - no actual deployment\n');
    printDeploymentPlan(CONTRACTS);
    process.exit(0);
  }

  // Check private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.error('❌ PRIVATE_KEY not set or is placeholder');
    process.exit(1);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error('❌ PRIVATE_KEY format invalid (expect 0x + 64 hex chars)');
    process.exit(1);
  }

  // Check RPC
  const rpcUrl = process.env[networkConfig.rpcEnv];
  if (!rpcUrl) {
    console.error(`❌ ${networkConfig.rpcEnv} not set`);
    process.exit(1);
  }

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.getBalance();

  console.log(`\n👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.utils.formatEther(balance)} ETH`);
  console.log(`⛽ Gas Price: ${networkConfig.gasPrice || 'auto'} gwei\n`);

  if (balance.lt(ethers.utils.parseEther('0.01'))) {
    console.warn('⚠️  Low balance! Deployment may fail.');
  }

  // Load previous deployment if exists
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);

  let previousDeployment: Record<string, any> = {};
  if (fs.existsSync(deploymentFile)) {
    previousDeployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    console.log(`📁 Loaded previous deployment from ${deploymentFile}\n`);
  }

  // Deploy contracts
  const results: DeploymentResult[] = [];
  const deployedContracts: Record<string, string> = {};

  for (const contract of CONTRACTS) {
    const result = await deployContract(contract, deployedContracts, shouldVerify);
    if (result) {
      results.push(result);
      deployedContracts[contract.name] = result.address;
    } else {
      // 如果有依赖于此合约的其他合约，后续部署将因 dependsOn 校验失败而中断
      console.error(`🛑 ${contract.name} deployment returned null. Subsequent dependent contracts will fail.`);
    }
  }

  // Save deployment
  const deployment = {
    network,
    chainId: networkConfig.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    commit: getGitCommit(),
    branch: getGitBranch(),
    contracts: results.reduce((acc, r) => {
      acc[r.name] = {
        address: r.address,
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        gasUsed: r.gasUsed,
        constructorArgs: r.constructorArgs,
        verified: r.verified,
      };
      return acc;
    }, {} as Record<string, any>),
    previousDeployment: previousDeployment.deployedAt || null,
  };

  fs.mkdirSync(deploymentsDir, { recursive: true });
  // Atomic write: write to temp file first, then rename
  const tmpDeployment = `${deploymentFile}.tmp`;
  fs.writeFileSync(tmpDeployment, JSON.stringify(deployment, null, 2));
  fs.renameSync(tmpDeployment, deploymentFile);
  console.log(`\n📝 Deployment saved to ${deploymentFile}`);

  // Update subgraph config
  await updateSubgraphConfig(network, deployedContracts);

  // Update .env file
  await updateEnvFile(network, deployedContracts);

  // Print summary
  printDeploymentSummary(results, networkConfig);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Deployment Complete!');
  console.log('='.repeat(70));
}

async function deployContract(
  config: ContractConfig,
  deployedContracts: Record<string, string>,
  shouldVerify: boolean
): Promise<DeploymentResult | null> {
  console.log(`\n🔨 Deploying ${config.name}...`);

  // Step 1: 严格校验前置依赖是否已成功部署
  if (config.dependsOn) {
    for (const dep of config.dependsOn) {
      if (!deployedContracts[dep]) {
        console.error(`   ❌ Cannot deploy ${config.name}: Dependency '${dep}' is missing or failed to deploy.`);
        throw new Error(
          `Cannot deploy ${config.name}: Dependency '${dep}' is missing or failed to deploy.`
        );
      }
    }
  }

  // Step 2: 准备阶段（合约工厂、参数解析）— 失败可安全返回 null
  let contract: any;
  let resolvedArgs: any[];
  try {
    const ContractFactory = await ethers.getContractFactory(config.name);

    // 严格解析构造参数，拒绝将未解析的纯文本直接传给合约
    resolvedArgs = (config.args || []).map(arg => {
      if (typeof arg === 'string') {
        // 如果字符串匹配已部署合约名，替换为地址
        if (deployedContracts[arg]) {
          return deployedContracts[arg];
        }
        // 如果不是已部署的合约，且不是合法的以太坊地址或数字，直接报错防止意外转型
        if (!ethers.utils.isAddress(arg) && isNaN(Number(arg))) {
          throw new Error(`Unresolved dependency or invalid argument: "${arg}"`);
        }
      }
      return arg;
    });

    // 发送部署交易
    contract = await ContractFactory.deploy(...resolvedArgs);
    await contract.deployed();
  } catch (error: unknown) {
    let errMessage: string;
    if (error instanceof Error) {
      errMessage = error.message;
    } else {
      errMessage = String(error);
    }
    console.error(`   ❌ Failed to deploy ${config.name}: ${errMessage}`);
    return null;
  }

  // Step 3: 等待回执 — 如果此处失败，交易可能已上链，绝不能当作普通失败处理
  let receipt: any;
  try {
    receipt = await contract.deployTransaction.wait();
  } catch (waitError: unknown) {
    console.error(`🚨 Critical: Tx sent but receipt fetching failed for ${config.name}.`);
    console.error(`🚨 TxHash: ${contract.deployTransaction.hash}. Manual check required!`);
    // 强制中断整个部署流程，要求人工介入
    throw waitError;
  }

  const gasUsed = receipt.gasUsed.toString();

  console.log(`   ✅ ${config.name} deployed at ${contract.address}`);
  console.log(`   📦 Tx: ${contract.deployTransaction.hash}`);
  console.log(`   ⛽ Gas used: ${gasUsed}`);
  console.log(`   🔢 Block: ${receipt.blockNumber}`);

  let verified = false;
  if (shouldVerify && config.verify) {
    verified = await verifyContract(config.name, contract.address, resolvedArgs);
  }

  return {
    name: config.name,
    address: contract.address,
    txHash: contract.deployTransaction.hash,
    blockNumber: receipt.blockNumber,
    gasUsed,
    constructorArgs: resolvedArgs,
    verified,
    timestamp: new Date().toISOString(),
  };
}

async function verifyContract(
  name: string,
  address: string,
  constructorArgs: any[]
): Promise<boolean> {
  console.log(`   🔍 Verifying ${name} on Etherscan...`);

  try {
    // Wait for Etherscan to index the contract
    await new Promise(resolve => setTimeout(resolve, 15000));

    await hre.run('verify:verify', {
      address,
      constructorArguments: constructorArgs,
    });

    console.log(`   ✅ ${name} verified successfully`);
    return true;
  } catch (error: unknown) {
    let errMessage: string;
    if (error instanceof Error) {
      errMessage = error.message;
    } else {
      errMessage = String(error);
    }

    if (errMessage.toLowerCase().includes('already verified')) {
      console.log(`   ℹ️  ${name} already verified`);
      return true;
    }

    console.error(`   ⚠️  Failed to verify ${name}: ${errMessage}`);
    return false;
  }
}

async function updateSubgraphConfig(
  network: string,
  deployedContracts: Record<string, string>
): Promise<void> {
  const subgraphConfigPath = path.join(__dirname, '..', 'subgraph', 'networks.json');

  let config: Record<string, any> = {};
  if (fs.existsSync(subgraphConfigPath)) {
    config = JSON.parse(fs.readFileSync(subgraphConfigPath, 'utf8'));
  }

  config[network] = {
    ...config[network],
    RiskRegistry: { address: deployedContracts.RiskRegistry || '' },
    PolicyEngine: { address: deployedContracts.PolicyEngine || '' },
    ComplianceEngine: { address: deployedContracts.ComplianceEngine || '' },
    CompliantStablecoin: { address: deployedContracts.CompliantStablecoin || '' },
    CompliantSmartWallet: { address: deployedContracts.CompliantSmartWallet || '' },
    FidesCompliance: { address: deployedContracts.FidesCompliance || '' },
    QuarantineVault: { address: deployedContracts.QuarantineVault || '' },
  };

  // Atomic write
  const tmp = `${subgraphConfigPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
  fs.renameSync(tmp, subgraphConfigPath);

  console.log(`📁 Subgraph config updated: ${subgraphConfigPath}`);
}

async function updateEnvFile(
  network: string,
  deployedContracts: Record<string, string>
): Promise<void> {
  const envFile = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envFile)) {
    console.log('⚠️  .env file not found, skipping env update');
    return;
  }

  let content = fs.readFileSync(envFile, 'utf8');

  // 使用安全的逐行替换，避免正则注入风险
  for (const [name, address] of Object.entries(deployedContracts)) {
    const envVar = `${name.toUpperCase()}_ADDRESS`;
    content = setEnvLine(content, envVar, address);
  }

  // Atomic write: write to temp file first, then rename
  const tmp = `${envFile}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, envFile);

  console.log(`📁 .env file updated`);
}

function setEnvLine(content: string, key: string, value: string): string {
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

function printDeploymentPlan(contracts: ContractConfig[]): void {
  console.log('Deployment Plan:');
  console.log('-'.repeat(70));
  for (const contract of contracts) {
    const deps = contract.dependsOn
      ? ` (depends on: ${contract.dependsOn.join(', ')})`
      : '';
    const verify = contract.verify ? ' [verify]' : '';
    console.log(`  📦 ${contract.name}${deps}${verify}`);
  }
  console.log('-'.repeat(70));
}

function printDeploymentSummary(
  results: DeploymentResult[],
  networkConfig: NetworkConfig
): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 Deployment Summary');
  console.log('='.repeat(70));

  for (const result of results) {
    console.log(`\n  📦 ${result.name}`);
    console.log(`     Address: ${result.address}`);
    console.log(`     Tx: ${result.txHash}`);
    console.log(`     Block: ${result.blockNumber}`);
    console.log(`     Gas: ${result.gasUsed}`);
    console.log(`     Verified: ${result.verified ? '✅' : '❌'}`);
    console.log(`     Explorer: ${networkConfig.explorer}/address/${result.address}`);
  }

  console.log('\n' + '='.repeat(70));
}

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    let errMessage: string;
    if (error instanceof Error) {
      errMessage = error.message;
    } else {
      errMessage = String(error);
    }
    console.error('\n❌ Deployment failed:', errMessage);
    process.exit(1);
  });