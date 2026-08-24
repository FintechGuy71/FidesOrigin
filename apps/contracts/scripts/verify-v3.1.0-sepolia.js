/**
 * FidesOrigin v3.1.0 — Etherscan 源码验证（Sepolia）
 *
 * 前置条件（仅需一次）：
 *   1. https://etherscan.io 注册并生成 API Key（免费）
 *   2. 写入仓库 secret：Settings → Secrets → Actions → ETHERSCAN_API_KEY
 *      （或本地 export ETHERSCAN_API_KEY=xxx）
 *
 * 用法：
 *   ETHERSCAN_API_KEY=xxx npx hardhat run scripts/verify-v3.1.0-sepolia.js --network sepolia
 *
 * 说明：
 *   - UUPS 代理合约：先验证 implementation，再以 EIP-1967 代理形式验证 proxy
 *     （Etherscan 对 ERC1967Proxy 有专门识别，重跑会提示 already verified 属正常）
 *   - Diamond 合约：Etherscan 不理解 Diamond 的多 facet 路由，主 Diamond
 *     （DiamondComplianceEngine 本体）以普通合约验证；各 facet 独立验证
 *   - 已验证的合约会抛 "Already Verified"，脚本自动跳过继续
 */

const fs = require('fs');
const path = require('path');

// 从部署记录读取地址（deployments/sepolia-latest.json，gitignore 但部署机本地存在）
function loadAddresses() {
  const recordPath = path.join(__dirname, '..', 'deployments', 'sepolia-latest.json');
  if (!fs.existsSync(recordPath)) {
    throw new Error('部署记录缺失: deployments/sepolia-latest.json（在部署机运行或手工填入地址）');
  }
  return JSON.parse(fs.readFileSync(recordPath, 'utf-8')).contracts;
}

async function safeVerify(hre, name, address, constructorArguments) {
  try {
    await hre.run('verify:verify', { address, constructorArguments });
    console.log(`  ✅ ${name}: ${address}`);
  } catch (e) {
    if (/already verified/i.test(e.message)) {
      console.log(`  ⏭️  ${name}: 已验证，跳过`);
    } else {
      console.log(`  ❌ ${name}: ${e.message.split('\n')[0]}`);
    }
  }
}

async function main() {
  const hre = require('hardhat');
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error('缺少 ETHERSCAN_API_KEY 环境变量（etherscan.io 免费生成）');
  }

  const c = loadAddresses();
  console.log('═══ FidesOrigin v3.1.0 Etherscan 验证（Sepolia）═══\n');

  // ── 1. UUPS 实现合约（无参构造，initialize 不参与部署时 calldata）──
  console.log('── UUPS implementations ──');
  await safeVerify(hre, 'RiskRegistry impl', c.RiskRegistry.implementation, []);
  await safeVerify(hre, 'PolicyEngine impl', c.PolicyEngine.implementation, []);
  await safeVerify(hre, 'FidesCompliance impl', c.FidesCompliance.implementation, []);

  // ── 2. UUPS 代理（EIP-1967，Etherscan 自动识别代理关系）──
  console.log('── UUPS proxies ──');
  await safeVerify(hre, 'RiskRegistry proxy', c.RiskRegistry.address, []);
  await safeVerify(hre, 'PolicyEngine proxy', c.PolicyEngine.address, []);
  await safeVerify(hre, 'FidesCompliance proxy', c.FidesCompliance.address, []);

  // ── 3. Diamond 及 facets ──
  console.log('── Diamond + facets ──');
  // Diamond 构造参数复杂（cuts 数组），Etherscan 对此类参数验证成功率低，
  // 使用 force 模式按无参处理（源码匹配优先）
  try {
    await hre.run('verify:verify', {
      address: c.DiamondComplianceEngine.address,
      constructorArguments: [],
      force: true,
    });
    console.log(`  ✅ DiamondComplianceEngine: ${c.DiamondComplianceEngine.address}`);
  } catch (e) {
    console.log(`  ⚠️  DiamondComplianceEngine: ${e.message.split('\n')[0]}（可到 Etherscan 网页端手工验证）`);
  }
  for (const [facetName, facetInfo] of Object.entries(c.DiamondComplianceEngine.facets || {})) {
    await safeVerify(hre, facetName, facetInfo, []);
  }

  // ── 4. 直部署合约 ──
  console.log('── Direct contracts ──');
  await safeVerify(hre, 'QuarantineVault', c.QuarantineVault.address, []);
  await safeVerify(hre, 'TestUSD', c.TestUSD.address, []);
  // MerkleRiskRegistry 构造参数为初始占位 root
  const initialRoot = '0x6e830516130a39f97721eac9d9c301f65ce0fa5c281d2851982628e64fbd8202';
  await safeVerify(hre, 'MerkleRiskRegistry', c.MerkleRiskRegistry.address, [initialRoot]);
  // CompliantStableCoin(name, symbol, complianceEngine)
  await safeVerify(hre, 'CompliantStableCoin', c.CompliantStableCoin.address, [
    'FidesOrigin USD',
    'fUSD',
    c.DiamondComplianceEngine.address,
  ]);

  console.log('\n═══ 验证完成（⚠️/❌ 项可到 Etherscan 网页端手工补充）═══');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
