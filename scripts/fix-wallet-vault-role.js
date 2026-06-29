const hre = require('hardhat');

async function main() {
    console.log('Granting QUARANTINE_ROLE to wallet contract...');
    const [deployer] = await hre.ethers.getSigners();
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const vaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
    
    const vault = await hre.ethers.getContractAt('QuarantineVault', vaultAddress);
    
    const quarantineRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('QUARANTINE_ROLE'));
    
    const hasRole = await vault.hasRole(quarantineRole, walletAddress);
    console.log(`Wallet has QUARANTINE_ROLE: ${hasRole}`);
    
    if (!hasRole) {
        const tx = await vault.grantRole(quarantineRole, walletAddress);
        await tx.wait();
        console.log('✅ QUARANTINE_ROLE granted to wallet');
    }
    
    // Also check operator (for release)
    const releaseRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('RELEASE_ROLE'));
    const operator = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress).operator();
    const hasRelease = await vault.hasRole(releaseRole, operator);
    console.log(`Operator has RELEASE_ROLE: ${hasRelease}`);
    
    if (!hasRelease) {
        const tx = await vault.grantRole(releaseRole, operator);
        await tx.wait();
        console.log('✅ RELEASE_ROLE granted to operator');
    }
    
    console.log('\n✅ Done!');
}

main().catch(console.error);
