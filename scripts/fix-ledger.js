const hre = require('hardhat');

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Fixing Wallet Ledger Inconsistency   ║');
    console.log('╚════════════════════════════════════════╝\n');

    const [deployer] = await hre.ethers.getSigners();
    const walletAddress = process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
    const tokenAddress = '0x9c9f4d5775BAf5DB2f4E8f8cD1C5ca695D5c7BDb';
    const vaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';

    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    const token = await hre.ethers.getContractAt('TestUSD', tokenAddress);
    const vault = await hre.ethers.getContractAt('QuarantineVault', vaultAddress);

    // ========== Step 1: 查看当前状态 ==========
    console.log('\n📋 Step 1: Current state...');
    const walletBalance = await token.balanceOf(walletAddress);
    const vaultBalance = await token.balanceOf(vaultAddress);
    const status = await wallet.getFundStatus(tokenAddress);

    console.log(`   Wallet TUSD: ${hre.ethers.formatUnits(walletBalance, 18)}`);
    console.log(`   Vault TUSD:  ${hre.ethers.formatUnits(vaultBalance, 18)}`);
    console.log(`   Fund status: total=${status[0]}, available=${status[1]}, frozen=${status[2]}, pending=${status[3]}`);

    // 不一致：frozen (40) > actual (30)，差 10 TUSD
    const inconsistency = status[2] - walletBalance;
    console.log(`   Inconsistency: frozen exceeds actual by ${hre.ethers.formatUnits(inconsistency, 18)} TUSD`);

    if (inconsistency <= 0) {
        console.log('\n✅ No inconsistency to fix.');
        return;
    }

    // ========== Step 2: 补齐差额到 wallet ==========
    console.log('\n💸 Step 2: Topping up wallet to match frozen balance...');
    const topUpAmount = inconsistency;
    console.log(`   Transferring ${hre.ethers.formatUnits(topUpAmount, 18)} TUSD to wallet...`);
    
    const tx1 = await token.transfer(walletAddress, topUpAmount);
    await tx1.wait();
    console.log('   ✅ Topped up');

    const newWalletBalance = await token.balanceOf(walletAddress);
    console.log(`   New wallet balance: ${hre.ethers.formatUnits(newWalletBalance, 18)} TUSD`);

    // ========== Step 3: 触发 quarantine + release 来同步状态 ==========
    console.log('\n🔒 Step 3: Triggering quarantine + release to sync...');
    
    // Quarantine 一笔小额资金（比如 1 TUSD）
    const syncAmount = hre.ethers.parseUnits('1', 18);
    console.log(`   Quarantining ${hre.ethers.formatUnits(syncAmount, 18)} TUSD...`);
    
    const tx2 = await wallet.quarantineFunds(tokenAddress, syncAmount, 'ledger sync');
    await tx2.wait();
    console.log('   ✅ Quarantined');

    // 获取新创建的 recordId
    const recordCount = await vault.getRecordCount();
    const recordId = await vault.allRecordIds(Number(recordCount) - 1);
    console.log(`   New record ID: ${recordId}`);

    // 立即释放
    console.log(`   Releasing record...`);
    const tx3 = await wallet.releaseQuarantinedFunds(recordId);
    await tx3.wait();
    console.log('   ✅ Released');

    // ========== Step 4: 验证 ==========
    console.log('\n✅ Step 4: Verification...');
    const finalWalletBalance = await token.balanceOf(walletAddress);
    const finalVaultBalance = await token.balanceOf(vaultAddress);
    const finalStatus = await wallet.getFundStatus(tokenAddress);

    console.log(`   Wallet TUSD: ${hre.ethers.formatUnits(finalWalletBalance, 18)}`);
    console.log(`   Vault TUSD:  ${hre.ethers.formatUnits(finalVaultBalance, 18)}`);
    console.log(`   Fund status: total=${finalStatus[0]}, available=${finalStatus[1]}, frozen=${finalStatus[2]}, pending=${finalStatus[3]}`);

    const finalInconsistency = finalStatus[2] - finalWalletBalance;
    if (finalInconsistency == 0) {
        console.log('\n🎉 Ledger is now consistent!');
    } else {
        console.log(`\n⚠️ Still inconsistent by ${hre.ethers.formatUnits(finalInconsistency, 18)} TUSD`);
    }

    // ========== Step 5: 把多余资金转回 deployer ==========
    // 如果 wallet 有多余资金，通过 callContract 转出
    if (finalWalletBalance > 0 && finalStatus[1] > 0) {
        console.log('\n💸 Step 5: Withdrawing available funds...');
        const withdrawAmount = finalStatus[1];
        console.log(`   Withdrawing ${hre.ethers.formatUnits(withdrawAmount, 18)} TUSD...`);
        
        const tx4 = await wallet.transferToken(tokenAddress, deployer.address, withdrawAmount);
        await tx4.wait();
        console.log('   ✅ Withdrawn');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('🏁 Fix complete!');
    console.log('═══════════════════════════════════════');
}

main().catch(console.error);
