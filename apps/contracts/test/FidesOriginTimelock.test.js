const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('FidesOriginTimelock', function () {
  let timelock, owner, admin, proposer1, proposer2, proposer3, executor1, executor2, user;
  let minDelay, emergencyDelay;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    timelock = fixture.timelock;
    owner = fixture.owner;
    admin = fixture.admin;
    const signers = await ethers.getSigners();
    proposer1 = signers[10];
    proposer2 = signers[11];
    proposer3 = signers[12];
    executor1 = signers[13];
    executor2 = signers[14];
    user = signers[15];

    minDelay = 2 * 24 * 60 * 60;
    emergencyDelay = 4 * 60 * 60;
  });

  describe('Deployment', function () {
    it('should have correct constants', async function () {
      expect(await timelock.MIN_DELAY()).to.equal(minDelay);
      expect(await timelock.EMERGENCY_DELAY()).to.equal(emergencyDelay);
    });

    it('should start with emergency mode disabled', async function () {
      expect(await timelock.emergencyMode()).to.be.false;
    });
  });

  describe('Emergency Mode', function () {
    beforeEach(async function () {
      await timelock.addEmergencyOperator(owner.address);
    });

    it('should enable emergency mode', async function () {
      await expect(timelock.proposeEnableEmergencyMode())
        .to.emit(timelock, 'EmergencyModeEnabled')
        .withArgs(owner.address);

      await network.provider.send('evm_increaseTime', [minDelay + 1]);
      await network.provider.send('evm_mine');

      await expect(timelock.executeEmergencyModeChange())
        .to.emit(timelock, 'EmergencyModeChangeAffected');

      expect(await timelock.emergencyMode()).to.be.true;
    });

    it('should disable emergency mode', async function () {
      await timelock.proposeEnableEmergencyMode();
      await network.provider.send('evm_increaseTime', [minDelay + 1]);
      await network.provider.send('evm_mine');
      await timelock.executeEmergencyModeChange();
      expect(await timelock.emergencyMode()).to.be.true;

      await expect(timelock.proposeDisableEmergencyMode())
        .to.emit(timelock, 'EmergencyModeDisabled')
        .withArgs(owner.address);

      await network.provider.send('evm_increaseTime', [minDelay + 1]);
      await network.provider.send('evm_mine');

      await expect(timelock.executeEmergencyModeChange())
        .to.emit(timelock, 'EmergencyModeChangeAffected');

      expect(await timelock.emergencyMode()).to.be.false;
    });

    it('should reject enable when already enabled', async function () {
      await timelock.proposeEnableEmergencyMode();
      await network.provider.send('evm_increaseTime', [minDelay + 1]);
      await network.provider.send('evm_mine');
      await timelock.executeEmergencyModeChange();

      await expect(timelock.proposeEnableEmergencyMode())
        .to.be.revertedWithCustomError(timelock, 'EmergencyModeAlreadySet')
        .withArgs(true);
    });

    it('should reject disable when already disabled', async function () {
      await expect(timelock.proposeDisableEmergencyMode())
        .to.be.revertedWithCustomError(timelock, 'EmergencyModeAlreadySet')
        .withArgs(false);
    });

    it('should reject emergency mode from non-operator', async function () {
      await expect(timelock.connect(user).proposeEnableEmergencyMode())
        .to.be.revertedWithCustomError(timelock, 'NotEmergencyOperator')
        .withArgs(user.address);
    });

    it('should return correct effective delay', async function () {
      expect(await timelock.getEffectiveDelay()).to.equal(minDelay);

      await timelock.proposeEnableEmergencyMode();
      await network.provider.send('evm_increaseTime', [minDelay + 1]);
      await network.provider.send('evm_mine');
      await timelock.executeEmergencyModeChange();

      expect(await timelock.getEffectiveDelay()).to.equal(emergencyDelay);
    });
  });

  describe('Emergency Operator Management', function () {
    it('should add emergency operator', async function () {
      await expect(timelock.addEmergencyOperator(proposer1.address))
        .to.emit(timelock, 'EmergencyOperatorAdded')
        .withArgs(proposer1.address);

      expect(await timelock.isEmergencyOperator(proposer1.address)).to.be.true;
    });

    it('should remove emergency operator', async function () {
      await timelock.addEmergencyOperator(proposer1.address);

      await expect(timelock.removeEmergencyOperator(proposer1.address))
        .to.emit(timelock, 'EmergencyOperatorRemoved')
        .withArgs(proposer1.address);

      expect(await timelock.isEmergencyOperator(proposer1.address)).to.be.false;
    });

    it('should reject operator management without admin role', async function () {
      await expect(timelock.connect(user).addEmergencyOperator(proposer1.address))
        .to.be.revertedWithCustomError(timelock, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('Timelock Operations', function () {
    let target, value, data, predecessor, salt;

    beforeEach(async function () {
      target = owner.address;
      value = 0;
      data = '0x';
      predecessor = ethers.ZeroHash;
      salt = ethers.keccak256(ethers.toUtf8Bytes('test'));
    });

    it('should schedule an operation', async function () {
      const proposerRole = await timelock.PROPOSER_ROLE();
      await timelock.grantRole(proposerRole, owner.address);

      await timelock.schedule(target, value, data, predecessor, salt, minDelay);

      const operationId = await timelock.hashOperation(target, value, data, predecessor, salt);
      expect(await timelock.isOperationPending(operationId)).to.be.true;
    });

    it('should require minimum delay', async function () {
      const proposerRole = await timelock.PROPOSER_ROLE();
      await timelock.grantRole(proposerRole, owner.address);

      await expect(
        timelock.schedule(target, value, data, predecessor, salt, minDelay - 1)
      ).to.be.revertedWithCustomError(timelock, 'TimelockInsufficientDelay');
    });
  });

  describe('Access Control', function () {
    it('should have correct roles', async function () {
      const defaultAdminRole = await timelock.DEFAULT_ADMIN_ROLE();
      const proposerRole = await timelock.PROPOSER_ROLE();

      expect(await timelock.hasRole(defaultAdminRole, owner.address)).to.be.true;
    });

    it('should allow admin to grant roles', async function () {
      const proposerRole = await timelock.PROPOSER_ROLE();
      await timelock.grantRole(proposerRole, proposer1.address);
      expect(await timelock.hasRole(proposerRole, proposer1.address)).to.be.true;
    });
  });
});
