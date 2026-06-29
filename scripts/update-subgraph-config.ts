import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * FidesOrigin Subgraph 配置更新脚本 (TypeScript)
 * 
 * 功能：
 * 1. 从部署文件读取合约地址
 * 2. 更新 subgraph.yaml 中的网络、地址和 startBlock
 * 3. 更新 networks.json
 * 4. 支持多网络配置
 * 
 * 使用方式：
 *   npx tsx scripts/update-subgraph-config.ts --network sepolia
 *   npx tsx scripts/update-subgraph-config.ts --network polygon --from-deployments
 */

interface NetworkConfig {
  name: string;
  chainId: number;
  startBlock: number;
}

interface ContractMapping {
  name: string;
  subgraphName: string;
  addressEnvVar?: string;
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  sepolia: {
    name: 'sepolia',
    chainId: 11155111,
    startBlock: 7650000,
  },
  holesky: {
    name: 'holesky',
    chainId: 17000,
    startBlock: 100000,
  },
  mainnet: {
    name: 'mainnet',
    chainId: 1,
    startBlock: 20000000,
  },
  polygon: {
    name: 'polygon',
    chainId: 137,
    startBlock: 60000000,
  },
  amoy: {
    name: 'amoy',
    chainId: 80002,
    startBlock: 100000,
  },
  arbitrum: {
    name: 'arbitrum',
    chainId: 42161,
    startBlock: 250000000,
  },
  optimism: {
    name: 'optimism',
    chainId: 10,
    startBlock: 120000000,
  },
  base: {
    name: 'base',
    chainId: 8453,
    startBlock: 15000000,
  },
  bnb: {
    name: 'bnb',
    chainId: 56,
    startBlock: 40000000,
  },
  bnbTestnet: {
    name: 'bnbTestnet',
    chainId: 97,
    startBlock: 40000000,
  },
};

const CONTRACT_MAPPINGS: ContractMapping[] = [
  { name: 'RiskRegistry', subgraphName: 'RiskRegistry', addressEnvVar: 'RISK_REGISTRY_ADDRESS' },
  { name: 'PolicyEngine', subgraphName: 'PolicyEngine', addressEnvVar: 'POLICY_ENGINE_ADDRESS' },
  { name: 'ComplianceEngine', subgraphName: 'ComplianceEngine', addressEnvVar: 'COMPLIANCE_ENGINE_ADDRESS' },
  { name: 'FidesCompliance', subgraphName: 'FidesCompliance', addressEnvVar: 'FIDES_COMPLIANCE_ADDRESS' },
  { name: 'CompliantSmartWallet', subgraphName: 'CompliantSmartWalletV3', addressEnvVar: 'COMPLIANT_SMART_WALLET_ADDRESS' },
];

async function main() {
  const network = process.argv.find(arg => arg.startsWith('--network'))?.split('=')[1] || 'sepolia';
  const fromDeployments = process.argv.includes('--from-deployments');
  const dryRun = process.argv.includes('--dry-run');

  const networkConfig = NETWORK_CONFIGS[network];
  if (!networkConfig) {
    console.error(`❌ Unsupported network: ${network}`);
    console.log('Supported networks:', Object.keys(NETWORK_CONFIGS).join(', '));
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🔄 FidesOrigin Subgraph Configuration Update');
  console.log('='.repeat(70));
  console.log(`📍 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
  console.log(`🔢 Start Block: ${networkConfig.startBlock}`);
  console.log(`🧪 Dry Run: ${dryRun ? 'Yes' : 'No'}`);
  console.log('='.repeat(70));

  const subgraphDir = path.join(__dirname, '..', 'apps', 'subgraph');
  const rootSubgraphDir = path.join(__dirname, '..', 'subgraph');
  
  // Determine which subgraph directory to use
  const targetDir = fs.existsSync(subgraphDir) ? subgraphDir : rootSubgraphDir;
  
  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Subgraph directory not found: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\n📁 Subgraph directory: ${targetDir}`);

  // Load contract addresses
  const addresses = fromDeployments
    ? await loadAddressesFromDeployments(network)
    : await loadAddressesFromEnv(network);

  if (Object.keys(addresses).length === 0) {
    console.error('❌ No contract addresses found');
    process.exit(1);
  }

  console.log('\n📋 Contract addresses:');
  for (const [name, address] of Object.entries(addresses)) {
    console.log(`   ${name}: ${address}`);
  }

  // Update subgraph.yaml
  await updateSubgraphYaml(targetDir, networkConfig, addresses, dryRun);

  // Update networks.json
  await updateNetworksJson(targetDir, networkConfig, addresses, dryRun);

  // Update .env file
  if (!dryRun) {
    await updateEnvFile(network, addresses);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Subgraph configuration updated!');
  console.log('='.repeat(70));
  console.log(`\nNext steps:`);
  console.log(`  1. cd ${path.relative(process.cwd(), targetDir)}`);
  console.log(`  2. pnpm run codegen`);
  console.log(`  3. pnpm run build`);
  console.log(`  4. pnpm run deploy`);
}

async function loadAddressesFromDeployments(network: string): Promise<Record<string, string>> {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentFile = path.join(deploymentsDir, `${network}.json`);

  if (!fs.existsSync(deploymentFile)) {
    console.warn(`⚠️  Deployment file not found: ${deploymentFile}`);
    return {};
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const addresses: Record<string, string> = {};

  if (deployment.contracts) {
    for (const [name, info] of Object.entries(deployment.contracts)) {
      const contractInfo = info as any;
      if (contractInfo.address) {
        addresses[name] = contractInfo.address;
      }
    }
  }

  return addresses;
}

async function loadAddressesFromEnv(network: string): Promise<Record<string, string>> {
  const addresses: Record<string, string> = {};
  const prefix = network.toUpperCase();

  for (const mapping of CONTRACT_MAPPINGS) {
    const envVar = `${prefix}_${mapping.name.toUpperCase()}_ADDRESS`;
    const address = process.env[envVar];
    if (address) {
      addresses[mapping.name] = address;
    }
  }

  // Also check generic env vars
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile) && Object.keys(addresses).length === 0) {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const mapping of CONTRACT_MAPPINGS) {
      const envVar = `${prefix}_${mapping.name.toUpperCase()}_ADDRESS`;
      const match = content.match(new RegExp(`${envVar}=(0x[a-fA-F0-9]{40})`));
      if (match) {
        addresses[mapping.name] = match[1];
      }
    }
  }

  return addresses;
}

async function updateSubgraphYaml(
  subgraphDir: string,
  networkConfig: NetworkConfig,
  addresses: Record<string, string>,
  dryRun: boolean
) {
  const subgraphYamlPath = path.join(subgraphDir, 'subgraph.yaml');

  if (!fs.existsSync(subgraphYamlPath)) {
    console.warn(`⚠️  subgraph.yaml not found: ${subgraphYamlPath}`);
    return;
  }

  let content = fs.readFileSync(subgraphYamlPath, 'utf8');

  // Update network
  content = content.replace(/network: \w+/g, `network: ${networkConfig.name}`);

  // Update contract addresses
  for (const mapping of CONTRACT_MAPPINGS) {
    const address = addresses[mapping.name];
    if (!address) continue;

    // Find and update the address for this contract
    const contractRegex = new RegExp(
      `(name: ${mapping.subgraphName}[\\s\\S]*?address: ")[^"]+`,
      'g'
    );
    content = content.replace(contractRegex, `$1${address}`);
  }

  // Update startBlock values
  content = content.replace(/startBlock: \d+/g, `startBlock: ${networkConfig.startBlock}`);

  if (dryRun) {
    console.log('\n📄 subgraph.yaml (dry run - would write):');
    console.log(content.substring(0, 500) + '...');
  } else {
    fs.writeFileSync(subgraphYamlPath, content);
    console.log('✅ Updated subgraph.yaml');
  }
}

async function updateNetworksJson(
  subgraphDir: string,
  networkConfig: NetworkConfig,
  addresses: Record<string, string>,
  dryRun: boolean
) {
  const networksJsonPath = path.join(subgraphDir, 'networks.json');

  const networksData: Record<string, Record<string, { address: string; startBlock: number }>> = {};

  // Load existing if present
  if (fs.existsSync(networksJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(networksJsonPath, 'utf8'));
      Object.assign(networksData, existing);
    } catch {
      // Ignore parse errors
    }
  }

  // Update for current network
  networksData[networkConfig.name] = {};
  for (const mapping of CONTRACT_MAPPINGS) {
    const address = addresses[mapping.name];
    if (address) {
      networksData[networkConfig.name][mapping.subgraphName] = {
        address,
        startBlock: networkConfig.startBlock,
      };
    }
  }

  if (dryRun) {
    console.log('\n📄 networks.json (dry run - would write):');
    console.log(JSON.stringify(networksData, null, 2).substring(0, 500) + '...');
  } else {
    fs.writeFileSync(networksJsonPath, JSON.stringify(networksData, null, 2));
    console.log('✅ Updated networks.json');
  }
}

async function updateEnvFile(network: string, addresses: Record<string, string>) {
  const envFile = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envFile)) {
    console.log('⚠️  .env file not found, skipping update');
    return;
  }

  let content = fs.readFileSync(envFile, 'utf8');
  const prefix = network.toUpperCase();

  for (const [name, address] of Object.entries(addresses)) {
    const envVar = `${prefix}_${name.toUpperCase()}_ADDRESS`;
    const regex = new RegExp(`${envVar}=.*`, 'g');
    
    if (content.includes(envVar)) {
      content = content.replace(regex, `${envVar}=${address}`);
    } else {
      content += `\n${envVar}=${address}`;
    }
  }

  fs.writeFileSync(envFile, content);
  console.log('✅ Updated .env file');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Subgraph config update failed:', error);
    process.exit(1);
  });
