const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    const tokenAddress = '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const deployer = '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
    
    // Try different amounts
    const amounts = [
        ethers.parseUnits('0.1', 18),
        ethers.parseUnits('0.01', 18),
        ethers.parseUnits('0.001', 18),
        ethers.parseUnits('1', 6),  // Maybe decimals is 6?
        ethers.parseUnits('1', 18),
        1n,  // 1 wei
    ];
    
    const abi = ['function transfer(address, uint256) returns (bool)'];
    const iface = new ethers.Interface(abi);
    
    for (const amount of amounts) {
        try {
            const data = iface.encodeFunctionData('transfer', [walletAddress, amount]);
            await provider.call({
                from: deployer,
                to: tokenAddress,
                data: data,
            });
            console.log(`Amount ${amount.toString()}: SUCCESS`);
        } catch (e) {
            console.log(`Amount ${amount.toString()}: FAILED`);
            if (e.data) {
                try {
                    const reason = ethers.toUtf8String(e.data);
                    console.log(`  Decoded: ${reason}`);
                } catch {
                    console.log(`  Raw data: ${e.data}`);
                }
            }
            if (e.reason) {
                console.log(`  Reason: ${e.reason}`);
            }
        }
    }
    
    // Also check decimals
    console.log('\nChecking decimals...');
    const decimalsABI = ['function decimals() view returns (uint8)'];
    const decimalsContract = new ethers.Contract(tokenAddress, decimalsABI, provider);
    try {
        const decimals = await decimalsContract.decimals();
        console.log(`Decimals: ${decimals}`);
    } catch (e) {
        console.log('Decimals error:', e.message);
    }
    
    // Check total supply
    console.log('\nChecking totalSupply...');
    const supplyABI = ['function totalSupply() view returns (uint256)'];
    const supplyContract = new ethers.Contract(tokenAddress, supplyABI, provider);
    try {
        const supply = await supplyContract.totalSupply();
        console.log(`Total supply: ${ethers.formatUnits(supply, 18)}`);
    } catch (e) {
        console.log('Total supply error:', e.message);
    }
}

main().catch(console.error);
