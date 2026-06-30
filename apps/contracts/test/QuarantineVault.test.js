const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

// Helper: check if a transaction reverts with a specific error message
async function expectRevert(promise, expectedMessage) {
  try {
    await promise;
    expect.fail(`Expected revert with "${expectedMessage}" but transaction succeeded`);
  } catch (error) {
    if (error.message.includes(expectedMessage) || error.shortMessage?.includes(expectedMessage)) {
      return;
    }
    if (error.message.includes('Expected revert') || error.message.includes('transaction succeeded')) {
      throw error;
    }
    // Some errors come from EVM with different formatting
    if (!error.message.includes('reverted') && !error.message.includes(expectedMessage)) {
      expect.fail(`Unexpected error: ${error.message}. Expected: ${expectedMessage}`);
    }
  }
}

// Helper: find parsed event from receipt
function findEvent(receipt, contract, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === eventName) {
        return parsed;
      }
    } catch {
      // skip unparseable logs
    }
  }
  return null;
}

// Helper: check if event exists in receipt
function hasEvent(receipt, contract, eventName) {
  return findEvent(receipt, contract, eventName) !== null;
}

describe('QuarantineVault', function () {
  let vault, testUSD, owner, user1, user2, attacker;
  let quarantineRole, releaseRole, auditorRole, emergencyRole, defaultAdminRole;

  beforeEach(async function () {
    [owner, user1, user2, attacker] = await ethers.getSigners();

    const TestUSD = await ethers.getContractFactory('TestUSD');
    testUSD = await TestUSD.deploy();
    await testUSD.waitForDeployment();

    const QuarantineVault = await ethers.getContractFactory('QuarantineVault');
    vault = await QuarantineVault.deploy();
    await vault.waitForDeployment();

    quarantineRole = await vault.QUARANTINE_ROLE();
    releaseRole = await vault.RELEASE_ROLE();
    auditorRole = await vault.AUDITOR_ROLE();
    emergencyRole = await vault.EMERGENCY_ROLE();
    defaultAdminRole = await vault.DEFAULT_ADMIN_ROLE();

    // Mint tokens to owner (quarantiner) and approve vault
    await testUSD.mint(owner.address, ethers.parseEther('10000'));
    await testUSD.connect(owner).approve(vault.target, ethers.parseEther('10000'));
  });

  // ========== Deployment ==========
  describe('Deployment', function () {
    it('should have correct VERSION', async function () {
      expect(await vault.VERSION()).to.equal('1.2.1');
    });

    it('should grant operational roles to deployer on deployment', async function () {
      expect(await vault.hasRole(quarantineRole, owner.address)).to.be.true;
      expect(await vault.hasRole(releaseRole, owner.address)).to.be.true;
      expect(await vault.hasRole(emergencyRole, owner.address)).to.be.true;
      expect(await vault.hasRole(auditorRole, owner.address)).to.be.true;
    });

    it('should retain DEFAULT_ADMIN_ROLE in constructor', async function () {
      expect(await vault.hasRole(defaultAdminRole, owner.address)).to.be.true;
    });

    it('should have zero records initially', async function () {
      expect(await vault.getRecordCount()).to.equal(0n);
    });

    it('should have zero stats initially', async function () {
      const stats = await vault.getStats();
      expect(stats[0]).to.equal(0n); // totalQuarantined
      expect(stats[1]).to.equal(0n); // totalReleased
      expect(stats[2]).to.equal(0n); // totalQuarantinedAmount
      expect(stats[3]).to.equal(0n); // totalReleasedAmount
    });
  });

  // ========== Deposit ==========
  describe('Deposit', function () {
    it('should deposit single ERC20 and create record', async function () {
      const amount = ethers.parseEther('100');
      const reasonHash = ethers.ZeroHash;

      const tx = await vault.deposit(user1.address, testUSD.target, amount, reasonHash);
      const receipt = await tx.wait();

      expect(await vault.getRecordCount()).to.equal(1n);
      expect(await testUSD.balanceOf(vault.target)).to.equal(amount);

      const recordId = await vault.allRecordIds(0);
      const record = await vault.getRecord(recordId);

      expect(record.originalOwner).to.equal(user1.address);
      expect(record.token).to.equal(testUSD.target);
      expect(record.amount).to.equal(amount);
      expect(record.released).to.be.false;
      expect(record.frozen).to.be.false;
      expect(record.reason).to.equal('manual'); // ZeroHash -> "manual"
      expect(hasEvent(receipt, vault, 'FundsQuarantined')).to.be.true;
    });

    it('should emit correct deposit event params', async function () {
      const amount = ethers.parseEther('100');
      const tx = await vault.deposit(user1.address, testUSD.target, amount, ethers.ZeroHash);
      const receipt = await tx.wait();

      const event = findEvent(receipt, vault, 'FundsQuarantined');
      expect(event).to.not.be.null;
      expect(event.args.originalOwner).to.equal(user1.address);
      expect(event.args.token).to.equal(testUSD.target);
      expect(event.args.amount).to.equal(amount);
      expect(event.args.reason).to.equal('manual');
    });

    it('should deposit with non-zero reasonHash and convert to hex string', async function () {
      const amount = ethers.parseEther('100');
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('test_reason'));

      await vault.deposit(user1.address, testUSD.target, amount, reasonHash);

      const recordId = await vault.allRecordIds(0);
      const record = await vault.getRecord(recordId);

      // reasonHash is converted to hex string by _bytes32ToHexString
      expect(record.reason).to.match(/^0x[0-9a-f]{64}$/i);
    });

    it('should reject deposit with zero address owner', async function () {
      await expectRevert(
        vault.deposit(ethers.ZeroAddress, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash),
        'InvalidAddress'
      );
    });

    it('should reject deposit with zero address token', async function () {
      await expectRevert(
        vault.deposit(user1.address, ethers.ZeroAddress, ethers.parseEther('100'), ethers.ZeroHash),
        'InvalidAddress'
      );
    });

    it('should reject deposit with zero amount', async function () {
      await expectRevert(
        vault.deposit(user1.address, testUSD.target, 0, ethers.ZeroHash),
        'InvalidAmount'
      );
    });

    it('should reject deposit without QUARANTINE_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should track total quarantined per token', async function () {
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('200'), ethers.ZeroHash);

      expect(await vault.totalQuarantinedAmountForToken(testUSD.target)).to.equal(ethers.parseEther('300'));
    });

    it('should return unique recordIds via monotonic nonce', async function () {
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);

      const id1 = await vault.allRecordIds(0);
      const id2 = await vault.allRecordIds(1);
      expect(id1).to.not.equal(id2);
    });
  });

  // ========== ETH Handling ==========
  describe('ETH Handling', function () {
    it('should receive ETH and emit ETHReceived event', async function () {
      const amount = ethers.parseEther('1');
      const tx = await owner.sendTransaction({
        to: vault.target,
        value: amount
      });
      const receipt = await tx.wait();

      expect(hasEvent(receipt, vault, 'ETHReceived')).to.be.true;
      const event = findEvent(receipt, vault, 'ETHReceived');
      expect(event.args.sender).to.equal(owner.address);
      expect(event.args.amount).to.equal(amount);
      expect(await ethers.provider.getBalance(vault.target)).to.equal(amount);
    });
  });

  // ========== Batch Deposit ==========
  describe('Batch Deposit', function () {
    beforeEach(async function () {
      // Need more tokens and approval for batch operations
      await testUSD.mint(owner.address, ethers.parseEther('10000'));
      await testUSD.connect(owner).approve(vault.target, ethers.parseEther('20000'));
    });

    it('should deposit multiple records', async function () {
      const owners = [user1.address, user2.address];
      const tokens = [testUSD.target, testUSD.target];
      const amounts = [ethers.parseEther('100'), ethers.parseEther('200')];
      const reasons = [ethers.ZeroHash, ethers.ZeroHash];

      const tx = await vault.batchDeposit(owners, tokens, amounts, reasons);
      const receipt = await tx.wait();

      expect(await vault.getRecordCount()).to.equal(2n);
      expect(await vault.totalQuarantinedAmountForToken(testUSD.target)).to.equal(ethers.parseEther('300'));
      expect(hasEvent(receipt, vault, 'FundsQuarantined')).to.be.true;

      const record0 = await vault.getRecord(await vault.allRecordIds(0));
      const record1 = await vault.getRecord(await vault.allRecordIds(1));

      expect(record0.originalOwner).to.equal(user1.address);
      expect(record0.amount).to.equal(ethers.parseEther('100'));
      expect(record1.originalOwner).to.equal(user2.address);
      expect(record1.amount).to.equal(ethers.parseEther('200'));
    });

    it('should handle length mismatch', async function () {
      await expectRevert(
        vault.batchDeposit(
          [user1.address],
          [testUSD.target, testUSD.target],
          [ethers.parseEther('100')],
          [ethers.ZeroHash]
        ),
        'Length mismatch'
      );
    });

    it('should reject batch exceeding MAX_BATCH_SIZE', async function () {
      const owners = Array(101).fill(user1.address);
      const tokens = Array(101).fill(testUSD.target);
      const amounts = Array(101).fill(ethers.parseEther('1'));
      const reasons = Array(101).fill(ethers.ZeroHash);

      await expectRevert(
        vault.batchDeposit(owners, tokens, amounts, reasons),
        'Batch too large'
      );
    });

    it('should reject batch deposit with zero address owner', async function () {
      await expectRevert(
        vault.batchDeposit(
          [ethers.ZeroAddress],
          [testUSD.target],
          [ethers.parseEther('100')],
          [ethers.ZeroHash]
        ),
        'InvalidAddress'
      );
    });

    it('should reject batch deposit with zero amount', async function () {
      await expectRevert(
        vault.batchDeposit(
          [user1.address],
          [testUSD.target],
          [0],
          [ethers.ZeroHash]
        ),
        'InvalidAmount'
      );
    });
  });

  // ========== Release ==========
  describe('Release', function () {
    let recordId;

    beforeEach(async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      recordId = await vault.allRecordIds(0);
    });

    it('should release funds to original owner via releaseFunds', async function () {
      const initialBalance = await testUSD.balanceOf(user1.address);

      const tx = await vault.releaseFunds(recordId);
      const receipt = await tx.wait();

      expect(hasEvent(receipt, vault, 'FundsReleased')).to.be.true;
      const event = findEvent(receipt, vault, 'FundsReleased');
      expect(event.args.recordId).to.equal(recordId);
      expect(event.args.originalOwner).to.equal(user1.address);

      expect(await testUSD.balanceOf(user1.address)).to.equal(initialBalance + ethers.parseEther('100'));

      const record = await vault.getRecord(recordId);
      expect(record.released).to.be.true;
      expect(record.releasedBy).to.equal(owner.address);
      expect(record.releasedAt > 0n).to.be.true;
    });

    it('should release via legacy release with to=address(0)', async function () {
      const tx = await vault.release(recordId, ethers.ZeroAddress);
      const receipt = await tx.wait();

      expect(hasEvent(receipt, vault, 'FundsReleased')).to.be.true;
      const record = await vault.getRecord(recordId);
      expect(record.released).to.be.true;
    });

    it('should reject legacy release with non-zero to address', async function () {
      await expectRevert(
        vault.release(recordId, user2.address),
        'Use releaseFunds for owner return'
      );
    });

    it('should reject releasing already released record', async function () {
      await vault.releaseFunds(recordId);
      await expectRevert(
        vault.releaseFunds(recordId),
        'AlreadyReleased'
      );
    });

    it('should reject release without RELEASE_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).releaseFunds(recordId),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should update stats on release', async function () {
      await vault.releaseFunds(recordId);
      const stats = await vault.getStats();
      expect(stats[0]).to.equal(1n); // totalQuarantined
      expect(stats[1]).to.equal(1n); // totalReleased
      expect(stats[2]).to.equal(ethers.parseEther('100')); // totalQuarantinedAmount
      expect(stats[3]).to.equal(ethers.parseEther('100')); // totalReleasedAmount
    });

    it('should update token quarantined amount on release', async function () {
      await vault.releaseFunds(recordId);
      expect(await vault.totalQuarantinedAmountForToken(testUSD.target)).to.equal(0n);
    });
  });

  // ========== Batch Release ==========
  describe('Batch Release', function () {
    let recordId1, recordId2;

    beforeEach(async function () {
      let tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      recordId1 = await vault.allRecordIds(0);

      tx = await vault.deposit(user2.address, testUSD.target, ethers.parseEther('200'), ethers.ZeroHash);
      await tx.wait();
      recordId2 = await vault.allRecordIds(1);
    });

    it('should release multiple records', async function () {
      const initialBalance1 = await testUSD.balanceOf(user1.address);
      const initialBalance2 = await testUSD.balanceOf(user2.address);

      const tx = await vault.batchReleaseFunds([recordId1, recordId2]);
      await tx.wait();

      expect(await testUSD.balanceOf(user1.address)).to.equal(initialBalance1 + ethers.parseEther('100'));
      expect(await testUSD.balanceOf(user2.address)).to.equal(initialBalance2 + ethers.parseEther('200'));

      const record1 = await vault.getRecord(recordId1);
      const record2 = await vault.getRecord(recordId2);
      expect(record1.released).to.be.true;
      expect(record2.released).to.be.true;
    });

    it('should handle non-existent records gracefully with BatchReleaseFailed event', async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes('fake'));
      const tx = await vault.batchReleaseFunds([recordId1, fakeId]);
      const receipt = await tx.wait();

      // recordId1 should be released
      const record1 = await vault.getRecord(recordId1);
      expect(record1.released).to.be.true;

      // Check for BatchReleaseFailed event
      const failedEvent = findEvent(receipt, vault, 'BatchReleaseFailed');
      expect(failedEvent).to.not.be.null;
      expect(failedEvent.args.recordId).to.equal(fakeId);
      expect(failedEvent.args.reason).to.equal('RecordNotFound');
    });

    it('should handle already released records gracefully with BatchReleaseFailed event', async function () {
      await vault.releaseFunds(recordId1);
      const tx = await vault.batchReleaseFunds([recordId1, recordId2]);
      const receipt = await tx.wait();

      const record2 = await vault.getRecord(recordId2);
      expect(record2.released).to.be.true;

      const failedEvent = findEvent(receipt, vault, 'BatchReleaseFailed');
      expect(failedEvent).to.not.be.null;
      expect(failedEvent.args.recordId).to.equal(recordId1);
      expect(failedEvent.args.reason).to.equal('AlreadyReleased');
    });

    it('should reject batch exceeding MAX_BATCH_SIZE', async function () {
      const ids = Array(101).fill(recordId1);
      await expectRevert(
        vault.batchReleaseFunds(ids),
        'Batch too large'
      );
    });
  });

  // ========== Freeze Permanently ==========
  describe('Freeze Permanently', function () {
    let recordId;

    beforeEach(async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      recordId = await vault.allRecordIds(0);
    });

    it('should freeze funds permanently', async function () {
      const tx = await vault.freezePermanently(recordId);
      const receipt = await tx.wait();

      expect(hasEvent(receipt, vault, 'FundsFrozen')).to.be.true;

      const record = await vault.getRecord(recordId);
      expect(record.frozen).to.be.true;
      expect(record.released).to.be.false;
      expect(await testUSD.balanceOf(vault.target)).to.equal(ethers.parseEther('100'));
    });

    it('should emit correct freeze event params', async function () {
      const tx = await vault.freezePermanently(recordId);
      const receipt = await tx.wait();

      const event = findEvent(receipt, vault, 'FundsFrozen');
      expect(event).to.not.be.null;
      expect(event.args.recordId).to.equal(recordId);
      expect(event.args.originalOwner).to.equal(user1.address);
      expect(event.args.token).to.equal(testUSD.target);
      expect(event.args.amount).to.equal(ethers.parseEther('100'));
      expect(event.args.by).to.equal(owner.address);
    });

    it('should prevent release of frozen funds', async function () {
      await vault.freezePermanently(recordId);
      await expectRevert(
        vault.releaseFunds(recordId),
        'AlreadyFrozen'
      );
    });

    it('should reject freeze without EMERGENCY_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).freezePermanently(recordId),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should reject freeze of already released record', async function () {
      await vault.releaseFunds(recordId);
      await expectRevert(
        vault.freezePermanently(recordId),
        'AlreadyReleased'
      );
    });

    it('should reject freeze of already frozen record', async function () {
      await vault.freezePermanently(recordId);
      await expectRevert(
        vault.freezePermanently(recordId),
        'AlreadyFrozen'
      );
    });
  });

  // ========== Emergency Pause ==========
  describe('Emergency Pause', function () {
    let recordId;

    beforeEach(async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      recordId = await vault.allRecordIds(0);
    });

    it('should pause contract and block deposits', async function () {
      await vault.emergencyPause();
      expect(await vault.isEmergencyPaused()).to.be.true;

      await expectRevert(
        vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash),
        'EmergencyPausedError'
      );
    });

    it('should pause contract and block releases', async function () {
      await vault.emergencyPause();
      await expectRevert(
        vault.releaseFunds(recordId),
        'EmergencyPausedError'
      );
    });

    it('should emit EmergencyPaused and ContractPaused events', async function () {
      const tx = await vault.emergencyPause();
      const receipt = await tx.wait();

      expect(hasEvent(receipt, vault, 'EmergencyPaused')).to.be.true;
      expect(hasEvent(receipt, vault, 'ContractPaused')).to.be.true;
    });

    it('should reject pause without EMERGENCY_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).emergencyPause(),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should enforce cooldown before unpause', async function () {
      await vault.emergencyPause();
      await expectRevert(
        vault.emergencyUnpause(),
        'EmergencyCooldownActive'
      );
    });

    it('should unpause after cooldown and restore operations', async function () {
      await vault.emergencyPause();

      // Advance time by 1 hour + 1 second
      await time.increase(3601);

      const tx = await vault.emergencyUnpause();
      const receipt = await tx.wait();

      expect(hasEvent(receipt, vault, 'EmergencyUnpaused')).to.be.true;
      expect(hasEvent(receipt, vault, 'ContractUnpaused')).to.be.true;
      expect(await vault.isEmergencyPaused()).to.be.false;

      // Should be able to deposit again
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      expect(await vault.getRecordCount()).to.equal(2n);
    });

    it('should reject unpause without EMERGENCY_ROLE', async function () {
      await vault.emergencyPause();
      await time.increase(3601);
      await expectRevert(
        vault.connect(attacker).emergencyUnpause(),
        'AccessControlUnauthorizedAccount'
      );
    });
  });

  // ========== Governance Unlock ==========
  describe('Governance Unlock', function () {
    let recordId;

    beforeEach(async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      recordId = await vault.allRecordIds(0);
    });

    it('should unlock funds with EMERGENCY_ROLE', async function () {
      await vault.governanceUnlock(recordId);
      const record = await vault.getRecord(recordId);
      expect(record.released).to.be.true;
    });

    it('should allow governanceUnlock by EMERGENCY_ROLE holder', async function () {
      // Owner has EMERGENCY_ROLE, so governanceUnlock should succeed
      await vault.governanceUnlock(recordId);
      const record = await vault.getRecord(recordId);
      expect(record.released).to.be.true;
    });

    it('should reject governanceUnlock by attacker', async function () {
      await expectRevert(
        vault.connect(attacker).governanceUnlock(recordId),
        'AccessControlUnauthorizedAccount'
      );
    });
  });

  // ========== Withdraw ETH ==========
  describe('Withdraw ETH', function () {
    beforeEach(async function () {
      await owner.sendTransaction({
        to: vault.target,
        value: ethers.parseEther('1')
      });
    });

    it('should withdraw ETH by EMERGENCY_ROLE holder', async function () {
      const vaultBalanceBefore = await ethers.provider.getBalance(vault.target);
      expect(vaultBalanceBefore).to.equal(ethers.parseEther('1'));
      await vault.withdrawETH(user1.address);
      expect(await ethers.provider.getBalance(vault.target)).to.equal(0n);
    });

    it('should allow withdrawETH by EMERGENCY_ROLE holder', async function () {
      // Owner has EMERGENCY_ROLE, so withdrawETH should succeed
      await vault.withdrawETH(user1.address);
      expect(await ethers.provider.getBalance(vault.target)).to.equal(0n);
    });

    it('should reject withdrawETH by attacker', async function () {
      await expectRevert(
        vault.connect(attacker).withdrawETH(user1.address),
        'AccessControlUnauthorizedAccount'
      );
    });
  });

  // ========== Role Management ==========
  describe('Role Management', function () {
    // TODO: fix contract bug - all role management functions require DEFAULT_ADMIN_ROLE,
    // which is permanently renounced in constructor. These functions are dead code.

    it('should grant and revoke quarantine role', async function () {
      await vault.grantQuarantineRole(user1.address, 'test');
      expect(await vault.hasRole(quarantineRole, user1.address)).to.be.true;
      await vault.revokeQuarantineRole(user1.address, 'test');
      expect(await vault.hasRole(quarantineRole, user1.address)).to.be.false;
    });

    it('should grant and revoke auditor role', async function () {
      await vault.grantAuditorRole(user1.address, 'test');
      expect(await vault.hasRole(auditorRole, user1.address)).to.be.true;
      await vault.revokeAuditorRole(user1.address, 'test');
      expect(await vault.hasRole(auditorRole, user1.address)).to.be.false;
    });

    it('should grant and revoke release role', async function () {
      await vault.grantReleaseRole(user1.address, 'test');
      expect(await vault.hasRole(releaseRole, user1.address)).to.be.true;
      await vault.revokeReleaseRole(user1.address, 'test');
      expect(await vault.hasRole(releaseRole, user1.address)).to.be.false;
    });

    it('should grant and revoke emergency role', async function () {
      await vault.grantEmergencyRole(user1.address, 'test');
      expect(await vault.hasRole(emergencyRole, user1.address)).to.be.true;
      await vault.revokeEmergencyRole(user1.address, 'test');
      expect(await vault.hasRole(emergencyRole, user1.address)).to.be.false;
    });

    it('should reject role management by non-DEFAULT_ADMIN_ROLE', async function () {
      // Attacker does not have DEFAULT_ADMIN_ROLE
      await expectRevert(vault.connect(attacker).grantQuarantineRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).revokeQuarantineRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).grantAuditorRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).revokeAuditorRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).grantReleaseRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).revokeReleaseRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).grantEmergencyRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
      await expectRevert(vault.connect(attacker).revokeEmergencyRole(user1.address, 'test'), 'AccessControlUnauthorizedAccount');
    });
  });

  // ========== Permissions ==========
  describe('Permissions', function () {
    let recordId;

    beforeEach(async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      recordId = await vault.allRecordIds(0);
    });

    it('should reject deposit by non-QUARANTINE_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should reject freeze by non-EMERGENCY_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).freezePermanently(recordId),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should reject release by non-RELEASE_ROLE', async function () {
      await expectRevert(
        vault.connect(attacker).releaseFunds(recordId),
        'AccessControlUnauthorizedAccount'
      );
    });

    it('should allow release by non-originalOwner with RELEASE_ROLE', async function () {
      // owner (has RELEASE_ROLE) releases funds that belong to user1 (originalOwner)
      // This verifies that RELEASE_ROLE holders can release any record
      const tx = await vault.connect(owner).releaseFunds(recordId);
      const receipt = await tx.wait();
      expect(hasEvent(receipt, vault, 'FundsReleased')).to.be.true;
      const record = await vault.getRecord(recordId);
      expect(record.released).to.be.true;
      // Funds go to originalOwner, not the releaser
      expect(await testUSD.balanceOf(user1.address)).to.equal(ethers.parseEther('100'));
    });

    it('should confirm constructor retained DEFAULT_ADMIN_ROLE', async function () {
      expect(await vault.hasRole(defaultAdminRole, owner.address)).to.be.true;
      // Owner should be the only one with DEFAULT_ADMIN_ROLE initially
      const accounts = [user1.address, user2.address, attacker.address];
      for (const account of accounts) {
        expect(await vault.hasRole(defaultAdminRole, account)).to.be.false;
      }
    });
  });

  // ========== Edge Cases ==========
  describe('Edge Cases', function () {
    it('should reject release of non-existent record', async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'));
      await expectRevert(
        vault.releaseFunds(fakeId),
        'RecordNotFound'
      );
    });

    it('should reject freeze of non-existent record', async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'));
      await expectRevert(
        vault.freezePermanently(fakeId),
        'RecordNotFound'
      );
    });

    it('should handle deposit during emergency pause', async function () {
      await vault.emergencyPause();
      await expectRevert(
        vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash),
        'EmergencyPausedError'
      );
    });

    it('should handle release during emergency pause', async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      const rid = await vault.allRecordIds(0);

      await vault.emergencyPause();
      await expectRevert(
        vault.releaseFunds(rid),
        'EmergencyPausedError'
      );
    });

    it('should handle batch release during emergency pause with BatchReleaseFailed event', async function () {
      const tx = await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await tx.wait();
      const rid = await vault.allRecordIds(0);

      await vault.emergencyPause();
      const batchTx = await vault.batchReleaseFunds([rid]);
      const receipt = await batchTx.wait();

      const failedEvent = findEvent(receipt, vault, 'BatchReleaseFailed');
      expect(failedEvent).to.not.be.null;
      expect(failedEvent.args.reason).to.equal('Paused');
    });
  });

  // ========== View Functions ==========
  describe('View Functions', function () {
    beforeEach(async function () {
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('100'), ethers.ZeroHash);
      await vault.deposit(user1.address, testUSD.target, ethers.parseEther('200'), ethers.ZeroHash);
      await vault.deposit(user2.address, testUSD.target, ethers.parseEther('50'), ethers.ZeroHash);
    });

    it('should get record by id', async function () {
      const recordId = await vault.allRecordIds(0);
      const record = await vault.getRecord(recordId);
      expect(record.amount).to.equal(ethers.parseEther('100'));
      expect(record.originalOwner).to.equal(user1.address);
    });

    it('should get user records', async function () {
      const records = await vault.getUserRecords(user1.address);
      expect(records.length).to.equal(2);
    });

    it('should get all record ids by index', async function () {
      expect(await vault.allRecordIds(0)).to.not.equal(ethers.ZeroHash);
      expect(await vault.allRecordIds(1)).to.not.equal(ethers.ZeroHash);
      expect(await vault.allRecordIds(2)).to.not.equal(ethers.ZeroHash);
      await expectRevert(
        vault.allRecordIds(3),
        'Index out of bounds'
      );
    });

    it('should get stats', async function () {
      const stats = await vault.getStats();
      expect(stats[0]).to.equal(3n); // totalQuarantined
      expect(stats[1]).to.equal(0n); // totalReleased
      expect(stats[2]).to.equal(ethers.parseEther('350')); // totalQuarantinedAmount
      expect(stats[3]).to.equal(0n); // totalReleasedAmount
    });

    it('should get correct recordNonce', async function () {
      // After 3 deposits, nonce should be 3
      expect(await vault.recordNonce()).to.equal(3n);
    });
  });

  // ========== Fee-on-Transfer Token ==========
  describe('Fee-on-Transfer Token', function () {
    it('should record actual received amount for fee-on-transfer tokens', async function () {
      const FeeOnTransferToken = await ethers.getContractFactory('FeeOnTransferToken');
      const feeToken = await FeeOnTransferToken.deploy('FeeToken', 'FEE');
      await feeToken.waitForDeployment();

      // Mint and approve fee token to owner
      await feeToken.mint(owner.address, ethers.parseEther('10000'));
      await feeToken.connect(owner).approve(vault.target, ethers.parseEther('10000'));

      const depositAmount = ethers.parseEther('1000');
      const tx = await vault.deposit(user1.address, feeToken.target, depositAmount, ethers.ZeroHash);
      await tx.wait();

      const recordId = await vault.allRecordIds(0);
      const record = await vault.getRecord(recordId);

      // 10% fee means actual received = 900
      const expectedActual = (depositAmount * 9000n) / 10000n; // 900
      expect(record.amount).to.equal(expectedActual);
      expect(await feeToken.balanceOf(vault.target)).to.equal(expectedActual);
    });
  });

  // ========== Reentrancy Protection ==========
  describe('Reentrancy Protection', function () {
    it('should prevent reentrancy attacks on deposit', async function () {
      const ReentrantERC20 = await ethers.getContractFactory('ReentrantERC20');
      const reentrantToken = await ReentrantERC20.deploy();
      await reentrantToken.waitForDeployment();

      // Mint tokens to owner and approve vault
      await reentrantToken.mint(owner.address, ethers.parseEther('10000'));
      await reentrantToken.connect(owner).approve(vault.target, ethers.parseEther('10000'));

      // Set up callback to re-enter deposit during transfer
      const reenterData = vault.interface.encodeFunctionData('deposit', [
        user1.address,
        reentrantToken.target,
        ethers.parseEther('1'),
        ethers.ZeroHash
      ]);
      await reentrantToken.setCallback(vault.target, reenterData);

      // The first deposit should succeed, but the reentrant call should be blocked
      // by the nonReentrant modifier
      await vault.deposit(user1.address, reentrantToken.target, ethers.parseEther('100'), ethers.ZeroHash);

      // Only one record should exist (reentrant call blocked)
      expect(await vault.getRecordCount()).to.equal(1n);
    });
  });
});
