const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('ComplianceEngine', function () {
  let complianceEngine, riskRegistry, policyEngine, riskOracle, owner, admin, oracle, operator, user1, user2, issuer, smartWallet, stableCoin;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    complianceEngine = fixture.complianceEngine;
    riskRegistry = fixture.riskRegistry;
    policyEngine = fixture.policyEngine;
    riskOracle = fixture.riskOracle;
    owner = fixture.owner;
    admin = fixture.admin;
    oracle = fixture.oracle;
    operator = fixture.operator;
    user1 = fixture.user1;
    user2 = fixture.user2;
    smartWallet = fixture.smartWallet;
    issuer = fixture.issuer;
    stableCoin = fixture.stableCoin;
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

  describe('Asset Compliance (IAssetCompliance)', function () {
    it('should validate transfer and return ALLOW for clean addresses', async function () {
      const [decision, reason] = await complianceEngine.validateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(0); // ALLOW
      expect(reason).to.equal('Transfer approved');
    });

    it('should BLOCK transfer for sanctioned address', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      const [decision, reason] = await complianceEngine.validateTransfer(user1.address, user2.address, 100, issuer.address);
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.include('Sanctioned');
    });

    it('should preTransferHook revert for BLOCK decision', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      await expect(
        complianceEngine.preTransferHook(user1.address, user2.address, 100)
      ).to.be.reverted;
    });

    it('should preTransferHook pass for ALLOW decision', async function () {
      await expect(complianceEngine.preTransferHook(user1.address, user2.address, 100)).to.not.be.reverted;
    });

    it('should record transfer in postTransferHook', async function () {
      await complianceEngine.connect(owner).postTransferHook(user1.address, user2.address, 500, true);
      const spent = await policyEngine.getDailySpent(user1.address, owner.address);
      expect(spent).to.equal(500);
    });

    it('should return correct risk tier via getRiskTier', async function () {
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);
      expect(await complianceEngine.getRiskTier(user1.address)).to.equal(2); // MEDIUM
    });

    it('should return isSanctioned correctly', async function () {
      expect(await complianceEngine.isSanctioned(user1.address)).to.be.false;
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'test');
      expect(await complianceEngine.isSanctioned(user1.address)).to.be.true;
    });

    it('should return IssuerPolicy via getIssuerPolicy', async function () {
      const policy = await complianceEngine.getIssuerPolicy(issuer.address);
      expect(policy.maxTxAmount).to.be.gt(0);
    });
  });

  describe('Wallet Compliance (IWalletCompliance)', function () {
    it('should validate wallet operation', async function () {
      const op = {
        opType: 0, // TRANSFER
        target: user2.address,
        value: 1,
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1,
      };
      const [decision] = await complianceEngine.validateOperation(user1.address, op, await smartWallet.getAddress());
      expect(decision).to.equal(0); // ALLOW
    });

    it('should preExecutionHook revert for blocked operation', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'test');
      const op = {
        opType: 0,
        target: user2.address,
        value: 1,
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1,
      };
      await expect(complianceEngine.preExecutionHook(user1.address, op)).to.be.reverted;
    });

    it('should validate batch operations', async function () {
      const ops = [
        { opType: 0, target: user2.address, value: 1, data: '0x', token: ethers.ZeroAddress, tokenAmount: 0, chainId: 1 },
        { opType: 0, target: user2.address, value: 2, data: '0x', token: ethers.ZeroAddress, tokenAmount: 0, chainId: 1 },
      ];
      const decisions = await complianceEngine.validateBatch(user1.address, ops);
      expect(decisions.length).to.equal(2);
      expect(decisions[0]).to.equal(0); // ALLOW
      expect(decisions[1]).to.equal(0); // ALLOW
    });

    it('should analyze operation risk', async function () {
      const op = {
        opType: 6, // BRIDGE
        target: user2.address,
        value: ethers.parseEther('200'), // Large amount
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1,
      };
      const [score, tier, factors] = await complianceEngine.analyzeOperationRisk(op);
      expect(score).to.be.gt(0);
      expect(factors).to.include('Cross-chain');
    });
  });

  describe('Hold / Freeze Funds', function () {
    it('should create hold record via postTransferHook for HOLD decision', async function () {
      // Set user1 as MEDIUM risk → default policy returns HOLD (allowMediumRisk=false)
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);
      
      // Mint tokens to user1 and transfer via stableCoin to trigger postTransferHook
      // Use amount within stableCoin's maxTxAmount (1000000 * 10^6)
      const mintAmount = 1000000n * 10n ** 6n;
      await stableCoin.connect(owner).mint(user1.address, mintAmount);
      await stableCoin.connect(user1).transfer(user2.address, mintAmount);
      
      const held = await complianceEngine.heldFunds(user1.address, await stableCoin.getAddress());
      expect(held).to.equal(mintAmount);
    });

    it('should release held funds by holdId', async function () {
      // Set user1 as MEDIUM risk
      await riskRegistry.connect(oracle).updateRiskProfile(user1.address, 50, 2, [], false);
      
      const mintAmount = 1000000n * 10n ** 6n;
      await stableCoin.connect(owner).mint(user1.address, mintAmount);
      await stableCoin.connect(user1).transfer(user2.address, mintAmount);
      
      const records = await complianceEngine.getAllHoldRecords();
      expect(records.length).to.equal(1);
      
      await complianceEngine.connect(owner).releaseHold(records[0]);
      
      const held = await complianceEngine.heldFunds(user1.address, await stableCoin.getAddress());
      expect(held).to.equal(0);
    });
  });

  describe('Emergency Pause', function () {
    it('should emergency pause and unpause preTransferHook', async function () {
      await complianceEngine.connect(owner).emergencyPause();
      await expect(
        complianceEngine.preTransferHook(user1.address, user2.address, 100)
      ).to.be.revertedWithCustomError(complianceEngine, 'ContractPaused');

      await complianceEngine.connect(owner).emergencyUnpause();
      await expect(complianceEngine.preTransferHook(user1.address, user2.address, 100)).to.not.be.reverted;
    });
  });
});