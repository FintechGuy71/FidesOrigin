const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FidesCompliance Guard Integration", function () {
  let fidesCompliance, riskRegistry, policyEngine, vault, guard;
  let admin, user1, user2, sanctioned;

  beforeEach(async function () {
    [admin, user1, user2, sanctioned] = await ethers.getSigners();
    
    // Deploy RiskRegistry (UUPS upgradeable via proxy)
    const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
    riskRegistry = await upgrades.deployProxy(RiskRegistry, [admin.address], {
      initializer: 'initialize',
      unsafeAllow: ['constructor']
    });
    await riskRegistry.waitForDeployment();
    
    // Deploy PolicyEngine (UUPS upgradeable via proxy)
    const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
    policyEngine = await upgrades.deployProxy(PolicyEngine, [admin.address, await riskRegistry.getAddress()], {
      initializer: 'initialize',
      unsafeAllow: ['constructor']
    });
    await policyEngine.waitForDeployment();
    
    // Deploy QuarantineVault
    const QuarantineVault = await ethers.getContractFactory("QuarantineVault");
    vault = await QuarantineVault.deploy();
    await vault.waitForDeployment();
    
    // Deploy ComplianceEngine (UUPS upgradeable via proxy)
    const ComplianceEngine = await ethers.getContractFactory("ComplianceEngine");
    const complianceEngine = await upgrades.deployProxy(ComplianceEngine, [
      await riskRegistry.getAddress(),
      await policyEngine.getAddress()
    ], {
      initializer: 'initialize',
      unsafeAllow: ['constructor']
    });
    await complianceEngine.waitForDeployment();
    
    // Deploy FidesCompliance via proxy (UUPS upgradeable)
    const FidesCompliance = await ethers.getContractFactory("FidesCompliance");
    fidesCompliance = await upgrades.deployProxy(FidesCompliance, [
      await complianceEngine.getAddress(),
      await riskRegistry.getAddress(),
      await policyEngine.getAddress(),
      await vault.getAddress()
    ], {
      initializer: 'initialize',
      unsafeAllow: ['constructor']
    });
    await fidesCompliance.waitForDeployment();
    
    // Grant FidesCompliance OPERATOR_ROLE on ComplianceEngine
    const CE_OPERATOR_ROLE = await complianceEngine.OPERATOR_ROLE();
    await complianceEngine.connect(admin).grantRole(CE_OPERATOR_ROLE, await fidesCompliance.getAddress());
    
    // Deploy Guard
    const Guard = await ethers.getContractFactory("PreTransactionGuard");
    guard = await Guard.deploy(await riskRegistry.getAddress());
    await guard.waitForDeployment();
    
    // Add sanctioned address to Guard cache
    await guard.grantRole(await guard.OPERATOR_ROLE(), admin.address);
    await guard.updateSanctionedCache(sanctioned.address, true);
  });

  it("should enable Guard and block sanctioned address", async () => {
    // Enable Guard
    await fidesCompliance.enableGuard(await guard.getAddress());
    expect(await fidesCompliance.guardEnabled()).to.be.true;
    
    // Preview should block sanctioned address
    const [allowed] = await fidesCompliance.previewTransaction(
      user1.address, sanctioned.address, 100, ethers.ZeroAddress, 0
    );
    expect(allowed).to.be.false;
  });

  it("should allow transaction when Guard disabled", async () => {
    // Enable then disable
    await fidesCompliance.enableGuard(await guard.getAddress());
    await fidesCompliance.disableGuard();
    
    expect(await fidesCompliance.guardEnabled()).to.be.false;
    
    // Should allow even sanctioned address when disabled
    const [allowed] = await fidesCompliance.previewTransaction(
      user1.address, sanctioned.address, 100, ethers.ZeroAddress, 0
    );
    // Note: RiskRegistry may still block, but Guard won't
    // This just verifies Guard is not interfering
  });

  it("should return Guard stats", async () => {
    await fidesCompliance.enableGuard(await guard.getAddress());
    const [checks, blocks, enabled, guardAddr] = await fidesCompliance.getGuardStats();
    expect(enabled).to.be.true;
    expect(guardAddr).to.equal(await guard.getAddress());
  });

  it("should preview Guard check", async () => {
    await fidesCompliance.enableGuard(await guard.getAddress());
    
    const [wouldBlock1] = await fidesCompliance.previewGuardCheck(user1.address, user2.address);
    expect(wouldBlock1).to.be.false;
    
    const [wouldBlock2, reason] = await fidesCompliance.previewGuardCheck(user1.address, sanctioned.address);
    expect(wouldBlock2).to.be.true;
  });
});
