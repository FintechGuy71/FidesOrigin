const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployFidesOriginFixture } = require('./shared/fixtures');

describe('FidesOrigin Contract Suite', function () {
    let owner, operator, user1, user2, user3;
    let riskRegistry, policyEngine, complianceEngine, testUSD;

    beforeEach(async function () {
        const fixture = await deployFidesOriginFixture();
        owner = fixture.owner;
        operator = fixture.operator;
        user1 = fixture.user1;
        user2 = fixture.user2;
        user3 = fixture.user3 || (await ethers.getSigners())[5];
        riskRegistry = fixture.riskRegistry;
        policyEngine = fixture.policyEngine;
        complianceEngine = fixture.complianceEngine;
        testUSD = fixture.testUSD;

        // Grant oracle role to owner for testing
        const ORACLE_ROLE = await riskRegistry.ORACLE_ROLE();
        await riskRegistry.grantRole(ORACLE_ROLE, owner.address);

        // Grant COMPLIANCE_ENGINE_ROLE on policyEngine to complianceEngine
        const COMPLIANCE_ENGINE_ROLE = await policyEngine.COMPLIANCE_ENGINE_ROLE();
        await policyEngine.grantRole(COMPLIANCE_ENGINE_ROLE, await complianceEngine.getAddress());

        // Transfer tokens
        await testUSD.transfer(user1.address, ethers.parseEther('10000'));
        await testUSD.transfer(user2.address, ethers.parseEther('10000'));
    });

    describe('RiskRegistry', function () {
        it('should deploy successfully', async function () {
            expect(await riskRegistry.getAddress()).to.properAddress;
        });

        it('should allow ORACLE_ROLE to update risk profile', async function () {
            await riskRegistry.connect(owner).updateRiskProfile(
                user1.address,
                50,
                2,
                [ethers.id('TEST_TAG')],
                false
            );

            const profile = await riskRegistry.getProfile(user1.address);
            expect(profile[0]).to.equal(50); // riskScore
            expect(profile[3]).to.equal(2); // tier
        });

        it('should correctly identify sanctioned addresses', async function () {
            await riskRegistry.connect(owner).updateRiskProfile(
                user2.address,
                100,
                3,
                [],
                true
            );

            const profile = await riskRegistry.getProfile(user2.address);
            expect(profile[5]).to.be.true; // sanctioned
        });

        it('should allow emergency sanction via updateRiskProfile', async function () {
            await riskRegistry.connect(owner).updateRiskProfile(user3.address, 100, 3, [], true);
            const profile = await riskRegistry.getProfile(user3.address);
            expect(profile[5]).to.be.true;
        });

        it('should batch update risk profiles', async function () {
            const accounts = [user1.address, user2.address];
            const scores = [30, 70];
            const tiers = [1, 3];
            const sanctioned = [false, true];
            const tags = [[ethers.id('TAG1')], [ethers.id('TAG2')]];

            await riskRegistry.connect(owner).batchUpdateRiskProfiles(accounts, scores, tiers, sanctioned, tags);

            const p1 = await riskRegistry.getProfile(user1.address);
            const p2 = await riskRegistry.getProfile(user2.address);
            expect(p1[5]).to.be.false; // sanctioned
            expect(p2[5]).to.be.true; // sanctioned
        });
    });

    describe('PolicyEngine', function () {
        it('should evaluate transfer correctly', async function () {
            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('100'),
                await testUSD.getAddress()
            );

            expect(decision).to.equal(0); // ALLOW
        });

        it('should block transfers with sanctioned addresses', async function () {
            await riskRegistry.connect(owner).updateRiskProfile(user2.address, 100, 3, [], true);
            expect((await riskRegistry.getProfile(user2.address))[5]).to.be.true;

            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('100'),
                await testUSD.getAddress()
            );

            expect(decision).to.be.gte(1); // BLOCK
        });

        it('should enforce daily limits', async function () {
            const policy = {
                maxTxAmount: ethers.parseEther('100'),
                dailyLimit: ethers.parseEther('500'),
                allowMediumRisk: false,
                allowHighRisk: false,
                blockMixer: true,
                requireDestinationKYC: false,
                cooldownPeriod: 0,
                blockedTokens: []
            };

            await policyEngine.setIssuerPolicy(await testUSD.getAddress(), policy);

            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('1000'),
                await testUSD.getAddress()
            );

            expect(decision).to.be.gte(1); // BLOCK
        });
    });

    describe('TestUSD', function () {
        it('should deploy with correct initial supply', async function () {
            const totalSupply = await testUSD.totalSupply();
            expect(totalSupply).to.equal(ethers.parseEther('100000000'));
        });

        it('should allow transfers between users', async function () {
            const amount = ethers.parseEther('100');
            await testUSD.connect(user1).transfer(user2.address, amount);
            const balance = await testUSD.balanceOf(user2.address);
            expect(balance).to.equal(ethers.parseEther('10100'));
        });

        it('should block transfers from blacklisted addresses', async function () {
            await testUSD.connect(owner).tagAddress(user1.address, 4, 'Test blacklist');
            await expect(
                testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100'))
            ).to.be.reverted;
        });

        it('should enforce daily limits', async function () {
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
            expect(limitInfo.remainingToday).to.be.gte(ethers.parseEther('999900'));
        });

        it('should allow faucet for users with low balance', async function () {
            await testUSD.connect(user3).faucet();
            const balance = await testUSD.balanceOf(user3.address);
            expect(balance).to.equal(ethers.parseEther('1000'));
        });

        it('should prevent faucet for users who already used it', async function () {
            await testUSD.connect(user3).faucet();
            await expect(testUSD.connect(user3).faucet()).to.be.revertedWithCustomError(
                testUSD,
                'FaucetAlreadyUsed'
            );
        });
    });

    describe('Integration Tests', function () {
        it('should complete full compliance flow', async function () {
            await riskRegistry.connect(owner).updateRiskProfile(user1.address, 20, 1, [], false);

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

            const [decision, reason] = await policyEngine.evaluateTransfer(
                user1.address,
                user2.address,
                ethers.parseEther('1000'),
                await testUSD.getAddress()
            );
            expect(decision).to.equal(0); // ALLOW

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
            await testUSD.connect(user1).transfer(user2.address, ethers.parseEther('100'));
        });
    });
});
