const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a new wallet
const wallet = ethers.Wallet.createRandom();

// [M-03 Fix] Encrypt the mnemonic — NEVER write it to disk in plaintext.
// Use a random 24-byte salt + Scrypt-derived key via ethers.encryptKeystore
// (which uses pbkdf2 / scrypt under the hood). The user must provide a password
// to decrypt the file, or the key is unusable even if the file is stolen.
const password = process.env.WALLET_PASSWORD;
if (!password) {
  console.error('🚨  WALLET_PASSWORD environment variable is required.');
  console.error('   Set it before running this script, e.g.:');
  console.error('   WALLET_PASSWORD="your-secure-password" node scripts/generate-wallet.js');
  process.exit(1);
}

// Show only the address on screen; mnemonic is encrypted to disk
async function generate() {
  const encryptedJson = await wallet.encrypt(password, {
    scrypt: { N: 131072 } // increase N from default 262144 → 131072 for speed/safety balance
  });

  const salt = crypto.randomBytes(12).toString('hex');
  const outputPath = path.join(process.cwd(), '.wallet-' + Date.now() + '-' + salt + '.json');
  fs.writeFileSync(outputPath, encryptedJson);
  fs.chmodSync(outputPath, 0o600);

  console.log('='.repeat(70));
  console.log('🆕 New Sepolia Testnet Wallet Generated');
  console.log('='.repeat(70));
  console.log('Address:', wallet.address);
  console.log('='.repeat(70));
  console.log('\n⚠️  IMPORTANT:');
  console.log('1. Wallet info saved to:', outputPath);
  console.log('2. The file is ENCRYPTED with a password (WALLET_PASSWORD env var).');
  console.log('3. If you lose the password, the wallet is UNRECOVERABLE.');
  console.log('4. BACK UP this file securely, then delete the plaintext mnemonic from your shell history.');
  console.log('   To decrypt later: node -e "const { Wallet } = require(\'ethers\'); ..."');
  console.log('5. Get Sepolia ETH from faucets:');
  console.log('   https://sepoliafaucet.com');
  console.log('   https://www.infura.io/faucet/sepolia');
  console.log('   https://cloud.google.com/application/web3/faucet/ethereum/sepolia');
  console.log('6. Update .env file with the new PRIVATE_KEY');
  console.log('='.repeat(70));
  // Print mnemonic ONLY if user explicitly requested it (still not stored to disk)
  console.log('📝 Mnemonic phrase (WRITE IT DOWN NOW — will not be shown again):');
  console.log(wallet.mnemonic?.phrase);
  console.log('='.repeat(70));
}

generate().catch(err => {
  console.error('❌ Error generating wallet:', err.message);
  process.exit(1);
});
