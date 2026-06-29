const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Deploying FidesOrigin TestUSD...');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('📍 Deploying with account:', deployer.address);
  console.log('💰 Account balance:', (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy TestUSD
  const TestUSD = await hre.ethers.getContractFactory('TestUSD');
  const testUSD = await TestUSD.deploy();
  
  await testUSD.waitForDeployment();
  
  const contractAddress = await testUSD.getAddress();
  console.log('✅ TestUSD deployed to:', contractAddress);
  
  // Get deployment info
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;
  const deployTime = new Date().toISOString();
  
  // Save deployment info
  const deploymentInfo = {
    contractName: 'TestUSD',
    contractAddress,
    network,
    chainId,
    deployer: deployer.address,
    deployTime,
    version: 'v0.3.0',
    phase: 'Phase 3 - Timelock + Multisig',
  };
  
  // Save to deployments directory
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentsDir, `${network}-${deployTime.split('T')[0]}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  // Save latest deployment
  const latestFile = path.join(deploymentsDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('📝 Deployment info saved to:', deploymentFile);
  
  // Verify contract if on testnet
  if (network !== 'hardhat') {
    console.log('⏳ Waiting for block confirmations...');
    await testUSD.deploymentTransaction().wait(5);
    
    console.log('🔍 Verifying contract on Etherscan...');
    try {
      await hre.run('verify:verify', {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log('✅ Contract verified!');
    } catch (error) {
      console.log('⚠️ Verification failed:', error.message);
    }
  }
  
  console.log('\n🎉 Deployment complete!');
  console.log('📄 Contract Address:', contractAddress);
  console.log('🔗 Explorer URL:', getExplorerUrl(network, contractAddress));
  
  return deploymentInfo;
}

function getExplorerUrl(network, address) {
  const explorers = {
    sepolia: `https://sepolia.etherscan.io/address/${address}`,
    goerli: `https://goerli.etherscan.io/address/${address}`,
  };
  return explorers[network] || 'N/A';
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
