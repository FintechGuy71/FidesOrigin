const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   部署带隔离功能的 CompliantSmartWallet ║');
    console.log('╚════════════════════════════════════════╝\n');

    const [deployer] = await hre.ethers.getSigners();
    console.log(`🔑 Deployer: ${deployer.address}`);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

    // 读取已有部署地址
    const deploymentFile = path.join(__dirname, '..', 'deployments', 'sepolia-latest.json');
    const existing = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    const complianceEngine = existing.contracts.ComplianceEngine.address;
    const complianceEngineV1 = existing.contracts.ComplianceEngine.address; // 旧接口也用同一个
    
    console.log('📋 Existing contracts:');
    console.log(`   ComplianceEngine: ${complianceEngine}\n`);

    // 1. 部署 QuarantineVault
    console.log('📦 Deploying QuarantineVault...');
    const QuarantineVault = await hre.ethers.getContractFactory('QuarantineVault');
    const quarantineVault = await QuarantineVault.deploy();
    await quarantineVault.waitForDeployment();
    const quarantineVaultAddress = await quarantineVault.getAddress();
    console.log(`   ✅ QuarantineVault: ${quarantineVaultAddress}`);

    // 2. 部署 CompliantSmartWallet（新版，带隔离功能）
    // constructor(address _owner, address _complianceEngine, address _fidesCompliance, address _operator)
    console.log('\n📦 Deploying CompliantSmartWallet (v2 with quarantine)...');
    const CompliantSmartWallet = await hre.ethers.getContractFactory('CompliantSmartWallet');
    const wallet = await CompliantSmartWallet.deploy(
        deployer.address,           // _owner
        complianceEngineV1,         // _complianceEngine (旧接口)
        complianceEngine,           // _fidesCompliance (新接口)
        deployer.address            // _operator (keeper)
    );
    await wallet.waitForDeployment();
    const walletAddress = await wallet.getAddress();
    console.log(`   ✅ CompliantSmartWallet: ${walletAddress}`);

    // 3. 设置 QuarantineVault
    console.log('\n⚙️ Configuring wallet...');
    await wallet.setQuarantineVault(quarantineVaultAddress);
    console.log(`   ✅ QuarantineVault set`);
    
    await wallet.toggleAutoQuarantine(true);
    console.log(`   ✅ Auto-quarantine enabled`);
    
    // 4. 配置 QuarantineVault 权限
    const quarantineRole = await quarantineVault.QUARANTINE_ROLE();
    await quarantineVault.grantRole(quarantineRole, walletAddress);
    console.log(`   ✅ Wallet granted QUARANTINE_ROLE`);
    
    const operatorRole = await quarantineVault.OPERATOR_ROLE();
    await quarantineVault.grantRole(operatorRole, deployer.address);
    console.log(`   ✅ Deployer granted OPERATOR_ROLE`);

    // 5. 保存部署信息
    const deploymentData = {
        network: 'sepolia',
        chainId: 11155111,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            ...existing.contracts,
            QuarantineVault: {
                address: quarantineVaultAddress,
                note: 'Deployed with auto-quarantine support'
            },
            CompliantSmartWalletV2: {
                address: walletAddress,
                note: 'v2 with quarantine, auto-interception, spend control'
            }
        }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(`\n💾 Deployment saved to ${deploymentFile}`);

    // 6. 更新 .env 中的 WALLET_LIST
    console.log('\n📝 Update .env:');
    console.log(`   WALLET_LIST=${walletAddress}`);
    console.log(`   TOKEN_LIST=${existing.contracts.CompliantStableCoin.address}`);

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Deployment complete!');
    console.log('═══════════════════════════════════════');
    console.log('\nNext steps:');
    console.log('1. Update .env WALLET_LIST with new address');
    console.log('2. Restart keeper: scripts/start-keeper.sh restart');
    console.log('3. Test: send tokens from blacklisted address to wallet');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
