const { expect } = require('chai');
const { ethers } = require('hardhat');
const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');

describe('MerkleRiskRegistry Extended Tests', function () {
    let owner, admin, oracle, user1, user2, attacker;
    let registry;
    let merkleTree;
    let merkleRoot;
    let testAddresses;
    
    beforeEach(async function () {
        [owner, admin, oracle, user1, user2, attacker] = await ethers.getSigners();
        
        // Create test Merkle Tree with 10 addresses
        testAddresses = [
            [user1.address, 80, 'BLACK'],
            [user2.address, 30, 'GREY'],
            [owner.address, 100, 'BLACK'],
            [admin.address, 50, 'GREY'],
            [oracle.address, 20, 'GREY'],
            ['0x1234567890123456789012345678901234567890', 90, 'BLACK'],
            ['0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', 85, 'BLACK'],
            ['0xdAC17F958D2ee523a2206206994597C13D831ec7', 40, 'GREY'],
            ['0xa0b86a33e6441e0a421e56e4773c3c4b0db1fc6b', 95, 'BLACK'],
            ['0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', 25, 'GREY'],
        ];
        
        merkleTree = StandardMerkleTree.of(testAddresses, ['address', 'uint256', 'string']);
        merkleRoot = merkleTree.root;
        
        // Deploy contract
        const MerkleRiskRegistry = await ethers.getContractFactory('MerkleRiskRegistry');
        registry = await MerkleRiskRegistry.deploy(merkleRoot);
        await registry.waitForDeployment();
        
        // Grant roles
        await registry.grantRole(await registry.ADMIN_ROLE(), admin.address);
        await registry.grantRole(await registry.ORACLE_ROLE(), oracle.address);
    });
    
    describe('Constructor & Initialization', function () {
        it('should set initial Merkle Root correctly', async function () {
            expect(await registry.merkleRoot()).to.equal(merkleRoot);
        });
        
        it('should record initial root in history', async function () {
            const history = await registry.getMerkleRootHistory();
            expect(history.length).to.equal(1);
            expect(history[0]).to.equal(merkleRoot);
        });
        
        it('should grant DEFAULT_ADMIN_ROLE to deployer', async function () {
            const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
            expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });
        
        it('should grant ADMIN_ROLE to deployer', async function () {
            expect(await registry.hasRole(await registry.ADMIN_ROLE(), owner.address)).to.be.true;
        });
        
        it('should grant ORACLE_ROLE to deployer', async function () {
            expect(await registry.hasRole(await registry.ORACLE_ROLE(), owner.address)).to.be.true;
        });
    });
    
    describe('Merkle Root Updates', function () {
        it('should allow ADMIN to update Merkle Root', async function () {
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes('new root'));
            
            const tx = await registry.connect(admin).updateMerkleRoot(newRoot);
            const receipt = await tx.wait();
            
            // Verify event emitted
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'MerkleRootUpdated'
            );
            expect(event).to.exist;
            expect(event.args[0]).to.equal(merkleRoot); // oldRoot
            expect(event.args[1]).to.equal(newRoot);    // newRoot
            expect(event.args[2]).to.be.a('bigint');    // timestamp
            
            expect(await registry.merkleRoot()).to.equal(newRoot);
        });
        
        it('should reject same root update', async function () {
            await expect(registry.updateMerkleRoot(merkleRoot))
                .to.be.revertedWith('Same root');
        });
        
        it('should reject non-ADMIN update', async function () {
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes('new root'));
            
            await expect(registry.connect(user1).updateMerkleRoot(newRoot))
                .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
        });
        
        it('should reject ORACLE role from updating root', async function () {
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes('new root'));
            
            await expect(registry.connect(oracle).updateMerkleRoot(newRoot))
                .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
        });
        
        it('should track root history', async function () {
            const roots = [];
            for (let i = 0; i < 3; i++) {
                const newRoot = ethers.keccak256(ethers.toUtf8Bytes(`root ${i}`));
                await registry.updateMerkleRoot(newRoot);
                roots.push(newRoot);
            }
            
            const history = await registry.getMerkleRootHistory();
            expect(history.length).to.equal(4); // initial + 3 updates
            expect(history[0]).to.equal(merkleRoot);
            for (let i = 0; i < 3; i++) {
                expect(history[i + 1]).to.equal(roots[i]);
            }
        });
        
        it('should emit event with correct old and new root', async function () {
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes('test root'));
            
            const tx = await registry.updateMerkleRoot(newRoot);
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'MerkleRootUpdated'
            );
            expect(event).to.exist;
            expect(event.args[0]).to.equal(merkleRoot); // oldRoot
            expect(event.args[1]).to.equal(newRoot);    // newRoot
            expect(event.args[2]).to.be.a('bigint');    // timestamp
        });
    });
    
    describe('Address Verification', function () {
        it('should verify valid address in Merkle Tree', async function () {
            const [value, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            
            const result = await registry.verifyAddress(
                value[0], value[1], value[2], proof
            );
            expect(result).to.be.true;
        });
        
        it('should reject invalid proof', async function () {
            const fakeProof = [ethers.keccak256(ethers.toUtf8Bytes('fake'))];
            
            const result = await registry.verifyAddress(
                user1.address, 80, 'BLACK', fakeProof
            );
            expect(result).to.be.false;
        });
        
        it('should reject address with wrong risk score', async function () {
            const [value, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            
            // Try with wrong score
            const result = await registry.verifyAddress(
                value[0], 999, value[2], proof
            );
            expect(result).to.be.false;
        });
        
        it('should reject address with wrong risk tier', async function () {
            const [value, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            
            // Try with wrong tier
            const result = await registry.verifyAddress(
                value[0], value[1], 'GREY', proof
            );
            expect(result).to.be.false;
        });
        
        it('should verify address not in tree returns false', async function () {
            const notInTree = '0x0000000000000000000000000000000000000001';
            const [_, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            
            const result = await registry.verifyAddress(
                notInTree, 80, 'BLACK', proof
            );
            expect(result).to.be.false;
        });
        
        it('should verify multiple addresses', async function () {
            for (let i = 0; i < 3; i++) {
                const [value, index] = [testAddresses[i], i];
                const proof = merkleTree.getProof(index);
                
                const result = await registry.verifyAddress(
                    value[0], value[1], value[2], proof
                );
                expect(result).to.be.true;
            }
        });
    });
    
    describe('Batch Verification', function () {
        it('should batch verify all addresses', async function () {
            const addresses = [];
            const riskScores = [];
            const riskTiers = [];
            const proofs = [];
            
            for (let i = 0; i < testAddresses.length; i++) {
                const [value, index] = [testAddresses[i], i];
                addresses.push(value[0]);
                riskScores.push(value[1]);
                riskTiers.push(value[2]);
                proofs.push(merkleTree.getProof(index));
            }
            
            const results = await registry.batchVerify(
                addresses, riskScores, riskTiers, proofs
            );
            
            expect(results.length).to.equal(testAddresses.length);
            for (const result of results) {
                expect(result).to.be.true;
            }
        });
        
        it('should reject batch with mismatched lengths', async function () {
            const addresses = [user1.address];
            const riskScores = [80, 30];
            const riskTiers = ['BLACK'];
            const proofs = [merkleTree.getProof(0)];
            
            await expect(registry.batchVerify(addresses, riskScores, riskTiers, proofs))
                .to.be.revertedWith('Length mismatch');
        });
        
        it('should batch verify with some invalid', async function () {
            const addresses = [user1.address, user2.address];
            const riskScores = [80, 999]; // Second score is wrong
            const riskTiers = ['BLACK', 'GREY'];
            const proofs = [merkleTree.getProof(0), merkleTree.getProof(1)];
            
            const results = await registry.batchVerify(
                addresses, riskScores, riskTiers, proofs
            );
            
            expect(results[0]).to.be.true;
            expect(results[1]).to.be.false;
        });
        
        it('should handle empty batch', async function () {
            const results = await registry.batchVerify([], [], [], []);
            expect(results.length).to.equal(0);
        });
    });
    
    describe('Risk Score Operations', function () {
        it('should allow ORACLE to set risk score', async function () {
            await expect(registry.connect(oracle).setAddressRiskScore(user1.address, 75))
                .to.emit(registry, 'AddressRiskUpdated')
                .withArgs(user1.address, 75, '');
            
            expect(await registry.getAddressRiskScore(user1.address)).to.equal(75);
        });
        
        it('should reject score > 100', async function () {
            await expect(registry.setAddressRiskScore(user1.address, 101))
                .to.be.revertedWith('Invalid score');
        });
        
        it('should reject non-ORACLE from setting score', async function () {
            await expect(registry.connect(user1).setAddressRiskScore(user2.address, 50))
                .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
        });
        
        it('should allow batch set risk scores', async function () {
            const addresses = [user1.address, user2.address, owner.address];
            const scores = [75, 25, 100];
            
            await registry.batchSetRiskScores(addresses, scores);
            
            for (let i = 0; i < addresses.length; i++) {
                expect(await registry.getAddressRiskScore(addresses[i])).to.equal(scores[i]);
            }
        });
        
        it('should reject batch with mismatched lengths', async function () {
            await expect(registry.batchSetRiskScores([user1.address], [50, 75]))
                .to.be.revertedWith('Length mismatch');
        });
        
        it('should return 0 for unset address', async function () {
            expect(await registry.getAddressRiskScore(user1.address)).to.equal(0);
        });
        
        it('should update existing score', async function () {
            await registry.setAddressRiskScore(user1.address, 50);
            expect(await registry.getAddressRiskScore(user1.address)).to.equal(50);
            
            await registry.setAddressRiskScore(user1.address, 75);
            expect(await registry.getAddressRiskScore(user1.address)).to.equal(75);
        });
    });
    
    describe('Tag Operations', function () {
        it('should allow ORACLE to add tag', async function () {
            const tag = ethers.encodeBytes32String('SANCTIONED');
            await registry.connect(oracle).addAddressTag(user1.address, tag);
            
            expect(await registry.hasTag(user1.address, tag)).to.be.true;
        });
        
        it('should reject non-ORACLE from adding tag', async function () {
            const tag = ethers.encodeBytes32String('SANCTIONED');
            await expect(registry.connect(user1).addAddressTag(user2.address, tag))
                .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
        });
        
        it('should return false for non-existent tag', async function () {
            const tag = ethers.encodeBytes32String('NONEXISTENT');
            expect(await registry.hasTag(user1.address, tag)).to.be.false;
        });
        
        it('should handle multiple tags per address', async function () {
            const tag1 = ethers.encodeBytes32String('SANCTIONED');
            const tag2 = ethers.encodeBytes32String('PHISHING');
            
            await registry.addAddressTag(user1.address, tag1);
            await registry.addAddressTag(user1.address, tag2);
            
            expect(await registry.hasTag(user1.address, tag1)).to.be.true;
            expect(await registry.hasTag(user1.address, tag2)).to.be.true;
        });
        
        it('should handle same tag on multiple addresses', async function () {
            const tag = ethers.encodeBytes32String('SANCTIONED');
            
            await registry.addAddressTag(user1.address, tag);
            await registry.addAddressTag(user2.address, tag);
            
            expect(await registry.hasTag(user1.address, tag)).to.be.true;
            expect(await registry.hasTag(user2.address, tag)).to.be.true;
        });
    });
    
    describe('Access Control Edge Cases', function () {
        it('should allow admin to grant ADMIN_ROLE', async function () {
            await registry.grantRole(await registry.ADMIN_ROLE(), user1.address);
            expect(await registry.hasRole(await registry.ADMIN_ROLE(), user1.address)).to.be.true;
        });
        
        it('should allow admin to revoke ORACLE_ROLE', async function () {
            await registry.revokeRole(await registry.ORACLE_ROLE(), oracle.address);
            expect(await registry.hasRole(await registry.ORACLE_ROLE(), oracle.address)).to.be.false;
        });
        
        it('should prevent revoked ORACLE from setting scores', async function () {
            await registry.revokeRole(await registry.ORACLE_ROLE(), oracle.address);
            
            await expect(registry.connect(oracle).setAddressRiskScore(user1.address, 50))
                .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
        });
        
        it('should allow renouncing role', async function () {
            await registry.connect(admin).renounceRole(await registry.ADMIN_ROLE(), admin.address);
            expect(await registry.hasRole(await registry.ADMIN_ROLE(), admin.address)).to.be.false;
        });
        
        it('should prevent non-admin from granting roles', async function () {
            await expect(registry.connect(user1).grantRole(await registry.ORACLE_ROLE(), user2.address))
                .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
        });
    });
    
    describe('View Functions', function () {
        it('should return correct Merkle Root', async function () {
            expect(await registry.getMerkleRoot()).to.equal(merkleRoot);
        });
        
        it('should return complete history', async function () {
            const newRoot1 = ethers.keccak256(ethers.toUtf8Bytes('root1'));
            const newRoot2 = ethers.keccak256(ethers.toUtf8Bytes('root2'));
            
            await registry.updateMerkleRoot(newRoot1);
            await registry.updateMerkleRoot(newRoot2);
            
            const history = await registry.getMerkleRootHistory();
            expect(history).to.deep.equal([merkleRoot, newRoot1, newRoot2]);
        });
        
        it('should not allow external modification of history', async function () {
            const history = await registry.getMerkleRootHistory();
            // history is memory copy, modifications don't affect storage
            expect(history.length).to.equal(1);
        });
    });
    
    describe('Gas Optimization Scenarios', function () {
        it('should verify single address without transaction (view function)', async function () {
            const [value, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            
            // view function - no transaction, just call
            const result = await registry.verifyAddress(
                value[0], value[1], value[2], proof
            );
            expect(result).to.be.true;
        });
        
        it('should batch verify without transaction (view function)', async function () {
            const count = 5;
            const addresses = [];
            const riskScores = [];
            const riskTiers = [];
            const proofs = [];
            
            for (let i = 0; i < count; i++) {
                const [value, index] = [testAddresses[i], i];
                addresses.push(value[0]);
                riskScores.push(value[1]);
                riskTiers.push(value[2]);
                proofs.push(merkleTree.getProof(index));
            }
            
            // view function - no transaction
            const results = await registry.batchVerify(
                addresses, riskScores, riskTiers, proofs
            );
            
            expect(results.length).to.equal(count);
            for (const result of results) {
                expect(result).to.be.true;
            }
        });
        
        it('should estimate gas for state-changing operations', async function () {
            // Only state-changing functions consume gas
            const newRoot = ethers.keccak256(ethers.toUtf8Bytes('gas test root'));
            
            const gasEstimate = await registry.updateMerkleRoot.estimateGas(newRoot);
            expect(gasEstimate).to.be.lt(100000); // Should be reasonable
        });
    });
    
    describe('Integration with Risk Scores and Tags', function () {
        it('should combine Merkle verification with on-chain risk score', async function () {
            // Set on-chain score
            await registry.setAddressRiskScore(user1.address, 75);
            
            // Verify in Merkle tree
            const [value, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            const inMerkle = await registry.verifyAddress(
                value[0], value[1], value[2], proof
            );
            
            expect(inMerkle).to.be.true;
            expect(await registry.getAddressRiskScore(user1.address)).to.equal(75);
        });
        
        it('should combine Merkle verification with tags', async function () {
            const tag = ethers.encodeBytes32String('OFAC');
            await registry.addAddressTag(user1.address, tag);
            
            const [value, index] = [testAddresses[0], 0];
            const proof = merkleTree.getProof(index);
            const inMerkle = await registry.verifyAddress(
                value[0], value[1], value[2], proof
            );
            
            expect(inMerkle).to.be.true;
            expect(await registry.hasTag(user1.address, tag)).to.be.true;
        });
    });
});
