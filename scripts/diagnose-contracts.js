const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    const tokenAddress = '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';
    const walletAddress = process.env.WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
    const deployer = process.env.DEPLOYER_ADDRESS || '0x0000000000000000000000000000000000000000';
    
    // 正确的 ABI - addressRiskLevel 是 public mapping 的自动 getter
    const minimalABI = [
        'function balanceOf(address) view returns (uint256)',
        'function addressRiskLevel(address) view returns (uint8)',
        'function transfer(address, uint256) returns (bool)',
        'function mint(address, uint256)',
        'function tagAddress(address, uint8, string)',
        'function isBlacklisted(address) view returns (bool)',
    ];
    
    const token = new ethers.Contract(tokenAddress, minimalABI, provider);
    
    console.log('Testing TestUSD at', tokenAddress);
    
    try {
        const bal = await token.balanceOf(deployer);
        console.log('Deployer balance:', ethers.formatUnits(bal, 18));
    } catch (e) {
        console.log('balanceOf error:', e.message);
    }
    
    try {
        const risk = await token.addressRiskLevel(walletAddress);
        console.log('Wallet risk level:', risk);
    } catch (e) {
        console.log('addressRiskLevel error:', e.message);
    }
    
    try {
        const risk = await token.addressRiskLevel(deployer);
        console.log('Deployer risk level:', risk);
    } catch (e) {
        console.log('deployer risk error:', e.message);
    }
    
    try {
        const bl = await token.isBlacklisted(walletAddress);
        console.log('Wallet blacklisted:', bl);
    } catch (e) {
        console.log('isBlacklisted error:', e.message);
    }
    
    // 测试 RiskRegistry
    const registryAddress = '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3';
    const registryABI = [
        'function isSanctioned(address) view returns (bool)',
        'function getRiskProfile(address) view returns (uint8, uint8, uint256, bool)',
    ];
    
    const registry = new ethers.Contract(registryAddress, registryABI, provider);
    
    console.log('\nTesting RiskRegistry at', registryAddress);
    
    try {
        const sanctioned = await registry.isSanctioned(deployer);
        console.log('Deployer sanctioned:', sanctioned);
    } catch (e) {
        console.log('isSanctioned error:', e.message);
    }
    
    try {
        const profile = await registry.getRiskProfile(deployer);
        console.log('Risk profile:', profile);
    } catch (e) {
        console.log('getRiskProfile error:', e.message);
    }
    
    try {
        const profile = await registry.getRiskProfile(walletAddress);
        console.log('Wallet risk profile:', profile);
    } catch (e) {
        console.log('wallet profile error:', e.message);
    }
}

main().catch(console.error);
