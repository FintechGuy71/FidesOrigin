/**
 * ============================================================================
 * [DEPRECATED] 历史遗留脚本（v2.x/v3.0.x 时代），仅作历史记录保留。
 * 引用已弃用的旧合约地址/实现，切勿执行（会操作错误的合约）。
 * 现役部署/升级请参考 scripts/deploy-full.js（v3.1.0 权威脚本集）。
 * ============================================================================
 */

const { ethers } = require("hardhat");

// 现有部署地址
const PROXIES = {
    ComplianceEngine: "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
    PolicyEngine: "0x87089F67A61F9643796AE154663A6a9F21196b38",
    RiskRegistry: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
};

const NEW_DEPLOYMENTS = {
    ComplianceEngineImpl: "0x3B2977A90A9701EcB3F7521Df324b4A3FB10E3ed",
    FidesCompliance: "0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707",
    QuarantineVault: "0xF7c5c4DdcB0F868a6c271334131728CecA313DFb",
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log('Signer:', signer.address);
    console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(signer.address)), 'ETH');
    console.log('');

    // 1. 修复 RiskRegistry 升级 - 使用 UUPS 代理 ABI
    console.log('━━━ Fix 1: Upgrade RiskRegistry via UUPSProxy ━━━');
    try {
        const RiskRegistryFactory = await ethers.getContractFactory('RiskRegistry');
        const newImpl = await RiskRegistryFactory.deploy();
        await newImpl.waitForDeployment();
        const newImplAddr = await newImpl.getAddress();
        console.log('  New implementation:', newImplAddr);
        
        // UUPS 升级需要通过 proxy 的 upgradeTo 函数
        const proxyAbi = [
            'function upgradeTo(address newImplementation) external',
            'function owner() external view returns (address)'
        ];
        const proxy = new ethers.Contract(PROXIES.RiskRegistry, proxyAbi, signer);
        
        const tx = await proxy.upgradeTo(newImplAddr, { gasLimit: 1000000 });
        console.log('  Upgrade tx:', tx.hash);
        const receipt = await tx.wait();
        console.log('  ✅ RiskRegistry upgraded! Block:', receipt.blockNumber);
    } catch (e) {
        console.error('  ❌ RiskRegistry upgrade failed:', e.message);
    }

    // 2. 修复 PolicyEngine 升级
    console.log('\n━━━ Fix 2: Upgrade PolicyEngine via UUPSProxy ━━━');
    try {
        const PolicyEngineFactory = await ethers.getContractFactory('PolicyEngine');
        const newImpl = await PolicyEngineFactory.deploy();
        await newImpl.waitForDeployment();
        const newImplAddr = await newImpl.getAddress();
        console.log('  New implementation:', newImplAddr);
        
        const proxyAbi = [
            'function upgradeTo(address newImplementation) external',
            'function owner() external view returns (address)'
        ];
        const proxy = new ethers.Contract(PROXIES.PolicyEngine, proxyAbi, signer);
        
        const tx = await proxy.upgradeTo(newImplAddr, { gasLimit: 1000000 });
        console.log('  Upgrade tx:', tx.hash);
        const receipt = await tx.wait();
        console.log('  ✅ PolicyEngine upgraded! Block:', receipt.blockNumber);
    } catch (e) {
        console.error('  ❌ PolicyEngine upgrade failed:', e.message);
    }

    // 3. 修复 CompliantStableCoin 部署
    console.log('\n━━━ Fix 3: Deploy CompliantStableCoin ━━━');
    try {
        const CompliantStableCoinFactory = await ethers.getContractFactory('CompliantStableCoin');
        const stableCoin = await CompliantStableCoinFactory.deploy(
            "FidesOrigin USD",
            "fUSD",
            6,
            PROXIES.ComplianceEngine  // complianceEngine address
        );
        await stableCoin.waitForDeployment();
        const address = await stableCoin.getAddress();
        console.log('  Address:', address);
        console.log('  ✅ CompliantStableCoin deployed!');
    } catch (e) {
        console.error('  ❌ CompliantStableCoin deployment failed:', e.message);
    }

    console.log('\n✅ All fixes attempted!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
