const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    const tokenAddress = '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';
    const walletAddress = process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
    const deployer = process.env.DEPLOYER_ADDRESS || '0x0000000000000000000000000000000000000000';
    
    // Extended ABI for diagnosis
    const abi = [
        'function balanceOf(address) view returns (uint256)',
        'function paused() view returns (bool)',
        'function transfer(address, uint256) returns (bool)',
        'function mint(address, uint256)',
        'function owner() view returns (address)',
        'function name() view returns (string)',
        'function symbol() view returns (string)',
    ];
    
    const token = new ethers.Contract(tokenAddress, abi, provider);
    
    console.log('Diagnosing TestUSD at', tokenAddress);
    console.log('');
    
    // Basic info
    try {
        const name = await token.name();
        const symbol = await token.symbol();
        console.log(`Name: ${name}`);
        console.log(`Symbol: ${symbol}`);
    } catch (e) {
        console.log('name/symbol error:', e.message);
    }
    
    // Check paused
    try {
        const isPaused = await token.paused();
        console.log(`Paused: ${isPaused}`);
    } catch (e) {
        console.log('paused() error:', e.message);
    }
    
    // Check owner
    try {
        const owner = await token.owner();
        console.log(`Owner: ${owner}`);
    } catch (e) {
        console.log('owner() error:', e.message);
    }
    
    // Try to get revert reason for transfer
    console.log('\nTrying to simulate transfer...');
    
    try {
        // Encode transfer call
        const iface = new ethers.Interface(abi);
        const data = iface.encodeFunctionData('transfer', [walletAddress, ethers.parseUnits('10', 18)]);
        
        const result = await provider.call({
            from: deployer,
            to: tokenAddress,
            data: data,
        });
        console.log('Simulation result:', result);
    } catch (e) {
        console.log('Transfer simulation failed:');
        console.log('  Error:', e.message);
        if (e.revert) {
            console.log('  Revert reason:', e.revert);
        }
        if (e.reason) {
            console.log('  Reason:', e.reason);
        }
    }
    
    // Also check wallet code
    console.log('\nChecking wallet code...');
    const walletCode = await provider.getCode(walletAddress);
    console.log(`Wallet code size: ${walletCode.length}`);
    
    // Check CompliantSmartWallet features
    const walletABI = [
        'function autoQuarantineEnabled() view returns (bool)',
        'function quarantineVault() view returns (address)',
        'function operator() view returns (address)',
    ];
    const wallet = new ethers.Contract(walletAddress, walletABI, provider);
    
    try {
        const autoQ = await wallet.autoQuarantineEnabled();
        console.log(`Auto-quarantine: ${autoQ}`);
    } catch (e) {
        console.log('autoQuarantineEnabled error:', e.message);
    }
    
    try {
        const qv = await wallet.quarantineVault();
        console.log(`Quarantine vault: ${qv}`);
    } catch (e) {
        console.log('quarantineVault error:', e.message);
    }
    
    try {
        const op = await wallet.operator();
        console.log(`Operator: ${op}`);
    } catch (e) {
        console.log('operator error:', e.message);
    }
}

main().catch(console.error);
