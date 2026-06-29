const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const deployer = process.env.DEPLOYER_ADDRESS || '0x0000000000000000000000000000000000000000';
    
    const balance = await provider.getBalance(deployer);
    console.log(`Deployer ETH balance: ${ethers.formatEther(balance)} ETH`);
    
    // Also check wallet ETH balance
    const wallet = process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
    const walletBal = await provider.getBalance(wallet);
    console.log(`Wallet ETH balance: ${ethers.formatEther(walletBal)} ETH`);
}

main().catch(console.error);
