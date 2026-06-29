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
      const profile = await riskRegistry.getRiskProfile(user1.address);
      expect(profile.riskScore).to.equal(0);
      expect(profile.riskTier).to.equal(0); // UNKNOWN
      expect(profile.isSanctioned).to.be.false;
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

      const profile = await riskRegistry.getRiskProfile(user1.address);
      expect(profile.riskScore).to.equal(75);
      expect(profile.riskTier).to.equal(2);
      expect(profile.isSanctioned).to.be.false;
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

      await riskRegistry.connect(oracle).batchUpdateRiskProfiles(accounts, scores, tiers, sanctioned);

      const p1 = await riskRegistry.getRiskProfile(user1.address);
      expect(p1.riskScore).to.equal(30);
      expect(p1.riskTier).to.equal(1);

      const p2 = await riskRegistry.getRiskProfile(user2.address);
      expect(p2.riskScore).to.equal(80);
      expect(p2.riskTier).to.equal(3);
      expect(p2.isSanctioned).to.be.true;
    });

    it('should reject batch with mismatched lengths', async function () {
      await expect(
        riskRegistry.connect(oracle).batchUpdateRiskProfiles([user1.address], [50, 60], [1], [false])
      ).to.be.revertedWithCustomError(riskRegistry, 'LengthMismatch');
    });

    it('should reject batch > 100 addresses', async function () {
      const addresses = Array(101).fill(user1.address);
      await expect(
        riskRegistry.connect(oracle).batchUpdateRiskProfiles(addresses, Array(101).fill(50), Array(101).fill(1), Array(101).fill(false))
      ).to.be.revertedWithCustomError(riskRegistry, 'BatchTooLarge');
    });
  });

  // ============ Sanctions ============
  describe('Sanctions', function () {
    it('should allow admin to emergency sanction addresses', async function () {
      const tx = await riskRegistry.connect(admin).emergencySanction([user1.address, user2.address], 'OFAC update');

      await expect(tx)
        .to.emit(riskRegistry, 'SanctionAdded')
        .withArgs(user1.address, 'OFAC update');

      expect(await riskRegistry.isSanctioned(user1.address)).to.be.true;
      expect(await riskRegistry.isSanctioned(user2.address)).to.be.true;

      const profile = await riskRegistry.getRiskProfile(user1.address);
      expect(profile.riskTier).to.equal(3); // HIGH
      expect(profile.isSanctioned).to.be.true;
    });

    it('should allow admin to remove sanction', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'test');
      await riskRegistry.connect(admin).removeSanction(user1.address);

      expect(await riskRegistry.isSanctioned(user1.address)).to.be.false;
      const profile = await riskRegistry.getRiskProfile(user1.address);
      expect(profile.isSanctioned).to.be.false;
    });

    it('should reject non-admin from adding sanctions', async function () {
      await expect(
        riskRegistry.connect(user1).emergencySanction([user2.address], 'test')
      ).to.be.reverted;
    });
  });

  // ============ Tags ============
  describe('Tags', function () {
    it('should allow operator to add tags', async function () {
      const tag = ethers.encodeBytes32String('exchange');
      await expect(riskRegistry.connect(operator).addTag(user1.address, tag))
        .to.emit(riskRegistry, 'AddressTagged')
        .withArgs(user1.address, tag);

      expect(await riskRegistry.hasTag(user1.address, tag)).to.be.true;
    });

    it('should allow operator to remove tags', async function () {
      const tag = ethers.encodeBytes32String('mixer');
      await riskRegistry.connect(operator).addTag(user1.address, tag);
      await expect(riskRegistry.connect(operator).removeTag(user1.address, tag))
        .to.emit(riskRegistry, 'AddressUntagged')
        .withArgs(user1.address, tag);

      expect(await riskRegistry.hasTag(user1.address, tag)).to.be.false;
    });

    it('should return all tags for an address', async function () {
      const tag1 = ethers.encodeBytes32String('exchange');
      const tag2 = ethers.encodeBytes32String('whale');
      await riskRegistry.connect(operator).addTag(user1.address, tag1);
      await riskRegistry.connect(operator).addTag(user1.address, tag2);

      const tags = await riskRegistry.getTags(user1.address);
      expect(tags.length).to.equal(2);
    });
  });

  // ============ Contract Registry ============
  describe('Contract Registry', function () {
    it('should register contract info', async function () {
      const contractAddr = ethers.Wallet.createRandom().address;
      await expect(
        riskRegistry.connect(operator).registerContract(contractAddr, ethers.encodeBytes32String('dex'), true, 20)
      )
        .to.emit(riskRegistry, 'ContractRegistered')
        .withArgs(contractAddr, ethers.encodeBytes32String('dex'), true);

      const info = await riskRegistry.getContractRisk(contractAddr);
      expect(info.verified).to.be.true;
      expect(info.riskScore).to.equal(20);
      expect(info.contractType).to.equal(ethers.encodeBytes32String('dex'));
    });
  });

  // ============ View Functions ============
  describe('View Functions', function () {
    it('should return correct risk tier', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);
      expect(await riskRegistry.getRiskTier(user1.address)).to.equal(2);
    });

    it('should return HIGH tier for sanctioned address regardless of profile', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 10, 1, [], false);
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'test');
      expect(await riskRegistry.getRiskTier(user1.address)).to.equal(3); // HIGH
    });

    it('should return correct risk score', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 42, 1, [], false);
      expect(await riskRegistry.getRiskScore(user1.address)).to.equal(42);
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
