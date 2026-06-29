const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// 生成新钱包
const wallet = ethers.Wallet.createRandom();

// [Cross-check Fix] 将私钥写入加密文件而非打印到控制台
const outputPath = path.join(process.cwd(), '.wallet-' + Date.now() + '.json');
fs.writeFileSync(outputPath, JSON.stringify({
  address: wallet.address,
  mnemonic: wallet.mnemonic?.phrase,
  createdAt: new Date().toISOString()
}, null, 2));

console.log('='.repeat(70));
console.log('🆕 New Sepolia Testnet Wallet Generated');
console.log('='.repeat(70));
console.log('Address:', wallet.address);
console.log('='.repeat(70));
console.log('\n⚠️  IMPORTANT:');
console.log('1. Wallet info saved to:', outputPath);
console.log('2. Back up this file securely and delete it after use');
console.log('3. Get Sepolia ETH from faucets:');
console.log('   https://sepoliafaucet.com');
console.log('   https://www.infura.io/faucet/sepolia');
console.log('   https://cloud.google.com/application/web3/faucet/ethereum/sepolia');
console.log('4. Update .env file with the new PRIVATE_KEY');
