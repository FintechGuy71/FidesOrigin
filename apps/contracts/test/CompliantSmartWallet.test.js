const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

/**
 * @title CompliantSmartWallet Test Suite
 * @notice Tests for CompliantSmartWallet.sol - smart wallet compliance integration
 */

describe('CompliantSmartWallet', function () {
  let wallet, complianceEngine, riskRegistry, owner, admin, oracle, walletOwner, user1, user2;

  beforeEach(async function () {
    const fixture = await deployFidesOriginFixture();
    wallet = fixture.smartWallet;
    complianceEngine = fixture.complianceEngine;
    riskRegistry = fixture.riskRegistry;
    owner = fixture.owner;
    admin = fixture.admin;
    oracle = fixture.oracle;
    walletOwner = fixture.walletOwner;
    user1 = fixture.user1;
    user2 = fixture.user2;

    // Fund wallet with ETH
    await owner.sendTransaction({
      to: await wallet.getAddress(),
      value: ethers.parseEther('10'),
    });
  });

  describe('Deployment', function () {
    it('should set owner correctly', async function () {
      expect(await wallet.owner()).to.equal(walletOwner.address);
    });

    it('should set compliance engine correctly', async function () {
      expect(await wallet.complianceEngine()).to.equal(await complianceEngine.getAddress());
    });

    it('should have default policy with limits', async function () {
      const policy = await wallet.policy();
      expect(policy.maxTxValue).to.be.gt(0);
      expect(policy.dailyEthLimit).to.be.gt(0);
    });
  });

  describe('ETH Transfer', function () {
    it('should transfer ETH to clean address', async function () {
      const initialBalance = await ethers.provider.getBalance(user1.address);
      await expect(wallet.connect(walletOwner).transferETH(user1.address, ethers.parseEther('1')))
        .to.emit(wallet, 'OperationExecuted');
      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther('1'));
    });

    it('should BLOCK transfer to sanctioned address', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      await expect(
        wallet.connect(walletOwner).transferETH(user1.address, ethers.parseEther('1'))
      ).to.be.reverted;
    });

    it('should revert for zero address', async function () {
      await expect(
        wallet.connect(walletOwner).transferETH(ethers.ZeroAddress, ethers.parseEther('1'))
      ).to.be.revertedWithCustomError(wallet, 'InvalidAddress');
    });
  });

  describe('Contract Call', function () {
    it('should call contract successfully', async function () {
      // Use a simple contract (the TestUSD contract) as target
      const TestUSD = await ethers.getContractFactory('TestUSD');
      const testToken = await TestUSD.deploy();
      await testToken.waitForDeployment();

      const data = testToken.interface.encodeFunctionData('name');
      const result = await wallet.connect(walletOwner).callContract.staticCall(
        await testToken.getAddress(),
        0,
        data
      );
      expect(result).to.not.be.empty;
    });

    it('should revert for zero address target', async function () {
      await expect(
        wallet.connect(walletOwner).callContract(ethers.ZeroAddress, 0, '0x')
      ).to.be.revertedWithCustomError(wallet, 'InvalidAddress');
    });
  });

  describe('Token Transfer', function () {
    it('should transfer ERC20 tokens', async function () {
      // Deploy a simple ERC20
      const TestUSD = await ethers.getContractFactory('TestUSD');
      const testToken = await TestUSD.deploy();
      await testToken.waitForDeployment();

      // Mint to wallet
      await testToken.mint(await wallet.getAddress(), ethers.parseEther('1000'));

      await wallet.connect(walletOwner).transferToken(
        await testToken.getAddress(),
        user1.address,
        ethers.parseEther('100')
      );

      expect(await testToken.balanceOf(user1.address)).to.equal(ethers.parseEther('100'));
    });

    it('should revert for zero token address', async function () {
      await expect(
        wallet.connect(walletOwner).transferToken(ethers.ZeroAddress, user1.address, 100)
      ).to.be.revertedWithCustomError(wallet, 'InvalidAddress');
    });
  });

  describe('Batch Operations', function () {
    it('should execute multiple operations', async function () {
      const ops = [
        {
          opType: 0, // TRANSFER
          target: user1.address,
          value: ethers.parseEther('0.5'),
          data: '0x',
          token: ethers.ZeroAddress,
          tokenAmount: 0,
          chainId: 1,
        },
        {
          opType: 0, // TRANSFER
          target: user2.address,
          value: ethers.parseEther('0.5'),
          data: '0x',
          token: ethers.ZeroAddress,
          tokenAmount: 0,
          chainId: 1,
        },
      ];

      const results = await wallet.connect(walletOwner).executeBatch.staticCall(ops);
      expect(results.length).to.equal(2);
    });

    it('should skip blocked operations in batch', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');

      const ops = [
        {
          opType: 0,
          target: user1.address,
          value: ethers.parseEther('0.5'),
          data: '0x',
          token: ethers.ZeroAddress,
          tokenAmount: 0,
          chainId: 1,
        },
        {
          opType: 0,
          target: user2.address,
          value: ethers.parseEther('0.5'),
          data: '0x',
          token: ethers.ZeroAddress,
          tokenAmount: 0,
          chainId: 1,
        },
      ];

      const tx = await wallet.connect(walletOwner).executeBatch(ops);
      await expect(tx).to.emit(wallet, 'BatchExecuted');
    });
  });

  describe('Emergency Pause', function () {
    it('should allow owner to emergency pause', async function () {
      await expect(wallet.connect(walletOwner).emergencyPause())
        .to.emit(wallet, 'EmergencyPaused')
        .withArgs(walletOwner.address);
      expect(await wallet.emergencyPaused()).to.be.true;
    });

    it('should BLOCK operations when paused', async function () {
      await wallet.connect(walletOwner).emergencyPause();
      await expect(
        wallet.connect(walletOwner).transferETH(user1.address, ethers.parseEther('1'))
      ).to.be.revertedWith('Emergency mode active');
    });

    it('should allow owner to unpause', async function () {
      await wallet.connect(walletOwner).emergencyPause();
      await expect(wallet.connect(walletOwner).emergencyUnpause())
        .to.emit(wallet, 'EmergencyUnpaused')
        .withArgs(walletOwner.address);
      expect(await wallet.emergencyPaused()).to.be.false;
    });
  });

  describe('Owner Change', function () {
    it('should allow owner to change owner', async function () {
      await expect(wallet.connect(walletOwner).setOwner(user1.address))
        .to.emit(wallet, 'OwnerChanged')
        .withArgs(user1.address);
      expect(await wallet.owner()).to.equal(user1.address);
    });

    it('should reject non-owner from changing owner', async function () {
      await expect(
        wallet.connect(user1).setOwner(user2.address)
      ).to.be.revertedWith('Not owner');
    });
  });

  describe('Compliance Toggle', function () {
    it('should allow owner to toggle compliance', async function () {
      await wallet.connect(walletOwner).toggleCompliance(false);
      expect(await wallet.complianceEnabled()).to.be.false;
    });

    it('should allow transfer to sanctioned when compliance disabled', async function () {
      await riskRegistry.connect(admin).emergencySanction([user1.address], 'OFAC');
      await wallet.connect(walletOwner).toggleCompliance(false);

      await expect(
        wallet.connect(walletOwner).transferETH(user1.address, ethers.parseEther('1'))
      ).to.not.be.reverted;
    });
  });

  describe('Whitelist', function () {
    it('should add and remove from whitelist', async function () {
      await expect(wallet.connect(walletOwner).addToWhitelist(user1.address))
        .to.emit(wallet, 'TargetWhitelisted')
        .withArgs(user1.address);
      expect(await wallet.whitelistedTargets(user1.address)).to.be.true;

      await expect(wallet.connect(walletOwner).removeFromWhitelist(user1.address))
        .to.emit(wallet, 'TargetRemovedFromWhitelist')
        .withArgs(user1.address);
      expect(await wallet.whitelistedTargets(user1.address)).to.be.false;
    });
  });

  describe('View Functions', function () {
    it('should return daily usage', async function () {
      await wallet.connect(walletOwner).transferETH(user1.address, ethers.parseEther('1'));
      const [ethSpent, ethLimit, remainingEth] = await wallet.getDailyUsage();
      expect(ethSpent).to.equal(ethers.parseEther('1'));
      expect(ethLimit).to.be.gt(0);
      expect(remainingEth).to.equal(ethLimit - ethSpent);
    });

    it('should simulate operation', async function () {
      const op = {
        opType: 0,
        target: user1.address,
        value: ethers.parseEther('1'),
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1,
      };
      const [wouldSucceed, decision] = await wallet.simulateOperation.staticCall(op);
      expect(wouldSucceed).to.be.true;
      expect(decision).to.equal(0); // ALLOW
    });
  });
});
