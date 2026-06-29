const { ethers } = require('ethers');
const fs = require('fs');

async function deployMerkleRiskRegistry() {
  // 读取配置
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.log('Missing PRIVATE_KEY env var');
    return;
  }
  
  // 读取 Merkle Root
  const merkleRoot = fs.readFileSync('./data-sync/cache/merkle-root-final.txt', 'utf8').trim();
  console.log('Deploying with Merkle Root:', merkleRoot);
  
  // 连接网络
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('Deployer:', wallet.address);
  
  // 读取合约字节码和 ABI
  const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/MerkleRiskRegistry.sol/MerkleRiskRegistry.json', 'utf8'));
  
  // 创建合约工厂
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  // 部署合约
  console.log('Deploying MerkleRiskRegistry...');
  const contract = await factory.deploy(merkleRoot);
  
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log('Deployed to:', address);
  console.log('Transaction:', contract.deploymentTransaction().hash);
  
  // 保存部署信息
  const deployment = {
    network: 'sepolia',
    chainId: 11155111,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MerkleRiskRegistry: {
        address: address,
        merkleRoot: merkleRoot,
        totalAddresses: 20470
      }
    }
  };
  
  fs.writeFileSync('./deployments/sepolia-merkle-latest.json', JSON.stringify(deployment, null, 2));
  console.log('Deployment saved to: deployments/sepolia-merkle-latest.json');
}

deployMerkleRiskRegistry().catch(console.error);
