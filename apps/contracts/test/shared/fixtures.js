const { ethers, upgrades } = require('hardhat');

/**
 * @notice Shared deployment fixtures for FidesOrigin test suite
 * @dev Uses Hardhat Ethers v6 + OpenZeppelin Upgrades
 */

async function deployFidesOriginFixture() {
  const [owner, oracle, operator, admin, user1, user2, user3, attacker, issuer, walletOwner] = await ethers.getSigners();

  // 1. Deploy RiskRegistry (UUPS upgradeable via proxy)
  const RiskRegistry = await ethers.getContractFactory('RiskRegistry');
  const riskRegistry = await upgrades.deployProxy(RiskRegistry, [owner.address], { 
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await riskRegistry.waitForDeployment();

  // 2. Deploy PolicyEngine (UUPS upgradeable via proxy)
  const PolicyEngine = await ethers.getContractFactory('PolicyEngine');
  const policyEngine = await upgrades.deployProxy(PolicyEngine, [owner.address, await riskRegistry.getAddress()], { 
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await policyEngine.waitForDeployment();

  // 3. Deploy RiskOracle (mock router address)
  // L-14 NOTE: mockRouter is a random address; real Chainlink tests need MockChainlinkRouter
  const mockRouter = ethers.Wallet.createRandom().address;
  // [High Fix #35] Replaced Math.random with fixed values for deterministic test results.
  const donId = ethers.encodeBytes32String('test-don-fixed-001');
  const subscriptionId = 42;
  const RiskOracle = await ethers.getContractFactory('RiskOracle');
  const riskOracle = await RiskOracle.deploy(
    mockRouter,
    donId,
    subscriptionId,
    await riskRegistry.getAddress()
  );
  await riskOracle.waitForDeployment();

  // 4. Deploy ComplianceEngine (UUPS upgradeable via proxy)
  const ComplianceEngine = await ethers.getContractFactory('ComplianceEngine');
  const complianceEngine = await upgrades.deployProxy(ComplianceEngine, [
    await riskRegistry.getAddress(),
    await policyEngine.getAddress()
  ], { 
    initializer: 'initialize',
    unsafeAllow: ['constructor']
  });
  await complianceEngine.waitForDeployment();

  // 5. Set up roles
  const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();
  const POLICY_ADMIN_ROLE = await policyEngine.ADMIN_ROLE();
  const RR_ADMIN_ROLE = await riskRegistry.ADMIN_ROLE();
  await policyEngine.connect(owner).grantRole(COMPLIANCE_ENGINE_ROLE, await complianceEngine.getAddress());
  
  // 5b. Grant ComplianceEngine role to owner (for testing recordTransfer directly)
  await policyEngine.connect(owner).grantRole(COMPLIANCE_ENGINE_ROLE, owner.address);

  // 6. Grant oracle roles
  const ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
  await riskRegistry.connect(owner).grantRole(ORACLE_ROLE, await riskOracle.getAddress());
  await riskRegistry.connect(owner).grantRole(ORACLE_ROLE, oracle.address);
  await riskRegistry.connect(owner).grantRole(ORACLE_ROLE, operator.address);
  
  // 6a. Grant RiskOracle OPERATOR_ROLE to operator (for queueRiskUpdate and executeQueuedUpdates)
  const RO_OPERATOR_ROLE = await riskOracle.OPERATOR_ROLE();
  await riskOracle.connect(owner).grantRole(RO_OPERATOR_ROLE, operator.address);
  
  // 6b. Grant RiskOracle COMPLIANCE_ENGINE_ROLE on RiskRegistry (so it can call updateRiskProfile)
  const RR_COMPLIANCE_ENGINE_ROLE = await riskRegistry.COMPLIANCE_ENGINE_ROLE();
  await riskRegistry.connect(owner).grantRole(RR_COMPLIANCE_ENGINE_ROLE, await riskOracle.getAddress());

  // 7d. Grant DEFAULT_ADMIN_ROLE to owner for ComplianceEngine
  // Note: ComplianceEngine constructor grants DEFAULT_ADMIN_ROLE to msg.sender (deployer)
  // We need to ensure owner has this role before granting other roles
  const CE_DEFAULT_ADMIN = await complianceEngine.DEFAULT_ADMIN_ROLE();
  // Owner should already have DEFAULT_ADMIN_ROLE from constructor, but verify
  const hasAdmin = await complianceEngine.hasRole(CE_DEFAULT_ADMIN, owner.address);
  if (!hasAdmin) {
    // If not, we need to use the deployer to grant it
    // This shouldn't happen if deployer is owner
    console.log("Warning: Owner does not have DEFAULT_ADMIN_ROLE on ComplianceEngine");
  }
  
  // 7. Grant operator roles (RiskRegistry uses ADMIN_ROLE instead of OPERATOR_ROLE)
  await riskRegistry.connect(owner).grantRole(RR_ADMIN_ROLE, operator.address);
  await policyEngine.connect(owner).grantRole(POLICY_ADMIN_ROLE, admin.address);

  // 7b. Grant RiskRegistry admin role to admin
  await riskRegistry.connect(owner).grantRole(RR_ADMIN_ROLE, admin.address);

  // 7c. Grant ComplianceEngine operator role to owner (for hold/release operations)
  const CE_OPERATOR_ROLE = await complianceEngine.OPERATOR_ROLE();
  await complianceEngine.connect(owner).grantRole(CE_OPERATOR_ROLE, owner.address);
  await complianceEngine.connect(owner).grantRole(CE_OPERATOR_ROLE, operator.address);

  // 8. Deploy CompliantStableCoin
  const CompliantStableCoin = await ethers.getContractFactory('CompliantStableCoin');
  const stableCoin = await CompliantStableCoin.deploy(
    'CompliantUSD',
    'cUSD',
    await complianceEngine.getAddress()
  );
  await stableCoin.waitForDeployment();

  // 9. Deploy QuarantineVault
  const QuarantineVault = await ethers.getContractFactory('QuarantineVault');
  const quarantineVault = await QuarantineVault.deploy();
  await quarantineVault.waitForDeployment();

  // 10. Deploy FidesCompliance (NOT upgradeable - has constructor with args)
  const FidesCompliance = await ethers.getContractFactory('FidesCompliance');
  const fidesCompliance = await FidesCompliance.deploy(
    await complianceEngine.getAddress(),
    await riskRegistry.getAddress(),
    await policyEngine.getAddress(),
    await quarantineVault.getAddress()
  );
  await fidesCompliance.waitForDeployment();

  // 10-1. C-01 FIX: Grant FidesCompliance the OPERATOR_ROLE on ComplianceEngine
  await complianceEngine.connect(owner).grantRole(CE_OPERATOR_ROLE, await fidesCompliance.getAddress());

  // 11. Deploy CompliantSmartWallet
  const CompliantSmartWallet = await ethers.getContractFactory('CompliantSmartWallet');
  const smartWallet = await CompliantSmartWallet.deploy(
    walletOwner.address,
    await complianceEngine.getAddress(),
    await fidesCompliance.getAddress(),
    operator.address,
    await quarantineVault.getAddress()
  );
  await smartWallet.waitForDeployment();

  // 12. Deploy TestUSD
  const TestUSD = await ethers.getContractFactory('TestUSD');
  const testUSD = await TestUSD.deploy();
  await testUSD.waitForDeployment();

  // 13. Grant QUARANTINE_ROLE
  const QUARANTINE_ROLE = await quarantineVault.QUARANTINE_ROLE();
  await quarantineVault.connect(owner).grantRole(QUARANTINE_ROLE, user1.address);
  await quarantineVault.connect(owner).grantRole(QUARANTINE_ROLE, user2.address);

  // 14. Deploy FidesOriginTimelock
  const minDelay = 2 * 24 * 60 * 60; // 2 days
  const proposers = [owner.address];
  const executors = [owner.address];
  const FidesOriginTimelock = await ethers.getContractFactory('FidesOriginTimelock');
  const timelock = await FidesOriginTimelock.deploy(proposers, executors, owner.address);
  await timelock.waitForDeployment();

  return {
    // Contracts
    riskRegistry,
    policyEngine,
    riskOracle,
    complianceEngine,
    fidesCompliance,
    stableCoin,
    smartWallet,
    testUSD,
    quarantineVault,
    timelock,
    // Signers
    owner,
    oracle,
    operator,
    admin,
    user1,
    user2,
    user3,
    attacker,
    issuer,
    walletOwner,
    // Addresses
    riskRegistryAddress: await riskRegistry.getAddress(),
    policyEngineAddress: await policyEngine.getAddress(),
    complianceEngineAddress: await complianceEngine.getAddress(),
    fidesComplianceAddress: await fidesCompliance.getAddress(),
  };
}

module.exports = {
  deployFidesOriginFixture,
};
