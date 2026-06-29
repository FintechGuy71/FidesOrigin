const hre = require('hardhat');
const { upgrades } = hre;
const fs = require('fs');
const path = require('path');

/**
 * FidesOrigin v0.2.1 Full Sepolia Deployment
 * Deploys complete protocol stack with UUPS proxies
 */

const NETWORK_CONFIG = {
  name: 'Sepolia Testnet',
  network: 'sepolia',
  chainId: 11155111,
  explorer: 'https://sepolia.etherscan.io',
};

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 FidesOrigin v0.2.1 Full Sepolia Deployment');
  console.log('='.repeat(70));
  console.log(`⏰ ${new Date().toISOString()}`);
  
  // Wait for provider to be ready
  await hre.ethers.provider.ready;
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n👤 Deployer: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);
  
  if (balance < hre.ethers.parseEther('0.02')) {
    console.error('❌ Insufficient balance. Need at least 0.02 ETH for full deployment.');
    console.error('   Get Sepolia ETH: https://sepoliafaucet.com');
    process.exit(1);
  }

  const deployments = {};

  // 1. RiskRegistry (UUPS Proxy)
  console.log('\n📦 1/6 Deploying RiskRegistry...');
  const RiskRegistry = await hre.ethers.getContractFactory('RiskRegistry');
  const riskRegistry = await upgrades.deployProxy(RiskRegistry, [], {
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await riskRegistry.waitForDeployment();
  deployments.RiskRegistry = {
    address: await riskRegistry.getAddress(),
    impl: await upgrades.erc1967.getImplementationAddress(await riskRegistry.getAddress()),
    proxy: 'UUPS',
  };
  console.log(`   ✅ Proxy: ${deployments.RiskRegistry.address}`);
  console.log(`   🔧 Impl:  ${deployments.RiskRegistry.impl}`);

  // 2. PolicyEngine (UUPS Proxy)
  console.log('\n📦 2/6 Deploying PolicyEngine...');
  const PolicyEngine = await hre.ethers.getContractFactory('PolicyEngine');
  const policyEngine = await upgrades.deployProxy(PolicyEngine, [deployments.RiskRegistry.address], {
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await policyEngine.waitForDeployment();
  deployments.PolicyEngine = {
    address: await policyEngine.getAddress(),
    impl: await upgrades.erc1967.getImplementationAddress(await policyEngine.getAddress()),
    proxy: 'UUPS',
  };
  console.log(`   ✅ Proxy: ${deployments.PolicyEngine.address}`);
  console.log(`   🔧 Impl:  ${deployments.PolicyEngine.impl}`);

  // 3. ComplianceEngine (UUPS Proxy)
  console.log('\n📦 3/6 Deploying ComplianceEngine...');
  const ComplianceEngine = await hre.ethers.getContractFactory('ComplianceEngine');
  const complianceEngine = await upgrades.deployProxy(ComplianceEngine, [
    deployments.RiskRegistry.address,
    deployments.PolicyEngine.address
  ], {
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await complianceEngine.waitForDeployment();
  deployments.ComplianceEngine = {
    address: await complianceEngine.getAddress(),
    impl: await upgrades.erc1967.getImplementationAddress(await complianceEngine.getAddress()),
    proxy: 'UUPS',
  };
  console.log(`   ✅ Proxy: ${deployments.ComplianceEngine.address}`);
  console.log(`   🔧 Impl:  ${deployments.ComplianceEngine.impl}`);

  // 4. QuarantineVault (Direct - no proxy needed)
  console.log('\n📦 4/6 Deploying QuarantineVault...');
  const QuarantineVault = await hre.ethers.getContractFactory('QuarantineVault');
  const quarantineVault = await QuarantineVault.deploy();
  await quarantineVault.waitForDeployment();
  deployments.QuarantineVault = {
    address: await quarantineVault.getAddress(),
    proxy: 'Direct',
  };
  console.log(`   ✅ Direct: ${deployments.QuarantineVault.address}`);

  // 5. FidesCompliance (UUPS Proxy)
  console.log('\n📦 5/6 Deploying FidesCompliance...');
  const FidesCompliance = await hre.ethers.getContractFactory('FidesCompliance');
  const fidesCompliance = await upgrades.deployProxy(FidesCompliance, [], {
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await fidesCompliance.waitForDeployment();
  deployments.FidesCompliance = {
    address: await fidesCompliance.getAddress(),
    impl: await upgrades.erc1967.getImplementationAddress(await fidesCompliance.getAddress()),
    proxy: 'UUPS',
  };
  console.log(`   ✅ Proxy: ${deployments.FidesCompliance.address}`);
  console.log(`   🔧 Impl:  ${deployments.FidesCompliance.impl}`);

  // 6. CompliantStableCoin (Direct)
  console.log('\n📦 6/6 Deploying CompliantStableCoin...');
  const CompliantStableCoin = await hre.ethers.getContractFactory('CompliantStableCoin');
  const stableCoin = await CompliantStableCoin.deploy(
    'FidesOrigin USD',
    'fUSD',
    deployments.ComplianceEngine.address
  );
  await stableCoin.waitForDeployment();
  deployments.CompliantStableCoin = {
    address: await stableCoin.getAddress(),
    proxy: 'Direct',
  };
  console.log(`   ✅ Direct: ${deployments.CompliantStableCoin.address}`);

  // 7. Setup Roles
  console.log('\n🔐 Setting up roles...');
  const ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
  const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();
  const OPERATOR_ROLE = await complianceEngine.OPERATOR_ROLE();
  
  await riskRegistry.grantRole(ORACLE_ROLE, deployments.ComplianceEngine.address);
  await riskRegistry.grantRole(ORACLE_ROLE, deployer.address);
  await policyEngine.grantRole(COMPLIANCE_ENGINE_ROLE, deployments.ComplianceEngine.address);
  await complianceEngine.grantRole(OPERATOR_ROLE, deployer.address);
  console.log('   ✅ Roles configured');

  // 8. Seed test data
  console.log('\n🌱 Seeding test data...');
  const testAddresses = [
    '0x1234567890123456789012345678901234567890',
    '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  ];
  for (let i = 0; i < testAddresses.length; i++) {
    await riskRegistry.updateRiskProfile(
      testAddresses[i],
      80 + i * 5,
      3, // HIGH
      [hre.ethers.encodeBytes32String('test')],
      i === 0
    );
  }
  await stableCoin.mint(deployer.address, hre.ethers.parseUnits('1000000', 6));
  console.log('   ✅ Test data seeded');

  // 9. Save deployment
  console.log('\n💾 Saving deployment info...');
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  
  const deploymentRecord = {
    network: NETWORK_CONFIG.network,
    chainId: NETWORK_CONFIG.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployments,
  };
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'sepolia-v0.2.1.json'),
    JSON.stringify(deploymentRecord, null, 2)
  );
  fs.writeFileSync(
    path.join(deploymentsDir, 'sepolia-latest.json'),
    JSON.stringify(deploymentRecord, null, 2)
  );

  // 10. Print summary
  console.log('\n' + '='.repeat(70));
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('='.repeat(70));
  for (const [name, info] of Object.entries(deployments)) {
    console.log(`\n📄 ${name}:`);
    console.log(`   Address: ${info.address}`);
    if (info.impl) console.log(`   Impl:    ${info.impl}`);
    console.log(`   ${NETWORK_CONFIG.explorer}/address/${info.address}`);
  }
  
  console.log('\n📋 Environment Variables:');
  console.log(`SEPOLIA_RISK_REGISTRY=${deployments.RiskRegistry.address}`);
  console.log(`SEPOLIA_POLICY_ENGINE=${deployments.PolicyEngine.address}`);
  console.log(`SEPOLIA_COMPLIANCE_ENGINE=${deployments.ComplianceEngine.address}`);
  console.log(`SEPOLIA_QUARANTINE_VAULT=${deployments.QuarantineVault.address}`);
  console.log(`SEPOLIA_FIDES_COMPLIANCE=${deployments.FidesCompliance.address}`);
  console.log(`SEPOLIA_STABLECOIN=${deployments.CompliantStableCoin.address}`);
  console.log('='.repeat(70));
  
  // Return addresses for Subgraph update
  return deployments;
}

main()
  .then((deployments) => {
    console.log('\n✅ All contracts deployed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
