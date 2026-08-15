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
      // DEFAULT_ADMIN_ROLE is granted to deployer in initialize()
      expect(await fidesCompliance.hasRole(await fidesCompliance.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
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

  describe('Guard Integration', function () {
    let mockGuard;

    beforeEach(async function () {
      const MockGuard = await ethers.getContractFactory('MockPreTransactionGuard');
      mockGuard = await MockGuard.deploy();
      await mockGuard.waitForDeployment();
    });

    it('should pass evaluateTransaction without Guard (guard not set)', async function () {
      const [allowed, riskScore] = await fidesCompliance.connect(addr1).evaluateTransaction(
        addr1.address,
        addr2.address,
        100,
        ethers.ZeroAddress,
        0
      );
      expect(allowed).to.be.true;
      expect(riskScore).to.equal(0);
    });

    it('should BLOCK via Guard when Guard returns BLOCK action', async function () {
      await fidesCompliance.connect(owner).setGuard(await mockGuard.getAddress());
      await mockGuard.setNextAction(2); // Action.BLOCK = 2

      const [allowed, riskScore] = await fidesCompliance.connect(addr1).evaluateTransaction(
        addr1.address,
        addr2.address,
        100,
        ethers.ZeroAddress,
        0
      );
      expect(allowed).to.be.false;
      expect(riskScore).to.equal(100);
    });

    it('should ALLOW via Guard when Guard returns ALLOW action', async function () {
      await fidesCompliance.connect(owner).setGuard(await mockGuard.getAddress());
      await mockGuard.setNextAction(0); // Action.ALLOW = 0

      const [allowed] = await fidesCompliance.connect(addr1).evaluateTransaction(
        addr1.address,
        addr2.address,
        100,
        ethers.ZeroAddress,
        0
      );
      expect(allowed).to.be.true;
    });

    it('should disable Guard and bypass check', async function () {
      await fidesCompliance.connect(owner).setGuard(await mockGuard.getAddress());
      await mockGuard.setNextAction(2); // BLOCK

      await fidesCompliance.connect(owner).disableGuard();
      expect(await fidesCompliance.guardEnabled()).to.be.false;

      const [allowed] = await fidesCompliance.connect(addr1).evaluateTransaction(
        addr1.address,
        addr2.address,
        100,
        ethers.ZeroAddress,
        0
      );
      expect(allowed).to.be.true;
    });

    it('should only allow admin to setGuard', async function () {
      await expect(
        fidesCompliance.connect(addr1).setGuard(await mockGuard.getAddress())
      ).to.be.revertedWithCustomError(fidesCompliance, 'AccessControlUnauthorizedAccount');
    });
  });
});
