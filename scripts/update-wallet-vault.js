const hre = require('hardhat');

async function main() {
    console.log('Updating wallet configuration...');
    const [deployer] = await hre.ethers.getSigners();
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const newVaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
    
    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    const vault = await hre.ethers.getContractAt('QuarantineVault', newVaultAddress);
    
    // 1. 更新 wallet 的 quarantineVault 地址
    console.log('\n1. Setting new quarantineVault...');
    const currentVault = await wallet.quarantineVault();
    console.log(`   Current: ${currentVault}`);
    
    if (currentVault.toLowerCase() !== newVaultAddress.toLowerCase()) {
        const tx = await wallet.setQuarantineVault(newVaultAddress);
        await tx.wait();
        console.log('   ✅ Updated');
    }
    
    // 2. 给 wallet operator 授权 QUARANTINE_ROLE
    console.log('\n2. Granting QUARANTINE_ROLE to wallet operator...');
    const operator = await wallet.operator();
    console.log(`   Operator: ${operator}`);
    
    const hasRole = await vault.hasRole(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('QUARANTINE_ROLE')),
        operator
    );
    console.log(`   Has QUARANTINE_ROLE: ${hasRole}`);
    
    if (!hasRole) {
        const tx = await vault.grantRole(
            hre.ethers.keccak256(hre.ethers.toUtf8Bytes('QUARANTINE_ROLE')),
            operator
        );
        await tx.wait();
        console.log('   ✅ Role granted');
    }
    
    // 3. 给 deployer 授权 RELEASE_ROLE（用于测试释放）
    console.log('\n3. Granting RELEASE_ROLE to deployer...');
    const releaseRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('RELEASE_ROLE'));
    const hasRelease = await vault.hasRole(releaseRole, deployer.address);
    
    if (!hasRelease) {
        const tx = await vault.grantRole(releaseRole, deployer.address);
        await tx.wait();
        console.log('   ✅ RELEASE_ROLE granted');
    }
    
    // 4. 验证
    console.log('\n4. Verification...');
    const newVault = await wallet.quarantineVault();
    console.log(`   quarantineVault: ${newVault}`);
    
    const opHasRole = await vault.hasRole(
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes('QUARANTINE_ROLE')),
        operator
    );
    console.log(`   operator has QUARANTINE_ROLE: ${opHasRole}`);
    
    console.log('\n✅ Configuration updated!');
}

main().catch(console.error);
