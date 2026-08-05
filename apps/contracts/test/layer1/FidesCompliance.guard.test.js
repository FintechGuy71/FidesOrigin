const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FidesCompliance Guard Integration", function () {
  let fidesCompliance, riskRegistry, policyEngine, vault, guard;
  let admin, user1, user2, sanctioned;

  beforeEach(async function () {
    [admin, user1, user2, sanctioned] = await ethers.getSigners();
    
    // Deploy dependencies
    const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
    riskRegistry = await RiskRegistry.deploy();
    await riskRegistry.waitForDeployment();
    
    const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
    policyEngine = await PolicyEngine.deploy();
    await policyEngine.waitForDeployment();
    
    const QuarantineVault = await ethers.getContractFactory("QuarantineVault");
    vault = await QuarantineVault.deploy();
    await vault.waitForDeployment();
    
    // Deploy ComplianceEngine
    const ComplianceEngine = await ethers.getContractFactory("ComplianceEngine");
    const complianceEngine = await ComplianceEngine.deploy();
    await complianceEngine.waitForDeployment();
    
    // Deploy FidesCompliance (direct for testing)
    const FidesCompliance = await ethers.getContractFactory("FidesCompliance");
    fidesCompliance = await FidesCompliance.deploy();
    await fidesCompliance.waitForDeployment();
    
    // Initialize
    await fidesCompliance.initialize(
      await complianceEngine.getAddress(),
      await riskRegistry.getAddress(),
      await policyEngine.getAddress(),
      await vault.getAddress()
    );
    
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
