const { ethers } = require('ethers');
const fs = require('fs');

async function updateMerkleRoot() {
  const rpcUrl = process.env.RPC_URL || 'https://rpc.moderato.tempo.xyz';
  const privateKey = process.env.SYNC_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!privateKey || !contractAddress) {
    console.log('Missing PRIVATE_KEY or CONTRACT_ADDRESS env vars');
    return;
  }
  
  const newRoot = fs.readFileSync('data-sync/cache/merkle-root-v91.txt', 'utf8').trim();
  console.log('New Merkle Root:', newRoot);
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const abi = [
    'function updateMerkleRoot(bytes32 newRoot) external',
    'function merkleRoot() view returns (bytes32)',
    'function owner() view returns (address)',
    'event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, wallet);
  const owner = await contract.owner();
  console.log('Contract owner:', owner);
  console.log('Wallet address:', wallet.address);
  
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log('ERROR: Wallet is not the contract owner!');
    return;
  }
  
  const currentRoot = await contract.merkleRoot();
  console.log('Current Merkle Root:', currentRoot);
  
  console.log('Updating Merkle Root...');
  const tx = await contract.updateMerkleRoot(newRoot);
  console.log('Transaction:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('Confirmed! Block:', receipt.blockNumber);
  
  const updatedRoot = await contract.merkleRoot();
  console.log('Updated Merkle Root:', updatedRoot);
  console.log('Match:', updatedRoot === newRoot ? '✅ YES' : '❌ NO');
}

updateMerkleRoot().catch(console.error);
