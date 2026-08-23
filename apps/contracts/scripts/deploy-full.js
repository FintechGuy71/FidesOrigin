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

/**
 * 部署 Diamond 架构的合规引擎（DiamondComplianceEngine + facets）。
 *
 * 背景：审计修复后标准 ComplianceEngine 实现达 26.8KB，超过 EIP-170 的
 * 24576 字节上限（旧版链上实现仅剩 235 字节余量）。Diamond 分片架构正是
 * 为此存在（见 DEPLOYED.md 权威合约集），本部署采用 Diamond 版引擎。
 *
 * 选择器全局去重：多个 facet 继承 OZ AccessControl/Pausable 产生相同
 * 选择器，LibDiamond.addFunctions 对重复选择器 revert，必须保证每个
 * 选择器只注册到一个 facet（先到先得）。
 */
async function deployDiamondEngine(riskRegistry, policyEngine, signer) {
  console.log('  ▶ DiamondComplianceEngine (Diamond + 6 facets)');

  const facetNames = [
    'DiamondCutFacet',
    'DiamondLoupeFacet',
    'ComplianceCoreFacet',
    'AssetComplianceFacet',
    'WalletComplianceFacet',
    'AdminFacet',
  ];

  const facetAddresses = {};
  for (const name of facetNames) {
    const Factory = await ethers.getContractFactory(name);
    const facet = await Factory.deploy();
    await facet.waitForDeployment();
    facetAddresses[name] = await facet.getAddress();
    console.log(`    facet ${name}: ${facetAddresses[name]}`);
  }

  // 选择器计算 + 全局去重
  const getSelectors = (abi) => {
    const iface = new ethers.Interface(abi);
    const out = [];
    for (const frag of iface.fragments) {
      if (frag.type !== 'function' || frag.name === 'initialize') continue;
      out.push(frag.selector);
    }
    return out;
  };
  const seen = new Set();
  const dedupe = (sels) => sels.filter((s) => !seen.has(s) && seen.add(s));

  const cuts = [];
  for (const name of facetNames) {
    if (name === 'DiamondCutFacet') continue; // 在构造初始 cut 中处理
    const artifact = await hre.artifacts.readArtifact(name);
    const unique = dedupe(getSelectors(artifact.abi));
    if (unique.length === 0) continue;
    cuts.push({ facetAddress: facetAddresses[name], action: 0, functionSelectors: unique });
  }
  const diamondCutArtifact = await hre.artifacts.readArtifact('DiamondCutFacet');
  const diamondCutSelectors = dedupe(getSelectors(diamondCutArtifact.abi));

  const initialCuts = [
    { facetAddress: facetAddresses.DiamondCutFacet, action: 0, functionSelectors: diamondCutSelectors },
    ...cuts,
  ];
  console.log(`    注册选择器总数: ${seen.size}`);

  // AdminFacet.initialize(riskRegistry, policyEngine, admin)
  const adminArtifact = await hre.artifacts.readArtifact('AdminFacet');
  const adminIface = new ethers.Interface(adminArtifact.abi);
  const initCalldata = adminIface.encodeFunctionData('initialize', [
    riskRegistry,
    policyEngine,
    signer.address,
  ]);

  const Diamond = await ethers.getContractFactory('DiamondComplianceEngine');
  const diamond = await Diamond.deploy(
    signer.address,
    initialCuts,
    facetAddresses.AdminFacet,
    initCalldata,
    { gasLimit: 8000000 }
  );
  await diamond.waitForDeployment();
  const diamondAddr = await diamond.getAddress();
  record('DiamondComplianceEngine', diamondAddr, { type: 'diamond', facets: facetAddresses });
  return diamondAddr;
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

  // ═══ Phase 2: Diamond 合规引擎 ═══
  console.log('\n━━━ Phase 2: Diamond Compliance Engine ━━━');

  const complianceEngine = await deployDiamondEngine(riskRegistry, policyEngine, signer);

  // v3.1.0: initialize 3 参（quarantineVault 死引用已移除）
  const fidesCompliance = await deployProxyWithInit('FidesCompliance', [
    complianceEngine,
    riskRegistry,
    policyEngine,
  ]);

  // ═══ Phase 3: 直接部署合约 ═══
  console.log('\n━━━ Phase 3: Direct Contracts ━━━');

  const quarantineVault = await deployDirect('QuarantineVault');
  const merkleRiskRegistry = await deployDirect('MerkleRiskRegistry', [PLACEHOLDER_MERKLE_ROOT]);
  const testUsd = await deployDirect('TestUSD');

  // v3.1.0: 构造 3 参（decimals 已移除）
  const fUsd = await deployDirect('CompliantStableCoin', [
    'FidesOrigin USD',
    'fUSD',
    complianceEngine,
  ]);

  // ═══ Phase 4: 角色接线（沿用 v3.0.4 部署矩阵）═══
  console.log('\n━━━ Phase 4: Role Wiring ━━━');

  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ORACLE_ROLE'));
  const COMPLIANCE_ENGINE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('COMPLIANCE_ENGINE_ROLE'));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));

  const registry = await ethers.getContractAt('RiskRegistry', riskRegistry);
  const policy = await ethers.getContractAt('PolicyEngine', policyEngine);
  // Diamond 引擎：grantRole 等角色函数由 BaseFacet 存储提供（经任一 facet
  // 的 ABI 调用均可路由），此处用 AdminFacet 的 ABI 绑定 Diamond 地址
  const adminArtifact = await hre.artifacts.readArtifact('AdminFacet');
  const engine = new ethers.Contract(complianceEngine, adminArtifact.abi, signer);

  const grantAndRecord = async (label, contract, role, account, resultsKey) => {
    const tx = await contract.grantRole(role, account);
    await tx.wait();
    (deploymentResults.roles[resultsKey] ||= []).push(account);
    console.log(`  ✅ ${label}`);
  };

  // Diamond 引擎：审计修复 L-9 后角色管理走 grantRoleWithReason（带事件留痕）
  const grantWithReason = async (label, role, account, resultsKey) => {
    const tx = await engine.grantRoleWithReason(role, account, 'v3.1.0 deployment wiring');
    await tx.wait();
    (deploymentResults.roles[resultsKey] ||= []).push(account);
    console.log(`  ✅ ${label}`);
  };

  await grantAndRecord('RiskRegistry.ORACLE_ROLE → ComplianceEngine(Diamond)', registry, ORACLE_ROLE, complianceEngine, 'RiskRegistry.ORACLE_ROLE');
  await grantAndRecord('RiskRegistry.ORACLE_ROLE → deployer', registry, ORACLE_ROLE, signer.address, 'RiskRegistry.ORACLE_ROLE');
  await grantAndRecord('PolicyEngine.COMPLIANCE_ENGINE_ROLE → ComplianceEngine(Diamond)', policy, COMPLIANCE_ENGINE_ROLE, complianceEngine, 'PolicyEngine.COMPLIANCE_ENGINE_ROLE');
  await grantWithReason('ComplianceEngine(Diamond).OPERATOR_ROLE → deployer', OPERATOR_ROLE, signer.address, 'ComplianceEngine.OPERATOR_ROLE');

  // MerkleRiskRegistry 的 ORACLE_ROLE 已在构造中授予 deployer（data-sync 签名者
  // 生产环境应替换为独立 KMS 密钥，见 DEPLOYED.md 检查清单）

  // ═══ Phase 5: 冒烟验证 ═══
  console.log('\n━━━ Phase 5: Smoke Tests ━━━');

  const fc = await ethers.getContractAt('FidesCompliance', fidesCompliance);
  const regView = await ethers.getContractAt('RiskRegistry', riskRegistry);
  const merkle = await ethers.getContractAt('MerkleRiskRegistry', merkleRiskRegistry);

  const profile = await regView.getRiskProfile(signer.address);
  console.log(`  RiskRegistry.getRiskProfile(deployer) → exists=${profile.exists} (fail-open 语义 ✓)`);
  const root = await merkle.merkleRoot();
  console.log(`  MerkleRiskRegistry.merkleRoot() → ${root} (占位 root，待 data-sync 推送)`);
  const fcVersion = await fc.hasRole(await fc.DEFAULT_ADMIN_ROLE(), signer.address);
  console.log(`  FidesCompliance deployer is admin → ${fcVersion}`);
  // Diamond 冒烟：Loupe 应能返回已注册 facet
  const loupeArtifact = await hre.artifacts.readArtifact('DiamondLoupeFacet');
  const loupe = new ethers.Contract(complianceEngine, loupeArtifact.abi, signer);
  const facetList = await loupe.facetAddresses();
  console.log(`  Diamond 已注册 facet 数 → ${facetList.length} (预期 6)`);

  // ═══ Phase 6: 保存部署记录 ═══
  console.log('\n━━━ Phase 6: Save Deployment Record ━━━');

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
