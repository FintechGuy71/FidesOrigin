/**
 * V3.0.2 Upgrade Script — Security audit fixes
 *
 * Upgrades UUPS proxies on Sepolia:
 *   - ComplianceEngine (Critical: Timelock fix, interface implementation, events)
 *   - PolicyEngine (wallet policy check in evaluateOperation)
 *
 * Direct deploy (non-proxy) contracts with changes:
 *   - FidesCompliance (caller validation, fail-closed)
 *   - QuarantineVault (ETH release, pagination)
 *   - MerkleRiskRegistry (deadline parameter)
 *   - FidesOriginTimelock (super.cancel fix)
 *   - FidesBridgeReceiver (timestamp tolerance)
 *   - RiskOracleConsensus (MAX_ORACLES)
 *   - CompliantSmartWalletBase (try/catch)
 *
 * Usage:
 *   ADMIN_PRIVATE_KEY=0x... npx hardhat run scripts/upgrade-v3-sepolia.js --network sepolia
 */

const { ethers } = require("hardhat");

// Existing proxy addresses on Sepolia (from deployments/sepolia-latest.json)
const PROXIES = {
    ComplianceEngine: "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
    PolicyEngine: "0x87089F67A61F9643796AE154663A6a9F21196b38",
    RiskRegistry: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log('═══════════════════════════════════════');
    console.log('  V3.0.2 Upgrade — Sepolia');
    console.log('═══════════════════════════════════════');
    console.log('Signer:', signer.address);
    console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(signer.address)), 'ETH');
    console.log('');

    const results = {};

    // ============ Upgrade ComplianceEngine ============
    console.log('━━━ ComplianceEngine ━━━');
    try {
        const ComplianceEngine = await ethers.getContractFactory('ComplianceEngine');
        const newImpl = await ComplianceEngine.deploy();
        await newImpl.waitForDeployment();
        const newImplAddr = await newImpl.getAddress();
        console.log('New implementation deployed:', newImplAddr);

        // Upgrade proxy
        const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external payable'];
        const proxy = new ethers.Contract(PROXIES.ComplianceEngine, proxyAbi, signer);
        const tx = await proxy.upgradeToAndCall(newImplAddr, '0x', { gasLimit: 1000000 });
        console.log('Upgrade tx:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ ComplianceEngine upgraded! Block:', receipt.blockNumber, 'Gas:', receipt.gasUsed.toString());
        results.ComplianceEngine = { impl: newImplAddr, tx: tx.hash, status: 'success' };
    } catch (e) {
        console.error('❌ ComplianceEngine upgrade failed:', e.message);
        results.ComplianceEngine = { status: 'failed', error: e.message };
    }
    console.log('');

    // ============ Upgrade PolicyEngine ============
    console.log('━━━ PolicyEngine ━━━');
    try {
        const PolicyEngine = await ethers.getContractFactory('PolicyEngine');
        const newImpl = await PolicyEngine.deploy();
        await newImpl.waitForDeployment();
        const newImplAddr = await newImpl.getAddress();
        console.log('New implementation deployed:', newImplAddr);

        const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external payable'];
        const proxy = new ethers.Contract(PROXIES.PolicyEngine, proxyAbi, signer);
        const tx = await proxy.upgradeToAndCall(newImplAddr, '0x', { gasLimit: 1000000 });
        console.log('Upgrade tx:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ PolicyEngine upgraded! Block:', receipt.blockNumber, 'Gas:', receipt.gasUsed.toString());
        results.PolicyEngine = { impl: newImplAddr, tx: tx.hash, status: 'success' };
    } catch (e) {
        console.error('❌ PolicyEngine upgrade failed:', e.message);
        results.PolicyEngine = { status: 'failed', error: e.message };
    }
    console.log('');

    // ============ Upgrade RiskRegistryV2 ============
    console.log('━━━ RiskRegistryV2 ━━━');
    try {
        const RiskRegistryV2 = await ethers.getContractFactory('RiskRegistryV2');
        const newImpl = await RiskRegistryV2.deploy();
        await newImpl.waitForDeployment();
        const newImplAddr = await newImpl.getAddress();
        console.log('New implementation deployed:', newImplAddr);

        const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external payable'];
        const proxy = new ethers.Contract(PROXIES.RiskRegistry, proxyAbi, signer);
        const tx = await proxy.upgradeToAndCall(newImplAddr, '0x', { gasLimit: 1000000 });
        console.log('Upgrade tx:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ RiskRegistryV2 upgraded! Block:', receipt.blockNumber, 'Gas:', receipt.gasUsed.toString());
        results.RiskRegistry = { impl: newImplAddr, tx: tx.hash, status: 'success' };
    } catch (e) {
        console.error('❌ RiskRegistryV2 upgrade failed:', e.message);
        results.RiskRegistry = { status: 'failed', error: e.message };
    }
    console.log('');

    // ============ Verify ============
    console.log('═══════════════════════════════════════');
    console.log('  Verification');
    console.log('═══════════════════════════════════════');
    for (const [name, result] of Object.entries(results)) {
        if (result.status === 'success') {
            console.log(`✅ ${name}: ${result.impl} (tx: ${result.tx})`);
        } else {
            console.log(`❌ ${name}: ${result.error}`);
        }
    }

    // Save deployment record
    const fs = require('fs');
    const record = {
        network: 'sepolia',
        chainId: 11155111,
        timestamp: new Date().toISOString(),
        deployer: signer.address,
        version: 'v3.0.2',
        upgrades: results,
    };
    const recordPath = 'deployments/sepolia-v3.0.2-upgrade.json';
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    console.log('\n📋 Deployment record saved:', recordPath);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
