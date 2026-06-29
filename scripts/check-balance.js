const hre = require('hardhat');

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    
    console.log('Deployer:', deployer.address);
    console.log('Balance:', hre.ethers.formatEther(balance), 'ETH');
    
    if (balance < hre.ethers.parseEther('0.01')) {
        console.log('\n⚠️  Insufficient balance for deployment!');
        console.log('Get Sepolia ETH from:');
        console.log('  - https://sepoliafaucet.com');
        console.log('  - https://www.infura.io/faucet/sepolia');
        process.exit(1);
    }
    
    console.log('✅ Balance sufficient for deployment');
}

main().catch(console.error);
