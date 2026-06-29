const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('PolicyEngine', function () {
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

  describe('Deployment', function () {
    it('should set RiskRegistry reference correctly', async function () {
      expect(await policyEngine.riskRegistry()).to.equal(await riskRegistry.getAddress());
    });

    it('should have default issuer policy with non-zero limits', async function () {
      const defaultPolicy = await policyEngine.defaultIssuerPolicy();
      expect(defaultPolicy.maxTxAmount).to.be.gt(0);
      expect(defaultPolicy.dailyLimit).to.be.gt(0);
    });
  });

  describe('Transfer Evaluation', function () {
    it('should BLOCK sanctioned addresses', async function () {
      await riskRegistry.connect(owner).emergencySanction([user1.address], 'test');
      const [decision, reason] = await policyEngine.evaluateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.include('Sanctioned');
    });

    it('should BLOCK if amount exceeds maxTxAmount', async function () {
      const maxTx = (await policyEngine.defaultIssuerPolicy()).maxTxAmount;
      const [decision, reason] = await policyEngine.evaluateTransfer(user1.address, user2.address, maxTx + 1n, issuer.address);
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.include('max transaction');
    });

    it('should HOLD medium risk when allowMediumRisk is false', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(user1.address, 50, 2, [], false); // MEDIUM
      const [decision] = await policyEngine.evaluateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(3); // HOLD
    });

    it('should ALLOW low risk transfer within limits', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(user1.address, 20, 1, [], false); // LOW
      const [decision] = await policyEngine.evaluateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(0); // ALLOW
    });

    it('should BLOCK high risk address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(user1.address, 90, 3, [], false); // HIGH
      const [decision] = await policyEngine.evaluateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(1); // BLOCK
    });

    it('should BLOCK mixer transactions', async function () {
      const mixer = ethers.Wallet.createRandom().address;
      await policyEngine.connect(owner).addMixer(mixer);

      const [decision] = await policyEngine.evaluateTransfer(user1.address, mixer, 100, issuer.address);
      expect(decision).to.equal(1); // BLOCK
    });

    it('should use custom issuer policy when set', async function () {
      const customPolicy = {
        maxTxAmount: 500n * 10n ** 18n,
        dailyLimit: 1000n * 10n ** 18n,
        allowMediumRisk: true,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: [],
      };
      await policyEngine.connect(owner).setIssuerPolicy(issuer.address, customPolicy);

      // Medium risk should be ALLOWED with custom policy
      await riskRegistry.connect(owner).updateRiskProfile(user1.address, 50, 2, [], false);
      const [decision] = await policyEngine.evaluateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(0); // ALLOW
    });
  });

  describe('Operation Evaluation', function () {
    it('should BLOCK wallet operation for sanctioned owner', async function () {
      await riskRegistry.connect(owner).emergencySanction([user1.address], 'test');
      const op = {
        opType: 0, // TRANSFER
        target: user2.address,
        value: 100,
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1,
      };
      const [decision] = await policyEngine.evaluateOperation(user1.address, op, ethers.Wallet.createRandom().address);
      expect(decision).to.equal(1); // BLOCK
    });

    it('should BLOCK contract calls when blockContractCalls is true', async function () {
      const wallet = ethers.Wallet.createRandom().address;
      const policy = {
        maxTxValue: 100n * 10n ** 18n,
        maxTokenTxAmount: 1000000n * 10n ** 18n,
        dailyEthLimit: 500n * 10n ** 18n,
        dailyTokenLimit: 5000000n * 10n ** 18n,
        blockContractCalls: true,
        blockUnknownTokens: true,
        requireWhitelist: false,
        allowedDex: [],
        blockedContracts: [],
        whitelistedContracts: [],
      };
      await policyEngine.connect(owner).setWalletPolicy(wallet, policy);

      const op = {
        opType: 1, // CONTRACT_CALL
        target: user2.address,
        value: 0,
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1,
      };
      const [decision] = await policyEngine.evaluateOperation(user1.address, op, wallet);
      expect(decision).to.equal(1); // BLOCK
    });
  });

  describe('Policy Configuration', function () {
    it('should allow admin to set issuer policy', async function () {
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
      await expect(policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy))
        .to.emit(policyEngine, 'IssuerPolicySet');
    });

    it('should reject invalid policy (zero maxTxAmount)', async function () {
      const policy = {
        maxTxAmount: 0,
        dailyLimit: 1000n * 10n ** 18n,
        allowMediumRisk: false,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: [],
      };
      await expect(
        policyEngine.connect(owner).setIssuerPolicy(issuer.address, policy)
      ).to.be.revertedWithCustomError(policyEngine, 'InvalidPolicy');
    });

    it('should allow adding and removing mixers', async function () {
      const mixer = ethers.Wallet.createRandom().address;
      await policyEngine.connect(owner).addMixer(mixer);
      expect(await policyEngine.knownMixers(mixer)).to.be.true;

      await policyEngine.connect(owner).removeMixer(mixer);
      expect(await policyEngine.knownMixers(mixer)).to.be.false;
    });
  });

  describe('Recording Functions', function () {
    it('should record transfer (only callable by ComplianceEngine)', async function () {
      await policyEngine.connect(owner).recordTransfer(user1.address, user2.address, 500, issuer.address, true);
      const spent = await policyEngine.getDailySpent(user1.address, issuer.address);
      expect(spent).to.equal(500);
    });

    it('should reject recordTransfer from non-ComplianceEngine', async function () {
      await expect(
        policyEngine.connect(user1).recordTransfer(user1.address, user2.address, 500, issuer.address, true)
      ).to.be.revertedWithCustomError(policyEngine, 'UnauthorizedCaller');
    });
  });
});
