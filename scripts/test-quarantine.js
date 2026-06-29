const hre = require('hardhat');

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Quarantine Test - Full Flow          ║');
    console.log('╚════════════════════════════════════════╝\n');

    const [deployer] = await hre.ethers.getSigners();
    console.log(`🔑 Tester: ${deployer.address}`);

    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    // 新部署的 TestUSD
    const tokenAddress = '0x9c9f4d5775BAf5DB2f4E8f8cD1C5ca695D5c7BDb';
    const riskRegistry = '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3';
    const quarantineVault = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';

    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    const token = await hre.ethers.getContractAt('TestUSD', tokenAddress);
    const registry = await hre.ethers.getContractAt('RiskRegistry', riskRegistry);
    const vault = await hre.ethers.getContractAt('QuarantineVault', quarantineVault);

    // ========== Step 1: 基础检查 ==========
    console.log('\n📋 Step 1: Basic checks...');
    const deployerBalance = await token.balanceOf(deployer.address);
    console.log(`   Deployer TUSD balance: ${hre.ethers.formatUnits(deployerBalance, 18)}`);

    const complianceEnabled = await wallet.complianceEnabled();
    console.log(`   Wallet complianceEnabled: ${complianceEnabled}`);

    // ========== Step 2: 转账 ERC20 到钱包 ==========
    console.log('\n💸 Step 2: Transferring TUSD to wallet...');
    const transferAmount = hre.ethers.parseUnits('10', 18);
    console.log(`   Transferring ${hre.ethers.formatUnits(transferAmount, 18)} TUSD...`);
    
    try {
        const tx = await token.transfer(walletAddress, transferAmount);
        await tx.wait();
        console.log('   ✅ ERC20 transfer succeeded');
    } catch (e) {
        console.log('   ❌ ERC20 transfer failed:', e.message);
        return;
    }

    const walletBalance = await token.balanceOf(walletAddress);
    console.log(`   Wallet TUSD balance: ${hre.ethers.formatUnits(walletBalance, 18)}`);

    // ========== Step 3: 触发隔离（模拟 Keeper） ==========
    console.log('\n🔒 Step 3: Triggering quarantine...');
    
    if (walletBalance > 0) {
        try {
            const operator = await wallet.operator();
            console.log(`   Operator: ${operator}`);
            console.log(`   Is deployer: ${operator.toLowerCase() === deployer.address.toLowerCase()}`);

            const status = await wallet.getFundStatus(tokenAddress);
            console.log(`   Fund status: total=${status[0]}, available=${status[1]}, frozen=${status[2]}, pending=${status[3]}`);

            if (operator.toLowerCase() === deployer.address.toLowerCase()) {
                const tx = await wallet.quarantineFunds(
                    tokenAddress,
                    walletBalance,
                    'Test: quarantine after detection of sanctioned sender'
                );
                await tx.wait();
                console.log('   ✅ Funds quarantined!');
            }
        } catch (e) {
            console.log('   ⚠️ Quarantine failed:', e.message);
        }
    }

    // ========== Step 4: 验证 ==========
    console.log('\n✅ Step 4: Verifying quarantine...');
    const finalWalletBalance = await token.balanceOf(walletAddress);
    const vaultBalance = await token.balanceOf(quarantineVault);
    const status = await wallet.getFundStatus(tokenAddress);

    console.log(`   Wallet: ${hre.ethers.formatUnits(finalWalletBalance, 18)} TUSD`);
    console.log(`   Vault:  ${hre.ethers.formatUnits(vaultBalance, 18)} TUSD`);
    console.log(`   Status: total=${status[0]}, available=${status[1]}, frozen=${status[2]}, pending=${status[3]}`);

    if (vaultBalance > 0) {
        console.log('\n🎉 QUARANTINE TEST PASSED!');
        
        // 检查隔离记录
        console.log('\n📋 Step 5: Checking quarantine records...');
        try {
            const records = await vault.getRecordsByWallet(walletAddress);
            console.log(`   Records count: ${records.length}`);
            for (let i = 0; i < records.length; i++) {
                const r = records[i];
                console.log(`   [${i}] Token: ${r.token}, Amount: ${hre.ethers.formatUnits(r.amount, 18)}, Status: ${r.status}`);
            }
        } catch (e) {
            console.log('   getRecordsByWallet error:', e.message);
        }
    } else {
        console.log('\n⚠️ No funds in vault');
    }

    // ========== Step 5: 测试释放隔离资金 ==========
    if (vaultBalance > 0) {
        console.log('\n🔓 Step 5: Testing release...');
        try {
            const records = await vault.getRecordsByWallet(walletAddress);
            if (records.length > 0) {
                const recordId = records[records.length - 1].recordId;
                console.log(`   Releasing record ${recordId}...`);
                
                const tx = await wallet.releaseQuarantinedFunds(recordId);
                await tx.wait();
                console.log('   ✅ Funds released!');
                
                const afterReleaseWallet = await token.balanceOf(walletAddress);
                const afterReleaseVault = await token.balanceOf(quarantineVault);
                console.log(`   After release - Wallet: ${hre.ethers.formatUnits(afterReleaseWallet, 18)}, Vault: ${hre.ethers.formatUnits(afterReleaseVault, 18)}`);
            }
        } catch (e) {
            console.log('   ⚠️ Release failed:', e.message);
        }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('🏁 Test complete!');
    console.log('═══════════════════════════════════════');
}

main().catch(console.error);