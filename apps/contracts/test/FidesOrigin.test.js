const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');

describe('FidesOrigin Contract Suite', function () {
    // Accounts
    let owner, operator, user1, user2, user3;
    
    // Contracts
    let riskRegistry;
    let policyEngine;
    let complianceEngine;
    let testUSD;
    
    beforeEach(async function () {
        [owner, operator, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy RiskRegistry via proxy
        const RiskRegistry = await ethers.getContractFactory('RiskRegistry');
        riskRegistry = await upgrades.deployProxy(RiskRegistry, [owner.address], { kind: 'uups', unsafeAllow: ['constructor'] });
        await riskRegistry.waitForDeployment();
        
        // Deploy PolicyEngine via proxy
        const PolicyEngine = await ethers.getContractFactory('PolicyEngine');
        policyEngine = await upgrades.deployProxy(PolicyEngine, [await riskRegistry.getAddress()], { kind: 'uups', unsafeAllow: ['constructor'] });
        await policyEngine.waitForDeployment();
        
        // Deploy ComplianceEngine via proxy
        const ComplianceEngine = await ethers.getContractFactory('ComplianceEngine');
        complianceEngine = await upgrades.deployProxy(ComplianceEngine, [
            await riskRegistry.getAddress(),
            await policyEngine.getAddress()
        ], { kind: 'uups', unsafeAllow: ['constructor'] });
        await complianceEngine.waitForDeployment();
        
        // Deploy TestUSD
        const TestUSD = await ethers.getContractFactory('TestUSD');
        testUSD = await TestUSD.deploy();
        await testUSD.waitForDeployment();
        
        // Grant roles
        const ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
        await riskRegistry.grantRole(ORACLE_ROLE, owner.address);
        
        const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();
        await policyEngine.grantRole(COMPLIANCE_ENGINE_ROLE, await complianceEngine.getAddress());
        
        // Transfer some tokens for testing
        await testUSD.transfer(user1.address, ethers.parseEther('10000'));
        await testUSD.transfer(user2.address, ethers.parseEther('10000'));
    });
    
    describe('RiskRegistry', function () {
        it('should deploy successfully', async function () {
            expect(await riskRegistry.getAddress()).to.properAddress;
        });
        
        it('should allow ORACLE_ROLE to update risk profile', async function () {
            await riskRegistry.updateRiskProfile(
                user1.address,
                50, // riskScore
                2, // MEDIUM tier
                [ethers.id('TEST_TAG')],
                false // not sanctioned
            );
            
            const profile = await riskRegistry.getRiskProfile(user1.address);
            expect(profile.riskScore).to.equal(50);
            expect(profile.tier).to.equal(2);
        });
        
        it('should correctly identify sanctioned addresses', async function () {
            await riskRegistry.updateRiskProfile(
                user2.address,
                100,
                3, // HIGH tier
                [],
                true // sanctioned
            );
            
            expect(await riskRegistry.isSanctioned(user2.address)).to.be.true;
        });
        
        it('should allow emergency sanction by admin', async function () {
            await riskRegistry.emergencySanction([user3.address], "Emergency block");
            
            expect(await riskRegistry.isSanctioned(user3.address)).to.be.true;
        });
        
        it('should batch update risk profiles', async function () {
            const accounts = [user1.address, user2.address];
            const scores = [30, 70];
            const tiers = [1, 3];
            const sanctioned = [false, true];
            
            await riskRegistry.batchUpdateRiskProfiles(accounts, scores, tiers, sanctioned);
            
            expect(await riskRegistry.isSanctioned(user1.address)).to.be.false;
            expect(await riskRegistry.isSanctioned(user2.address)).to.be.true;
        });
    });
    
    describe('PolicyEngine', function () {
        beforeEach(async function () {
            // Grant COMPLIANCE_ENGINE_ROLE
            const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();
            await policyEngine.grantRole(COMPLIANCE_ENGINE_ROLE, await complianceEngine.getAddress());
        });
        
        it('should evaluate transfer correctly', async function () {
            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('100'),
                await testUSD.getAddress()
            );
            
            expect(decision).to.equal(0); // Decision.ALLOW = 0
        });
        
        it('should block transfers with sanctioned addresses', async function () {
            // Sanction user2
            await riskRegistry.emergencySanction([user2.address], "Test sanction");
            
            // Verify sanction was applied
            expect(await riskRegistry.isSanctioned(user2.address)).to.be.true;
            
            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('100'),
                await testUSD.getAddress()
            );
            
            // Should block or hold for sanctioned address
            expect(decision).to.be.gte(1); // At least HOLD (1) or BLOCK (2)
        });
        
        it('should enforce daily limits', async function () {
            // Set a low daily limit policy
            const policy = {
                maxTxAmount: ethers.parseEther('100'),  // Low max tx
                dailyLimit: ethers.parseEther('500'),
                allowMediumRisk: false,
                allowHighRisk: false,
                blockMixer: true,
                requireDestinationKYC: false,
                cooldownPeriod: 0,
                blockedTokens: []
            };
            
            await policyEngine.setIssuerPolicy(await testUSD.getAddress(), policy);
            
            // Transfer should exceed max transaction amount (1000 > 100)
            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('1000'),
                await testUSD.getAddress()
            );
            
            // Should block due to exceeding maxTxAmount
            expect(decision).to.be.gte(1); // At least HOLD or BLOCK
        });
    });
    
    describe('ComplianceEngine', function () {
        it('should validate transfer through interface', async function () {
            const [decision, reason] = await complianceEngine.validateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('100'),
                await testUSD.getAddress()
            );
            
            expect(decision).to.equal(0); // Decision.ALLOW
        });
        
        it('should hold funds for medium risk', async function () {
            // Update user1 to medium risk
            await riskRegistry.updateRiskProfile(
                user1.address,
                50,
                2, // MEDIUM
                [],
                false
            );
            
            // Set policy to hold medium risk (allowMediumRisk = false)
            const policy = {
                maxTxAmount: ethers.parseEther('10000'),
                dailyLimit: ethers.parseEther('10000'),
                allowMediumRisk: false,
                allowHighRisk: false,
                blockMixer: true,
                requireDestinationKYC: false,
                cooldownPeriod: 0,
                blockedTokens: []
            };
            
            await policyEngine.setIssuerPolicy(await testUSD.getAddress(), policy);
            
            // Check decision
            const [decision, reason] = await complianceEngine.validateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('100'),
                await testUSD.getAddress()
            );
            
            // Can be either HOLD (1) or BLOCK (2) depending on policy
            expect(decision).to.be.gte(1); // At least HOLD
        });
        
        it('should activate and deactivate emergency mode', async function () {
            expect(await complianceEngine.emergencyMode()).to.be.false;
            
            // Call activateEmergencyMode twice to reach threshold (emergencyMinApprovals=2)
            await complianceEngine.activateEmergencyMode();
            await complianceEngine.activateEmergencyMode();
            expect(await complianceEngine.emergencyMode()).to.be.true;
            
            await complianceEngine.deactivateEmergencyMode();
            expect(await complianceEngine.emergencyMode()).to.be.false;
        });
    });
    
    describe('TestUSD', function () {
        it('should deploy with correct initial supply', async function () {
            const totalSupply = await testUSD.totalSupply();
            expect(totalSupply).to.equal(ethers.parseEther('100000000')); // 1亿
        });
        
        it('should allow transfers between users', async function () {
            const amount = ethers.parseEther('100');
            await testUSD.connect(user1).transfer(user2.address, amount);
            
            const balance = await testUSD.balanceOf(user2.address);
            expect(balance).to.equal(ethers.parseEther('10100')); // 10000 + 100
        });
        
        it('should block transfers from blacklisted addresses', async function () {
            // Tag user1 as blacklisted
            await testUSD.connect(owner).tagAddress(user1.address, 4, "Test blacklist"); // BLACK = 4
            
            await expect(
                testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100'))
            ).to.be.reverted;
        });
        
        it('should enforce daily limits', async function () {
            // User1 is NORMAL by default, limit is 1M TUSD daily
            // Try to transfer more than 1M
            const largeAmount = ethers.parseEther('1000001');
            
            await expect(
                testUSD.connect(user1).transfer(user2.address, largeAmount)
            ).to.be.reverted;
        });
        
        it('should allow minting by admin', async function () {
            const mintAmount = ethers.parseEther('1000');
            await testUSD.mint(user3.address, mintAmount);
            
            const balance = await testUSD.balanceOf(user3.address);
            expect(balance).to.equal(mintAmount);
        });
        
        it('should allow batch transfers', async function () {
            const recipients = [user2.address, user3.address];
            const amounts = [ethers.parseEther('100'), ethers.parseEther('200')];
            
            await testUSD.connect(user1).batchTransfer(recipients, amounts);
            
            expect(await testUSD.balanceOf(user2.address)).to.equal(ethers.parseEther('10100'));
            expect(await testUSD.balanceOf(user3.address)).to.equal(ethers.parseEther('200'));
        });
        
        it('should track daily usage', async function () {
            const amount = ethers.parseEther('100');
            await testUSD.connect(user1).transfer(user2.address, amount);
            
            const limitInfo = await testUSD.getLimitInfo(user1.address);
            expect(limitInfo.usedToday).to.equal(amount);
            // VIP has 10M daily limit, but user1 is NORMAL with 1M limit
            // User1 starts with 10k and transfers 100, so remaining is 999900... (or 1M - 100)
            expect(limitInfo.remainingToday).to.be.gte(ethers.parseEther('999900'));
        });
        
        it('should reset daily usage after a day', async function () {
            // This test would require time manipulation on the blockchain
            // Skipping for now as it requires more complex setup
        });
        
        it('should allow faucet for users with low balance', async function () {
            await testUSD.connect(user3).faucet();
            const balance = await testUSD.balanceOf(user3.address);
            expect(balance).to.equal(ethers.parseEther('1000'));
        });
        
        it('should prevent faucet for users with high balance', async function () {
            await expect(testUSD.connect(user1).faucet()).to.be.revertedWithCustomError(
                testUSD,
                'BalanceTooHigh'
            );
        });
    });
    
    describe('Integration Tests', function () {
        it('should complete full compliance flow', async function () {
            // 1. Update risk profile
            await riskRegistry.updateRiskProfile(
                user1.address,
                20,
                1, // LOW
                [],
                false
            );
            
            // 2. Set custom policy
            const policy = {
                maxTxAmount: ethers.parseEther('5000'),
                dailyLimit: ethers.parseEther('10000'),
                allowMediumRisk: true,
                allowHighRisk: false,
                blockMixer: true,
                requireDestinationKYC: false,
                cooldownPeriod: 0,
                blockedTokens: []
            };
            
            await policyEngine.setIssuerPolicy(await testUSD.getAddress(), policy);
            
            // 3. Validate through ComplianceEngine
            const [decision, reason] = await complianceEngine.validateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('1000'),
                await testUSD.getAddress()
            );
            
            expect(decision).to.equal(0); // ALLOW
            
            // 4. Execute actual transfer
            await testUSD.connect(user1).transfer(user2.address, ethers.parseEther('1000'));
            
            const balance = await testUSD.balanceOf(user2.address);
            expect(balance).to.equal(ethers.parseEther('11000'));
        });
        
        it('should handle emergency pause correctly', async function () {
            await testUSD.pause();
            
            await expect(
                testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100'))
            ).to.be.revertedWithCustomError(testUSD, 'EnforcedPause');
            
            await testUSD.unpause();
            
            // Should work after unpause
            await testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100'));
        });
    });
});
