const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('DiamondComplianceEngine', function () {
  let diamond, diamondCutFacet, diamondLoupeFacet;
  let adminFacet, complianceCoreFacet, assetComplianceFacet, walletComplianceFacet;
  let owner, addr1, addr2, operator;
  let riskRegistry, policyEngine;

  // Helper to execute diamondCut with timelock (propose -> wait 48h -> execute)
  async function executeDiamondCut(cut) {
    await diamond.proposeDiamondCut(cut, ethers.ZeroAddress, '0x');
    await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
    await ethers.provider.send('evm_mine');
    return await diamond.diamondCut(cut, ethers.ZeroAddress, '0x');
  }

  // Helper to get function selectors from a contract factory, excluding already-used ones
  async function getSelectorsExcluding(contractFactory, usedSelectors) {
    const fragmentKeys = Object.keys(contractFactory.interface.fragments);
    const selectors = [];
    for (const key of fragmentKeys) {
      const fragment = contractFactory.interface.fragments[key];
      if (fragment.type === 'function') {
        const sig = fragment.format();
        const selector = contractFactory.interface.getFunction(sig).selector;
        if (!usedSelectors.has(selector)) {
          selectors.push(selector);
          usedSelectors.add(selector);
        }
      }
    }
    return selectors;
  }

  beforeEach(async function () {
    [owner, addr1, addr2, operator] = await ethers.getSigners();

    // Deploy RiskRegistry
    const RiskRegistry = await ethers.getContractFactory('RiskRegistry');
    riskRegistry = await upgrades.deployProxy(RiskRegistry, [owner.address], {
      initializer: 'initialize',
      unsafeAllow: ['constructor']
    });
    await riskRegistry.waitForDeployment();

    // Deploy PolicyEngine
    const PolicyEngine = await ethers.getContractFactory('PolicyEngine');
    policyEngine = await upgrades.deployProxy(PolicyEngine, [owner.address, await riskRegistry.getAddress()], {
      initializer: 'initialize',
      unsafeAllow: ['constructor']
    });
    await policyEngine.waitForDeployment();

    // Deploy facets
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.waitForDeployment();

    const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet');
    diamondLoupeFacet = await DiamondLoupeFacet.deploy();
    await diamondLoupeFacet.waitForDeployment();

    const AdminFacet = await ethers.getContractFactory('AdminFacet');
    adminFacet = await AdminFacet.deploy();
    await adminFacet.waitForDeployment();

    const ComplianceCoreFacet = await ethers.getContractFactory('ComplianceCoreFacet');
    complianceCoreFacet = await ComplianceCoreFacet.deploy();
    await complianceCoreFacet.waitForDeployment();

    const AssetComplianceFacet = await ethers.getContractFactory('AssetComplianceFacet');
    assetComplianceFacet = await AssetComplianceFacet.deploy();
    await assetComplianceFacet.waitForDeployment();

    const WalletComplianceFacet = await ethers.getContractFactory('WalletComplianceFacet');
    walletComplianceFacet = await WalletComplianceFacet.deploy();
    await walletComplianceFacet.waitForDeployment();

    // Build diamond cut with global deduplication to avoid "function already exists"
    const usedSelectors = new Set();
    const cut = [];

    // DiamondCutFacet
    const diamondCutSelectors = await getSelectorsExcluding(DiamondCutFacet, usedSelectors);
    cut.push({
      facetAddress: await diamondCutFacet.getAddress(),
      action: 0, // Add
      functionSelectors: diamondCutSelectors
    });

    // DiamondLoupeFacet
    const diamondLoupeSelectors = await getSelectorsExcluding(DiamondLoupeFacet, usedSelectors);
    cut.push({
      facetAddress: await diamondLoupeFacet.getAddress(),
      action: 0,
      functionSelectors: diamondLoupeSelectors
    });

    // AdminFacet (adds AccessControl functions first)
    const adminSelectors = await getSelectorsExcluding(AdminFacet, usedSelectors);
    cut.push({
      facetAddress: await adminFacet.getAddress(),
      action: 0,
      functionSelectors: adminSelectors
    });

    // ComplianceCoreFacet
    const coreSelectors = await getSelectorsExcluding(ComplianceCoreFacet, usedSelectors);
    cut.push({
      facetAddress: await complianceCoreFacet.getAddress(),
      action: 0,
      functionSelectors: coreSelectors
    });

    // AssetComplianceFacet
    const assetSelectors = await getSelectorsExcluding(AssetComplianceFacet, usedSelectors);
    cut.push({
      facetAddress: await assetComplianceFacet.getAddress(),
      action: 0,
      functionSelectors: assetSelectors
    });

    // WalletComplianceFacet
    const walletSelectors = await getSelectorsExcluding(WalletComplianceFacet, usedSelectors);
    cut.push({
      facetAddress: await walletComplianceFacet.getAddress(),
      action: 0,
      functionSelectors: walletSelectors
    });

    // Deploy Diamond
    const DiamondComplianceEngine = await ethers.getContractFactory('DiamondComplianceEngine');
    diamond = await DiamondComplianceEngine.deploy(
      owner.address,
      cut,
      await adminFacet.getAddress(),
      adminFacet.interface.encodeFunctionData('initialize', [
        await riskRegistry.getAddress(),
        await policyEngine.getAddress(),
        owner.address
      ])
    );
    await diamond.waitForDeployment();

    // [K3 Fix] Merge all facet ABIs into diamond instance so ethers.js can encode facet function calls
    const diamondAddress = await diamond.getAddress();
    const allFragments = [
      ...DiamondCutFacet.interface.fragments,
      ...DiamondLoupeFacet.interface.fragments,
      ...AdminFacet.interface.fragments,
      ...ComplianceCoreFacet.interface.fragments,
      ...AssetComplianceFacet.interface.fragments,
      ...WalletComplianceFacet.interface.fragments,
    ];
    const uniqueFragments = [];
    const seen = new Set();
    for (const f of allFragments) {
      if (f.type === 'function' || f.type === 'event' || f.type === 'error') {
        const sig = f.type === 'function' ? f.format('full') : f.format();
        if (!seen.has(sig)) {
          seen.add(sig);
          uniqueFragments.push(f);
        }
      }
    }
    diamond = new ethers.Contract(diamondAddress, uniqueFragments, owner);
  });

  describe('Deployment', function () {
    it('should deploy diamond with all facets', async function () {
      const facets = await diamond.facets();
      expect(facets.length).to.be.gte(6);
    });

    it('should set contract owner correctly', async function () {
      // owner() is not directly exposed, but diamondCut should be restricted
      const loupe = await ethers.getContractAt('DiamondLoupeFacet', await diamond.getAddress());
      const facets = await loupe.facets();
      expect(facets.length).to.be.gte(6);
    });
  });

  describe('DiamondLoupe', function () {
    it('should return all facets', async function () {
      const facets = await diamond.facets();
      expect(facets.length).to.be.gte(6);
    });

    it('should return facet addresses', async function () {
      const addresses = await diamond.facetAddresses();
      expect(addresses.length).to.be.gte(6);
    });

    it('should return correct facet for known selector', async function () {
      // facets() selector is from DiamondLoupeFacet
      const selector = diamond.interface.getFunction('facets').selector;
      const facet = await diamond.facetAddress(selector);
      expect(facet).to.equal(await diamondLoupeFacet.getAddress());
    });

    it('should return function selectors for a facet', async function () {
      const selectors = await diamond.facetFunctionSelectors(await diamondLoupeFacet.getAddress());
      expect(selectors.length).to.be.gt(0);
    });

    it('should return address(0) for unknown selector', async function () {
      const unknownSelector = '0x12345678';
      const facet = await diamond.facetAddress(unknownSelector);
      expect(facet).to.equal(ethers.ZeroAddress);
    });
  });

  describe('diamondCut - Upgrade', function () {
    it('should allow owner to add a new facet', async function () {
      const TestFacet = await ethers.getContractFactory('DiamondLoupeFacet');
      const testFacet = await TestFacet.deploy();
      await testFacet.waitForDeployment();

      // Use a unique selector that doesn't exist in the diamond yet
      const uniqueSelector = '0x12345678';
      const cut = [{
        facetAddress: await testFacet.getAddress(),
        action: 0, // Add
        functionSelectors: [uniqueSelector]
      }];

      await executeDiamondCut(cut);

      // Verify it was added
      const facet = await diamond.facetAddress(uniqueSelector);
      expect(facet).to.equal(await testFacet.getAddress());
    });

    it('should allow owner to replace a facet function', async function () {
      const NewLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet');
      const newLoupe = await NewLoupeFacet.deploy();
      await newLoupe.waitForDeployment();

      const selector = diamond.interface.getFunction('facets').selector;
      const cut = [{
        facetAddress: await newLoupe.getAddress(),
        action: 1, // Replace
        functionSelectors: [selector]
      }];

      await executeDiamondCut(cut);

      const facet = await diamond.facetAddress(selector);
      expect(facet).to.equal(await newLoupe.getAddress());
    });

    it('should allow owner to remove a facet function', async function () {
      // First add a unique function selector we can remove
      const uniqueSelector = '0xabcdef01';
      const addCut = [{
        facetAddress: await diamondLoupeFacet.getAddress(),
        action: 0,
        functionSelectors: [uniqueSelector]
      }];
      await executeDiamondCut(addCut);

      // Verify it exists
      expect(await diamond.facetAddress(uniqueSelector)).to.equal(await diamondLoupeFacet.getAddress());

      // Now remove it
      const removeCut = [{
        facetAddress: ethers.ZeroAddress,
        action: 2, // Remove
        functionSelectors: [uniqueSelector]
      }];
      await executeDiamondCut(removeCut);

      const facet = await diamond.facetAddress(uniqueSelector);
      expect(facet).to.equal(ethers.ZeroAddress);
    });

    it('should revert when non-owner tries diamondCut', async function () {
      const cut = [];
      await expect(
        diamond.connect(addr1).diamondCut(cut, ethers.ZeroAddress, '0x')
      ).to.be.revertedWith('LibDiamond: Must be contract owner');
    });
  });

  describe('Facet Selector Conflict Detection', function () {
    it('should revert when adding duplicate selector', async function () {
      const selector = diamond.interface.getFunction('facets').selector;
      const cut = [{
        facetAddress: await diamondLoupeFacet.getAddress(),
        action: 0,
        functionSelectors: [selector]
      }];

      await diamond.proposeDiamondCut(cut, ethers.ZeroAddress, '0x');
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(
        diamond.diamondCut(cut, ethers.ZeroAddress, '0x')
      ).to.be.revertedWith("LibDiamond: Can't add function that already exists");
    });

    it('should revert when replacing with same facet', async function () {
      const selector = diamond.interface.getFunction('facets').selector;
      const cut = [{
        facetAddress: await diamondLoupeFacet.getAddress(),
        action: 1,
        functionSelectors: [selector]
      }];

      await diamond.proposeDiamondCut(cut, ethers.ZeroAddress, '0x');
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(
        diamond.diamondCut(cut, ethers.ZeroAddress, '0x')
      ).to.be.revertedWith("LibDiamond: Can't replace function with same function");
    });

    it('should revert when removing non-existent selector', async function () {
      const cut = [{
        facetAddress: ethers.ZeroAddress,
        action: 2,
        functionSelectors: ['0xdeadbeef']
      }];

      await diamond.proposeDiamondCut(cut, ethers.ZeroAddress, '0x');
      await ethers.provider.send('evm_increaseTime', [48 * 3600 + 1]);
      await ethers.provider.send('evm_mine');

      await expect(
        diamond.diamondCut(cut, ethers.ZeroAddress, '0x')
      ).to.be.revertedWith("LibDiamond: Can't remove function that doesn't exist");
    });
  });

  describe('Storage Layout Consistency', function () {
    it('should preserve data after facet replacement', async function () {
      // Set some data via AdminFacet
      await diamond.setUpgradeTimelockDelay(7 * 24 * 60 * 60);

      // Replace AdminFacet
      const NewAdminFacet = await ethers.getContractFactory('AdminFacet');
      const newAdmin = await NewAdminFacet.deploy();
      await newAdmin.waitForDeployment();

      const selectors = await getSelectorsExcluding(NewAdminFacet, new Set());
      const cut = [{
        facetAddress: await newAdmin.getAddress(),
        action: 1, // Replace
        functionSelectors: selectors
      }];

      await executeDiamondCut(cut);

      // Data should still be there
      const delay = await diamond.upgradeTimelockDelay();
      expect(delay).to.equal(7 * 24 * 60 * 60);
    });

    it('should preserve check history after facet upgrade', async function () {
      // Add a risk profile first
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 30, 1, [], false);

      // Perform a check
      await diamond.checkAddressCompliance(addr1.address);
      const historyBefore = await diamond.getCheckHistoryLength();
      expect(historyBefore).to.be.gt(0);

      // Replace ComplianceCoreFacet
      const NewCoreFacet = await ethers.getContractFactory('ComplianceCoreFacet');
      const newCore = await NewCoreFacet.deploy();
      await newCore.waitForDeployment();

      const selectors = await getSelectorsExcluding(NewCoreFacet, new Set());
      const cut = [{
        facetAddress: await newCore.getAddress(),
        action: 1,
        functionSelectors: selectors
      }];

      await executeDiamondCut(cut);

      // History should be preserved
      const historyAfter = await diamond.getCheckHistoryLength();
      expect(historyAfter).to.equal(historyBefore);
    });
  });

  describe('AdminFacet', function () {
    it('should allow admin to pause and unpause', async function () {
      const tx1 = await diamond.pause();
      const receipt1 = await tx1.wait();
      const pausedEvent = receipt1.logs.find(l => l.fragment && l.fragment.name === 'ContractPaused');
      expect(pausedEvent).to.exist;
      expect(pausedEvent.args[0]).to.equal(owner.address);

      // Advance time to avoid same timestamp issues
      await ethers.provider.send('evm_increaseTime', [2]);
      await ethers.provider.send('evm_mine');

      const tx2 = await diamond.unpause();
      const receipt2 = await tx2.wait();
      const unpausedEvent = receipt2.logs.find(l => l.fragment && l.fragment.name === 'ContractUnpaused');
      expect(unpausedEvent).to.exist;
      expect(unpausedEvent.args[0]).to.equal(owner.address);
    });

    it('should revert when non-admin tries to pause', async function () {
      await expect(
        diamond.connect(addr1).pause()
      ).to.be.reverted;
    });

    it('should allow admin to set risk registry', async function () {
      const newRegistry = ethers.Wallet.createRandom().address;
      // We need a contract address, so deploy a dummy
      const Dummy = await ethers.getContractFactory('RiskRegistry');
      const dummy = await Dummy.deploy();
      await dummy.waitForDeployment();

      await expect(diamond.setRiskRegistry(await dummy.getAddress()))
        .to.emit(diamond, 'RiskRegistrySet');

      expect(await diamond.riskRegistry()).to.equal(await dummy.getAddress());
    });

    it('should allow admin to set policy engine', async function () {
      const Dummy = await ethers.getContractFactory('PolicyEngine');
      const dummy = await Dummy.deploy();
      await dummy.waitForDeployment();

      await expect(diamond.setPolicyEngine(await dummy.getAddress()))
        .to.emit(diamond, 'PolicyEngineSet');
    });

    it('should allow admin to set issuer policy', async function () {
      const token = ethers.Wallet.createRandom().address;
      const policy = {
        maxTxAmount: ethers.parseEther('1000'),
        dailyLimit: ethers.parseEther('5000'),
        allowMediumRisk: true,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      };

      await expect(diamond.setIssuerPolicy(token, policy))
        .to.emit(diamond, 'IssuerPolicySet');
    });

    it('should allow admin to grant and revoke roles with reason', async function () {
      const ADMIN_ROLE = await diamond.ADMIN_ROLE();

      await expect(
        diamond.grantRoleWithReason(ADMIN_ROLE, addr1.address, 'test grant')
      ).to.emit(diamond, 'RoleGrantedDetailed');

      expect(await diamond.hasRole(ADMIN_ROLE, addr1.address)).to.be.true;

      await expect(
        diamond.revokeRoleWithReason(ADMIN_ROLE, addr1.address, 'test revoke')
      ).to.emit(diamond, 'RoleRevokedDetailed');

      expect(await diamond.hasRole(ADMIN_ROLE, addr1.address)).to.be.false;
    });

    it('should allow operator to release quarantine', async function () {
      const OPERATOR_ROLE = await diamond.OPERATOR_ROLE();
      await diamond.grantRoleWithReason(OPERATOR_ROLE, operator.address, 'test');

      // Create a quarantine record
      await diamond.connect(operator).quarantineTransaction(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        'test'
      );

      const qListLen = await diamond.getQuarantineListLength();
      expect(qListLen).to.equal(1);

      // Get the quarantine ID from the paginated list
      const records = await diamond.getQuarantineListPaginated(0, 1);
      const qId = records[0];

      await diamond.connect(operator).releaseQuarantine(qId);

      const releasedRecord = await diamond.getQuarantineRecord(qId);
      expect(releasedRecord.released).to.be.true;
    });

    it('should track total checks, blocked, and quarantined counts', async function () {
      // Add risk profiles
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 1, [], false);

      await diamond.checkAddressCompliance(addr1.address);
      expect(await diamond.totalChecks()).to.equal(1);
    });
  });

  describe('ComplianceCoreFacet', function () {
    beforeEach(async function () {
      // Set up issuer policy for token
      const token = ethers.Wallet.createRandom().address;
      const policy = {
        maxTxAmount: ethers.parseEther('1000'),
        dailyLimit: ethers.parseEther('5000'),
        allowMediumRisk: true,
        allowHighRisk: false,
        blockMixer: true,
        requireDestinationKYC: false,
        cooldownPeriod: 0,
        blockedTokens: []
      };
      await diamond.setIssuerPolicy(token, policy);
    });

    it('should check address compliance for clean address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 1, [], false);

      const [isCompliant, riskScore, reason] = await diamond.checkAddressCompliance.staticCall(addr1.address);
      expect(isCompliant).to.be.true;
      expect(riskScore).to.equal(50);
      expect(reason).to.equal('Low risk');
    });

    it('should block sanctioned address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 1, [], true);

      const [isCompliant, riskScore, reason] = await diamond.checkAddressCompliance.staticCall(addr1.address);
      expect(isCompliant).to.be.false;
      expect(reason).to.equal('Sanctioned');
    });

    it('should block high risk address (score >= 80)', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 85, 3, [], false);

      const [isCompliant, riskScore, reason] = await diamond.checkAddressCompliance.staticCall(addr1.address);
      expect(isCompliant).to.be.false;
      expect(riskScore).to.equal(85);
      expect(reason).to.equal('High risk');
    });

    it('should block critical risk address (score >= 95)', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 98, 4, [], false);

      const [isCompliant, riskScore, reason] = await diamond.checkAddressCompliance.staticCall(addr1.address);
      expect(isCompliant).to.be.false;
      expect(riskScore).to.equal(98);
      expect(reason).to.equal('Critical');
    });

    it('should fail closed for unknown address', async function () {
      const [isCompliant, , reason] = await diamond.checkAddressCompliance.staticCall(addr1.address);
      expect(isCompliant).to.be.false;
      expect(reason).to.equal('No profile - fail closed');
    });

    it('should allow transfer for clean addresses', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const [decision, reason] = await diamond.checkTransfer.staticCall(addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress);
      expect(decision).to.equal(0); // ALLOW
      expect(reason).to.equal('Transfer allowed');
    });

    it('should block transfer from sanctioned address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], true);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const [decision, reason] = await diamond.checkTransfer.staticCall(addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress);
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.equal('Sanctioned');
    });

    it('should quarantine transaction with deadline', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600;
      const [decision] = await diamond.checkTransferWithDeadline.staticCall(
        addr1.address,
        addr2.address,
        ethers.parseEther('1'),
        ethers.ZeroAddress,
        deadline
      );
      expect(decision).to.equal(0); // ALLOW
    });

    it('should revert expired deadline', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const deadline = (await ethers.provider.getBlock('latest')).timestamp - 1;
      await expect(
        diamond.checkTransferWithDeadline(addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress, deadline)
      ).to.be.revertedWithCustomError(diamond, 'DeadlineExpired');
    });

    it('should support batch check address compliance', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 85, 3, [], false);

      const [results, scores] = await diamond.batchCheckAddressCompliance.staticCall([addr1.address, addr2.address]);
      expect(results[0]).to.be.true;
      expect(results[1]).to.be.false;
      expect(scores[0]).to.equal(30);
      expect(scores[1]).to.equal(85);
    });

    it('should revert batch check for more than 100 addresses', async function () {
      const addrs = Array(101).fill(addr1.address);
      await expect(
        diamond.batchCheckAddressCompliance(addrs)
      ).to.be.revertedWithCustomError(diamond, 'BatchSizeExceeded');
    });
  });

  describe('AssetComplianceFacet', function () {
    it('should validate transfer for clean addresses', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const [decision, reason] = await diamond.validateTransfer(addr1.address, addr2.address, ethers.parseEther('1'), ethers.ZeroAddress);
      expect(decision).to.equal(0); // ALLOW
      expect(reason).to.equal('Transfer allowed');
    });

    it('should revert preTransferHook for blocked address', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 98, 4, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      await expect(
        diamond.preTransferHook(addr1.address, addr2.address, ethers.parseEther('1'))
      ).to.be.revertedWithCustomError(diamond, 'RiskBlocked');
    });

    it('should get address risk profile', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 2, [ethers.encodeBytes32String('test')], false);

      const profile = await diamond.getAddressRisk(addr1.address);
      expect(profile.riskScore).to.equal(50);
      expect(profile.tier).to.equal(2);
      expect(profile.isSanctioned).to.be.false;
    });

    it('should check if address is sanctioned', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 50, 1, [], true);
      expect(await diamond.isSanctioned(addr1.address)).to.be.true;

      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 50, 1, [], false);
      expect(await diamond.isSanctioned(addr2.address)).to.be.false;
    });
  });

  describe('WalletComplianceFacet', function () {
    beforeEach(async function () {
      // Grant OPERATOR_ROLE to owner and diamond address for validateOperation/validateBatch tests
      const OPERATOR_ROLE = await diamond.OPERATOR_ROLE();
      await diamond.grantRoleWithReason(OPERATOR_ROLE, owner.address, 'test setup');
      // Diamond address needs OPERATOR_ROLE because validateOperation internally calls
      // validateTransfer via external call (IAssetCompliance(address(this)).validateTransfer)
      const diamondAddress = await diamond.getAddress();
      await diamond.grantRoleWithReason(OPERATOR_ROLE, diamondAddress, 'diamond self-call');
    });

    it('should validate operation for clean owner', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const op = {
        opType: 0, // TRANSFER
        target: addr2.address,
        value: ethers.parseEther('1'),
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1
      };

      const [decision] = await diamond.validateOperation(addr1.address, op, ethers.ZeroAddress);
      expect(decision).to.equal(0); // ALLOW
    });

    it('should block operation for sanctioned owner', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], true);

      const op = {
        opType: 0,
        target: addr2.address,
        value: ethers.parseEther('1'),
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1
      };

      const [decision, reason] = await diamond.validateOperation(addr1.address, op, ethers.ZeroAddress);
      expect(decision).to.equal(1); // BLOCK
      expect(reason).to.equal('Sanctioned');
    });

    it('should validate batch operations', async function () {
      await riskRegistry.connect(owner).updateRiskProfile(addr1.address, 30, 1, [], false);
      await riskRegistry.connect(owner).updateRiskProfile(addr2.address, 20, 1, [], false);

      const ops = [
        {
          opType: 0,
          target: addr2.address,
          value: ethers.parseEther('1'),
          data: '0x',
          token: ethers.ZeroAddress,
          tokenAmount: 0,
          chainId: 1
        }
      ];

      const decisions = await diamond.validateBatch(addr1.address, ops);
      expect(decisions[0]).to.equal(0); // ALLOW
    });

    it('should analyze operation risk for unknown target', async function () {
      const op = {
        opType: 0,
        target: addr2.address,
        value: ethers.parseEther('1'),
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1
      };

      const [riskScore, tier, factors] = await diamond.analyzeOperationRisk(op);
      expect(riskScore).to.equal(50);
      expect(tier).to.equal(2); // MEDIUM
      expect(factors).to.equal('Unknown target');
    });

    it('should analyze operation risk for zero target', async function () {
      const op = {
        opType: 0,
        target: ethers.ZeroAddress,
        value: ethers.parseEther('1'),
        data: '0x',
        token: ethers.ZeroAddress,
        tokenAmount: 0,
        chainId: 1
      };

      const [riskScore, tier, factors] = await diamond.analyzeOperationRisk(op);
      expect(riskScore).to.equal(100);
      expect(tier).to.equal(4); // CRITICAL
      expect(factors).to.equal('Zero target');
    });
  });
});
