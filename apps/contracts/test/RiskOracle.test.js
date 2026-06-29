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
      expect(await riskOracle.VERSION()).to.equal('1.2.0');
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
      expect(await riskOracle.getOracleCount()).to.equal(2); // deployer + user1
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
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        riskOracle.connect(user1).submitOracleResponse(user2.address, score, tier, isSanctioned, deadline)
      )
        .to.emit(riskOracle, 'OracleResponseReceived')
        .withArgs(user1.address, user2.address, ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'uint8', 'bool'], [user2.address, score, tier, isSanctioned])), 1)
        .to.emit(riskOracle, 'MultiOracleUpdateConfirmed')
        .to.emit(riskOracle, 'RiskProfileUpdated');

      expect(await riskOracle.isUpdateConfirmed(user2.address)).to.be.true;
    });

    it('should reject response from unauthorized oracle', async function () {
      await expect(
        riskOracle.connect(user2).submitOracleResponse(user1.address, 50, 1, false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'OracleNotAuthorized');
    });

    it('should reject expired deadline', async function () {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 1;
      await expect(
        riskOracle.connect(user1).submitOracleResponse(user2.address, 50, 1, false, expiredDeadline)
      ).to.be.revertedWithCustomError(riskOracle, 'DeadlineExpired');
    });

    it('should require multiple confirmations when configured', async function () {
      await riskOracle.addAuthorizedOracle(operator.address);
      await riskOracle.setRequiredConfirmations(2);

      const responseHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'uint8', 'bool'],
          [user2.address, 50, 1, false]
        )
      );

      // First confirmation
      await riskOracle.connect(user1).submitOracleResponse(user2.address, 50, 1, false, 0);
      expect(await riskOracle.getResponseConfirmations(user2.address, responseHash)).to.equal(1);
      expect(await riskOracle.isUpdateConfirmed(user2.address)).to.be.false;

      // Second confirmation
      await riskOracle.connect(operator).submitOracleResponse(user2.address, 50, 1, false, 0);
      expect(await riskOracle.isUpdateConfirmed(user2.address)).to.be.true;
    });
  });

  describe('Direct Risk Profile Update', function () {
    it('should update risk profile as operator', async function () {
      const score = 80;
      const tier = 2;
      const tags = [ethers.keccak256(ethers.toUtf8Bytes('TEST'))];

      await expect(
        riskOracle.updateRiskProfile(user1.address, score, tier, tags, false, 0)
      )
        .to.emit(riskOracle, 'RiskProfileUpdated')
        .withArgs(ethers.ZeroHash, user1.address, score, tier, false);
    });

    it('should reject update for zero address', async function () {
      await expect(
        riskOracle.updateRiskProfile(ethers.ZeroAddress, 50, 1, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'InvalidAddress');
    });

    it('should reject update without operator role', async function () {
      await expect(
        riskOracle.connect(user1).updateRiskProfile(user2.address, 50, 1, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'AccessControlUnauthorizedAccount');
    });

    it('should enforce update cooldown', async function () {
      await riskOracle.updateRiskProfile(user1.address, 50, 1, [], false, 0);

      await expect(
        riskOracle.updateRiskProfile(user1.address, 60, 2, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'UpdateCooldownActive');
    });
  });

  describe('Batch Update', function () {
    it('should batch update risk profiles', async function () {
      const accounts = [user1.address, user2.address];
      const scores = [50, 75];
      const tiers = [1, 2];
      const isSanctioned = [false, true];

      await expect(riskOracle.batchUpdateRiskProfiles(accounts, scores, tiers, isSanctioned))
        .to.emit(riskOracle, 'BatchUpdateExecuted');
    });

    it('should reject batch with mismatched arrays', async function () {
      await expect(
        riskOracle.batchUpdateRiskProfiles([user1.address], [50, 75], [1], [false])
      ).to.be.revertedWithCustomError(riskOracle, 'InvalidAddress');
    });

    it('should enforce batch size limit', async function () {
      const accounts = Array(51).fill(user1.address);
      const scores = Array(51).fill(50);
      const tiers = Array(51).fill(1);
      const isSanctioned = Array(51).fill(false);

      await expect(
        riskOracle.batchUpdateRiskProfiles(accounts, scores, tiers, isSanctioned)
      ).to.be.revertedWithCustomError(riskOracle, 'BatchSizeExceeded');
    });
  });

  describe('Queue Management', function () {
    it('should queue risk update', async function () {
      await expect(riskOracle.queueRiskUpdate(user1.address, 50, 1, false))
        .to.emit(riskOracle, 'QueuedRiskUpdate')
        .withArgs(user1.address, 50);

      expect(await riskOracle.getPendingQueueLength()).to.equal(1);
    });

    it('should reject queue when full', async function () {
      // Fill the queue
      for (let i = 0; i < 100; i++) {
        const addr = ethers.Wallet.createRandom().address;
        await riskOracle.queueRiskUpdate(addr, 50, 1, false);
      }

      await expect(
        riskOracle.queueRiskUpdate(user1.address, 50, 1, false)
      ).to.be.revertedWithCustomError(riskOracle, 'QueueFull');
    });

    it('should execute queued updates', async function () {
      await riskOracle.queueRiskUpdate(user1.address, 50, 1, false);
      await riskOracle.queueRiskUpdate(user2.address, 75, 2, false);

      await expect(riskOracle.executeQueuedUpdates())
        .to.emit(riskOracle, 'BatchUpdateExecuted');

      expect(await riskOracle.getPendingQueueLength()).to.equal(0);
    });
  });

  describe('Rate Limiting', function () {
    it('should enforce caller cooldown', async function () {
      await riskOracle.updateRiskProfile(user1.address, 50, 1, [], false, 0);

      await expect(
        riskOracle.updateRiskProfile(user2.address, 60, 2, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'CallerCooldownActive');
    });

    it('should enforce daily request limit', async function () {
      // Set very low limit for testing
      await riskOracle.setMaxDailyRequestsPerCaller(2);
      await riskOracle.setCallerCooldown(1); // 1 second cooldown for testing

      await riskOracle.updateRiskProfile(user1.address, 50, 1, [], false, 0);
      await riskOracle.updateRiskProfile(user2.address, 60, 2, [], false, 0);

      // Need a third address - should fail due to daily limit, not cooldown
      await expect(
        riskOracle.updateRiskProfile(operator.address, 70, 3, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'DailyRequestLimitExceeded');
    });
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

    it('should set update cooldown', async function () {
      await riskOracle.setUpdateCooldown(7200);
      expect(await riskOracle.updateCooldown()).to.equal(7200);
    });

    it('should set risk registry', async function () {
      const newRegistry = user1.address;
      await riskOracle.setRiskRegistry(newRegistry);
      expect(await riskOracle.riskRegistry()).to.equal(newRegistry);
    });

    it('should reject zero address for risk registry', async function () {
      await expect(riskOracle.setRiskRegistry(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(riskOracle, 'InvalidAddress');
    });

    it('should pause and unpause', async function () {
      await riskOracle.pause();
      expect(await riskOracle.paused()).to.be.true;

      await expect(
        riskOracle.updateRiskProfile(user1.address, 50, 1, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'EnforcedPause');

      await riskOracle.unpause();
      expect(await riskOracle.paused()).to.be.false;
    });
  });

  describe('View Functions', function () {
    it('should return request info', async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes('test-request'));
      const info = await riskOracle.getRequestInfo(requestId);
      expect(info.requestId).to.equal(ethers.ZeroHash);
    });

    it('should return oracle list', async function () {
      await riskOracle.addAuthorizedOracle(user1.address);
      const oracles = await riskOracle.getOracleList();
      expect(oracles.length).to.equal(2);
    });

    it('should return correct oracle count', async function () {
      expect(await riskOracle.getOracleCount()).to.equal(1); // deployer only
      await riskOracle.addAuthorizedOracle(user1.address);
      expect(await riskOracle.getOracleCount()).to.equal(2);
    });
  });
});
