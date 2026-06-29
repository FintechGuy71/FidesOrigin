const hre = require('hardhat');

async function main() {
    console.log('Fixing vault permissions...');
    const [deployer] = await hre.ethers.getSigners();
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const newVaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
    
    const wallet = await hre.ethers.getContractAt('CompliantSmartWallet', walletAddress);
    const vault = await hre.ethers.getContractAt('QuarantineVault', newVaultAddress);
    
    const operator = await wallet.operator();
    console.log(`Operator: ${operator}`);
    
    // Grant QUARANTINE_ROLE to operator
    const quarantineRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('QUARANTINE_ROLE'));
    const hasQ = await vault.hasRole(quarantineRole, operator);
    console.log(`Has QUARANTINE_ROLE: ${hasQ}`);
    
    if (!hasQ) {
        const tx = await vault.grantRole(quarantineRole, operator);
        await tx.wait();
        console.log('✅ QUARANTINE_ROLE granted to operator');
    }
    
    // Also grant to deployer for testing
    const hasQDeployer = await vault.hasRole(quarantineRole, deployer.address);
    if (!hasQDeployer) {
        const tx = await vault.grantRole(quarantineRole, deployer.address);
        await tx.wait();
        console.log('✅ QUARANTINE_ROLE granted to deployer');
    }
    
    // Grant RELEASE_ROLE to deployer
    const releaseRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes('RELEASE_ROLE'));
    const hasR = await vault.hasRole(releaseRole, deployer.address);
    console.log(`Has RELEASE_ROLE: ${hasR}`);
    
    if (!hasR) {
        const tx = await vault.grantRole(releaseRole, deployer.address);
        await tx.wait();
        console.log('✅ RELEASE_ROLE granted to deployer');
    }
    
    console.log('\n✅ Done!');
}

main().catch(console.error);
