const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('ComplianceEngine', function () {
  let complianceEngine, riskRegistry, policyEngine, owner, admin, oracle, operator, user1, user2, issuer;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    complianceEngine = fixture.complianceEngine;
    riskRegistry = fixture.riskRegistry;
    policyEngine = fixture.policyEngine;
    owner = fixture.owner;
    admin = fixture.admin;
    oracle = fixture.oracle;
    operator = fixture.operator;
    user1 = fixture.user1;
    user2 = fixture.user2;
    issuer = fixture.issuer;
  });

  describe('Deployment', function () {
    it('should set component addresses correctly', async function () {
      expect(await complianceEngine.riskRegistry()).to.equal(await riskRegistry.getAddress());
      expect(await complianceEngine.policyEngine()).to.equal(await policyEngine.getAddress());
    });

    it('should have ADMIN_ROLE assigned to deployer', async function () {
      const ADMIN_ROLE = await complianceEngine.ADMIN_ROLE();
      expect(await complianceEngine.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe('Core Compliance Checks', function () {
    it('should check address compliance for clean addresses', async function () {
      const [isCompliant, riskScore, reason] = await complianceEngine.checkAddressCompliance.staticCall(user1.address);
      // Default: no profile exists → fail-closed
      expect(isCompliant).to.be.false;
      expect(reason).to.include('fail closed');
    });

    it('should check address compliance for sanctioned address', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], true);
      const [isCompliant, , reason] = await complianceEngine.checkAddressCompliance.staticCall(user1.address);
      expect(isCompliant).to.be.false;
      expect(reason).to.include('Sanctioned');
    });

    it('should check transfer and return ALLOW for clean addresses', async function () {
      // Set a profile so user1 is not fail-closed
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 20, 1, [], false);
      await riskRegistry.connect(oracle).updateRiskProfile(user2.address, 20, 1, [], false);
      const [decision, reason] = await complianceEngine.connect(user1).checkTransfer.staticCall(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(0); // ALLOW
      expect(reason).to.equal('Transfer allowed');
    });

    it('should BLOCK transfer for sanctioned address', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], true);
      const [decision, reason] = await complianceEngine.connect(user1).checkTransfer.staticCall(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.include('Sanctioned');
    });
  });

  describe('Quarantine', function () {
    it('should quarantine a transaction', async function () {
      const tx = await complianceEngine.connect(operator).quarantineTransaction(user1.address, user2.address, 100, issuer.address, 'Test quarantine');
      await expect(tx).to.emit(complianceEngine, 'TransactionQuarantined');
      expect(await complianceEngine.getQuarantineListLength()).to.equal(1);
    });

    it('should release quarantine', async function () {
      await complianceEngine.connect(operator).quarantineTransaction(user1.address, user2.address, 100, issuer.address, 'Test');
      const quarantineId = (await complianceEngine.getQuarantineListLength() > 0) ? await complianceEngine.quarantineList(0) : ethers.ZeroHash;
      if (quarantineId !== ethers.ZeroHash) {
        await complianceEngine.connect(operator).releaseQuarantine(quarantineId);
        const record = await complianceEngine.getQuarantineRecord(quarantineId);
        expect(record.released).to.be.true;
      }
    });
  });

  describe('Batch Checks', function () {
    it('should batch check addresses', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 20, 1, [], false);
      const [results, scores] = await complianceEngine.batchCheckAddressCompliance.staticCall([user1.address, user2.address]);
      expect(results.length).to.equal(2);
      expect(scores.length).to.equal(2);
      expect(results[0]).to.be.true;
    });
  });

  describe('Issuer Policy', function () {
    it('should set issuer policy', async function () {
      const policy = {
        maxTxAmount: 1000n * 10n ** 18n,
        dailyLimit: 5000n * 10n ** 18n,
        allowMediumRisk: false,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: [],
      };
      await expect(complianceEngine.connect(owner).setIssuerPolicy(issuer.address, policy)).to.not.be.reverted;
    });
  });

  describe('Pausable', function () {
    it('should allow admin to pause and unpause', async function () {
      await complianceEngine.connect(owner).pause();
      expect(await complianceEngine.paused()).to.be.true;

      await complianceEngine.connect(owner).unpause();
      expect(await complianceEngine.paused()).to.be.false;
    });
  });
});
