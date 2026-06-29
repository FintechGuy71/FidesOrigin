const hre = require('hardhat');

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Releasing All Vault Records          ║');
    console.log('╚════════════════════════════════════════╝\n');

    const [deployer] = await hre.ethers.getSigners();
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const vaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';

    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    const vault = await hre.ethers.getContractAt('QuarantineVault', vaultAddress);

    // ========== Step 1: 查看记录 ==========
    const recordCount = await vault.getRecordCount();
    console.log(`Total records: ${recordCount}`);

    if (recordCount == 0) {
        console.log('✅ No records.');
        return;
    }

    const records = await vault.getAllRecords(0, 100);
    
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        console.log(`\n[${i}] Owner: ${r.originalOwner}`);
        console.log(`    Amount: ${hre.ethers.formatUnits(r.amount, 18)} TUSD`);
        console.log(`    Released: ${r.released}`);
        
        if (!r.released && r.amount > 0) {
            const recordId = await vault.allRecordIds(i);
            console.log(`    Record ID: ${recordId}`);
            console.log(`    → Releasing...`);
            
            try {
                // 如果记录属于 wallet，通过 wallet 释放
                if (r.originalOwner.toLowerCase() === walletAddress.toLowerCase()) {
                    const tx = await wallet.releaseQuarantinedFunds(recordId);
                    await tx.wait();
                    console.log(`    ✅ Released via wallet`);
                } else {
                    // 否则直接通过 vault 释放（需要 RELEASE_ROLE）
                    const tx = await vault.release(recordId, r.originalOwner);
                    await tx.wait();
                    console.log(`    ✅ Released directly`);
                }
            } catch (e) {
                console.log(`    ⚠️ Failed: ${e.message.slice(0, 100)}`);
            }
        }
    }

    // ========== Step 2: 验证 ==========
    console.log('\n✅ Verification...');
    const tokenAddress = records.length > 0 ? records[records.length - 1].token : '0x9c9f4d5775BAf5DB2f4E8f8cD1C5ca695D5c7BDb';
    const token = await hre.ethers.getContractAt('TestUSD', tokenAddress);
    const vaultBalance = await token.balanceOf(vaultAddress);
    const walletBalance = await token.balanceOf(walletAddress);
    const status = await wallet.getFundStatus(tokenAddress);

    console.log(`   Wallet: ${hre.ethers.formatUnits(walletBalance, 18)} TUSD`);
    console.log(`   Vault:  ${hre.ethers.formatUnits(vaultBalance, 18)} TUSD`);
    console.log(`   Status: total=${status[0]}, available=${status[1]}, frozen=${status[2]}, pending=${status[3]}`);

    if (vaultBalance == 0) {
        console.log('\n🎉 Vault is now empty!');
    } else {
        console.log('\n⚠️ Vault still has funds.');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('🏁 Done!');
    console.log('═══════════════════════════════════════');
}

main().catch(console.error);
