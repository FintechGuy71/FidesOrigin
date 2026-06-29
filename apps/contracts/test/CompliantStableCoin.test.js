const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('CompliantStableCoin', function () {
  let stableCoin, complianceEngine, riskRegistry, owner, admin, user1, user2, oracle;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    stableCoin = fixture.stableCoin;
    complianceEngine = fixture.complianceEngine;
    riskRegistry = fixture.riskRegistry;
    owner = fixture.owner;
    admin = fixture.admin;
    user1 = fixture.user1;
    user2 = fixture.user2;
    oracle = fixture.oracle;

    // Mint some tokens to user1 for testing
    await stableCoin.connect(owner).mint(user1.address, 1000000 * 10 ** 6);
  });

  describe('Deployment', function () {
    it('should set compliance engine correctly', async function () {
      expect(await stableCoin.complianceEngine()).to.equal(await complianceEngine.getAddress());
    });

    it('should have correct token metadata', async function () {
      expect(await stableCoin.name()).to.equal('CompliantUSD');
      expect(await stableCoin.symbol()).to.equal('cUSD');
      expect(await stableCoin.decimals()).to.equal(6);
    });

    it('should have default policy with limits', async function () {
      const policy = await stableCoin.policy();
      expect(policy.maxTxAmount).to.be.gt(0);
      expect(policy.blockMixer).to.be.true;
    });
  });

  describe('Transfers with Compliance', function () {
    it('should ALLOW transfer between clean addresses', async function () {
      await expect(stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)).to.not.be.reverted;
      expect(await stableCoin.balanceOf(user2.address)).to.equal(1000 * 10 ** 6);
    });

    it('should BLOCK transfer from sanctioned address', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');
    });

    it('should BLOCK transfer to sanctioned address', async function () {
      await riskRegistry.connect(admin).emergencySanction([user2.address], 'OFAC');
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');
    });

    it('should emit TransferBlocked when compliance fails', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      await expect(stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6))
        .to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');
    });

    it('should BLOCK transfer exceeding maxTxAmount', async function () {
      const maxTx = (await stableCoin.policy()).maxTxAmount;
      await expect(
        stableCoin.connect(user1).transfer(user2.address, maxTx + 1n)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');
    });

    it('should simulate transfer correctly', async function () {
      const [wouldSucceed, decision] = await stableCoin.simulateTransfer(user1.address, user2.address, 1000 * 10 ** 6);
      expect(wouldSucceed).to.be.true;
      expect(decision).to.equal(0); // ALLOW
    });
  });

  describe('Minting with Compliance', function () {
    it('should allow minting to clean address', async function () {
      await expect(stableCoin.connect(owner).mint(user2.address, 1000000 * 10 ** 6))
        .to.emit(stableCoin, 'Transfer')
        .withArgs(ethers.ZeroAddress, user2.address, 1000000 * 10 ** 6);
    });

    it('should BLOCK minting to sanctioned address', async function () {
      await riskRegistry.connect(admin).emergencySanction([user2.address], 'OFAC');
      await expect(
        stableCoin.connect(owner).mint(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'ComplianceCheckFailed');
    });
  });

  describe('Batch Transfer', function () {
    it('should execute batch transfer for clean addresses', async function () {
      const recipients = [user2.address, oracle.address];
      const amounts = [1000 * 10 ** 6, 2000 * 10 ** 6];
      await expect(stableCoin.connect(user1).batchTransfer(recipients, amounts)).to.not.be.reverted;
      expect(await stableCoin.balanceOf(user2.address)).to.equal(1000 * 10 ** 6);
    });

    it('should revert if one recipient is sanctioned', async function () {
      await riskRegistry.connect(admin).emergencySanction([user2.address], 'OFAC');
      const recipients = [user2.address, oracle.address];
      const amounts = [1000 * 10 ** 6, 2000 * 10 ** 6];
      await expect(
        stableCoin.connect(user1).batchTransfer(recipients, amounts)
      ).to.be.reverted;
    });
  });

  describe('KYC Integration', function () {
    it('should require KYC when enabled', async function () {
      await stableCoin.connect(owner).setPolicy({
        maxTxAmount: 1000000n * 10n ** 6n,
        dailyLimit: 5000000n * 10n ** 6n,
        allowMediumRisk: false,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: true,
        cooldownPeriod: 0,
        blockedTokens: [],
      });

      // user2 not KYC verified
      await expect(
        stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)
      ).to.be.revertedWithCustomError(stableCoin, 'NotKYCVerified');
    });

    it('should allow transfer after KYC verification', async function () {
      await stableCoin.connect(owner).setPolicy({
        maxTxAmount: 1000000n * 10n ** 6n,
        dailyLimit: 5000000n * 10n ** 6n,
        allowMediumRisk: false,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: true,
        cooldownPeriod: 0,
        blockedTokens: [],
      });

      await stableCoin.connect(owner).setKYCStatus(user2.address, true);
      await expect(stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)).to.not.be.reverted;
    });
  });

  describe('Admin Functions', function () {
    it('should allow admin to toggle compliance', async function () {
      await stableCoin.connect(owner).toggleCompliance(false);
      expect(await stableCoin.complianceEnabled()).to.be.false;

      // Transfer should work even for sanctioned when disabled
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      await expect(stableCoin.connect(user1).transfer(user2.address, 1000 * 10 ** 6)).to.not.be.reverted;
    });

    it('should allow batch KYC updates', async function () {
      await stableCoin.connect(owner).batchSetKYC([user1.address, user2.address], true);
      expect(await stableCoin.kycVerified(user1.address)).to.be.true;
      expect(await stableCoin.kycVerified(user2.address)).to.be.true;
    });
  });
});