const hre = require('hardhat');

async function main() {
    console.log('Granting RELEASE_ROLE to wallet contract...');
    const [deployer] = await hre.ethers.getSigners();
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const vaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
    
    const vault = await hre.ethers.getContractAt('QuarantineVault', vaultAddress);
    
    const releaseRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('RELEASE_ROLE'));
    
    const hasRole = await vault.hasRole(releaseRole, walletAddress);
    console.log(`Wallet has RELEASE_ROLE: ${hasRole}`);
    
    if (!hasRole) {
        const tx = await vault.grantRole(releaseRole, walletAddress);
        await tx.wait();
        console.log('✅ RELEASE_ROLE granted to wallet');
    }
    
    console.log('\n✅ Done!');
}

main().catch(console.error);
