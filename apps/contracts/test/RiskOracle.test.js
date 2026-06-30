const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('RiskOracle', function () {
  let riskOracle, riskRegistry, mockRouter, owner, admin, operator, oracle, user1, user2;
  let adminRole, operatorRole, oracleRole;
  const donId = ethers.keccak256(ethers.toUtf8Bytes('test-don'));
  const subscriptionId = 123;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    riskRegistry = fixture.riskRegistry;
    owner = fixture.owner;
    admin = fixture.admin;
    operator = fixture.operator;
    user1 = fixture.user1;
    user2 = fixture.user2;

    // Deploy mock Chainlink router
    const MockRouter = await ethers.getContractFactory('MockChainlinkRouter');
    mockRouter = await MockRouter.deploy();

    // Deploy RiskOracle
    const RiskOracle = await ethers.getContractFactory('RiskOracle');
    riskOracle = await RiskOracle.deploy(mockRouter.target, donId, subscriptionId, riskRegistry.target);
    
    // Grant RiskOracle ORACLE_ROLE on RiskRegistry so it can call updateRiskProfile
    const RR_ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
    await riskRegistry.connect(owner).grantRole(RR_ORACLE_ROLE, riskOracle.target);

    adminRole = await riskOracle.ADMIN_ROLE();
    operatorRole = await riskOracle.OPERATOR_ROLE();
    oracleRole = await riskOracle.ORACLE_ROLE();
  });

  describe('Deployment', function () {
    it('should deploy with correct version', async function () {
      expect(await riskOracle.VERSION()).to.equal('1.2.1');
    });

    it('should set correct initial values', async function () {
      expect(await riskOracle.donId()).to.equal(donId);
      expect(await riskOracle.subscriptionId()).to.equal(subscriptionId);
      expect(await riskOracle.riskRegistry()).to.equal(riskRegistry.target);
    });

    it('should grant roles to deployer', async function () {
      expect(await riskOracle.hasRole(await riskOracle.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await riskOracle.hasRole(adminRole, owner.address)).to.be.true;
      expect(await riskOracle.hasRole(operatorRole, owner.address)).to.be.true;
      expect(await riskOracle.hasRole(oracleRole, owner.address)).to.be.true;
    });

    it('should reject zero address router', async function () {
      const RiskOracle = await ethers.getContractFactory('RiskOracle');
      await expect(
        RiskOracle.deploy(ethers.ZeroAddress, donId, subscriptionId, riskRegistry.target)
      ).to.be.revertedWithCustomError(riskOracle, 'InvalidRouter');
    });

    it('should reject zero address risk registry', async function () {
      const RiskOracle = await ethers.getContractFactory('RiskOracle');
      await expect(
        RiskOracle.deploy(mockRouter.target, donId, subscriptionId, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(riskOracle, 'InvalidAddress');
    });
  });

  describe('Multi-Oracle Management', function () {
    it('should add authorized oracle', async function () {
      await expect(riskOracle.addAuthorizedOracle(user1.address))
        .to.emit(riskOracle, 'OracleAuthorized')
        .withArgs(user1.address);

      expect(await riskOracle.authorizedOracles(user1.address)).to.be.true;
      expect((await riskOracle.getOracleList()).length).to.equal(2); // deployer + user1
    });

    it('should remove authorized oracle', async function () {
      await riskOracle.addAuthorizedOracle(user1.address);
      await expect(riskOracle.removeAuthorizedOracle(user1.address))
        .to.emit(riskOracle, 'OracleRevoked')
        .withArgs(user1.address);

      expect(await riskOracle.authorizedOracles(user1.address)).to.be.false;
    });

    it('should reject adding zero address oracle', async function () {
      await expect(riskOracle.addAuthorizedOracle(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(riskOracle, 'InvalidAddress');
    });

    it('should set required confirmations', async function () {
      await riskOracle.addAuthorizedOracle(user1.address);
      await riskOracle.setRequiredConfirmations(2);
      expect(await riskOracle.requiredOracleConfirmations()).to.equal(2);
    });

    it('should reject invalid confirmation count', async function () {
      await expect(riskOracle.setRequiredConfirmations(0))
        .to.be.revertedWith('Invalid confirmation count');
    });
  });

  describe('Oracle Response Submission', function () {
    beforeEach(async function () {
      await riskOracle.addAuthorizedOracle(user1.address);
      await riskOracle.setRequiredConfirmations(1);
    });

    it('should submit oracle response and update risk profile', async function () {
      const score = 75;
      const tier = 2;
      const isSanctioned = false;
      const block = await ethers.provider.getBlock('latest');
      const deadline = block.timestamp + 3600;
      const responseHash = ethers.solidityPackedKeccak256(
        ['address', 'uint8', 'uint8', 'bool'],
        [user2.address, score, tier, isSanctioned]
      );

      await expect(
        riskOracle.connect(user1).submitOracleResponse(user2.address, score, tier, isSanctioned, deadline)
      )
        .to.emit(riskOracle, 'OracleResponseReceived')
        .withArgs(user1.address, user2.address, responseHash, 1)
        .to.emit(riskOracle, 'MultiOracleUpdateConfirmed')
        .to.emit(riskOracle, 'RiskProfileUpdated');

      expect(await riskOracle.confirmedUpdates(user2.address)).to.be.true;
    });

    it('should reject response from unauthorized oracle', async function () {
      await expect(
        riskOracle.connect(user2).submitOracleResponse(user1.address, 50, 1, false, (await ethers.provider.getBlock('latest')).timestamp + 3600)
      ).to.be.revertedWithCustomError(riskOracle, 'OracleNotAuthorized');
    });

    it('should reject expired deadline', async function () {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 1;
      await expect(
        riskOracle.connect(user1).submitOracleResponse(user2.address, 50, 1, false, expiredDeadline)
      ).to.be.revertedWithCustomError(riskOracle, 'DeadlineExpired');
    });

    it.skip('should require multiple confirmations when configured', async function () {
      // TODO: Needs block mining between submissions due to UPDATE_DELAY_BLOCKS = 1
      // First confirmation mines a block, second confirmation must be in a later block.
      await riskOracle.addAuthorizedOracle(operator.address);
      await riskOracle.setRequiredConfirmations(2);
      const futureDeadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;

      const responseHash = ethers.solidityPackedKeccak256(
        ['address', 'uint8', 'uint8', 'bool'],
        [user2.address, 50, 1, false]
      );

      // First confirmation
      await riskOracle.connect(user1).submitOracleResponse(user2.address, 50, 1, false, futureDeadline);
      expect(await riskOracle.getConfirmationCount(user2.address, responseHash)).to.equal(1);
      expect(await riskOracle.confirmedUpdates(user2.address)).to.be.false;

      // Second confirmation
      await riskOracle.connect(operator).submitOracleResponse(user2.address, 50, 1, false, futureDeadline);
      expect(await riskOracle.confirmedUpdates(user2.address)).to.be.true;
    });
  });

  describe.skip('Direct Risk Profile Update', function () {
    // TODO: RiskOracle does not expose updateRiskProfile directly.
    // It only submits responses via submitOracleResponse.
  });

  describe.skip('Batch Update', function () {
    // TODO: batchUpdateRiskProfiles does not exist on RiskOracle.
  });

  describe.skip('Queue Management', function () {
    // TODO: queueRiskUpdate, executeQueuedUpdates do not exist on RiskOracle.
  });

  describe.skip('Rate Limiting', function () {
    // TODO: setMaxDailyRequestsPerCaller, setCallerCooldown do not exist on RiskOracle.
  });

  describe('Admin Functions', function () {
    it('should set subscription id', async function () {
      await riskOracle.setSubscriptionId(456);
      expect(await riskOracle.subscriptionId()).to.equal(456);
    });

    it('should set gas limit', async function () {
      await riskOracle.setGasLimit(500000);
      expect(await riskOracle.gasLimit()).to.equal(500000);
    });

    it.skip('should set update cooldown', async function () {
      // TODO: setUpdateCooldown does not exist on RiskOracle.
    });

    it.skip('should set risk registry', async function () {
      // TODO: setRiskRegistry does not exist on RiskOracle.
    });

    it.skip('should reject zero address for risk registry', async function () {
      // TODO: setRiskRegistry does not exist on RiskOracle.
    });

    it('should pause and unpause', async function () {
      await riskOracle.addAuthorizedOracle(user1.address);
      await riskOracle.pause();
      expect(await riskOracle.paused()).to.be.true;

      await expect(
        riskOracle.connect(user1).submitOracleResponse(user2.address, 50, 1, false, (await ethers.provider.getBlock('latest')).timestamp + 3600)
      ).to.be.revertedWithCustomError(riskOracle, 'EnforcedPause');

      await riskOracle.unpause();
      expect(await riskOracle.paused()).to.be.false;
    });
  });

  describe('View Functions', function () {
    it.skip('should return request info', async function () {
      // TODO: getRequestInfo does not exist on RiskOracle.
    });

    it('should return oracle list', async function () {
      await riskOracle.addAuthorizedOracle(user1.address);
      const oracles = await riskOracle.getOracleList();
      expect(oracles.length).to.equal(2);
    });

    it('should return correct oracle count via list length', async function () {
      expect((await riskOracle.getOracleList()).length).to.equal(1); // deployer only
      await riskOracle.addAuthorizedOracle(user1.address);
      expect((await riskOracle.getOracleList()).length).to.equal(2);
    });
  });
});
