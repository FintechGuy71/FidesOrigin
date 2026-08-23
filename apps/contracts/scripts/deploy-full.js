/**
 * FidesOrigin v3.1.0 — 全新部署脚本（权威合约集）
 *
 * 用法:
 *   npx hardhat run scripts/deploy-full.js --network sepolia
 *   npx hardhat run scripts/deploy-full.js --network hardhat   # 本地验证
 *
 * 部署内容（与 DEPLOYED.md 权威合约集一致）:
 *   UUPS 代理: RiskRegistry → PolicyEngine → ComplianceEngine → FidesCompliance
 *   直  部 署: QuarantineVault, MerkleRiskRegistry, TestUSD, CompliantStableCoin(演示)
 *   角色接线: 沿用 v3.0.4 部署的角色矩阵
 *
 * 接口适配 v3.1.0 破坏性变更:
 *   - FidesCompliance.initialize: 4 参 → 3 参（移除 quarantineVault 死引用）
 *   - CompliantStableCoin 构造: 4 参 → 3 参（移除 decimals）
 *   - MerkleRiskRegistry: leaf 为 uint8 tier 规范格式，初始 root 用占位值，
 *     生产 root 由 data-sync 经 updateMerkleRootFromOracle 推送（ORACLE_ROLE）
 */

const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { upgrades } = require('hardhat');

const VERSION = 'v3.1.0';

// 占位 Merkle root（非零即可通过构造校验；真实 root 由 data-sync 管道推送）
const PLACEHOLDER_MERKLE_ROOT = ethers.keccak256(
  ethers.toUtf8Bytes('FidesOrigin-v3.1.0-initial-empty-tree')
);

const deploymentResults = {
  version: VERSION,
  timestamp: new Date().toISOString(),
  contracts: {},
  roles: {},
};

function record(name, address, extra = {}) {
  deploymentResults.contracts[name] = { address, ...extra };
  console.log(`    ↳ ${name}: ${address}`);
}

async function deployProxyWithInit(name, args) {
  console.log(`  ▶ ${name} (UUPS proxy + initialize)`);
  const Factory = await ethers.getContractFactory(name);
  const proxy = await upgrades.deployProxy(Factory, args, {
    initializer: 'initialize',
    unsafeAllow: ['constructor'],
  });
  await proxy.waitForDeployment();
  const address = await proxy.getAddress();
  const impl = await upgrades.erc1967.getImplementationAddress(address);
  record(name, address, { type: 'UUPS proxy', implementation: impl, initArgs: args.length });
  return address;
}

async function deployDirect(name, args = []) {
  console.log(`  ▶ ${name} (direct)`);
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  record(name, address, { type: 'direct' });
  return address;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === 'unknown' && Number(network.chainId) === 31337
    ? 'hardhat'
    : network.name;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  FidesOrigin ${VERSION} — Fresh Deployment`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Network : ${networkName} (chainId=${network.chainId})`);
  console.log(`  Deployer: ${signer.address}`);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`  Balance : ${ethers.formatEther(balance)} ETH`);

  if (networkName !== 'hardhat' && balance < ethers.parseEther('0.05')) {
    throw new Error('Insufficient balance: need at least 0.05 ETH for deployment');
  }

  // ═══ Phase 1: UUPS 代理合约（按依赖顺序）═══
  console.log('\n━━━ Phase 1: UUPS Proxies ━━━');

  const riskRegistry = await deployProxyWithInit('RiskRegistry', [signer.address]);
  const policyEngine = await deployProxyWithInit('PolicyEngine', [signer.address, riskRegistry]);
  const complianceEngine = await deployProxyWithInit('ComplianceEngine', [riskRegistry, policyEngine]);

  // v3.1.0: initialize 3 参（quarantineVault 死引用已移除）
  const fidesCompliance = await deployProxyWithInit('FidesCompliance', [
    complianceEngine,
    riskRegistry,
    policyEngine,
  ]);

  // ═══ Phase 2: 直接部署合约 ═══
  console.log('\n━━━ Phase 2: Direct Contracts ━━━');

  const quarantineVault = await deployDirect('QuarantineVault');
  const merkleRiskRegistry = await deployDirect('MerkleRiskRegistry', [PLACEHOLDER_MERKLE_ROOT]);
  const testUsd = await deployDirect('TestUSD');

  // v3.1.0: 构造 3 参（decimals 已移除）
  const fUsd = await deployDirect('CompliantStableCoin', [
    'FidesOrigin USD',
    'fUSD',
    complianceEngine,
  ]);

  // ═══ Phase 3: 角色接线（沿用 v3.0.4 部署矩阵）═══
  console.log('\n━━━ Phase 3: Role Wiring ━━━');

  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ORACLE_ROLE'));
  const COMPLIANCE_ENGINE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('COMPLIANCE_ENGINE_ROLE'));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));

  const registry = await ethers.getContractAt('RiskRegistry', riskRegistry);
  const policy = await ethers.getContractAt('PolicyEngine', policyEngine);
  const engine = await ethers.getContractAt('ComplianceEngine', complianceEngine);

  const grantAndRecord = async (label, contract, role, account, resultsKey) => {
    const tx = await contract.grantRole(role, account);
    await tx.wait();
    (deploymentResults.roles[resultsKey] ||= []).push(account);
    console.log(`  ✅ ${label}`);
  };

  await grantAndRecord('RiskRegistry.ORACLE_ROLE → ComplianceEngine', registry, ORACLE_ROLE, complianceEngine, 'RiskRegistry.ORACLE_ROLE');
  await grantAndRecord('RiskRegistry.ORACLE_ROLE → deployer', registry, ORACLE_ROLE, signer.address, 'RiskRegistry.ORACLE_ROLE');
  await grantAndRecord('PolicyEngine.COMPLIANCE_ENGINE_ROLE → ComplianceEngine', policy, COMPLIANCE_ENGINE_ROLE, complianceEngine, 'PolicyEngine.COMPLIANCE_ENGINE_ROLE');
  await grantAndRecord('ComplianceEngine.OPERATOR_ROLE → deployer', engine, OPERATOR_ROLE, signer.address, 'ComplianceEngine.OPERATOR_ROLE');

  // MerkleRiskRegistry 的 ORACLE_ROLE 已在构造中授予 deployer（data-sync 签名者
  // 生产环境应替换为独立 KMS 密钥，见 DEPLOYED.md 检查清单）

  // ═══ Phase 4: 冒烟验证 ═══
  console.log('\n━━━ Phase 4: Smoke Tests ━━━');

  const fc = await ethers.getContractAt('FidesCompliance', fidesCompliance);
  const regView = await ethers.getContractAt('RiskRegistry', riskRegistry);
  const merkle = await ethers.getContractAt('MerkleRiskRegistry', merkleRiskRegistry);

  const profile = await regView.getRiskProfile(signer.address);
  console.log(`  RiskRegistry.getRiskProfile(deployer) → exists=${profile.exists} (fail-open 语义 ✓)`);
  const root = await merkle.merkleRoot();
  console.log(`  MerkleRiskRegistry.merkleRoot() → ${root} (占位 root，待 data-sync 推送)`);
  const fcVersion = await fc.hasRole(await fc.DEFAULT_ADMIN_ROLE(), signer.address);
  console.log(`  FidesCompliance deployer is admin → ${fcVersion}`);

  // ═══ Phase 5: 保存部署记录 ═══
  console.log('\n━━━ Phase 5: Save Deployment Record ━━━');

  deploymentResults.network = networkName;
  deploymentResults.chainId = Number(network.chainId);
  deploymentResults.deployer = signer.address;
  deploymentResults.merkleRoot = {
    initial: PLACEHOLDER_MERKLE_ROOT,
    note: '占位 root；生产 root 由 data-sync 经 updateMerkleRootFromOracle 推送',
  };

  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outFile = path.join(deploymentsDir, `${networkName}-${VERSION}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deploymentResults, null, 2));
  const latestFile = path.join(deploymentsDir, `${networkName}-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deploymentResults, null, 2));
  console.log(`  ✅ Record: ${outFile}`);
  console.log(`  ✅ Latest: ${latestFile}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  ${VERSION} Deployment Complete`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n后续步骤:');
  console.log('  1. 更新 subgraph 配置指向新地址并重新部署');
  console.log('  2. Etherscan 验证合约');
  console.log('  3. 更新 demo 页面 / data-sync 的地址引用');
  console.log('  4. data-sync 推送真实 Merkle root');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
