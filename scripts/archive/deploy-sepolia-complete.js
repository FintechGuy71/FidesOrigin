const hre = require('hardhat');
const { upgrades } = hre;
const fs = require('fs');
const path = require('path');

/**
 * Complete v0.2.1 Deployment - Deploy remaining contracts
 */

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 FidesOrigin v0.2.1 - Complete Pending Deployment');
  console.log('='.repeat(70));
  
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`\n👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);

  // Load existing deployments
  const existing = {
    RiskRegistry: '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc',
    PolicyEngine: '0x87089F67A61F9643796AE154663A6a9F21196b38',
    ComplianceEngine: '0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC',
    QuarantineVault: '0x497176b21CC2EDd90a8725a3023742358311a382'
  };

  const deployments = { ...existing };

  // 5. FidesCompliance (Direct Deploy - not UUPS, has constructor args)
  console.log('\n📦 5/6 Deploying FidesCompliance...');
  const FidesCompliance = await hre.ethers.getContractFactory('FidesCompliance');
  const fidesCompliance = await FidesCompliance.deploy(
    deployments.ComplianceEngine,
    deployments.RiskRegistry,
    deployments.PolicyEngine,
    deployments.QuarantineVault
  );
  await fidesCompliance.waitForDeployment();
  deployments.FidesCompliance = await fidesCompliance.getAddress();
  console.log(`   ✅ Direct: ${deployments.FidesCompliance}`);

  // 6. CompliantStableCoin (Direct)
  console.log('\n📦 6/6 Deploying CompliantStableCoin...');
  const CompliantStableCoin = await hre.ethers.getContractFactory('CompliantStableCoin');
  const stableCoin = await CompliantStableCoin.deploy(
    'FidesOrigin USD',
    'fUSD',
    deployments.ComplianceEngine
  );
  await stableCoin.waitForDeployment();
  deployments.CompliantStableCoin = await stableCoin.getAddress();
  console.log(`   ✅ Direct: ${deployments.CompliantStableCoin}`);

  // Setup Roles (only for UUPS contracts)
  console.log('\n🔐 Setting up roles...');
  
  // Connect to existing contracts
  const riskRegistry = await hre.ethers.getContractAt('RiskRegistry', deployments.RiskRegistry);
  const policyEngine = await hre.ethers.getContractAt('PolicyEngine', deployments.PolicyEngine);
  const complianceEngine = await hre.ethers.getContractAt('ComplianceEngine', deployments.ComplianceEngine);
  
  const ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
  const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();
  const OPERATOR_ROLE = await complianceEngine.OPERATOR_ROLE();
  
  // Grant roles
  await (await riskRegistry.grantRole(ORACLE_ROLE, deployments.ComplianceEngine)).wait();
  await (await riskRegistry.grantRole(ORACLE_ROLE, deployer.address)).wait();
  await (await policyEngine.grantRole(COMPLIANCE_ENGINE_ROLE, deployments.ComplianceEngine)).wait();
  await (await complianceEngine.grantRole(OPERATOR_ROLE, deployer.address)).wait();
  console.log('   ✅ Roles configured');

  // Seed test data
  console.log('\n🌱 Seeding test data...');
  const testAddresses = [
    '0x1234567890123456789012345678901234567890',
    '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  ];
  
  for (let i = 0; i < testAddresses.length; i++) {
    await (await riskRegistry.updateRiskProfile(
      testAddresses[i],
      80 + i * 5,
      3, // HIGH
      [hre.ethers.encodeBytes32String('test')],
      i === 0
    )).wait();
  }
  console.log('   ✅ Risk profiles added');

  // Mint test tokens
  await (await stableCoin.mint(deployer.address, hre.ethers.parseUnits('1000000', 6))).wait();
  console.log('   ✅ 1M fUSD minted to deployer');

  // Save deployment
  console.log('\n💾 Saving deployment info...');
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  
  const deploymentRecord = {
    network: 'sepolia',
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      RiskRegistry: { address: deployments.RiskRegistry, proxy: 'UUPS' },
      PolicyEngine: { address: deployments.PolicyEngine, proxy: 'UUPS' },
      ComplianceEngine: { address: deployments.ComplianceEngine, proxy: 'UUPS' },
      QuarantineVault: { address: deployments.QuarantineVault, proxy: 'Direct' },
      FidesCompliance: { address: deployments.FidesCompliance, proxy: 'UUPS' },
      CompliantStableCoin: { address: deployments.CompliantStableCoin, proxy: 'Direct' }
    },
    status: 'complete'
  };
  
  fs.writeFileSync(
    path.join(deploymentsDir, 'sepolia-v0.2.1-complete.json'),
    JSON.stringify(deploymentRecord, null, 2)
  );
  
  // Update latest
  fs.writeFileSync(
    path.join(deploymentsDir, 'sepolia-latest.json'),
    JSON.stringify(deploymentRecord, null, 2)
  );

  console.log('\n' + '='.repeat(70));
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('='.repeat(70));
  for (const [name, addr] of Object.entries(deployments)) {
    console.log(`📄 ${name}: ${addr}`);
  }
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
