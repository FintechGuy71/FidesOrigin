const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('FidesCompliance Extended', function () {
  let fidesCompliance, complianceEngine, riskRegistry, policyEngine, quarantineVault;
  let owner, addr1, addr2, addr3, operator, admin;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    fidesCompliance = fixture.fidesCompliance;
    complianceEngine = fixture.complianceEngine;
    riskRegistry = fixture.riskRegistry;
    policyEngine = fixture.policyEngine;
    quarantineVault = fixture.quarantineVault;
    owner = fixture.owner;
    addr1 = fixture.user1;
    addr2 = fixture.user2;
    addr3 = fixture.user3;
    operator = fixture.operator;
    admin = fixture.admin;
  });

  describe('evaluateTransaction - All Scenarios', function () {
    beforeEach(async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 50, 2, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr3.address, 85, 3, [], false);
    });

    it('should ALLOW transaction for low-risk addresses', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed, riskScore] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.true;
      expect(riskScore).to.equal(50); // max of 30 and 50
    });

    it('should BLOCK transaction from sanctioned address', async function () {
      await riskRegistry.connect(owner).removeRiskProfile(addr1.address);
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], true);
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed, riskScore] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;
      expect(riskScore).to.equal(50);
    });

    it('should BLOCK transaction to sanctioned address', async function () {
      await riskRegistry.connect(owner).removeRiskProfile(addr2.address);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 50, 2, [], true);
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed, riskScore] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;
      expect(riskScore).to.equal(50);
    });

    it('should BLOCK transaction when risk score >= maxRiskScoreForBlock', async function () {
      await riskRegistry.connect(owner).removeRiskProfile(addr1.address);
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 98, 4, [], false);
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed, riskScore] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;
      expect(riskScore).to.equal(98);
    });

    it('should DENY transaction when deadline has expired', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp - 1;
      const [allowed] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;
    });

    it('should DENY transaction when emergency mode is active', async function () {
      await fidesCompliance.connect(owner).activateEmergency();
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;
    });

    it('should DENY transaction for zero address', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed] = await fidesCompliance.evaluateTransaction.staticCall(
        ethers.ZeroAddress,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;
    });

    it('should use engine decision when engine is set', async function () {
      // Set issuer policy on complianceEngine to block large transfers
      const policy = {
        maxTxAmount: ethers.parseEther('0.5'),
        dailyLimit: ethers.parseEther('5'),
        allowMediumRisk: true,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      };
      const dummyToken = ethers.Wallet.createRandom().address;
      await complianceEngine.connect(owner).setIssuerPolicy(dummyToken, policy);

      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        dummyToken,
        deadline
      );
      expect(allowed).to.be.false;
    });

    it('should ALLOW when risk score is below quarantine threshold', async function () {
      // Default minRiskScoreForQuarantine = 80, addr1=30, addr2=50, max=50
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [allowed, riskScore] = await fidesCompliance.evaluateTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.true;
      expect(riskScore).to.equal(50);
    });
  });

  describe('checkAndExecuteTransaction - Boundary Conditions', function () {
    beforeEach(async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      // Set generous policy
      const policy = {
        maxTxAmount: ethers.parseEther('1000'),
        dailyLimit: ethers.parseEther('5000'),
        allowMediumRisk: true,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      };
      const dummyToken = ethers.Wallet.createRandom().address;
      await complianceEngine.connect(owner).setIssuerPolicy(dummyToken, policy);
    });

    it('should ALLOW valid transaction and increment counters', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;
      // Use staticCall to get return value, then execute to persist state
      const allowed = await fidesCompliance.connect(addr1).checkAndExecuteTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.true;

      // Execute the transaction to persist state changes
      await fidesCompliance.connect(addr1).checkAndExecuteTransaction(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );

      const stats = await fidesCompliance.getTransactionStats();
      expect(stats.checked).to.equal(1);
      expect(stats.allowed).to.equal(1);
      expect(stats.blocked).to.equal(0);
    });

    it('should BLOCK transaction from high-risk address and increment blocked counter', async function () {
      await riskRegistry.connect(owner).removeRiskProfile(addr1.address);
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 98, 4, [], false);
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;
      // Use staticCall to get return value, then execute to persist state
      const allowed = await fidesCompliance.connect(addr1).checkAndExecuteTransaction.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(allowed).to.be.false;

      // Execute the transaction to persist state changes
      await fidesCompliance.connect(addr1).checkAndExecuteTransaction(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );

      const stats = await fidesCompliance.getTransactionStats();
      expect(stats.checked).to.equal(1);
      expect(stats.blocked).to.equal(1);
    });

    it('should revert when deadline is zero', async function () {
      await expect(
        fidesCompliance.connect(addr1).checkAndExecuteTransaction(
          addr1.address,
          addr2.address,
          ethers.parseEther('1'),
          ethers.ZeroAddress,
          0
        )
      ).to.be.revertedWithCustomError(fidesCompliance, 'DeadlineExpired');
    });

    it('should revert when deadline is in the past', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp - 1;
      await expect(
        fidesCompliance.connect(addr1).checkAndExecuteTransaction(
          addr1.address,
          addr2.address,
          ethers.parseEther('1'),
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWithCustomError(fidesCompliance, 'DeadlineExpired');
    });

    it('should revert when deadline is too far in the future', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 600; // > 5 minutes
      await expect(
        fidesCompliance.connect(addr1).checkAndExecuteTransaction(
          addr1.address,
          addr2.address,
          ethers.parseEther('1'),
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWithCustomError(fidesCompliance, 'DeadlineExpired');
    });

    it('should revert when caller is not from', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;
      await expect(
        fidesCompliance.connect(addr2).checkAndExecuteTransaction(
          addr1.address,
          addr2.address,
          ethers.parseEther('1'),
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWith('Caller must be from');
    });

    it('should revert in emergency mode', async function () {
      await fidesCompliance.connect(owner).activateEmergency();
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;
      await expect(
        fidesCompliance.connect(addr1).checkAndExecuteTransaction(
          addr1.address,
          addr2.address,
          ethers.parseEther('1'),
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWithCustomError(fidesCompliance, 'EmergencyModeActive');
    });

    it('should revert for zero address', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;
      // When from=ZeroAddress and caller=addr1, the "Caller must be from" check fails first
      await expect(
        fidesCompliance.connect(addr1).checkAndExecuteTransaction(
          ethers.ZeroAddress,
          addr2.address,
          ethers.parseEther('1'),
          ethers.ZeroAddress,
          deadline
        )
      ).to.be.revertedWith('Caller must be from');
    });
  });

  describe('Admin Parameter Setters', function () {
    it('should allow admin to set minRiskScoreForQuarantine', async function () {
      const tx = await fidesCompliance.connect(owner).setMinRiskScoreForQuarantine(70);
      await expect(tx)
        .to.emit(fidesCompliance, 'RiskThresholdUpdated')
        .withArgs('minRiskScoreForQuarantine', 80, 70, owner.address, await ethers.provider.getBlock('latest').then(b => b.timestamp));
      expect(await fidesCompliance.minRiskScoreForQuarantine()).to.equal(70);
    });

    it('should revert minRiskScoreForQuarantine above 100', async function () {
      await expect(
        fidesCompliance.connect(owner).setMinRiskScoreForQuarantine(101)
      ).to.be.revertedWith('Invalid value');
    });

    it('should revert minRiskScoreForQuarantine >= maxRiskScoreForBlock', async function () {
      await expect(
        fidesCompliance.connect(owner).setMinRiskScoreForQuarantine(95)
      ).to.be.revertedWith('Must be less than maxRiskScoreForBlock');
    });

    it('should allow admin to set maxRiskScoreForBlock', async function () {
      await fidesCompliance.connect(owner).setMinRiskScoreForQuarantine(50);
      await fidesCompliance.connect(owner).setMaxRiskScoreForBlock(90);
      expect(await fidesCompliance.maxRiskScoreForBlock()).to.equal(90);
    });

    it('should revert maxRiskScoreForBlock <= minRiskScoreForQuarantine', async function () {
      await expect(
        fidesCompliance.connect(owner).setMaxRiskScoreForBlock(79)
      ).to.be.revertedWith('Must be greater than minRiskScoreForQuarantine');
    });

    it('should allow admin to set minUpdateInterval', async function () {
      await fidesCompliance.connect(owner).setMinUpdateInterval(3600);
      expect(await fidesCompliance.minUpdateInterval()).to.equal(3600);
    });

    it('should allow admin to set emergencyCooldown', async function () {
      await fidesCompliance.connect(owner).setEmergencyCooldown(12 * 60 * 60);
      expect(await fidesCompliance.emergencyCooldown()).to.equal(12 * 60 * 60);
    });

    it('should revert emergencyCooldown above MAX_EMERGENCY_COOLDOWN', async function () {
      await expect(
        fidesCompliance.connect(owner).setEmergencyCooldown(8 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(fidesCompliance, 'InvalidCooldown');
    });

    it('should revert when non-admin tries to set parameters', async function () {
      await expect(
        fidesCompliance.connect(addr1).setMinRiskScoreForQuarantine(70)
      ).to.be.reverted;
    });
  });

  describe('Emergency Mode', function () {
    it('should allow admin to activate emergency mode', async function () {
      await expect(fidesCompliance.connect(owner).activateEmergency())
        .to.emit(fidesCompliance, 'EmergencyModeActivated');
      expect(await fidesCompliance.emergencyMode()).to.be.true;
    });

    it('should revert activating emergency when already active', async function () {
      await fidesCompliance.connect(owner).activateEmergency();
      await expect(
        fidesCompliance.connect(owner).activateEmergency()
      ).to.be.revertedWithCustomError(fidesCompliance, 'AlreadyInEmergencyMode');
    });

    it('should enforce emergency cooldown between activations', async function () {
      await fidesCompliance.connect(owner).activateEmergency();
      await ethers.provider.send('evm_increaseTime', [3601]);
      await ethers.provider.send('evm_mine');
      await fidesCompliance.connect(owner).deactivateEmergency();
      await expect(
        fidesCompliance.connect(owner).activateEmergency()
      ).to.be.revertedWithCustomError(fidesCompliance, 'EmergencyCooldownActive');
    });

    it('should enforce MIN_EMERGENCY_DURATION before deactivation', async function () {
      await fidesCompliance.connect(owner).activateEmergency();
      await expect(
        fidesCompliance.connect(owner).deactivateEmergency()
      ).to.be.revertedWithCustomError(fidesCompliance, 'TooEarly');
    });

    it('should allow deactivation after MIN_EMERGENCY_DURATION', async function () {
      await fidesCompliance.connect(owner).activateEmergency();
      await ethers.provider.send('evm_increaseTime', [3601]); // > 1 hour
      await ethers.provider.send('evm_mine');
      await expect(fidesCompliance.connect(owner).deactivateEmergency())
        .to.emit(fidesCompliance, 'EmergencyModeDeactivated');
      expect(await fidesCompliance.emergencyMode()).to.be.false;
    });

    it('should revert emergency activation by non-admin', async function () {
      await expect(
        fidesCompliance.connect(addr1).activateEmergency()
      ).to.be.reverted;
    });
  });

  describe('Batch Quick Check', function () {
    beforeEach(async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 85, 3, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr3.address, 98, 4, [], true);
    });

    it('should check multiple addresses in batch', async function () {
      const [results, scores] = await fidesCompliance.batchQuickCheck([addr1.address, addr2.address, addr3.address]);
      expect(results[0]).to.be.true;  // score 30 < 95
      expect(results[1]).to.be.true;  // score 85 < 95 (maxRiskScoreForBlock)
      expect(results[2]).to.be.false; // sanctioned
      expect(scores[0]).to.equal(30);
      expect(scores[1]).to.equal(85);
      expect(scores[2]).to.equal(98);
    });

    it('should revert for batch size exceeding MAX_BATCH_SIZE', async function () {
      const addrs = Array(101).fill(addr1.address);
      await expect(
        fidesCompliance.batchQuickCheck(addrs)
      ).to.be.revertedWithCustomError(fidesCompliance, 'BatchTooLarge');
    });

    it('should mark zero address as non-compliant', async function () {
      const [results, scores] = await fidesCompliance.batchQuickCheck([addr1.address, ethers.ZeroAddress]);
      expect(results[0]).to.be.true;
      expect(results[1]).to.be.false;
      expect(scores[1]).to.equal(0);
    });
  });

  describe('Two-Step Confirmation Setters', function () {
    it('should propose and execute compliance engine update', async function () {
      const MockCE = await ethers.getContractFactory('ComplianceEngine');
      const mockCE = await MockCE.deploy();
      await mockCE.waitForDeployment();

      await fidesCompliance.connect(owner).proposeComplianceEngine(await mockCE.getAddress());
      expect(await fidesCompliance.pendingComplianceEngine()).to.equal(await mockCE.getAddress());

      await ethers.provider.send('evm_increaseTime', [48 * 60 * 60 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(fidesCompliance.connect(owner).executeComplianceEngineUpdate())
        .to.emit(fidesCompliance, 'ComplianceEngineUpdated');
      expect(await fidesCompliance.complianceEngine()).to.equal(await mockCE.getAddress());
    });

    it('should revert executing update before delay', async function () {
      const MockCE = await ethers.getContractFactory('ComplianceEngine');
      const mockCE = await MockCE.deploy();
      await mockCE.waitForDeployment();

      await fidesCompliance.connect(owner).proposeComplianceEngine(await mockCE.getAddress());
      await expect(
        fidesCompliance.connect(owner).executeComplianceEngineUpdate()
      ).to.be.revertedWithCustomError(fidesCompliance, 'TooEarly');
    });

    it('should revert executing update with nothing pending', async function () {
      await expect(
        fidesCompliance.connect(owner).executeComplianceEngineUpdate()
      ).to.be.revertedWithCustomError(fidesCompliance, 'NothingPending');
    });

    it('should propose and execute risk registry update', async function () {
      const MockRR = await ethers.getContractFactory('RiskRegistry');
      const mockRR = await MockRR.deploy();
      await mockRR.waitForDeployment();

      await fidesCompliance.connect(owner).proposeRiskRegistry(await mockRR.getAddress());

      await ethers.provider.send('evm_increaseTime', [48 * 60 * 60 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(fidesCompliance.connect(owner).executeRiskRegistryUpdate())
        .to.emit(fidesCompliance, 'RiskRegistryUpdated');
    });

    it('should propose and execute policy engine update', async function () {
      const MockPE = await ethers.getContractFactory('PolicyEngine');
      const mockPE = await MockPE.deploy();
      await mockPE.waitForDeployment();

      await fidesCompliance.connect(owner).proposePolicyEngine(await mockPE.getAddress());

      await ethers.provider.send('evm_increaseTime', [48 * 60 * 60 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(fidesCompliance.connect(owner).executePolicyEngineUpdate())
        .to.emit(fidesCompliance, 'PolicyEngineUpdated');
    });

    it('should propose and execute quarantine vault update', async function () {
      const MockQV = await ethers.getContractFactory('QuarantineVault');
      const mockQV = await MockQV.deploy();
      await mockQV.waitForDeployment();

      await fidesCompliance.connect(owner).proposeQuarantineVault(await mockQV.getAddress());

      await ethers.provider.send('evm_increaseTime', [48 * 60 * 60 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(fidesCompliance.connect(owner).executeQuarantineVaultUpdate())
        .to.emit(fidesCompliance, 'QuarantineVaultUpdated');
    });

    it('should revert proposing zero address', async function () {
      await expect(
        fidesCompliance.connect(owner).proposeComplianceEngine(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(fidesCompliance, 'InvalidAddress');
    });
  });

  describe('Whitelist Management', function () {
    it('should allow admin to add and remove from whitelist', async function () {
      await expect(fidesCompliance.connect(owner).setWhitelist(addr1.address, true))
        .to.emit(fidesCompliance, 'WhitelistUpdated');
      expect(await fidesCompliance.isWhitelisted(addr1.address)).to.be.true;

      await expect(fidesCompliance.connect(owner).setWhitelist(addr1.address, false))
        .to.emit(fidesCompliance, 'WhitelistUpdated');
      expect(await fidesCompliance.isWhitelisted(addr1.address)).to.be.false;
    });

    it('should revert whitelisting zero address', async function () {
      await expect(
        fidesCompliance.connect(owner).setWhitelist(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(fidesCompliance, 'InvalidAddress');
    });

    it('should revert whitelist management by non-admin', async function () {
      await expect(
        fidesCompliance.connect(addr1).setWhitelist(addr2.address, true)
      ).to.be.reverted;
    });
  });

  describe('Pausable', function () {
    it('should allow admin to pause and unpause', async function () {
      await expect(fidesCompliance.connect(owner).pause())
        .to.emit(fidesCompliance, 'ContractPaused');
      expect(await fidesCompliance.paused()).to.be.true;

      await expect(fidesCompliance.connect(owner).unpause())
        .to.emit(fidesCompliance, 'ContractUnpaused');
      expect(await fidesCompliance.paused()).to.be.false;
    });

    it('should revert pause by non-admin', async function () {
      await expect(fidesCompliance.connect(addr1).pause()).to.be.reverted;
    });
  });

  describe('Role Management', function () {
    it('should grant and revoke roles with reason', async function () {
      const ADMIN_ROLE = await fidesCompliance.ADMIN_ROLE();

      await expect(
        fidesCompliance.connect(owner).grantRoleWithReason(ADMIN_ROLE, addr1.address, 'test')
      ).to.emit(fidesCompliance, 'RoleGrantedDetailed');

      expect(await fidesCompliance.hasRole(ADMIN_ROLE, addr1.address)).to.be.true;

      await expect(
        fidesCompliance.connect(owner).revokeRoleWithReason(ADMIN_ROLE, addr1.address, 'test')
      ).to.emit(fidesCompliance, 'RoleRevokedDetailed');

      expect(await fidesCompliance.hasRole(ADMIN_ROLE, addr1.address)).to.be.false;
    });
  });

  describe('Statistics Counter Accuracy', function () {
    beforeEach(async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr3.address, 98, 4, [], false);

      const policy = {
        maxTxAmount: ethers.parseEther('1000'),
        dailyLimit: ethers.parseEther('5000'),
        allowMediumRisk: true,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      };
      const dummyToken = ethers.Wallet.createRandom().address;
      await complianceEngine.connect(owner).setIssuerPolicy(dummyToken, policy);
    });

    it('should accurately count checked, blocked, quarantined, and allowed', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;

      // Allowed transaction
      await fidesCompliance.connect(addr1).checkAndExecuteTransaction(
        addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress, deadline
      );

      // Blocked transaction (high risk)
      await fidesCompliance.connect(addr3).checkAndExecuteTransaction(
        addr3.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress, deadline
      );

      const stats = await fidesCompliance.getTransactionStats();
      expect(stats.checked).to.equal(2);
      expect(stats.allowed).to.equal(1);
      expect(stats.blocked).to.equal(1);
      expect(stats.quarantined).to.equal(0);
    });

    it('should accurately count address transaction counts', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;

      await fidesCompliance.connect(addr1).checkAndExecuteTransaction(
        addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress, deadline
      );
      await fidesCompliance.connect(addr1).checkAndExecuteTransaction(
        addr1.address, addr2.address, ethers.parseEther('2'), ethers.ZeroAddress, deadline
      );

      const addrStats = await fidesCompliance.getAddressStats(addr1.address);
      expect(addrStats.count).to.equal(2);
      expect(addrStats.lastCheck).to.be.gt(0);
    });

    it('should increase totalTransactionsChecked for every call', async function () {
      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 300;

      for (let i = 0; i < 5; i++) {
        await fidesCompliance.connect(addr1).checkAndExecuteTransaction(
          addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress, deadline
        );
      }

      const stats = await fidesCompliance.getTransactionStats();
      expect(stats.checked).to.equal(5);
    });
  });

  describe('quickCheckAddress', function () {
    beforeEach(async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 98, 4, [], true);
    });

    it('should return compliant for low-risk address', async function () {
      const [isCompliant, riskScore] = await fidesCompliance.quickCheckAddress(addr1.address);
      expect(isCompliant).to.be.true;
      expect(riskScore).to.equal(30);
    });

    it('should return non-compliant for sanctioned address', async function () {
      const [isCompliant, riskScore] = await fidesCompliance.quickCheckAddress(addr2.address);
      expect(isCompliant).to.be.false;
      expect(riskScore).to.equal(98);
    });

    it('should revert for zero address', async function () {
      await expect(fidesCompliance.quickCheckAddress(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(fidesCompliance, 'InvalidAddress');
    });
  });

  describe('getRiskProfile', function () {
    it('should return fail-closed for zero address', async function () {
      const [riskScore, isSanctioned, lastUpdated] = await fidesCompliance.getRiskProfile(ethers.ZeroAddress);
      expect(riskScore).to.equal(100);
      expect(isSanctioned).to.be.false;
      expect(lastUpdated).to.equal(0);
    });

    it('should return profile for known address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 75, 2, [], false);
      const [riskScore, isSanctioned] = await fidesCompliance.getRiskProfile(addr1.address);
      expect(riskScore).to.equal(75);
      expect(isSanctioned).to.be.false;
    });
  });

  describe('isBlacklisted', function () {
    it('should return true for sanctioned address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 1, [], true);
      expect(await fidesCompliance.isBlacklisted(addr1.address)).to.be.true;
    });

    it('should return true for critical risk address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 98, 4, [], false);
      expect(await fidesCompliance.isBlacklisted(addr1.address)).to.be.true;
    });

    it('should return false for clean address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      expect(await fidesCompliance.isBlacklisted(addr1.address)).to.be.false;
    });

    it('should revert for zero address', async function () {
      await expect(fidesCompliance.isBlacklisted(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(fidesCompliance, 'InvalidAddress');
    });
  });
});
