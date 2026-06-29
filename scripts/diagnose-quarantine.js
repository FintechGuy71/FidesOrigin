const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const tokenAddress = '0x9c9f4d5775BAf5DB2f4E8f8cD1C5ca695D5c7BDb';
    const vaultAddress = '0xF5593e26b2560b9fc71de729EA2D86F979dfd76b';
    const deployer = '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
    
    // Check allowance
    const tokenABI = ['function allowance(address, address) view returns (uint256)'];
    const token = new ethers.Contract(tokenAddress, tokenABI, provider);
    
    const allowance = await token.allowance(walletAddress, vaultAddress);
    console.log(`Wallet -> Vault allowance: ${allowance.toString()}`);
    
    // Check vault balance
    const balanceABI = ['function balanceOf(address) view returns (uint256)'];
    const balanceContract = new ethers.Contract(tokenAddress, balanceABI, provider);
    const vaultBal = await balanceContract.balanceOf(vaultAddress);
    const walletBal = await balanceContract.balanceOf(walletAddress);
    console.log(`Vault balance: ${ethers.formatUnits(vaultBal, 18)}`);
    console.log(`Wallet balance: ${ethers.formatUnits(walletBal, 18)}`);
    
    // Simulate quarantineFunds
    console.log('\nSimulating quarantineFunds...');
    const walletABI = [
        'function quarantineFunds(address token, uint256 amount, string calldata reason)'
    ];
    const iface = new ethers.Interface(walletABI);
    const data = iface.encodeFunctionData('quarantineFunds', [
        tokenAddress,
        ethers.parseUnits('10', 18),
        'Test'
    ]);
    
    try {
        await provider.call({
            from: deployer,
            to: walletAddress,
            data: data,
        });
        console.log('Simulation: SUCCESS');
    } catch (e) {
        console.log('Simulation FAILED:');
        console.log('  Message:', e.message);
        if (e.data) {
            try {
                const decoded = ethers.toUtf8String(e.data);
                console.log(`  Decoded: ${decoded}`);
            } catch {
                console.log(`  Raw: ${e.data}`);
            }
        }
    }
}

main().catch(console.error);
