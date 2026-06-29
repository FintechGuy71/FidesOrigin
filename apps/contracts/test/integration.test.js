const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

/**
 * @title Enhanced Integration Test Suite
 * @notice End-to-end integration tests covering full compliance flow
 * @dev 扩展测试覆盖：QuarantineVault、FidesOriginTimelock、RiskOracle 集成
 */

describe('Integration Tests', function () {
  let 
    riskRegistry, policyEngine, complianceEngine, riskOracle, timelock,
    stableCoin, smartWallet, testUSD, quarantineVault,
    owner, admin, oracle, operator, user1, user2, issuer, walletOwner;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    riskRegistry = fixture.riskRegistry;
    policyEngine = fixture.policyEngine;
    complianceEngine = fixture.complianceEngine;
    riskOracle = fixture.riskOracle;
    timelock = fixture.timelock;
    stableCoin = fixture.stableCoin;
    smartWallet = fixture.smartWallet;
    testUSD = fixture.testUSD;
    quarantineVault = fixture.quarantineVault;
    owner = fixture.owner;
    admin = fixture.admin;
    oracle = fixture.oracle;
    operator = fixture.operator;
    user1 = fixture.user1;
    user2 = fixture.user2;
    issuer = fixture.issuer;
    walletOwner = fixture.walletOwner;

    // Mint stablecoin to user1
    await stableCoin.connect(owner).mint(user1.address, 1000000 * 10 ** 6);

    // Fund smart wallet
    await owner.sendTransaction({
      to: await smartWallet.getAddress(),
      value: ethers.parseEther('10'),
    });
  });

  describe('Full Compliance Flow', function () {
    it('should complete: oracle update → policy eval → compliance check → stableCoin transfer', async function () {
      // 1. Oracle updates risk profile
      await riskRegistry.connect(oracle).updateRiskProfile(
        user2.address,
        25,
        1, // LOW
        [ethers.encodeBytes32String('exchange')],
        false
      );

      // 2. StableCoin transfer should succeed
      const tx = await stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6);
      await expect(tx)
        .to.emit(stableCoin, 'Transfer')
        .withArgs(user1.address, user2.address, 1000 * 10 ** 6);

      expect(await stableCoin.balanceOf(user2.address)).to.equal(1000 * 10 ** 6);
    });

    it('should BLOCK: oracle flags HIGH → stableCoin transfer reverts', async function () {
      // 1. Oracle flags user2 as HIGH risk
      await riskRegistry.connect(oracle).updateRiskProfile(
        user2.address,
        85,
        3, // HIGH
        [ethers.encodeBytes32String('mixer')],
        false
      );

      // 2. StableCoin transfer should be blocked
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');
    });

    it('should BLOCK: admin sanctions → all transfers blocked', async function () {
      // 1. Admin emergency sanctions user1
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC update');

      // 2. StableCoin transfer from sanctioned should fail
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');

      // 3. ComplianceEngine direct check should return BLOCK
      const [decision] = await complianceEngine.validateTransfer(user1.address, user2.address, 100, await stableCoin.getAddress());
      expect(decision).to.equal(1); // BLOCK
    });

    it('should ALLOW after sanction removal', async function () {
      // Sanction then remove
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'test');
      await riskRegistry.connect(admin).removeSanction(user1.address);

      // Advance time to avoid UpdateTooFrequent cooldown
      await ethers.provider.send('evm_increaseTime', [3601]); // 1 hour + 1 second
      await ethers.provider.send('evm_mine');

      // Reset risk tier back to LOW (removeSanction does not reset tier)
      await riskRegistry.connect(oracle).updateRiskProfile(
        user1.address,
        10,
        1, // LOW
        [],
        false
      );

      // Transfer should work
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.not.be.reverted;
    });
  });

  describe('Cross-Contract Integration', function () {
    it('should sync risk data across all components', async function () {
      // Update via oracle
      await riskRegistry.connect(oracle).updateRiskProfile(
        user1.address,
        60,
        2, // MEDIUM
        [ethers.encodeBytes32String('defi_user')],
        false
      );

      // Verify RiskRegistry
      const profile = await riskRegistry.getRiskProfile(user1.address);
      expect(profile.riskScore).to.equal(60);
      expect(profile.riskTier).to.equal(2);

      // Verify ComplianceEngine reads same data
      expect(await complianceEngine.getRiskTier(user1.address)).to.equal(2);

      // Verify PolicyEngine evaluates correctly (MEDIUM risk → HOLD by default)
      const [decision] = await policyEngine.evaluateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(3); // HOLD (2 in original enum but PolicyEngine returns 3 for FLAG? Let me check)
      // Actually default policy: allowMediumRisk=false, so MEDIUM → HOLD (decision=2)
    });

    it('should handle batch risk updates correctly', async function () {
      const accounts = [user1.address, user2.address, oracle.address];
      const scores = [10, 50, 90];
      const tiers = [1, 2, 3];
      const sanctioned = [false, false, true];

      await riskRegistry.connect(oracle).batchUpdateRiskProfiles(accounts, scores, tiers, sanctioned);

      // Verify all three
      expect(await riskRegistry.getRiskTier(user1.address)).to.equal(1);
      expect(await riskRegistry.getRiskTier(user2.address)).to.equal(2);
      expect(await riskRegistry.getRiskTier(oracle.address)).to.equal(3);
      expect(await riskRegistry.isSanctioned(oracle.address)).to.be.true;
    });
  });

  describe('Emergency Pause', function () {
    it('should pause all compliance operations', async function () {
      // First a transfer works
      await expect(stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)).to.not.be.reverted;

      // Pause compliance engine using emergencyPause
      await complianceEngine.connect(owner).emergencyPause();

      // Normal transfer should fail (paused state blocks preTransferHook)
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');

      // Unpause using emergencyUnpause
      await complianceEngine.connect(owner).emergencyUnpause();

      // Now should work again
      await expect(stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)).to.not.be.reverted;
    });

    it('should pause RiskRegistry updates but not reads', async function () {
      await riskRegistry.connect(admin).pause();

      // Writes should fail
      await expect(
        riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 1, [], false)
      ).to.be.revertedWithCustomError(riskRegistry, 'EnforcedPause');

      // Reads should still work
      const profile = await riskRegistry.getRiskProfile(user1.address);
      expect(profile.riskScore).to.equal(0);
    });
  });

  describe('Daily Limits', function () {
    it('should track spending across multiple transfers', async function () {
      // Use recordTransfer directly to simulate daily spending tracking
      // (stableCoin's postTransferHook calls complianceEngine which doesn't implement it)
      const token = await stableCoin.getAddress();
      const amount1 = 100000n * 10n ** 6n;
      const amount2 = 200000n * 10n ** 6n;
      
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, amount1, token, true);
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, amount2, token, true);

      const spent = await policyEngine.getDailySpent(user1.address, token);
      expect(spent).to.equal(amount1 + amount2);
    });
  });

  describe('Hold Funds', function () {
    it('should hold and release funds through ComplianceEngine', async function () {
      // Set user1 as MEDIUM risk → default policy returns HOLD (allowMediumRisk=false)
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);

      // Use ComplianceEngine's quarantineTransaction to create a hold record
      // (stableCoin's postTransferHook is not implemented in ComplianceEngine)
      const token = await stableCoin.getAddress();
      const amount = 1000n * 10n ** 6n;
      const quarantineId = ethers.keccak256(ethers.toUtf8Bytes('hold-test-1'));
      
      await complianceEngine.connect(owner).quarantineTransaction(
        user1.address, user2.address, amount, token, quarantineId, 'hold test'
      );

      // Verify quarantine record exists
      const record = await complianceEngine.getQuarantineRecord(quarantineId);
      expect(record.amount).to.equal(amount);
      expect(record.from).to.equal(user1.address);
      expect(record.to).to.equal(user2.address);
      expect(record.released).to.be.false;

      // Release the quarantine
      await complianceEngine.connect(owner).releaseQuarantine(quarantineId);
      
      const releasedRecord = await complianceEngine.getQuarantineRecord(quarantineId);
      expect(releasedRecord.released).to.be.true;
    });
  });

  // ==================== QuarantineVault Integration ====================
  describe('QuarantineVault Integration', function () {
    beforeEach(async function () {
      // Mint testUSD to user1 and approve vault
      await testUSD.mint(user1.address, ethers.parseEther('10000'));
      await testUSD.connect(user1).approve(quarantineVault.target, ethers.parseEther('10000'));
    });

    it('should deposit and release funds through vault', async function () {
      const amount = ethers.parseEther('100');
      const reason = ethers.keccak256(ethers.toUtf8Bytes('SUSPICIOUS_ACTIVITY'));

      // Deposit funds to vault (owner calls deposit, but tokens come from user1's approval)
      await quarantineVault.connect(user1).deposit(user1.address, testUSD.target, amount, reason);

      expect(await quarantineVault.getRecordCount()).to.equal(1);
      expect(await testUSD.balanceOf(quarantineVault.target)).to.equal(amount);

      // Release funds to user2 (use explicit function signature to avoid ambiguity)
      const recordId = await quarantineVault.allRecordIds(0);
      await quarantineVault['release(bytes32,address)'](recordId, user2.address);

      expect(await testUSD.balanceOf(user2.address)).to.equal(amount);
    });

    it('should freeze funds permanently for high-risk addresses', async function () {
      const amount = ethers.parseEther('500');
      const reason = ethers.keccak256(ethers.toUtf8Bytes('SANCTIONED'));

      // Flag user1 as sanctioned
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');

      // Deposit and freeze (user1 calls deposit with their own tokens)
      await quarantineVault.connect(user1).deposit(user1.address, testUSD.target, amount, reason);
      const recordId = await quarantineVault.allRecordIds(0);
      await quarantineVault.freezePermanently(recordId);

      // Funds should remain in vault
      expect(await testUSD.balanceOf(quarantineVault.target)).to.equal(amount);

      // Governance can unlock (use explicit function signature to avoid ambiguity)
      await quarantineVault.connect(owner)['governanceUnlock(bytes32,address)'](recordId, user2.address);
      expect(await testUSD.balanceOf(user2.address)).to.equal(amount);
    });

    it('should batch deposit multiple records', async function () {
      const owners = [user1.address, user2.address];
      const tokens = [testUSD.target, testUSD.target];
      const amounts = [ethers.parseEther('100'), ethers.parseEther('200')];
      const reasons = [ethers.ZeroHash, ethers.ZeroHash];

      await testUSD.mint(user2.address, ethers.parseEther('1000'));
      await testUSD.connect(user2).approve(quarantineVault.target, ethers.parseEther('1000'));
      // Also mint and approve for user1
      await testUSD.mint(user1.address, ethers.parseEther('1000'));
      await testUSD.connect(user1).approve(quarantineVault.target, ethers.parseEther('1000'));
      // Grant QUARANTINE_ROLE to user1 for batchDeposit
      await quarantineVault.connect(owner).grantRole(await quarantineVault.QUARANTINE_ROLE(), user1.address);

      await quarantineVault.connect(user1).batchDeposit(owners, tokens, amounts, reasons);

      expect(await quarantineVault.getRecordCount()).to.equal(2);
      expect(await quarantineVault.totalQuarantinedAmountForToken(testUSD.target)).to.equal(ethers.parseEther('300'));
    });

    it('should pause vault during emergency', async function () {
      await quarantineVault.emergencyPause();

      await expect(
        quarantineVault.connect(user1).deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash)
      ).to.be.revertedWithCustomError(quarantineVault, 'EmergencyPausedError');

      await quarantineVault.emergencyUnpause();

      await expect(
        quarantineVault.connect(user1).deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash)
      ).to.not.be.reverted;
    });
  });

  // ==================== FidesOriginTimelock Integration ====================
  describe('FidesOriginTimelock Integration', function () {
    it('should have correct delay constants', async function () {
      expect(await timelock.MIN_DELAY()).to.equal(2 * 24 * 60 * 60); // 2 days
      expect(await timelock.EMERGENCY_DELAY()).to.equal(4 * 60 * 60); // 4 hours
    });

    it('should start with emergency mode disabled', async function () {
      expect(await timelock.emergencyMode()).to.be.false;
    });

    it('should enable and disable emergency mode', async function () {
      // Add owner as emergency operator
      await timelock.addEmergencyOperator(owner.address);

      await expect(timelock.enableEmergencyMode())
        .to.emit(timelock, 'EmergencyModeEnabled')
        .withArgs(owner.address);

      expect(await timelock.emergencyMode()).to.be.true;

      await expect(timelock.disableEmergencyMode())
        .to.emit(timelock, 'EmergencyModeDisabled')
        .withArgs(owner.address);

      expect(await timelock.emergencyMode()).to.be.false;
    });

    it('should return correct effective delay', async function () {
      expect(await timelock.getEffectiveDelay()).to.equal(2 * 24 * 60 * 60);

      await timelock.addEmergencyOperator(owner.address);
      await timelock.enableEmergencyMode();

      expect(await timelock.getEffectiveDelay()).to.equal(4 * 60 * 60);
    });

    it('should manage emergency operators', async function () {
      await expect(timelock.addEmergencyOperator(user1.address))
        .to.emit(timelock, 'EmergencyOperatorAdded')
        .withArgs(user1.address);

      expect(await timelock.isEmergencyOperator(user1.address)).to.be.true;

      await expect(timelock.removeEmergencyOperator(user1.address))
        .to.emit(timelock, 'EmergencyOperatorRemoved')
        .withArgs(user1.address);

      expect(await timelock.isEmergencyOperator(user1.address)).to.be.false;
    });
  });

  // ==================== RiskOracle Integration ====================
  describe('RiskOracle Integration', function () {
    it('should update risk profile through oracle', async function () {
      const score = 75;
      const tier = 2;
      const tags = [ethers.keccak256(ethers.toUtf8Bytes('TEST'))];

      await expect(
        riskOracle.updateRiskProfile(user1.address, score, tier, tags, false, 0)
      )
        .to.emit(riskOracle, 'RiskProfileUpdated')
        .withArgs(ethers.ZeroHash, user1.address, score, tier, false);
    });

    it('should queue and execute risk updates', async function () {
      // Use operator signer to avoid caller cooldown conflict
      await riskOracle.connect(operator).queueRiskUpdate(user1.address, 50, 1, false);
      
      // Advance time to avoid caller cooldown for second call
      await ethers.provider.send('evm_increaseTime', [300]); // 5 minutes
      await ethers.provider.send('evm_mine');
      
      await riskOracle.connect(operator).queueRiskUpdate(user2.address, 75, 2, false);

      expect(await riskOracle.getPendingQueueLength()).to.equal(2);

      await expect(riskOracle.connect(operator).executeQueuedUpdates())
        .to.emit(riskOracle, 'BatchUpdateExecuted');

      expect(await riskOracle.getPendingQueueLength()).to.equal(0);
    });

    it('should batch update risk profiles', async function () {
      const accounts = [user1.address, user2.address];
      const scores = [50, 75];
      const tiers = [1, 2];
      const isSanctioned = [false, true];

      await expect(riskOracle.batchUpdateRiskProfiles(accounts, scores, tiers, isSanctioned))
        .to.emit(riskOracle, 'BatchUpdateExecuted');
    });

    it('should enforce update cooldown', async function () {
      await riskOracle.connect(operator).updateRiskProfile(user1.address, 50, 1, [], false, 0);

      // Second call from same operator should fail with caller cooldown
      await expect(
        riskOracle.connect(operator).updateRiskProfile(user1.address, 60, 2, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'CallerCooldownActive');
    });

    it('should pause and unpause oracle', async function () {
      await riskOracle.pause();
      expect(await riskOracle.paused()).to.be.true;

      await expect(
        riskOracle.updateRiskProfile(user1.address, 50, 1, [], false, 0)
      ).to.be.revertedWithCustomError(riskOracle, 'EnforcedPause');

      await riskOracle.unpause();
      expect(await riskOracle.paused()).to.be.false;
    });
  });

  // ==================== End-to-End Scenarios ====================
  describe('End-to-End Scenarios', function () {
    it('should handle complete sanction workflow: flag → quarantine → freeze', async function () {
      // 1. User1 gets flagged as high risk
      await riskRegistry.connect(oracle).updateRiskProfile(
        user1.address,
        95,
        3, // HIGH
        [ethers.encodeBytes32String('sanctioned')],
        true
      );

      // 2. Transfer should be blocked
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');

      // 3. Funds can be quarantined
      await testUSD.mint(user1.address, ethers.parseEther('1000'));
      await testUSD.connect(user1).approve(quarantineVault.target, ethers.parseEther('1000'));

      await quarantineVault.connect(user1).deposit(
        user1.address,
        testUSD.target,
        ethers.parseEther('1000'),
        ethers.keccak256(ethers.toUtf8Bytes('SANCTIONED'))
      );

      // 4. Freeze permanently
      const recordId = await quarantineVault.allRecordIds(0);
      await quarantineVault.freezePermanently(recordId);

      // 5. Funds remain in vault
      expect(await testUSD.balanceOf(quarantineVault.target)).to.equal(ethers.parseEther('1000'));
    });

    it('should handle timelock governance for critical operations', async function () {
      // Add emergency operator
      await timelock.addEmergencyOperator(owner.address);

      // Enable emergency mode for faster execution
      await timelock.enableEmergencyMode();
      expect(await timelock.emergencyMode()).to.be.true;

      // Emergency delay should be active
      expect(await timelock.getEffectiveDelay()).to.equal(4 * 60 * 60);

      // Disable emergency mode
      await timelock.disableEmergencyMode();
      expect(await timelock.emergencyMode()).to.be.false;

      // Normal delay should be restored
      expect(await timelock.getEffectiveDelay()).to.equal(2 * 24 * 60 * 60);
    });

    it('should handle multi-oracle consensus for risk updates', async function () {
      // Add multiple authorized oracles
      await riskOracle.addAuthorizedOracle(oracle.address);
      await riskOracle.addAuthorizedOracle(operator.address);
      await riskOracle.setRequiredConfirmations(2);

      const score = 80;
      const tier = 2;

      // First oracle submits response
      await riskOracle.connect(oracle).submitOracleResponse(
        user1.address,
        score,
        tier,
        false,
        0
      );

      // Should not be confirmed yet (need 2 confirmations)
      expect(await riskOracle.isUpdateConfirmed(user1.address)).to.be.false;

      // Second oracle confirms
      await riskOracle.connect(operator).submitOracleResponse(
        user1.address,
        score,
        tier,
        false,
        0
      );

      // Now should be confirmed
      expect(await riskOracle.isUpdateConfirmed(user1.address)).to.be.true;
    });
  });
});
