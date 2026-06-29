const hre = require('hardhat');

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Cleaning Up Quarantine State         ║');
    console.log('╚════════════════════════════════════════╝\n');

    const [deployer] = await hre.ethers.getSigners();
    console.log(`🔑 Cleaner: ${deployer.address}`);

    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
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
    const recordCount = await vault.getRecordCount();

    console.log(`   Wallet TUSD: ${hre.ethers.formatUnits(walletBalance, 18)}`);
    console.log(`   Vault TUSD:  ${hre.ethers.formatUnits(vaultBalance, 18)}`);
    console.log(`   Fund status: total=${status[0]}, available=${status[1]}, frozen=${status[2]}, pending=${status[3]}`);
    console.log(`   Vault records: ${recordCount}`);

    if (recordCount == 0) {
        console.log('\n✅ No records to clean up.');
        return;
    }

    // ========== Step 2: 查询所有记录 ==========
    console.log('\n📋 Step 2: Reading all records...');
    const records = await vault.getAllRecords(0, 100);
    
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        console.log(`   [${i}] ID: ${r.recordId?.toString() || 'unknown'}`);
        console.log(`        Owner: ${r.originalOwner}, Token: ${r.token}`);
        console.log(`        Amount: ${hre.ethers.formatUnits(r.amount, 18)}, Released: ${r.released}`);
    }

    // ========== Step 3: 释放未释放的记录 ==========
    console.log('\n🔓 Step 3: Releasing records...');
    let releasedCount = 0;
    
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (!r.released && r.amount > 0) {
            try {
                // 获取 recordId
                const recordId = await vault.allRecordIds(i);
                console.log(`   Releasing record ${recordId} via wallet...`);
                
                // 通过 wallet 释放（wallet 会调用 vault.release）
                const tx = await wallet.releaseQuarantinedFunds(recordId);
                await tx.wait();
                console.log(`   ✅ Released!`);
                releasedCount++;
            } catch (e) {
                console.log(`   ⚠️ Failed to release record ${i}: ${e.message.slice(0, 100)}`);
                
                // 如果 wallet 释放失败，尝试直接通过 vault 释放
                try {
                    const recordId = await vault.allRecordIds(i);
                    console.log(`   Trying direct vault.release...`);
                    const tx = await vault.release(recordId, walletAddress);
                    await tx.wait();
                    console.log(`   ✅ Direct release succeeded!`);
                    releasedCount++;
                } catch (e2) {
                    console.log(`   ❌ Direct release also failed: ${e2.message.slice(0, 100)}`);
                }
            }
        }
    }

    console.log(`\n   Released ${releasedCount} records.`);

    // ========== Step 4: 验证清理后状态 ==========
    console.log('\n✅ Step 4: Verification...');
    const finalWalletBalance = await token.balanceOf(walletAddress);
    const finalVaultBalance = await token.balanceOf(vaultAddress);
    const finalStatus = await wallet.getFundStatus(tokenAddress);

    console.log(`   Wallet TUSD: ${hre.ethers.formatUnits(finalWalletBalance, 18)}`);
    console.log(`   Vault TUSD:  ${hre.ethers.formatUnits(finalVaultBalance, 18)}`);
    console.log(`   Fund status: total=${finalStatus[0]}, available=${finalStatus[1]}, frozen=${finalStatus[2]}, pending=${finalStatus[3]}`);

    if (finalVaultBalance == 0) {
        console.log('\n🎉 Cleanup complete! Vault is empty.');
    } else {
        console.log('\n⚠️ Vault still has funds. Some records may not have been released.');
    }

    // ========== Step 5: 重置 wallet 的 frozenBalances（如果还有残留）==========
    if (finalStatus[2] > 0 && finalVaultBalance == 0) {
        console.log('\n🧹 Step 5: Syncing wallet balances...');
        // 调用 wallet 的某个函数来同步？或者手动通过内部调用
        // 实际上，由于 vault 已经空了，如果 frozen > 0 说明记账不一致
        // 这种情况下需要 owner 手动调用某个函数来重置
        console.log('   Note: frozenBalances still > 0 but vault is empty.');
        console.log('   This is a ledger inconsistency from failed quarantine attempts.');
        console.log('   As owner, you can transferToken out to reset availableBalances.');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('🏁 Cleanup complete!');
    console.log('═══════════════════════════════════════');
}

main().catch(console.error);
