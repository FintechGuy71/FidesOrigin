const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    const walletAddress = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const deployer = '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
    
    // Wallet ABI
    const walletABI = [
        'function fidesCompliance() view returns (address)',
        'function complianceEngine() view returns (address)',
        'function complianceEnabled() view returns (bool)',
        'function owner() view returns (address)',
        'function autoQuarantineEnabled() view returns (bool)',
        'function quarantineVault() view returns (address)',
        'function operator() view returns (address)',
    ];
    
    const wallet = new ethers.Contract(walletAddress, walletABI, provider);
    
    console.log('Diagnosing CompliantSmartWallet at', walletAddress);
    console.log('');
    
    const fidesAddr = await wallet.fidesCompliance();
    const engineAddr = await wallet.complianceEngine();
    const complianceEnabled = await wallet.complianceEnabled();
    const owner = await wallet.owner();
    
    console.log(`fidesCompliance: ${fidesAddr}`);
    console.log(`complianceEngine: ${engineAddr}`);
    console.log(`complianceEnabled: ${complianceEnabled}`);
    console.log(`owner: ${owner}`);
    console.log(`deployer: ${deployer}`);
    console.log(`owner==deployer: ${owner.toLowerCase() === deployer.toLowerCase()}`);
    
    // Check IFidesCompliance functions
    const fidesABI = [
        'function isBlacklisted(address) view returns (bool)',
        'function getRiskProfile(address) view returns (uint8, uint256, string[], uint256, address, bytes32, bool)',
    ];
    
    const fides = new ethers.Contract(fidesAddr, fidesABI, provider);
    
    console.log('\nChecking fidesCompliance...');
    
    try {
        const blacklisted = await fides.isBlacklisted(deployer);
        console.log(`isBlacklisted(deployer): ${blacklisted}`);
    } catch (e) {
        console.log('isBlacklisted error:', e.message);
    }
    
    try {
        const profile = await fides.getRiskProfile(deployer);
        console.log('getRiskProfile(deployer):', profile);
    } catch (e) {
        console.log('getRiskProfile error:', e.message);
    }
    
    // Simulate ETH transfer
    console.log('\nSimulating ETH transfer to wallet...');
    try {
        await provider.call({
            from: deployer,
            to: walletAddress,
            value: ethers.parseEther('0.001'),
        });
        console.log('ETH transfer: would succeed');
    } catch (e) {
        console.log('ETH transfer failed:');
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
    
    // Simulate ERC20 transfer
    console.log('\nSimulating ERC20 transfer...');
    const tokenAddress = '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';
    const tokenABI = ['function transfer(address, uint256) returns (bool)'];
    const iface = new ethers.Interface(tokenABI);
    const data = iface.encodeFunctionData('transfer', [walletAddress, 1000000]);
    
    try {
        await provider.call({
            from: deployer,
            to: tokenAddress,
            data: data,
        });
        console.log('ERC20 transfer: would succeed');
    } catch (e) {
        console.log('ERC20 transfer failed:');
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
