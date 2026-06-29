const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('PolicyEngine Version Control', function () {
  let policyEngine, riskRegistry, owner, issuer, user1;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    policyEngine = fixture.policyEngine;
    riskRegistry = fixture.riskRegistry;
    owner = fixture.owner;
    issuer = fixture.issuer;
    user1 = fixture.user1;
  });

  const makePolicy = (overrides = {}) => ({
    maxTxAmount: (overrides.maxTxAmount ?? 1000n) * 10n ** 18n,
    dailyLimit: (overrides.dailyLimit ?? 5000n) * 10n ** 18n,
    allowMediumRisk: overrides.allowMediumRisk ?? false,
    allowHighRisk: overrides.allowHighRisk ?? false,
    blockMixer: overrides.blockMixer ?? true,
    requireDestinationKYC: overrides.requireDestinationKYC ?? false,
    cooldownPeriod: overrides.cooldownPeriod ?? 0,
    blockedTokens: overrides.blockedTokens ?? [],
  });

  describe('Version Snapshot Creation', function () {
    it('should recognize pre-configured fixture version as v1', async function () {
      // fixture already set issuer policy in beforeEach
      expect(await policyEngine.getIssuerPolicyVersion(issuer.address)).to.equal(1);
    });

    it('should auto-increment version on updates', async function () {
      // fixture has v1 already; add v2 and v3
      const policy2 = makePolicy({ maxTxAmount: 2000n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy2);
      
      const policy3 = makePolicy({ maxTxAmount: 3000n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy3);
      
      expect(await policyEngine.getIssuerPolicyVersion(issuer.address)).to.equal(3);
    });

    it('should emit IssuerPolicyVersioned event on update', async function () {
      const policy = makePolicy({ maxTxAmount: 2000n });
      await expect(policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy))
        .to.emit(policyEngine, 'IssuerPolicyVersioned');
    });

    it('should record timestamp on policy update', async function () {
      const policy = makePolicy();
      const blockBefore = await ethers.provider.getBlock('latest');
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy);
      
      const updatedAt = await policyEngine.issuerPolicyUpdatedAt(issuer.address);
      expect(updatedAt).to.be.gt(0);
      expect(updatedAt).to.be.closeTo(blockBefore.timestamp, 5); // within 5 seconds
    });
  });

  describe('Policy History Storage', function () {
    it('should save policy snapshot in history', async function () {
      // fixture already created v1 for issuer; create v2 and check it
      const policy = makePolicy({ maxTxAmount: 1500n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy);
      
      const snapshot = await policyEngine.getIssuerPolicyAtVersion(issuer.address, 2);
      expect(snapshot.maxTxAmount).to.equal(policy.maxTxAmount);
      expect(snapshot.dailyLimit).to.equal(policy.dailyLimit);
      expect(snapshot.allowMediumRisk).to.equal(policy.allowMediumRisk);
      expect(snapshot.blockMixer).to.equal(policy.blockMixer);
    });

    it('should preserve multiple historical versions', async function () {
      // fixture: v1 exists (maxTxAmount=1000000); add v2 and v3
      const policy2 = makePolicy({ maxTxAmount: 2000n, allowMediumRisk: true });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy2);
      
      const policy3 = makePolicy({ maxTxAmount: 3000n, allowMediumRisk: false });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy3);
      
      const snap1 = await policyEngine.getIssuerPolicyAtVersion(issuer.address, 1);
      const snap2 = await policyEngine.getIssuerPolicyAtVersion(issuer.address, 2);
      const snap3 = await policyEngine.getIssuerPolicyAtVersion(issuer.address, 3);
      
      // v1 from fixture: maxTxAmount=1000000
      expect(snap1.maxTxAmount).to.equal(ethers.parseEther('1000'));
      expect(snap1.allowMediumRisk).to.be.false;
      // v2
      expect(snap2.maxTxAmount).to.equal(2000n * 10n ** 18n);
      expect(snap2.allowMediumRisk).to.be.true;
      // v3
      expect(snap3.maxTxAmount).to.equal(3000n * 10n ** 18n);
      expect(snap3.allowMediumRisk).to.be.false;
    });

    it('should return empty struct for non-existent version', async function () {
      const snapshot = await policyEngine.getIssuerPolicyAtVersion(issuer.address, 99);
      expect(snapshot.maxTxAmount).to.equal(0);
    });
  });

  describe('Policy Rollback', function () {
    it('should rollback to a previous version', async function () {
      // fixture: v1 (restrictive: allowMediumRisk=false); create v2 (permissive)
      const restrictive = await policyEngine.issuerPolicies(issuer.address);
      
      const permissive = makePolicy({ maxTxAmount: 2000n, allowMediumRisk: true });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, permissive);
      
      // Rollback to version 1 (fixture's restrictive policy)
      await policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 1);
      
      // Current policy should match version 1 (fixture)
      const current = await policyEngine.issuerPolicies(issuer.address);
      expect(current.maxTxAmount).to.equal(restrictive.maxTxAmount);
      expect(current.allowMediumRisk).to.equal(restrictive.allowMediumRisk);
    });

    it('should increment version after rollback', async function () {
      // fixture: v1; create v2; rollback to v1 → should become v3
      const policy2 = makePolicy({ maxTxAmount: 2000n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy2);
      
      await policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 1);
      
      // v1 (fixture) → v2 (update) → rollback creates v3
      expect(await policyEngine.getIssuerPolicyVersion(issuer.address)).to.equal(3);
    });

    it('should emit Rollback event', async function () {
      // fixture: v1; create v2; rollback v1 → event shows from 2 to 1
      const policy = makePolicy();
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy);
      
      await expect(policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 1))
        .to.emit(policyEngine, 'IssuerPolicyRolledBack')
        .withArgs(issuer.address, 2, 1);
    });

    it('should revert when rolling back to version 0', async function () {
      await expect(
        policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 0)
      ).to.be.revertedWithCustomError(policyEngine, 'RollbackToZeroVersion');
    });

    it('should revert when rolling back to current version', async function () {
      // fixture has v1 already; current version is 1
      await expect(
        policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 1)
      ).to.be.revertedWithCustomError(policyEngine, 'RollbackToCurrentVersion');
    });

    it('should revert when rolling back to non-existent version', async function () {
      await expect(
        policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 99)
      ).to.be.revertedWithCustomError(policyEngine, 'VersionNotFound');
    });

    it('should revert for non-admin caller', async function () {
      await expect(
        policyEngine.connect(user1).rollbackIssuerPolicy(issuer.address, 1)
      ).to.be.reverted;
    });
  });

  describe('History Summary', function () {
    it('should return correct summary', async function () {
      // fixture already set v1; summary should show v1
      const summary = await policyEngine.getIssuerPolicyHistorySummary(issuer.address);
      
      expect(summary.currentVersion).to.equal(1);
      expect(summary.maxTxAmount).to.equal(ethers.parseEther('1000'));
      expect(summary.dailyLimit).to.equal(ethers.parseEther('5000'));
      expect(summary.allowHighRisk).to.be.false;
    });

    it('should return zeros for unconfigured issuer', async function () {
      const summary = await policyEngine.getIssuerPolicyHistorySummary(user1.address);
      expect(summary.currentVersion).to.equal(0);
      expect(summary.maxTxAmount).to.equal(0);
    });
  });

  describe('Integration with Evaluation', function () {
    it('should use rolled-back policy in transfer evaluation', async function () {
      // fixture: v1 (restrictive: allowMediumRisk=false)
      // Set permissive v2: medium risk allowed
      const permissive = makePolicy({ allowMediumRisk: true });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, permissive);
      
      // Verify permissive policy works
      await riskRegistry.connect(owner).updateRiskProfile(user1.address, 50, 2, [], false); // MEDIUM
      let [decision] = await policyEngine.evaluateTransfer(user1.address, issuer.address, 100, issuer.address);
      expect(decision).to.equal(0); // ALLOW
      
      // Rollback to restrictive v1
      await policyEngine.connect(owner).rollbackIssuerPolicy(issuer.address, 1);
      
      // Should now hold medium risk
      [decision] = await policyEngine.evaluateTransfer(user1.address, issuer.address, 100, issuer.address);
      expect(decision).to.equal(3); // HOLD (medium risk not allowed)
    });
  });
});