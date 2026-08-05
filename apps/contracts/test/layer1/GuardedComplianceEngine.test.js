const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GuardedComplianceEngine", function () {
  let guardedEngine, guard, riskRegistry;
  let admin, user1, user2, sanctioned;

  beforeEach(async function () {
    [admin, user1, user2, sanctioned] = await ethers.getSigners();
    
    // Deploy mock RiskRegistry
    const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
    riskRegistry = await RiskRegistry.deploy();
    await riskRegistry.waitForDeployment();
    
    // Deploy PreTransactionGuard
    const Guard = await ethers.getContractFactory("PreTransactionGuard");
    guard = await Guard.deploy(await riskRegistry.getAddress());
    await guard.waitForDeployment();
    
    // Deploy GuardedComplianceEngine
    const GuardedEngine = await ethers.getContractFactory("GuardedComplianceEngine");
    guardedEngine = await GuardedEngine.deploy(
      await guard.getAddress(),
      ethers.ZeroAddress // no fallback
    );
    await guardedEngine.waitForDeployment();
  });

  it("should ALLOW unknown addresses", async () => {
    const [decision, reason] = await guardedEngine.checkGuard(user1.address, user2.address);
    expect(decision).to.equal(0); // ALLOW
    expect(reason).to.equal("Transaction checked");
  });

  it("should BLOCK sanctioned addresses via Guard", async () => {
    // Add sanctioned address to Guard cache
    await guard.grantRole(await guard.OPERATOR_ROLE(), admin.address);
    await guard.updateSanctionedCache(sanctioned.address, true);
    
    const [decision, reason] = await guardedEngine.checkGuard(user1.address, sanctioned.address);
    expect(decision).to.equal(1); // BLOCK
  });

  it("should pass preTransferHook for normal addresses", async () => {
    await guardedEngine.preTransferHook(user1.address, user2.address, 100);
    // Should not revert
  });

  it("should revert preTransferHook for sanctioned addresses", async () => {
    await guard.grantRole(await guard.OPERATOR_ROLE(), admin.address);
    await guard.updateSanctionedCache(sanctioned.address, true);
    
    await expect(guardedEngine.preTransferHook(user1.address, sanctioned.address, 100))
      .to.be.revertedWithCustomError(guardedEngine, "GuardBlocked");
  });

  it("should validateTransfer with Guard", async () => {
    const [decision] = await guardedEngine.validateTransfer(user1.address, user2.address, 100, ethers.ZeroAddress);
    expect(decision).to.equal(0); // ALLOW
  });

  it("should getAddressRisk from Guard", async () => {
    const profile = await guardedEngine.getAddressRisk(user1.address);
    expect(profile.riskScore).to.equal(0);
    expect(profile.tier).to.equal(0); // UNKNOWN
  });

  it("should be admin-only for config", async () => {
    await expect(guardedEngine.connect(user1).setGuardEnabled(false))
      .to.be.revertedWithCustomError(guardedEngine, "Unauthorized");
  });

  it("should allow admin to disable Guard", async () => {
    await guardedEngine.setGuardEnabled(false);
    expect(await guardedEngine.guardEnabled()).to.be.false;
    
    // Even sanctioned should pass when Guard disabled
    const [decision] = await guardedEngine.checkGuard(user1.address, sanctioned.address);
    expect(decision).to.equal(0); // ALLOW
  });

  it("should support batch check", async () => {
    const fromList = [user1.address, user2.address];
    const toList = [user2.address, user1.address];
    const [decisions] = await guardedEngine.checkBatch(fromList, toList);
    expect(decisions.length).to.equal(2);
    expect(decisions[0]).to.equal(0); // ALLOW
  });
});
