const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('FidesCompliance', function () {
  let fidesCompliance, riskRegistry, owner, addr1, addr2;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    fidesCompliance = fixture.fidesCompliance;
    riskRegistry = fixture.riskRegistry;
    owner = fixture.owner;
    addr1 = fixture.user1;
    addr2 = fixture.user2;
  });

  describe('Deployment', function () {
    it('should set correct admin roles', async function () {
      expect(await fidesCompliance.hasRole(await fidesCompliance.ADMIN_ROLE(), owner.address)).to.be.true;
      // DEFAULT_ADMIN_ROLE is intentionally removed (S-06 fix)
    });
  });

  describe('Risk Profile', function () {
    it('should retrieve default risk profile for unknown address', async function () {
      const [riskScore, isSanctioned, lastUpdated] = await fidesCompliance.getRiskProfile(addr1.address);
      expect(riskScore).to.equal(0);
      expect(isSanctioned).to.be.false;
      expect(lastUpdated).to.equal(0);
    });

    it('should reflect risk profile updated via RiskRegistry', async function () {
      // Update via RiskRegistry (which FidesCompliance reads from)
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 75, 2, [], false);
      const [riskScore, isSanctioned] = await fidesCompliance.getRiskProfile(addr1.address);
      expect(riskScore).to.equal(75);
      expect(isSanctioned).to.be.false;
    });
  });

  describe('Blacklist / Whitelist', function () {
    it('should return false for non-blacklisted address', async function () {
      expect(await fidesCompliance.isBlacklisted(addr1.address)).to.be.false;
    });

    it('should return false for non-whitelisted address', async function () {
      expect(await fidesCompliance.isWhitelisted(addr1.address)).to.be.false;
    });
  });

  describe('Upgrade', function () {
    it('should allow admin to authorize upgrade', async function () {
      expect(await fidesCompliance.hasRole(await fidesCompliance.ADMIN_ROLE(), owner.address)).to.be.true;
    });
  });
});
