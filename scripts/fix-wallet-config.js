const hre = require('hardhat');

async function main() {
    console.log('Fixing CompliantSmartWallet configuration...');
    const [deployer] = await hre.ethers.getSigners();
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const riskRegistry = '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3';
    
    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    
    // 1. 暂时禁用合规检查，让 receive() 正常工作
    console.log('\n1. Disabling compliance checks...');
    const currentEnabled = await wallet.complianceEnabled();
    console.log(`   Current: complianceEnabled=${currentEnabled}`);
    
    if (currentEnabled) {
        const tx = await wallet.toggleCompliance(false);
        await tx.wait();
        console.log('   ✅ Compliance disabled');
    }
    
    // 2. 修正 fidesCompliance 地址
    console.log('\n2. Setting correct fidesCompliance address...');
    const currentFides = await wallet.fidesCompliance();
    console.log(`   Current: ${currentFides}`);
    console.log(`   Target:  ${riskRegistry}`);
    
    if (currentFides.toLowerCase() !== riskRegistry.toLowerCase()) {
        const tx = await wallet.setFidesCompliance(riskRegistry);
        await tx.wait();
        console.log('   ✅ fidesCompliance updated');
    }
    
    // 3. 验证
    console.log('\n3. Verification...');
    const newEnabled = await wallet.complianceEnabled();
    const newFides = await wallet.fidesCompliance();
    console.log(`   complianceEnabled: ${newEnabled}`);
    console.log(`   fidesCompliance:   ${newFides}`);
    
    console.log('\n✅ Fix complete!');
}

main().catch(console.error);
