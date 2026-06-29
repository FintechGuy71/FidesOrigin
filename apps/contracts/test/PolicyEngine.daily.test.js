const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('PolicyEngine Daily Limits', function () {
  let policyEngine, riskRegistry, complianceEngine, owner, admin, user1, user2, issuer;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    policyEngine = fixture.policyEngine;
    riskRegistry = fixture.riskRegistry;
    complianceEngine = fixture.complianceEngine;
    owner = fixture.owner;
    admin = fixture.admin;
    user1 = fixture.user1;
    user2 = fixture.user2;
    issuer = fixture.issuer;
  });

  const makePolicy = (overrides = {}) => ({
    maxTxAmount: (overrides.maxTxAmount ?? 1000n) * 10n ** 18n,
    dailyLimit: (overrides.dailyLimit ?? 5000n) * 10n ** 18n,
    allowMediumRisk: overrides.allowMediumRisk ?? false,
    allowHighRisk: overrides.allowHighRisk ?? false,
    blockMixer: overrides.blockMixer ?? true,
    requireDestinationKYC: overrides.requireDestinationKYC ?? false,
    cooldownPeriod: overrides.cooldownPeriod ?? 0,
    blockedTokens: [],
  });

  describe('Daily Limit Reset', function () {
    it('should reset daily limit after 1 day', async function () {
      const policy = makePolicy({ maxTxAmount: 1000n, dailyLimit: 1500n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy);

      // First transaction: 1000
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 1000n * 10n ** 18n, issuer.address, true);
      let spent = await policyEngine.getDailySpent(user1.address, issuer.address);
      expect(spent).to.equal(1000n * 10n ** 18n);

      // Second transaction: 600 would exceed daily limit (1500)
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 600n * 10n ** 18n, issuer.address, true);
      spent = await policyEngine.getDailySpent(user1.address, issuer.address);
      expect(spent).to.equal(1600n * 10n ** 18n); // exceeded but still recorded

      // Advance time by 1 day
      await ethers.provider.send('evm_increaseTime', [86400]);
      await ethers.provider.send('evm_mine');

      // After reset, spent should be 0 for new day
      spent = await policyEngine.getDailySpent(user1.address, issuer.address);
      expect(spent).to.equal(0);

      // Can transfer again
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 1000n * 10n ** 18n, issuer.address, true);
      spent = await policyEngine.getDailySpent(user1.address, issuer.address);
      expect(spent).to.equal(1000n * 10n ** 18n);
    });
  });

  describe('Daily Limit Exceeded', function () {
    it('should block when daily limit exceeded via evaluateTransfer', async function () {
      const policy = makePolicy({ maxTxAmount: 1000n, dailyLimit: 1500n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy);

      // Record 1500 spent
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 1500n * 10n ** 18n, issuer.address, true);

      // Evaluate transfer of 1 should exceed daily limit
      const [decision, reason] = await policyEngine.evaluateTransfer(user1.address, user2.address, 1n * 10n ** 18n, issuer.address);
      expect(decision).to.equal(3); // HOLD (Decision.HOLD = 3)
      expect(reason).to.include('Daily limit');
    });

    it('should track daily spent across multiple transactions', async function () {
      const policy = makePolicy({ maxTxAmount: 1000n, dailyLimit: 5000n });
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy);

      // Multiple transactions
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 1000n * 10n ** 18n, issuer.address, true);
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 2000n * 10n ** 18n, issuer.address, true);
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 500n * 10n ** 18n, issuer.address, true);

      const spent = await policyEngine.getDailySpent(user1.address, issuer.address);
      expect(spent).to.equal(3500n * 10n ** 18n);
    });
  });
});
