import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * FidesOrigin 合约验证脚本 (TypeScript)
 * 
 * 功能：
 * 1. 从部署文件读取已部署合约
 * 2. 在多个区块链浏览器上验证合约
 * 3. 支持批量验证和单个合约验证
 * 4. 生成验证报告
 * 
 * 使用方式：
 *   npx tsx scripts/verify-contracts.ts --network sepolia
 *   npx tsx scripts/verify-contracts.ts --network sepolia --contract RiskRegistry
 *   npx tsx scripts/verify-contracts.ts --network sepolia --all
 */

interface NetworkConfig {
  name: string;
  chainId: number;
  explorer: string;
  apiKeyEnv: string;
  verifyCommand: string;
}

interface ContractInfo {
  name: string;
  address: string;
  constructorArgs: any[];
  verified?: boolean;
  verifiedAt?: string;
  verifyError?: string;
}

interface VerificationResult {
  name: string;
  address: string;
  success: boolean;
  alreadyVerified?: boolean;
  error?: string;
  timestamp: string;
  explorerUrl: string;
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  holesky: {
    name: 'Holesky Testnet',
    chainId: 17000,
    explorer: 'https://holesky.etherscan.io',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    explorer: 'https://etherscan.io',
    apiKeyEnv: 'ETHERSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    explorer: 'https://polygonscan.com',
    apiKeyEnv: 'POLYGONSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  amoy: {
    name: 'Polygon Amoy Testnet',
    chainId: 80002,
    explorer: 'https://amoy.polygonscan.com',
    apiKeyEnv: 'POLYGONSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    explorer: 'https://arbiscan.io',
    apiKeyEnv: 'ARBITRUM_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    explorer: 'https://optimistic.etherscan.io',
    apiKeyEnv: 'OPTIMISM_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    explorer: 'https://basescan.org',
    apiKeyEnv: 'BASESCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  bnb: {
    name: 'BNB Smart Chain',
    chainId: 56,
    explorer: 'https://bscscan.com',
    apiKeyEnv: 'BSCSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
  bnbTestnet: {
    name: 'BNB Testnet',
    chainId: 97,
    explorer: 'https://testnet.bscscan.com',
    apiKeyEnv: 'BSCSCAN_API_KEY',
    verifyCommand: 'verify:etherscan',
  },
};

async function main() {
  const network = process.argv.find(arg => arg.startsWith('--network'))?.split('=')[1] || 'sepolia';
  const targetContract = process.argv.find(arg => arg.startsWith('--contract'))?.split('=')[1];
  const verifyAll = process.argv.includes('--all');
  const skipVerified = process.argv.includes('--skip-verified');

  const networkConfig = NETWORK_CONFIGS[network];
  if (!networkConfig) {
    console.error(`❌ Unsupported network: ${network}`);
    console.log('Supported networks:', Object.keys(NETWORK_CONFIGS).join(', '));
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🔍 FidesOrigin Contract Verification');
  console.log('='.repeat(70));
  console.log(`📍 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
  console.log(`🔗 Explorer: ${networkConfig.explorer}`);
  console.log('='.repeat(70));

  // Check API key
  const apiKey = process.env[networkConfig.apiKeyEnv];
  if (!apiKey) {
    console.error(`❌ Missing ${networkConfig.apiKeyEnv} environment variable`);
    process.exit(1);
  }

  // Load deployment file
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);

  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Deployment file not found: ${deploymentFile}`);
    console.log('Run deployment script first or use --contract to specify a contract');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  
  if (!deployment.contracts) {
    console.error('❌ No contracts found in deployment file');
    process.exit(1);
  }

  // Get contracts to verify
  let contractsToVerify: ContractInfo[] = [];
  
  if (targetContract) {
    const contract = deployment.contracts[targetContract];
    if (!contract) {
      console.error(`❌ Contract ${targetContract} not found in deployment`);
      process.exit(1);
    }
    contractsToVerify.push({
      name: targetContract,
      address: contract.address,
      constructorArgs: contract.constructorArgs || [],
    });
  } else {
    for (const [name, info] of Object.entries(deployment.contracts)) {
      const contractInfo = info as any;
      if (skipVerified && contractInfo.verified) {
        console.log(`⏭️  Skipping ${name} (already verified)`);
        continue;
      }
      contractsToVerify.push({
        name,
        address: contractInfo.address,
        constructorArgs: contractInfo.constructorArgs || [],
        verified: contractInfo.verified,
      });
    }
  }

  if (contractsToVerify.length === 0) {
    console.log('\n✅ All contracts are already verified!');
    process.exit(0);
  }

  console.log(`\n📋 Found ${contractsToVerify.length} contract(s) to verify:\n`);
  contractsToVerify.forEach((c, i) => {
    const status = c.verified ? ' (already verified - will retry)' : '';
    console.log(`   ${i + 1}. ${c.name} at ${c.address}${status}`);
  });

  // Wait for block indexing
  console.log('\n⏳ Waiting 15 seconds for block indexing...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Verify each contract
  const results: VerificationResult[] = [];
  
  for (const contract of contractsToVerify) {
    const result = await verifyContract(contract, networkConfig);
    results.push(result);
    
    // Rate limiting - wait between verifications
    if (contractsToVerify.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Print summary
  printSummary(results, networkConfig);

  // Update deployment file
  await updateDeploymentFile(network, results);

  // Generate verification report
  generateReport(network, results, networkConfig);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Verification Complete!');
  console.log('='.repeat(70));

  // Exit with error if any verification failed
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} contract(s) failed verification`);
    process.exit(1);
  }
}

async function verifyContract(
  contract: ContractInfo,
  networkConfig: NetworkConfig
): Promise<VerificationResult> {
  console.log(`\n🔎 Verifying ${contract.name} at ${contract.address}...`);

  try {
    const { run } = await import('hardhat');
    
    await run('verify:verify', {
      address: contract.address,
      constructorArguments: contract.constructorArgs,
    });

    console.log(`   ✅ ${contract.name} verified successfully!`);

    return {
      name: contract.name,
      address: contract.address,
      success: true,
      timestamp: new Date().toISOString(),
      explorerUrl: `${networkConfig.explorer}/address/${contract.address}#code`,
    };
  } catch (error: any) {
    const errorMessage = error.message || '';

    // Check if already verified
    if (errorMessage.includes('Already Verified') || 
        errorMessage.includes('already verified') ||
        errorMessage.includes('Contract source code already verified')) {
      console.log(`   ✅ ${contract.name} is already verified`);
      return {
        name: contract.name,
        address: contract.address,
        success: true,
        alreadyVerified: true,
        timestamp: new Date().toISOString(),
        explorerUrl: `${networkConfig.explorer}/address/${contract.address}#code`,
      };
    }

    console.error(`   ❌ Verification failed: ${errorMessage.substring(0, 150)}`);

    return {
      name: contract.name,
      address: contract.address,
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      explorerUrl: `${networkConfig.explorer}/address/${contract.address}#code`,
    };
  }
}

function printSummary(results: VerificationResult[], networkConfig: NetworkConfig) {
  console.log('\n' + '='.repeat(70));
  console.log('📋 Verification Summary');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const alreadyVerified = results.filter(r => r.alreadyVerified);

  console.log(`\nTotal: ${results.length}`);
  console.log(`✅ Success: ${successful.length} (including ${alreadyVerified.length} already verified)`);
  console.log(`❌ Failed: ${failed.length}\n`);

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const already = result.alreadyVerified ? ' (already verified)' : '';
    console.log(`${status} ${result.name}${already}`);
    console.log(`   Address: ${result.address}`);
    console.log(`   URL: ${result.explorerUrl}`);
    if (result.error) {
      console.log(`   Error: ${result.error.substring(0, 100)}...`);
    }
    console.log('');
  }
}

async function updateDeploymentFile(network: string, results: VerificationResult[]) {
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

    for (const result of results) {
      if (deployment.contracts[result.name]) {
        deployment.contracts[result.name].verified = result.success;
        if (result.success) {
          deployment.contracts[result.name].verifiedAt = result.timestamp;
          deployment.contracts[result.name].explorerUrl = result.explorerUrl;
        }
        if (result.error) {
          deployment.contracts[result.name].verifyError = result.error;
        }
        if (result.alreadyVerified) {
          deployment.contracts[result.name].alreadyVerified = true;
        }
      }
    }

    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    console.log(`📝 Updated deployment file: ${deploymentFile}`);
  } catch (error: any) {
    console.warn(`⚠️  Could not update deployment file: ${error.message}`);
  }
}

function generateReport(network: string, results: VerificationResult[], networkConfig: NetworkConfig) {
  const reportsDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const reportFile = path.join(reportsDir, `verification-${network}-${Date.now()}.json`);
  
  const report = {
    network,
    chainId: networkConfig.chainId,
    generatedAt: new Date().toISOString(),
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    alreadyVerified: results.filter(r => r.alreadyVerified).length,
    results,
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`📄 Verification report saved: ${reportFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
