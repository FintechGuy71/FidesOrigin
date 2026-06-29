const hre = require('hardhat');

async function main() {
    console.log('Deploying TestUSD...');
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const TestUSD = await hre.ethers.getContractFactory('TestUSD');
    const token = await TestUSD.deploy();
    await token.waitForDeployment();

    const address = await token.getAddress();
    console.log(`✅ TestUSD deployed at: ${address}`);

    // Mint some tokens to deployer
    const mintTx = await token.mint(deployer.address, hre.ethers.parseUnits('10000', 18));
    await mintTx.wait();
    console.log('✅ Minted 10,000 TUSD to deployer');

    // Tag a test address as BLACK for quarantine testing
    const blackAddr = '0x1234567890123456789012345678901234567890';
    const tagTx = await token.tagAddress(blackAddr, 4, 'Test blacklist'); // 4 = BLACK
    await tagTx.wait();
    console.log(`✅ Tagged ${blackAddr} as BLACK`);

    // Save deployment info
    const fs = require('fs');
    const info = {
        network: 'sepolia',
        token: address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };
    fs.writeFileSync('deployments/testusd-sepolia.json', JSON.stringify(info, null, 2));
    console.log('\nDeployment info saved to deployments/testusd-sepolia.json');
}

main().catch(console.error);
