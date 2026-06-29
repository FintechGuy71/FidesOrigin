const { ethers } = require("hardhat");

const PROXY = process.env.PROXY_ADDRESS || '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc';

async function main() {
  const [signer] = await ethers.getSigners();
  console.log('Deploying V2.2.0...');
  console.log('Signer:', signer.address);

  const V2 = await ethers.getContractFactory('RiskRegistryV2');
  const impl = await V2.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('V2.2 Implementation:', implAddr);

  // Check code exists
  const code = await ethers.provider.getCode(implAddr);
  if (code.length < 100) throw new Error('Empty deployment');
  console.log('Code size:', (code.length - 2) / 2);

  // Upgrade (NO init call — just pure code swap)
  const proxyAbi = ['function upgradeToAndCall(address impl, bytes data) external'];
  const proxy = new ethers.Contract(PROXY, proxyAbi, signer);
  const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
  console.log('Upgrade tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Status:', receipt.status);

  // Verify
  const v2 = new ethers.Contract(PROXY, [
    'function VERSION() view returns (string)',
    'function totalProfiles() view returns (uint256)',
    'function totalHighRisk() view returns (uint256)',
    'function totalSanctioned() view returns (uint256)',
    'function isSanctioned(address) view returns (bool)',
    'function getRiskProfile(address) view returns (uint8,uint8,bytes32[],uint256,bool)',
  ], ethers.provider);

  console.log('VERSION:', await v2.VERSION());
  console.log('totalProfiles:', (await v2.totalProfiles()).toString());
  console.log('totalHighRisk:', (await v2.totalHighRisk()).toString());
  console.log('totalSanctioned:', (await v2.totalSanctioned()).toString());
  console.log('isSanctioned(OFAC):', await v2.isSanctioned('0xe950dc316b836e4eefb8308bf32bf7c72a1358ff'));

  // Test a ScamSniffer address too
  console.log('isSanctioned(Scam):', await v2.isSanctioned('0x101ce0cedd142f199c9ef61739ae59b6611a0fc0'));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
