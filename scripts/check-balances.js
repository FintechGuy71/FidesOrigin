const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const deployer = '0x5F6Ae278e7a62E64F9F467a91B693f372b84a374';
    
    const balance = await provider.getBalance(deployer);
    console.log(`Deployer ETH balance: ${ethers.formatEther(balance)} ETH`);
    
    // Also check wallet ETH balance
    const wallet = '0xbC3E072F83118D9d68DFD8D78e0ed1E7d72BB6b1';
    const walletBal = await provider.getBalance(wallet);
    console.log(`Wallet ETH balance: ${ethers.formatEther(walletBal)} ETH`);
}

main().catch(console.error);
