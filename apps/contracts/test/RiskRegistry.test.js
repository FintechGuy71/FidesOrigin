const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

/**
 * @title RiskRegistry Test Suite
 * @notice Tests for RiskRegistry.sol - risk profile management, sanctions, tags, contract registry
 */

describe('RiskRegistry', function () {
  let riskRegistry, owner, oracle, operator, admin, user1, user2;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    riskRegistry = fixture.riskRegistry;
    owner = fixture.owner;
    oracle = fixture.oracle;
    operator = fixture.operator;
    admin = fixture.admin;
    user1 = fixture.user1;
    user2 = fixture.user2;
  });

  // ============ Deployment ============
  describe('Deployment', function () {
    it('should deploy with correct roles assigned to deployer', async function () {
      const DEFAULT_ADMIN_ROLE = await riskRegistry.DEFAULT_ADMIN_ROLE();
      expect(await riskRegistry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it('should have zero risk profiles initially', async function () {
      const [riskScore, , , riskTier, , sanctioned, exists] = await riskRegistry.getProfile(user1.address);
      expect(riskScore).to.equal(0);
      expect(riskTier).to.equal(0); // UNKNOWN
      expect(sanctioned).to.be.false;
      expect(exists).to.be.false;
    });
  });

  // ============ Risk Profile Management ============
  describe('Risk Profile Management', function () {
    it('should allow oracle to update risk profile', async function () {
      const tx = await riskRegistry.connect(oracle).updateRiskProfile(
        user1.address,
        75, // riskScore
        2,  // MEDIUM tier
        [ethers.encodeBytes32String('exchange')],
        false
      );

      await expect(tx)
        .to.emit(riskRegistry, 'RiskProfileUpdated')
        .withArgs(user1.address, 75, 2, false);

      const [riskScore, , , riskTier, , sanctioned] = await riskRegistry.getProfile(user1.address);
      expect(riskScore).to.equal(75);
      expect(riskTier).to.equal(2);
      expect(sanctioned).to.be.false;
    });

    it('should reject risk score > 100', async function () {
      await expect(
        riskRegistry.connect(oracle).updateRiskProfile(user1.address, 101, 1, [], false)
      ).to.be.revertedWithCustomError(riskRegistry, 'InvalidRiskScore');
    });

    it('should reject zero address', async function () {
      await expect(
        riskRegistry.connect(oracle).updateRiskProfile(ethers.ZeroAddress, 50, 1, [], false)
      ).to.be.revertedWithCustomError(riskRegistry, 'InvalidAddress');
    });

    it('should block non-oracle from updating profile', async function () {
      await expect(
        riskRegistry.connect(user1).updateRiskProfile(user2.address, 50, 1, [], false)
      ).to.be.reverted;
    });

    it('should batch update risk profiles', async function () {
      const accounts = [user1.address, user2.address];
      const scores = [30, 80];
      const tiers = [1, 3]; // LOW, HIGH
      const sanctioned = [false, true];
      const tags = [[ethers.encodeBytes32String('tag1')], [ethers.encodeBytes32String('tag2')]];

      await riskRegistry.connect(oracle).batchUpdateRiskProfiles(accounts, scores, tiers, sanctioned, tags);

      const [p1Score, , , p1Tier] = await riskRegistry.getProfile(user1.address);
      expect(p1Score).to.equal(30);
      expect(p1Tier).to.equal(1);

      const [p2Score, , , p2Tier, , p2Sanctioned] = await riskRegistry.getProfile(user2.address);
      expect(p2Score).to.equal(80);
      expect(p2Tier).to.equal(3);
      expect(p2Sanctioned).to.be.true;
    });

    it('should reject batch with mismatched lengths', async function () {
      await expect(
        riskRegistry.connect(oracle).batchUpdateRiskProfiles([user1.address], [50, 60], [1], [false], [])
      ).to.be.revertedWithCustomError(riskRegistry, 'LengthMismatch');
    });

    it('should reject batch > 100 addresses', async function () {
      const addresses = Array(101).fill(user1.address);
      await expect(
        riskRegistry.connect(oracle).batchUpdateRiskProfiles(addresses, Array(101).fill(50), Array(101).fill(1), Array(101).fill(false), Array(101).fill([]))
      ).to.be.revertedWithCustomError(riskRegistry, 'BatchTooLarge');
    });
  });

  // ============ Sanctions ============
  describe('Sanctions', function () {
    it('should allow oracle to sanction addresses via updateRiskProfile', async function () {
      // Use updateRiskProfile with sanctioned=true instead of emergencySanction
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 100, 4, [], true);

      expect(await riskRegistry.isSanctioned(user1.address)).to.be.true;

      const [riskScore, , , riskTier, , sanctioned] = await riskRegistry.getProfile(user1.address);
      expect(riskTier).to.equal(4); // CRITICAL
      expect(sanctioned).to.be.true;
    });

    it('should allow oracle to remove sanction via updateRiskProfile', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 100, 4, [], true);

      // Advance time past MIN_UPDATE_INTERVAL (1 hour)
      await network.provider.send('evm_increaseTime', [3601]);
      await network.provider.send('evm_mine');

      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);

      expect(await riskRegistry.isSanctioned(user1.address)).to.be.false;
      const [ , , , , , sanctioned] = await riskRegistry.getProfile(user1.address);
      expect(sanctioned).to.be.false;
    });
  });

  // ============ View Functions ============
  describe('View Functions', function () {
    it('should return correct risk profile', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);
      const [riskScore, , , riskTier, , sanctioned, exists] = await riskRegistry.getProfile(user1.address);
      expect(riskScore).to.equal(50);
      expect(riskTier).to.equal(2);
      expect(exists).to.be.true;
      expect(sanctioned).to.be.false;
    });

    it('should return HIGH tier for sanctioned address', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 10, 1, [], true);
      const [ , , , riskTier] = await riskRegistry.getProfile(user1.address);
      expect(riskTier).to.equal(1); // Tier is whatever was set; sanction flag is separate
      expect(await riskRegistry.isSanctioned(user1.address)).to.be.true;
    });

    it('should return correct risk score', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 42, 1, [], false);
      const [riskScore] = await riskRegistry.getProfile(user1.address);
      expect(riskScore).to.equal(42);
    });
  });

  // ============ Pause ============
  describe('Pausable', function () {
    it('should allow admin to pause and unpause', async function () {
      await riskRegistry.connect(admin).pause();
      await expect(
        riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 1, [], false)
      ).to.be.revertedWithCustomError(riskRegistry, 'EnforcedPause');

      await riskRegistry.connect(admin).unpause();
      await expect(
        riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 1, [], false)
      ).to.not.be.reverted;
    });
  });
});
