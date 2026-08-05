const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RiskRegistryV3", function () {
  let registry;
  let admin, operator, user;

  beforeEach(async () => {
    [admin, operator, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RiskRegistryV3");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
    await registry.initialize(admin.address);
    await registry.grantRole(await registry.OPERATOR_ROLE(), operator.address);
  });

  it("should set and get hot profile", async () => {
    await registry.connect(operator).setHotProfile(user.address, 85, 3, false);
    expect(await registry.getRiskScore(user.address)).to.equal(85);
    expect(await registry.isSanctioned(user.address)).to.equal(false);
  });

  it("should track daily volume", async () => {
    await registry.connect(operator).recordVolume(user.address, 1000);
    expect(await registry.dailyVolume(user.address)).to.equal(1000);
  });
});

describe("PolicyEngineV2", function () {
  let engine;
  let admin;

  beforeEach(async () => {
    [admin] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PolicyEngineV2");
    engine = await Factory.deploy();
    await engine.waitForDeployment();
    await engine.initialize(admin.address);
  });

  it("should add and evaluate rule", async () => {
    const [addr] = await ethers.getSigners();
    await engine.addRule(ethers.keccak256("0x01"), 80, 100, 1); // BLOCK
    const [action, reason] = await engine.evaluate(addr.address, 90);
    expect(action).to.equal(1); // BLOCK
    expect(reason).to.equal("Rule matched");
  });

  it("should ALLOW low risk", async () => {
    const [addr] = await ethers.getSigners();
    await engine.addRule(ethers.keccak256("0x01"), 80, 100, 1);
    const [action] = await engine.evaluate(addr.address, 30);
    expect(action).to.equal(0); // ALLOW
  });
});
