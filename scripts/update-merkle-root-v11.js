const { ethers } = require('ethers');
const fs = require('fs');

async function updateMerkleRoot() {
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!privateKey || !contractAddress) {
    console.log('Missing PRIVATE_KEY or CONTRACT_ADDRESS');
    return;
  }
  
  const merkleRoot = fs.readFileSync('./data-sync/cache/merkle-root-v11.txt', 'utf8').trim();
  
  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    console.error('❌ Invalid CONTRACT_ADDRESS:', contractAddress);
    process.exit(1);
  }
  
  // Validate merkle root format (32-byte hex hash)
  if (!/^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) {
    console.error('❌ Invalid merkle root format (expected 32-byte hex hash):', merkleRoot);
    process.exit(1);
  }
  
  console.log('Updating Merkle Root to:', merkleRoot);
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const abi = [
    'function updateMerkleRoot(bytes32 newRoot) external',
    'function merkleRoot() view returns (bytes32)',
    'event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, wallet);
  
  const oldRoot = await contract.merkleRoot();
  console.log('Current root:', oldRoot);
  
  const tx = await contract.updateMerkleRoot(merkleRoot);
  console.log('Transaction:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('Confirmed in block:', receipt.blockNumber);
  
  const newRoot = await contract.merkleRoot();
  console.log('New root:', newRoot);
}

updateMerkleRoot().catch(console.error);
