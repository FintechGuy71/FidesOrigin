const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PreTransactionGuard", function () {
  let guard, riskRegistry;
  let admin, operator, user1, user2, sanctioned;

  beforeEach(async function () {
    [admin, operator, user1, user2, sanctioned] = await ethers.getSigners();
    
    const RiskRegistry = await ethers.getContractFactory("RiskRegistry");
    riskRegistry = await RiskRegistry.deploy();
    await riskRegistry.waitForDeployment();
    
    const Guard = await ethers.getContractFactory("PreTransactionGuard");
    guard = await Guard.deploy(await riskRegistry.getAddress());
    await guard.waitForDeployment();
    
    await guard.grantRole(await guard.OPERATOR_ROLE(), operator.address);
  });

  it("should return ALLOW for unknown address", async () => {
    const r = await guard.assessAddress(user1.address);
    expect(r.action).to.equal(0); // ALLOW
    expect(r.riskScore).to.equal(0);
  });

  it("should BLOCK sanctioned address", async () => {
    await guard.connect(operator).updateSanctionedCache(sanctioned.address, true);
    const r = await guard.assessAddress(sanctioned.address);
    expect(r.action).to.equal(2); // BLOCK
    expect(r.riskScore).to.equal(100);
  });

  it("should assess transaction", async () => {
    const intent = { from: user1.address, to: user2.address, value: 0 };
    const r = await guard.assessTransaction(intent);
    expect(r.action).to.equal(0); // ALLOW
  });

  it("should block transaction to sanctioned address", async () => {
    await guard.connect(operator).updateSanctionedCache(user2.address, true);
    const intent = { from: user1.address, to: user2.address, value: 0 };
    const r = await guard.assessTransaction(intent);
    expect(r.action).to.equal(2); // BLOCK
  });

  it("should batch assess", async () => {
    const addrs = [user1.address, user2.address];
    const results = await guard.assessBatch(addrs);
    expect(results.length).to.equal(2);
    expect(results[0].action).to.equal(0);
  });

  it("should reject zero address", async () => {
    await expect(guard.assessAddress(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(guard, "InvalidAddress");
  });

  it("should use zero gas for view function", async () => {
    const r = await guard.assessAddress.staticCall(user1.address);
    expect(r.action).to.equal(0);
  });
});
