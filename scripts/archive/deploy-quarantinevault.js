const hre = require('hardhat');

async function main() {
    console.log('Deploying QuarantineVault...');
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const QuarantineVault = await hre.ethers.getContractFactory('QuarantineVault');
    const vault = await QuarantineVault.deploy();
    await vault.waitForDeployment();

    const address = await vault.getAddress();
    console.log(`✅ QuarantineVault deployed at: ${address}`);

    // Save deployment info
    const fs = require('fs');
    const info = {
        network: 'sepolia',
        vault: address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };
    fs.writeFileSync('deployments/quarantinevault-sepolia.json', JSON.stringify(info, null, 2));
    console.log('\nDeployment info saved to deployments/quarantinevault-sepolia.json');
}

main().catch(console.error);
