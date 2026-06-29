const hre = require('hardhat');

async function main() {
    console.log('⚙️ Configuring deployed contracts...\n');

    const [deployer] = await hre.ethers.getSigners();
    
    // 已部署地址
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const quarantineVaultAddress = '0x787CC3b07D59830DFBF0c7D93430E241c8aEf762';
    
    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    const vault = await hre.ethers.getContractAt('QuarantineVault', quarantineVaultAddress);

    // 等待几秒确保前一个交易确认
    console.log('⏳ Waiting for pending transactions...');
    await new Promise(r => setTimeout(r, 15000));

    // 1. Toggle auto-quarantine
    console.log('\n1. Enabling auto-quarantine...');
    try {
        const tx1 = await wallet.toggleAutoQuarantine(true, { nonce: await deployer.getNonce() });
        await tx1.wait();
        console.log('   ✅ Auto-quarantine enabled');
    } catch (e) {
        console.log('   ⚠️ Already enabled or failed:', e.message);
    }

    // 2. Grant roles on QuarantineVault
    console.log('\n2. Granting roles on QuarantineVault...');
    try {
        const quarantineRole = await vault.QUARANTINE_ROLE();
        const tx2 = await vault.grantRole(quarantineRole, walletAddress, { nonce: await deployer.getNonce() });
        await tx2.wait();
        console.log('   ✅ Wallet granted QUARANTINE_ROLE');
    } catch (e) {
        console.log('   ⚠️ Failed:', e.message);
    }

    try {
        const operatorRole = await vault.OPERATOR_ROLE();
        const tx3 = await vault.grantRole(operatorRole, deployer.address, { nonce: await deployer.getNonce() });
        await tx3.wait();
        console.log('   ✅ Deployer granted OPERATOR_ROLE');
    } catch (e) {
        console.log('   ⚠️ Failed:', e.message);
    }

    console.log('\n✅ Configuration complete!');
    console.log(`\n📝 Update .env:`);
    console.log(`   WALLET_LIST=${walletAddress}`);
}

main().catch(console.error);
