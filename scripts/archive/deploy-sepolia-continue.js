const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Load existing deployment
const DEPLOYMENTS_DIR = path.join(__dirname, '..', 'deployments');
const sepoliaFile = path.join(DEPLOYMENTS_DIR, 'sepolia-latest.json');
const sepoliaData = JSON.parse(fs.readFileSync(sepoliaFile, 'utf8'));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTx(txPromise, label) {
  console.log(`⏳ ${label}...`);
  const tx = await txPromise;
  await sleep(5000); // Wait 5s between transactions
  const receipt = await tx.wait();
  console.log(`✅ ${label} confirmed (tx: ${tx.hash})`);
  return receipt;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Continuing deployment with account:', deployer.address);
  
  const riskRegistryAddr = sepoliaData.contracts.RiskRegistry.address;
  const policyEngineAddr = sepoliaData.contracts.PolicyEngine.address;
  const complianceEngineAddr = sepoliaData.contracts.ComplianceEngine.address;
  
  // Attach to deployed contracts
  const RiskRegistry = await hre.ethers.getContractFactory('RiskRegistry');
  const PolicyEngine = await hre.ethers.getContractFactory('PolicyEngine');
  const ComplianceEngine = await hre.ethers.getContractFactory('ComplianceEngine');
  
  const riskRegistry = RiskRegistry.attach(riskRegistryAddr);
  const policyEngine = PolicyEngine.attach(policyEngineAddr);
  const complianceEngine = ComplianceEngine.attach(complianceEngineAddr);
  
  // Setup roles with delays
  console.log('\n🔐 Setting up roles and links...');
  
  const ORACLE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('ORACLE_ROLE'));
  
  try {
    await waitForTx(riskRegistry.grantRole(ORACLE_ROLE, complianceEngineAddr), 'Granted ORACLE_ROLE to ComplianceEngine');
  } catch(e) {
    console.log('⚠️ Role already granted or skipped:', e.message);
  }
  
  await sleep(3000);
  
  // Deploy CompliantStableCoin
  console.log('\n📦 Deploying CompliantStableCoin...');
  const CompliantStableCoin = await hre.ethers.getContractFactory('CompliantStableCoin');
  const stableCoin = await CompliantStableCoin.deploy(
    'FidesOrigin Demo USD',
    'fUSD',
    complianceEngineAddr
  );
  await stableCoin.waitForDeployment();
  const stableCoinAddr = await stableCoin.getAddress();
  console.log('✅ CompliantStableCoin deployed to:', stableCoinAddr);
  await sleep(5000);
  
  // Deploy CompliantSmartWallet
  console.log('\n📦 Deploying CompliantSmartWallet...');
  const CompliantSmartWallet = await hre.ethers.getContractFactory('CompliantSmartWallet');
  const smartWallet = await CompliantSmartWallet.deploy(
    deployer.address,
    complianceEngineAddr
  );
  await smartWallet.waitForDeployment();
  const smartWalletAddr = await smartWallet.getAddress();
  console.log('✅ CompliantSmartWallet deployed to:', smartWalletAddr);
  await sleep(5000);
  
  // Deploy RiskOracle (if Chainlink config available)
  const chainlinkRouter = process.env.CHAINLINK_FUNCTIONS_ROUTER;
  const chainlinkDonId = process.env.CHAINLINK_DON_ID;
  const chainlinkSubscriptionId = process.env.CHAINLINK_SUBSCRIPTION_ID;
  
  let riskOracleAddr = null;
  
  if (chainlinkRouter && chainlinkDonId && chainlinkSubscriptionId) {
    console.log('\n📦 Deploying RiskOracle...');
    const RiskOracle = await hre.ethers.getContractFactory('RiskOracle');
    const riskOracle = await RiskOracle.deploy(
      chainlinkRouter,
      hre.ethers.encodeBytes32String(chainlinkDonId),
      parseInt(chainlinkSubscriptionId),
      riskRegistryAddr
    );
    await riskOracle.waitForDeployment();
    riskOracleAddr = await riskOracle.getAddress();
    console.log('✅ RiskOracle deployed to:', riskOracleAddr);
    await sleep(5000);
    
    try {
      await waitForTx(riskRegistry.grantRole(ORACLE_ROLE, riskOracleAddr), 'Granted ORACLE_ROLE to RiskOracle');
    } catch(e) {
      console.log('⚠️ Role grant skipped:', e.message);
    }
  } else {
    console.log('\n⚠️ Skipping RiskOracle - no Chainlink config');
  }
  
  // Update and save deployment file
  sepoliaData.contracts.CompliantStableCoin = {
    address: stableCoinAddr,
    note: 'Deployed via continuation script'
  };
  sepoliaData.contracts.CompliantSmartWallet = {
    address: smartWalletAddr,
    note: 'Deployed via continuation script'
  };
  
  if (riskOracleAddr) {
    sepoliaData.contracts.RiskOracle = {
      address: riskOracleAddr,
      note: 'Deployed via continuation script'
    };
  }
  
  sepoliaData.status = 'complete - continuation finished';
  
  fs.writeFileSync(sepoliaFile, JSON.stringify(sepoliaData, null, 2));
  
  console.log('\n✨ Continuation complete!');
  console.log('\n📋 Sepolia Deployment Summary:');
  console.log('  RiskRegistry:', riskRegistryAddr);
  console.log('  PolicyEngine:', policyEngineAddr);
  console.log('  ComplianceEngine:', complianceEngineAddr);
  console.log('  CompliantStableCoin:', stableCoinAddr);
  console.log('  CompliantSmartWallet:', smartWalletAddr);
  if (riskOracleAddr) console.log('  RiskOracle:', riskOracleAddr);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
