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
  await sleep(5000);
  const receipt = await tx.wait();
  console.log(`✅ ${label} confirmed (tx: ${tx.hash})`);
  return receipt;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('🚀 Redeploying FidesOrigin (v1.1 split)...');
  console.log('Deployer:', deployer.address);
  console.log('Balance:', (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const complianceEngineAddr = sepoliaData.contracts.ComplianceEngine.address;
  const riskRegistryAddr = sepoliaData.contracts.RiskRegistry.address;

  // 1. Deploy FidesCompliance (upgradeable via proxy)
  console.log('\n📦 Deploying FidesCompliance (upgradeable)...');
  const FidesCompliance = await hre.ethers.getContractFactory('FidesCompliance');
  const fidesCompliance = await hre.upgrades.deployProxy(FidesCompliance, [], {
    kind: 'uups',
    initializer: 'initialize',
  });
  await fidesCompliance.waitForDeployment();
  const fidesComplianceAddr = await fidesCompliance.getAddress();
  console.log('✅ FidesCompliance deployed to:', fidesComplianceAddr);
  const fidesComplianceImpl = await hre.upgrades.erc1967.getImplementationAddress(fidesComplianceAddr);
  console.log('   Implementation:', fidesComplianceImpl);
  await sleep(5000);

  // 2. Deploy CompliantSmartWallet (new split version, inherits Base)
  console.log('\n📦 Deploying CompliantSmartWallet (v1.1 split)...');
  const CompliantSmartWallet = await hre.ethers.getContractFactory('CompliantSmartWallet');
  const smartWallet = await CompliantSmartWallet.deploy(
    deployer.address,        // _owner
    complianceEngineAddr,    // _complianceEngine (IWalletCompliance old interface)
    fidesComplianceAddr,     // _fidesCompliance (IFidesCompliance new interface)
    deployer.address         // _operator
  );
  await smartWallet.waitForDeployment();
  const smartWalletAddr = await smartWallet.getAddress();
  console.log('✅ CompliantSmartWallet deployed to:', smartWalletAddr);
  await sleep(5000);

  // 3. Link QuarantineVault (if exists)
  const quarantineVaultAddr = sepoliaData.contracts.QuarantineVault?.address;
  if (quarantineVaultAddr) {
    console.log('\n🔗 Linking QuarantineVault...');
    try {
      await waitForTx(smartWallet.setQuarantineVault(quarantineVaultAddr), 'Set QuarantineVault');
      await waitForTx(smartWallet.setFidesCompliance(fidesComplianceAddr), 'Set FidesCompliance');
      await waitForTx(
        smartWallet.grantRole?.(
          hre.ethers.keccak256(hre.ethers.toUtf8Bytes('OPERATOR_ROLE')),
          deployer.address
        ) || Promise.resolve(),
        'Grant OPERATOR_ROLE'
      );
    } catch (e) {
      console.log('⚠️ Vault linking skipped:', e.message);
    }
  }

  // 4. Update deployment records
  sepoliaData.contracts.FidesCompliance = {
    address: fidesComplianceAddr,
    implementation: fidesComplianceImpl,
    note: 'v1.1 UUPS upgradeable, deployed via proxy'
  };
  sepoliaData.contracts.CompliantSmartWalletV3 = {
    address: smartWalletAddr,
    note: 'v1.1 split: inherits CompliantSmartWalletBase + signature execution'
  };
  sepoliaData.status = 'complete - v1.1 redeployed';
  sepoliaData.redeployedAt = new Date().toISOString();

  fs.writeFileSync(sepoliaFile, JSON.stringify(sepoliaData, null, 2));

  // 5. Save standalone file
  const redeployFile = path.join(DEPLOYMENTS_DIR, `sepolia-v1.1-${new Date().toISOString().split('T')[0]}.json`);
  const redeployInfo = {
    network: 'sepolia',
    chainId: 11155111,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      FidesCompliance: {
        proxy: fidesComplianceAddr,
        implementation: fidesComplianceImpl
      },
      CompliantSmartWalletV3: {
        address: smartWalletAddr
      }
    }
  };
  fs.writeFileSync(redeployFile, JSON.stringify(redeployInfo, null, 2));

  console.log('\n✨ Redeployment complete!');
  console.log('\n📋 New Contracts:');
  console.log('  FidesCompliance (proxy):', fidesComplianceAddr);
  console.log('  FidesCompliance (impl): ', fidesComplianceImpl);
  console.log('  CompliantSmartWalletV3:', smartWalletAddr);
  console.log('\n📋 Existing Contracts (unchanged):');
  console.log('  RiskRegistry:', riskRegistryAddr);
  console.log('  PolicyEngine:', sepoliaData.contracts.PolicyEngine.address);
  console.log('  ComplianceEngine:', complianceEngineAddr);
  console.log('  QuarantineVault:', quarantineVaultAddr || 'N/A');

  // 6. Update networks.json for subgraph
  const networksFile = path.join(__dirname, '..', 'subgraph', 'networks.json');
  if (fs.existsSync(networksFile)) {
    const networks = JSON.parse(fs.readFileSync(networksFile, 'utf8'));
    if (networks.sepolia) {
      networks.sepolia.FidesCompliance = {
        address: fidesComplianceAddr,
        startBlock: await hre.ethers.provider.getBlockNumber()
      };
      networks.sepolia.CompliantSmartWalletV3 = {
        address: smartWalletAddr,
        startBlock: await hre.ethers.provider.getBlockNumber()
      };
      fs.writeFileSync(networksFile, JSON.stringify(networks, null, 2));
      console.log('\n📝 Updated subgraph/networks.json');
    }
  }

  return redeployInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Redeployment failed:', error);
    process.exit(1);
  });
