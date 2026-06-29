const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('FidesCompliance', function () {
  let fidesCompliance, owner, addr1, addr2;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    fidesCompliance = fixture.fidesCompliance;
    owner = fixture.owner;
    addr1 = fixture.user1;
    addr2 = fixture.user2;
  });

  describe('Deployment', function () {
    it('should set correct admin roles', async function () {
      expect(await fidesCompliance.hasRole(await fidesCompliance.ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await fidesCompliance.hasRole(await fidesCompliance.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });
  });

  describe('Risk Profile', function () {
    it('should allow operator to update risk profile', async function () {
      const level = 1; // RiskLevel.NORMAL
      const score = 5000;
      const tags = [];
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('test'));

      await expect(
        fidesCompliance.connect(owner).updateRiskProfile(addr1.address, level, score, tags, reasonHash)
      ).to.emit(fidesCompliance, 'RiskProfileUpdated');
    });

    it('should retrieve correct risk profile', async function () {
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('test'));
      await fidesCompliance.connect(owner).updateRiskProfile(addr1.address, 2, 7500, [], reasonHash);
      const profile = await fidesCompliance.getRiskProfile(addr1.address);
      expect(profile.score).to.equal(7500);
      expect(profile.level).to.equal(2);
    });
  });

  describe('Upgrade', function () {
    it('should allow admin to authorize upgrade', async function () {
      expect(await fidesCompliance.hasRole(await fidesCompliance.ADMIN_ROLE(), owner.address)).to.be.true;
    });
  });
});
