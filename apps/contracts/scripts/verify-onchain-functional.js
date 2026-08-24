// v3.1.0 Sepolia 链上功能实证（真实交易，测试网）
// 验证: H-2 mint/compliance-on, 风险阻断, 冷却期隔离(quarantine), OFAC Merkle 验证
// 用法: pnpm exec node scripts/verify-onchain-functional.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// data-sync 不在 pnpm workspace（根 pnpm-workspace.yaml 只含 apps/*、packages/*），
// 其 ethers 依赖经由本包 node_modules 解析：
process.env.NODE_PATH = path.join(__dirname, '..', 'node_modules');
require('module').Module._initPaths();

const RECORD = require('../deployments/sepolia-latest.json');
const { loadTree, getProof } = require('../../../data-sync/src/merkleBuilder');

const art = (name, sub = '') => JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'artifacts', 'contracts', sub, `${name}.sol`, `${name}.json`))).abi;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };
const explorer = (h) => `https://sepolia.etherscan.io/tx/${h}`;

(async () => {
  const req = new ethers.FetchRequest(process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com');
  req.setHeader('User-Agent', 'Mozilla/5.0');
  const provider = new ethers.JsonRpcProvider(req);
  const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  const deployer = wallet.address;
  console.log('signer:', deployer, '| balance:', ethers.formatEther(await provider.getBalance(deployer)), 'ETH\n');

  const C = RECORD.contracts;
  const fusd = new ethers.Contract(C.CompliantStableCoin.address, art('CompliantStableCoin', 'examples'), wallet);
  const rr = new ethers.Contract(C.RiskRegistry.address, art('RiskRegistry'), wallet);
  const mk = new ethers.Contract(C.MerkleRiskRegistry.address, art('MerkleRiskRegistry'), wallet);
  const diamondAbi = [...art('AdminFacet', 'facets'), ...art('ComplianceCoreFacet', 'facets'), ...art('AssetComplianceFacet', 'facets')];
  const dm = new ethers.Contract(C.DiamondComplianceEngine.address, diamondAbi, wallet);

  const dec = await fusd.decimals();
  const addr1 = ethers.Wallet.createRandom().address; // 正常接收方
  const addr2 = ethers.Wallet.createRandom().address; // 将被标记制裁的地址
  console.log('test addr1:', addr1, '\ntest addr2:', addr2, '| fUSD decimals:', dec, '\n');

  // ---- P0: 前置条件 ----
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
  const DADMIN = await fusd.DEFAULT_ADMIN_ROLE();
  if (!(await fusd.hasRole(MINTER_ROLE, deployer))) {
    if (await fusd.hasRole(DADMIN, deployer)) {
      const t = await fusd.grantRole(MINTER_ROLE, deployer); await t.wait();
      console.log('granted MINTER_ROLE to deployer:', explorer(t.hash));
    } else throw new Error('deployer lacks MINTER_ROLE and DEFAULT_ADMIN_ROLE on fUSD');
  }
  check('P0 fUSD complianceEnabled', await fusd.complianceEnabled());
  check('P0 fUSD engine == Diamond', (await fusd.complianceEngine()).toLowerCase() === C.DiamondComplianceEngine.address.toLowerCase());
  const ADMIN_ROLE_D = await dm.ADMIN_ROLE();
  check('P0 Diamond ADMIN_ROLE→deployer', await dm.hasRole(ADMIN_ROLE_D, deployer));

  // ---- P0.5: deployer 风险档案（UNKNOWN 可能被引擎拦截，先登记 LOW）----
  let tx = await rr.updateRiskProfile(deployer, 10, 1, [], false); await tx.wait();
  console.log('deployer profile LOW set:', explorer(tx.hash));

  // ---- P1: H-2 证据 —— 合规开启下 mint ----
  const mintAmt = ethers.parseUnits('1000', dec);
  tx = await fusd.mint(deployer, mintAmt); const r1 = await tx.wait();
  const bal0 = await fusd.balanceOf(deployer);
  check('P1 mint 1000 fUSD (compliance ON) [H-2]', bal0 >= mintAmt, explorer(tx.hash));

  // ---- P2: 正常转账（LOW 风险接收方）----
  tx = await rr.updateRiskProfile(addr1, 10, 1, [], false); await tx.wait();
  const sendAmt = ethers.parseUnits('100', dec);
  tx = await fusd.transfer(addr1, sendAmt); await tx.wait();
  const bal1 = await fusd.balanceOf(addr1);
  check('P2 transfer 100 fUSD → LOW-risk addr1', bal1 === sendAmt, explorer(tx.hash));

  // ---- P3: 制裁地址阻断 ----
  tx = await rr.updateRiskProfile(addr2, 100, 4, [], true); await tx.wait();
  console.log('addr2 flagged CRITICAL+sanctioned:', explorer(tx.hash));
  let blocked = false, reason = '';
  try {
    const t3 = await fusd.transfer(addr2, ethers.parseUnits('50', dec));
    await t3.wait();
  } catch (e) { blocked = true; reason = (e.info?.error?.message || e.shortMessage || e.message || '').slice(0, 120); }
  check('P3 transfer → sanctioned addr2 REVERTED', blocked, reason);

  // ---- P4: 冷却期隔离（quarantine / HOLD）----
  const fusdAddr = C.CompliantStableCoin.address;
  const origPolicy = await dm.issuerPolicies(fusdAddr);
  const testPolicy = { maxTxAmount: 0n, dailyLimit: 0n, allowMediumRisk: true, allowHighRisk: true, blockMixer: false, requireDestinationKYC: false, cooldownPeriod: 3600n, blockedTokens: [] };
  tx = await dm.setIssuerPolicy(fusdAddr, testPolicy); await tx.wait();
  console.log('issuer policy cooldown=3600 set:', explorer(tx.hash));

  const one = ethers.parseUnits('1', dec);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  tx = await dm.checkTransferWithDeadline(deployer, addr1, one, fusdAddr, deadline);
  const r4a = await tx.wait();
  const q1 = r4a.logs.some(l => l.topics[0] === ethers.id('TransactionQuarantined(address,address,uint256,address,bytes32,uint256,uint256)'));
  check('P4a first checkTransfer ALLOW (no quarantine)', !q1, explorer(tx.hash));

  tx = await dm.checkTransferWithDeadline(deployer, addr1, one, fusdAddr, deadline);
  const r4b = await tx.wait();
  const qEv = r4b.logs.find(l => l.topics[0] === ethers.id('TransactionQuarantined(address,address,uint256,address,bytes32,uint256,uint256)'));
  check('P4b immediate retry → QUARANTINED (HOLD)', !!qEv, explorer(tx.hash));
  const qlen = await dm.getQuarantineListLength();
  check('P4c quarantine record on-chain', qlen > 0n, 'list length=' + qlen);

  // 恢复策略
  tx = await dm.setIssuerPolicy(fusdAddr, {
    maxTxAmount: origPolicy[0], dailyLimit: origPolicy[1], allowMediumRisk: origPolicy[2],
    allowHighRisk: origPolicy[3], blockMixer: origPolicy[4], requireDestinationKYC: origPolicy[5],
    cooldownPeriod: origPolicy[6], blockedTokens: origPolicy[7],
  }); await tx.wait();
  console.log('issuer policy restored:', explorer(tx.hash));

  // ---- P5: OFAC Merkle 名单 verifyAddress（只读）----
  let raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'data-sync', 'cache', 'merkle-tree.json'), 'utf8'));
  if (typeof raw === 'string') raw = JSON.parse(raw); // 快照文件是双层 JSON 编码
  const tree = loadTree(raw);
  const entry = raw.entries[0];
  const proof = getProof(tree, entry.address, entry.riskScore, entry.tier);
  const okPos = await mk.verifyAddress.staticCall(entry.address, entry.riskScore, entry.tier, proof);
  const okNeg = await mk.verifyAddress.staticCall(entry.address, 50, 2, proof); // 错误分数应拒绝
  check('P5a OFAC addr verifyAddress TRUE', okPos === true, entry.address);
  check('P5b wrong-score verifyAddress FALSE', okNeg === false);

  // ---- 清理 ----
  try { tx = await rr.removeRiskProfile(addr2); await tx.wait(); console.log('cleanup: addr2 profile removed:', explorer(tx.hash)); } catch (e) { console.log('cleanup addr2 failed:', e.shortMessage || e.message); }

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${pass}/${results.length} functional checks passed`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('SCRIPT ERROR:', e.shortMessage || e.message); process.exit(2); });
