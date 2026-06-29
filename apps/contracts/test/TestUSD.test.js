const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

/**
 * @title TestUSD Test Suite
 * @notice Tests for TestUSD.sol - legacy demo contract with risk labels + limits
 */

describe('TestUSD', function () {
  let testUSD, owner, admin, user1, user2, user3;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    testUSD = fixture.testUSD;
    owner = fixture.owner;
    admin = fixture.admin;
    user1 = fixture.user1;
    user2 = fixture.user2;
    user3 = fixture.user3;

    // Fund users
    await testUSD.transfer(user1.address, ethers.parseEther('10000'));
    await testUSD.transfer(user2.address, ethers.parseEther('10000'));
  });

  describe('Deployment', function () {
    it('should have correct initial supply', async function () {
      const total = await testUSD.totalSupply();
      expect(total).to.equal(ethers.parseEther('100000000')); // 1亿代币
    });

    it('should assign all tokens to deployer', async function () {
      expect(await testUSD.balanceOf(owner.address)).to.equal(ethers.parseEther('100000000') - ethers.parseEther('20000'));
    });

    it('should have correct metadata', async function () {
      expect(await testUSD.name()).to.equal('TestUSD');
      expect(await testUSD.symbol()).to.equal('TUSD');
      expect(await testUSD.decimals()).to.equal(18);
    });
  });

  describe('Transfers', function () {
    it('should allow transfers between users', async function () {
      await expect(testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100')))
        .to.emit(testUSD, 'Transfer')
        .withArgs(user1.address, user2.address, ethers.parseEther('100'));

      expect(await testUSD.balanceOf(user2.address)).to.equal(ethers.parseEther('10100'));
    });

    it('should revert on insufficient balance', async function () {
      await expect(
        testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100000'))
      ).to.be.reverted;
    });
  });

  describe('Risk Labels & Limits', function () {
    it('should allow admin to tag address', async function () {
      // TestUSD has its own tagging system (label mapping)
      await expect(testUSD.connect(owner).tagAddress(user1.address, 1, 'VIP user'))
        .to.emit(testUSD, 'AddressTagged');
    });

    it('should enforce per-address limits', async function () {
      // Tag user1 as NORMAL (level 2) first
      await testUSD.connect(owner).tagAddress(user1.address, 2, 'Normal user');
      // Set NORMAL limits to 50 TUSD
      await testUSD.connect(owner).setRiskLimits(2, ethers.parseEther('50'), ethers.parseEther('50'));

      // First transfer 30 TUSD should succeed
      await expect(testUSD.connect(user1).transfer(user2.address, ethers.parseEther('30'))).to.not.be.reverted;

      // Second transfer 30 TUSD should fail (60 > 50 daily limit)
      await expect(
        testUSD.connect(user1).transfer(user2.address, ethers.parseEther('30'))
      ).to.be.reverted;
    });

    it('should track daily usage', async function () {
      await testUSD.connect(user1).transfer(user2.address, ethers.parseEther('10'));
      const info = await testUSD.getLimitInfo(user1.address);
      expect(info.usedToday).to.equal(ethers.parseEther('10'));
    });
  });

  describe('Faucet', function () {
    it('should allow low-balance users to use faucet', async function () {
      const before = await testUSD.balanceOf(user3.address);
      await testUSD.connect(user3).faucet();
      const after = await testUSD.balanceOf(user3.address);
      expect(after).to.be.gt(before);
    });

    it('should prevent high-balance users from using faucet', async function () {
      await expect(testUSD.connect(user1).faucet()).to.be.reverted;
    });
  });

  describe('Batch Transfer', function () {
    it('should execute batch transfers', async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseEther('10'), ethers.parseEther('20')];

      await testUSD.connect(user1).batchTransfer(recipients, amounts);

      // user2 initially had 10000, +10 = 10010
      expect(await testUSD.balanceOf(user2.address)).to.equal(ethers.parseEther('10010'));
      expect(await testUSD.balanceOf(user3.address)).to.equal(ethers.parseEther('20'));
    });

    it('should revert batch with mismatched lengths', async function () {
      await expect(
        testUSD.connect(user1).batchTransfer([user2.address], [ethers.parseEther('10'), ethers.parseEther('20')])
      ).to.be.reverted;
    });
  });

  describe('Minting', function () {
    it('should allow owner to mint', async function () {
      const before = await testUSD.totalSupply();
      await testUSD.mint(user1.address, ethers.parseEther('1000'));
      const after = await testUSD.totalSupply();
      expect(after).to.equal(before + ethers.parseEther('1000'));
    });
  });

  describe('Pause', function () {
    it('should allow owner to pause and unpause', async function () {
      await testUSD.pause();
      await expect(
        testUSD.connect(user1).transfer(user2.address, ethers.parseEther('1'))
      ).to.be.reverted;

      await testUSD.unpause();
      await expect(testUSD.connect(user1).transfer(user2.address, ethers.parseEther('1'))).to.not.be.reverted;
    });
  });
});
