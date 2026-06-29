/**
 * @title Multi-Chain Deployment Script
 * @notice Deploy FidesOrigin contracts to multiple chains
 * @dev Usage: npx hardhat run scripts/deploy-multichain.js --network <network_name>
 * 
 * Supported networks (from hardhat.config.js):
 * - hardhat (local)     : chainId 31337
 * - localhost           : chainId 31337
 * - ethereum            : chainId 1
 * - sepolia             : chainId 11155111
 * - base                : chainId 8453
 * - baseSepolia         : chainId 84532
 * - tempo               : chainId 4217
 * - tempoTestnet        : chainId 42431
 */

const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function deployFidesOrigin() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${network.name} (chainId: ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  // 1. Deploy RiskRegistry first (needed by RiskOracle)
  const RiskRegistry = await ethers.getContractFactory('RiskRegistry');
  const riskRegistry = await RiskRegistry.deploy();
  await riskRegistry.waitForDeployment();
  console.log(`RiskRegistry deployed: ${await riskRegistry.getAddress()}`);

  let routerAddress = ethers.ZeroAddress;
  
  // Deploy mock router for local/testing networks (no real Chainlink)
  if (network.name === 'hardhat' || network.name === 'localhost') {
    const MockRouter = await ethers.getContractFactory('MockChainlinkRouter');
    const mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();
    routerAddress = await mockRouter.getAddress();
    console.log(`MockChainlinkRouter deployed: ${routerAddress}`);
  }

  // 2. Deploy RiskOracle (constructor: router, donId, subscriptionId, riskRegistry)
  const RiskOracle = await ethers.getContractFactory('RiskOracle');
  const riskOracle = await RiskOracle.deploy(
    routerAddress,                       // router (mock for local, ZeroAddress for production without Chainlink)
    ethers.encodeBytes32String('local'), // donId
    0,                                   // subscriptionId
    await riskRegistry.getAddress()
  );
  await riskOracle.waitForDeployment();
  console.log(`RiskOracle deployed: ${await riskOracle.getAddress()}`);

  // 3. Deploy PolicyEngine (constructor: riskRegistry)
  const PolicyEngine = await ethers.getContractFactory('PolicyEngine');
  const policyEngine = await PolicyEngine.deploy(await riskRegistry.getAddress());
  await policyEngine.waitForDeployment();
  console.log(`PolicyEngine deployed: ${await policyEngine.getAddress()}`);

  // 4. Deploy ComplianceEngine (constructor: riskRegistry, policyEngine)
  const ComplianceEngine = await ethers.getContractFactory('ComplianceEngine');
  const complianceEngine = await ComplianceEngine.deploy(
    await riskRegistry.getAddress(),
    await policyEngine.getAddress()
  );
  await complianceEngine.waitForDeployment();
  console.log(`ComplianceEngine deployed: ${await complianceEngine.getAddress()}`);

  // 5. Deploy CompliantStableCoin (example token)
  const CompliantStableCoin = await ethers.getContractFactory('CompliantStableCoin');
  const stableCoin = await CompliantStableCoin.deploy(
    'FidesUSD',
    'FUSD',
    await complianceEngine.getAddress()
  );
  await stableCoin.waitForDeployment();
  console.log(`CompliantStableCoin deployed: ${await stableCoin.getAddress()}`);

  // 6. Deploy CompliantSmartWallet (example wallet)
  const CompliantSmartWallet = await ethers.getContractFactory('CompliantSmartWallet');
  const smartWallet = await CompliantSmartWallet.deploy(
    deployer.address,
    await complianceEngine.getAddress()
  );
  await smartWallet.waitForDeployment();
  console.log(`CompliantSmartWallet deployed: ${await smartWallet.getAddress()}`);

  // 7. Wire up roles and permissions
  const ADMIN_ROLE = await riskRegistry.ADMIN_ROLE();
  const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();

  // Grant ComplianceEngine role in PolicyEngine
  await (await policyEngine.grantRole(COMPLIANCE_ENGINE_ROLE, await complianceEngine.getAddress())).wait();

  // Grant admin role to deployer for RiskRegistry
  await (await riskRegistry.grantRole(ADMIN_ROLE, deployer.address)).wait();

  // 8. Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RiskOracle: await riskOracle.getAddress(),
      RiskRegistry: await riskRegistry.getAddress(),
      PolicyEngine: await policyEngine.getAddress(),
      ComplianceEngine: await complianceEngine.getAddress(),
      CompliantStableCoin: await stableCoin.getAddress(),
      CompliantSmartWallet: await smartWallet.getAddress(),
    },
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const fileName = `${network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, fileName),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Also update the latest deployment file
  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}-latest.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`Deployment saved to deployments/${fileName}`);
  console.log('\n=== Deployment Summary ===');
  console.table(deploymentInfo.contracts);

  return deploymentInfo;
}

// Execute if called directly
if (require.main === module) {
  deployFidesOrigin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployFidesOrigin };
