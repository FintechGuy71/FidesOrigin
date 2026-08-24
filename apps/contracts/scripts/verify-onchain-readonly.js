// v3.1.0 Sepolia 链上只读核验（不产生交易）
// 用法: pnpm exec node scripts/verify-onchain-readonly.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RECORD = require('../deployments/sepolia-latest.json');
const EXPECTED_MERKLE_ROOT = '0x1a292437361d236f51dfa198609a2ec309d8173ed253c1e47ed22c193cab4404';
const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

function artifact(name) {
  const p = path.join(__dirname, '..', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(p)).abi;
}
function facetArtifact(name) {
  const p = path.join(__dirname, '..', 'artifacts', 'contracts', 'facets', `${name}.sol`, `${name}.json`);
  return JSON.parse(fs.readFileSync(p)).abi;
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };

(async () => {
  const req = new ethers.FetchRequest(process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com');
  req.setHeader('User-Agent', 'Mozilla/5.0');
  const provider = new ethers.JsonRpcProvider(req);

  const net = await provider.getNetwork();
  check('chainId=11155111', Number(net.chainId) === 11155111, String(net.chainId));

  const C = RECORD.contracts;
  const all = [
    ['FidesCompliance', C.FidesCompliance.address], ['DiamondComplianceEngine', C.DiamondComplianceEngine.address],
    ['RiskRegistry', C.RiskRegistry.address], ['PolicyEngine', C.PolicyEngine.address],
    ['QuarantineVault', C.QuarantineVault.address], ['MerkleRiskRegistry', C.MerkleRiskRegistry.address],
    ['TestUSD', C.TestUSD.address], ['CompliantStableCoin', C.CompliantStableCoin.address],
  ];

  // 1. 字节码存在性
  for (const [name, addr] of all) {
    const code = await provider.getCode(addr);
    check(`code:${name}`, code.length > 2, `${(code.length - 2) / 2} bytes`);
  }

  // 2. UUPS 代理 impl 槽 (ERC1967)
  for (const name of ['FidesCompliance', 'RiskRegistry', 'PolicyEngine']) {
    const raw = await provider.getStorage(C[name].address, ERC1967_IMPL_SLOT);
    const impl = ethers.getAddress('0x' + raw.slice(26));
    check(`impl:${name}`, impl.toLowerCase() === C[name].implementation.toLowerCase(), impl);
  }

  // 3. Merkle 名单状态
  const merkle = new ethers.Contract(C.MerkleRiskRegistry.address, artifact('MerkleRiskRegistry'), provider);
  const root = await merkle.merkleRoot();
  check('merkleRoot=OFAC', root.toLowerCase() === EXPECTED_MERKLE_ROOT.toLowerCase(), root);
  const lastUpd = await merkle.lastOracleRootUpdate();
  check('lastOracleRootUpdate>0', lastUpd > 0n, new Date(Number(lastUpd) * 1000).toISOString());

  // 4. 角色矩阵
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ORACLE_ROLE'));
  const CE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('COMPLIANCE_ENGINE_ROLE'));
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
  const deployer = RECORD.deployer;
  const diamond = C.DiamondComplianceEngine.address;

  const rr = new ethers.Contract(C.RiskRegistry.address, artifact('RiskRegistry'), provider);
  check('RiskRegistry.ORACLE_ROLE→Diamond', await rr.hasRole(ORACLE_ROLE, diamond));
  check('RiskRegistry.ORACLE_ROLE→deployer', await rr.hasRole(ORACLE_ROLE, deployer));
  const pe = new ethers.Contract(C.PolicyEngine.address, artifact('PolicyEngine'), provider);
  check('PolicyEngine.CE_ROLE→Diamond', await pe.hasRole(CE_ROLE, diamond));
  const adminAbi = facetArtifact('AdminFacet');
  const dm = new ethers.Contract(diamond, adminAbi, provider);
  check('Diamond.OPERATOR_ROLE→deployer', await dm.hasRole(OPERATOR_ROLE, deployer));

  // 5. Diamond loupe: facet 数与选择器数
  const loupe = new ethers.Contract(diamond, facetArtifact('DiamondLoupeFacet'), provider);
  const facets = await loupe.facets();
  const selectorCount = facets.reduce((n, f) => n + f.functionSelectors.length, 0);
  check('diamond facets=6', facets.length === 6, String(facets.length));
  check('diamond selectors=79', selectorCount === 79, String(selectorCount));

  // 6. 汇总
  let pass = 0;
  for (const r of results) { if (r.ok) pass++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`); }
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('SCRIPT ERROR:', e.message); process.exit(2); });
