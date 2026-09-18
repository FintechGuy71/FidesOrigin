// ── DOM-Safe Helpers (SEC-003 Fix) ──────────────────────────────────
function _el(id) { return document.getElementById(id); }

/** Create an element with optional properties */
function _create(tag, opts) {
  const e = document.createElement(tag);
  if (!opts) return e;
  if (opts.className) e.className = opts.className;
  if (opts.text != null) e.textContent = opts.text;
  if (opts.html != null) e.innerHTML = opts.html; // only for trusted static HTML
  if (opts.style) Object.assign(e.style, opts.style);
  if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

/** Create a table cell (td or th) */
function _cell(text, className) {
  return _create('td', { text, className });
}

/** Create a badge span */
function _badge(text, className) {
  return _create('span', { text, className: 'tag ' + className });
}

/* [AUDIT FIX 2026-09-17 R1-007] <tr> 的合法子元素只有 td/th。
   原实现多处 tr.appendChild(_badge(...))（span 直挂 tr）以及
   _create('td').appendChild(badge) || _create('td')（appendChild 返回 badge，
   badge 被挂到 tr 下）——浏览器 foster-parenting 会把这些 span 提升到表格
   之外，导致列错位/布局破坏。统一用 td 包裹 badge。 */
function _badgeCell(text, className) {
  const td = _create('td');
  td.appendChild(_badge(text, className));
  return td;
}

/** Clear all children from an element */
function _clear(id) {
  const e = _el(id);
  if (e) while (e.firstChild) e.removeChild(e.firstChild);
  return e;
}

/** Set a tbody to loading state */
function _loading(id, message) {
  const tbody = _clear(id);
  if (!tbody) return;
  const tr = _create('tr');
  const td = _create('td', {
    className: 'table-loading',
    attrs: { colspan: '8' }
  });
  const spinner = _create('div', { className: 'spinner' });
  const msg = _create('div', { text: message });
  td.appendChild(spinner);
  td.appendChild(msg);
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/** Set a tbody to empty state */
function _empty(id, message, colspan) {
  const tbody = _clear(id);
  if (!tbody) return;
  const tr = _create('tr');
  const td = _create('td', {
    text: message,
    attrs: { colspan: String(colspan) }
  });
  td.style.textAlign = 'center';
  td.style.color = 'var(--text-secondary)';
  tr.appendChild(td);
  tbody.appendChild(tr);
}

/** Format an address for display */
function _fmtAddr(addr) {
  if (!addr || addr.length < 10) return addr || '-';
  return addr.slice(0, 10) + '...' + addr.slice(-4);
}

/** Format a timestamp */
function _fmtTime(ts) {
  if (!ts) return '-';
  return new Date(Number(ts) * 1000).toLocaleString();
}

// Contract ABI (simplified)
const CONTRACT_ABI = [
  "function getContractInfo() view returns (string name, string symbol, uint8 decimals, uint256 totalSupply, uint256 vipCount, uint256 greyCount, uint256 blackCount, bool paused, uint256 timelockDelay, uint256 requiredSigs, uint256 signerCount)",
  "function getRiskLevel(address account) view returns (uint8)",
  "function getRiskLevelName(address account) view returns (string)",
  "function getLimitInfo(address account) view returns (string levelName, uint256 dailyLimit, uint256 singleLimit, uint256 dailyUsed, uint256 remaining, bool limited)",
  "function getVIPList() view returns (address[])",
  "function getGreyList() view returns (address[])",
  "function getBlackList() view returns (address[])",
  "function tagAddress(address account, uint8 level, string reason)",
  "function untagAddress(address account)",
  "function mint(address to, uint256 amount)",
  "function emergencyPause()",
  "function emergencyUnpause()",
  "function addSigner(address signer)",
  "function removeSigner(address signer)",
  "function updateRequiredSignatures(uint256 newRequired)",
  "function getSigners() view returns (address[])",
  "function isSigner(address account) view returns (bool)",
  "function scheduleOperation(uint8 operationType, address target, uint256 value, bytes data) returns (bytes32)",
  "function signOperation(bytes32 operationId)",
  "function executeOperation(bytes32 operationId)",
  "function getPendingOperations() view returns (bytes32[])",
  "function getOperationDetails(bytes32 operationId) view returns (uint8 operationType, address target, uint256 value, bytes data, uint256 timestamp, bool executed, uint256 signatureCount, uint256 requiredSignatures)",
  "function updateTimelockDelay(uint256 newDelay)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event AddressTagged(address indexed account, uint8 level, string reason, address indexed operator)",
  "event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason)"
];

// v3.1.0 权威地址（与 DEPLOYED.md 一致；fallback 仅在 admin-config.js 未加载时使用）
const SEPOLIA_ADDRESSES = window.SEPOLIA_ADDRESSES || Object.freeze({
  RiskRegistry: '0x953f985f38f94d6159c0600d1f15D543895cE896',
  PolicyEngine: '0xCA12BB2daD2a6D429277823366D8C88a490EDDeA',
  ComplianceEngine: '0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E', // Diamond 引擎
  CompliantStableCoin: '0x2245A8FCf6aca017327eA8950Ba510e9596595E9',
  CompliantSmartWallet: 'PENDING', // v3.1.0 未部署
  FidesCompliance: '0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5',
  TestUSD: '0x34c76eE51f3A063365279f510dA9503dF809D374',
  QuarantineVault: '0x6803E163259B07F58111f56423aB0732858196Be',
  MerkleRiskRegistry: '0x31A034efbe22eDc1a78ceb37F52BA869D869c33B'
});

/* [AUDIT FIX R2-010/R2-032] 原实现 fetch('/api/subgraph')：静态导出没有 API routes、
   vercel.json 也没有该 rewrite，请求恒 404 → Subgraph 统计卡与合规日志永久失效。
   现改为直连 The Graph Studio 查询端点（meta CSP connect-src 已放行
   api.studio.thegraph.com），并保留 window.FIDESORIGIN_SUBGRAPH_URL 注入点
   （在 admin-config.js 或页面注入即可覆盖，便于切换版本/私有部署）。 */
const SUBGRAPH_URL =
  (typeof window !== 'undefined' && window.FIDESORIGIN_SUBGRAPH_URL) ||
  'https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.3';
const CONTRACT_ADDRESS = sessionStorage.getItem('contractAddress') || SEPOLIA_ADDRESSES.CompliantStableCoin;

let provider, signer, contract, userAddress;
/* [AUDIT FIX 2026-09-17 R1-008] 发行方策略读写发生在 ComplianceEngine
   （Diamond 引擎），不是 CompliantStableCoin。独立的策略合约实例。 */
let policyContract = null;

/* ComplianceEngine 策略相关 ABI（与 apps/contracts/contracts/ComplianceEngine.sol
   及 PolicyEngine.sol 的 struct IssuerPolicy 逐字对应）：
   setIssuerPolicy(address token, IssuerPolicy policy)
   getIssuerPolicy(address issuer) view returns (IssuerPolicy)
   合约无 rollbackToVersion —— 链上不存在策略版本回滚，原 UI 的回滚按钮
   调用的是不存在的函数（必然失败），已移除。 */
const POLICY_ABI = [
  "function setIssuerPolicy(address token, tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod, address[] blockedTokens) policy)",
  "function getIssuerPolicy(address issuer) view returns (tuple(uint256 maxTxAmount, uint256 dailyLimit, bool allowMediumRisk, bool allowHighRisk, bool blockMixer, bool requireDestinationKYC, uint256 cooldownPeriod, address[] blockedTokens))"
];
let charts = {};

// ========== The Graph Subgraph Queries ==========
async function querySubgraph(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (data.errors) {
      console.error('Subgraph errors:', data.errors);
      return null;
    }
    return data.data;
  } catch (error) {
    clearTimeout(timeout);
    console.error('Subgraph query failed:', error);
    return null;
  }
}

function showToast(message, type) {
  type = type || 'error';
  const toast = _el('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast toast-' + type + ' show';
  if (window._toastTimer) clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}

async function loadSubgraphStats() {
  try {
    const data = await querySubgraph(`
      query {
        protocolStats(id: "stats") {
          totalComplianceChecks
          totalBlocked
          totalFlagged
          totalHeld
          totalSanctioned
          totalFundsHeld
          lastUpdated
        }
      }
    `);
    if (data && data.protocolStats) {
      const s = data.protocolStats;
      const elChecks = _el('subgraphTotalChecks');
      const elBlocked = _el('subgraphBlocked');
      const elSanctioned = _el('subgraphSanctioned');
      const elHeld = _el('subgraphHeld');
      if (elChecks) elChecks.textContent = s.totalComplianceChecks || '0';
      if (elBlocked) elBlocked.textContent = s.totalBlocked || '0';
      if (elSanctioned) elSanctioned.textContent = s.totalSanctioned || '0';
      // [R3-L2] totalFundsHeld 为 6 位 decimals 原始值，与隔离页口径一致格式化
      if (elHeld) elHeld.textContent = s.totalFundsHeld ? Number(ethers.formatUnits(s.totalFundsHeld, 6)).toLocaleString() : '0';
    }
  } catch (error) {
    console.error('加载统计失败:', error);
    showToast('统计数据加载失败', 'error');
  }
}

async function loadSubgraphRiskProfiles() {
  try {
    const data = await querySubgraph(`
      query {
        riskProfiles(first: 50, orderBy: lastUpdated, orderDirection: desc) {
          id
          riskScore
          tier
          isSanctioned
          tags
          lastUpdated
        }
      }
    `);
    if (data && data.riskProfiles) {
      const tbody = _clear('customersTable');
      if (!tbody) return;

      const checkData = await querySubgraph(`
        query {
          complianceChecks(first: 200, orderBy: timestamp, orderDirection: desc) {
            id
            from
            timestamp
          }
        }
      `);
      const lastCheckMap = {};
      if (checkData && checkData.complianceChecks) {
        checkData.complianceChecks.forEach(c => {
          const addr = c.from;
          const key = addr.toLowerCase(); // [R3-L8] 与 profile.id（小写）对齐
          if (addr && !lastCheckMap[key]) {
            lastCheckMap[key] = c.timestamp;
          }
        });
      }

      const tierColors = { UNKNOWN: '#94a3b8', LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

      data.riskProfiles.forEach(profile => {
        const tagTime = _fmtTime(profile.lastUpdated);
        const lastTx = lastCheckMap[profile.id.toLowerCase()] ? _fmtTime(lastCheckMap[profile.id.toLowerCase()]) : '-';
        const tags = (profile.tags || []).join(', ') || '-';

        const tr = _create('tr');

        const tdAddr = _cell(_fmtAddr(profile.id), 'address-cell');
        tr.appendChild(tdAddr);

        const tdTier = _create('td');
        const tierSpan = _create('span', {
          text: profile.tier + ' (' + profile.riskScore + ')'
        });
        tierSpan.style.color = tierColors[profile.tier] || '#94a3b8';
        tdTier.appendChild(tierSpan);
        tr.appendChild(tdTier);

        tr.appendChild(_cell(lastTx, ''));
        tr.appendChild(_cell(tagTime, ''));
        tr.appendChild(_cell(tags, ''));

        const tdAction = _create('td');
        const btnView = _create('button', {
          text: '查看',
          className: 'btn btn-sm btn-primary'
        });
        btnView.setAttribute('data-action', 'viewProfile');
        btnView.setAttribute('data-address', profile.id);
        tdAction.appendChild(btnView);

        if (profile.isSanctioned) {
          tdAction.appendChild(document.createTextNode(' '));
          tdAction.appendChild(_badge('已制裁', 'tag-black'));
        }
        tr.appendChild(tdAction);

        tbody.appendChild(tr);
      });
    }
  } catch (error) {
    console.error('加载客户列表失败:', error);
    showToast('客户列表加载失败', 'error');
  }
}

async function loadSubgraphComplianceChecks(decision) {
  var whereClause = '';
  if (decision) whereClause = ', where: { decision: "' + decision + '" }';

  try {
    const data = await querySubgraph(`
      query {
        complianceChecks(first: 50, orderBy: timestamp, orderDirection: desc${whereClause}) {
          id
          operator
          from
          to
          amount
          decision
          reason
          timestamp
        }
      }
    `);
    if (data && data.complianceChecks) {
      const checks = data.complianceChecks;
      const decisionColors = { ALLOW: 'var(--success)', BLOCK: 'var(--danger)', FLAG: 'var(--warning)', HOLD: 'var(--accent-cyan)' };

      // Update dashboard transactions table
      const tbody = _clear('transactionsTable');
      if (tbody) {
        checks.slice(0, 20).forEach(check => {
          const date = new Date(check.timestamp * 1000).toLocaleString();
          const tr = _create('tr');
          tr.appendChild(_cell(_fmtAddr(check.from), 'address-cell'));
          tr.appendChild(_cell(_fmtAddr(check.to), 'address-cell'));
          tr.appendChild(_cell(ethers.formatUnits(check.amount, 6), ''));

          const tdDecision = _create('td');
          const decSpan = _create('span', { text: check.decision });
          decSpan.style.color = decisionColors[check.decision] || '#94a3b8';
          tdDecision.appendChild(decSpan);
          tr.appendChild(tdDecision);

          tr.appendChild(_cell(check.reason || '-', ''));
          tr.appendChild(_cell(date, ''));
          tr.appendChild(_badgeCell('已处理', 'badge-success'));
          tbody.appendChild(tr);
        });
      }

      // Update compliance logs page table
      const logsTbody = _clear('complianceLogsTable');
      if (logsTbody) {
        checks.forEach(check => {
          const date = new Date(check.timestamp * 1000).toLocaleString();
          const tr = _create('tr');
          tr.appendChild(_cell(_fmtAddr(check.from), 'address-cell'));
          tr.appendChild(_cell(_fmtAddr(check.to), 'address-cell'));
          tr.appendChild(_cell(ethers.formatUnits(check.amount, 6), ''));

          const tdDecision = _create('td');
          const decSpan = _create('span', { text: check.decision });
          decSpan.style.color = decisionColors[check.decision] || '#94a3b8';
          tdDecision.appendChild(decSpan);
          tr.appendChild(tdDecision);

          tr.appendChild(_cell(check.reason || '-', ''));
          tr.appendChild(_cell(date, ''));
          logsTbody.appendChild(tr);
        });
      }
    }
  } catch (error) {
    console.error('加载合规检查失败:', error);
    showToast('合规检查数据加载失败', 'error');
  }
}

async function loadSubgraphPolicies() {
  const data = await querySubgraph(`
    query {
      policies(first: 10) {
        id
        issuer
        version
        maxTxAmount
        dailyLimit
        allowMediumRisk
        allowHighRisk
        blockMixer
        updatedAt
      }
    }
  `);
  if (data && data.policies) {
    console.log('Subgraph policies:', data.policies);
  }
}

async function loadSubgraphChartData() {
  try {
    const riskData = await querySubgraph(`
      query {
        riskProfiles(first: 1000) {
          id
          tier
          isSanctioned
        }
      }
    `);
    if (riskData && riskData.riskProfiles && charts.risk) {
      const profiles = riskData.riskProfiles;
      const vip = profiles.filter(p => p.tier === 'LOW').length;
      const normal = profiles.filter(p => p.tier === 'UNKNOWN').length;
      const grey = profiles.filter(p => p.tier === 'MEDIUM').length;
      const black = profiles.filter(p => p.tier === 'HIGH' || p.isSanctioned).length;
      charts.risk.data.datasets[0].data = [vip, normal, grey, black];
      charts.risk._subgraphLoaded = true; // [R3-L4] 标记数据归属，防合约版覆盖
      charts.risk.update();
    }

    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 86400;
    const txData = await querySubgraph(`
      query {
        complianceChecks(
          first: 200,
          orderBy: timestamp,
          orderDirection: desc,
          where: { timestamp_gte: ${dayAgo} }
        ) {
          id
          decision
          timestamp
        }
      }
    `);
    if (txData && txData.complianceChecks && charts.tx) {
      const bins = [
        { label: '00:00', allow: 0, block: 0 },
        { label: '04:00', allow: 0, block: 0 },
        { label: '08:00', allow: 0, block: 0 },
        { label: '12:00', allow: 0, block: 0 },
        { label: '16:00', allow: 0, block: 0 },
        { label: '20:00', allow: 0, block: 0 }
      ];
      txData.complianceChecks.forEach(c => {
        const h = new Date(c.timestamp * 1000).getUTCHours(); // [R3-L3] 与 UTC epoch 过滤口径一致
        const binIndex = Math.floor(h / 4);
        if (bins[binIndex]) {
          if (c.decision === 'ALLOW') bins[binIndex].allow++;
          else bins[binIndex].block++;
        }
      });
      charts.tx.data.labels = bins.map(b => b.label);
      charts.tx.data.datasets[0].data = bins.map(b => b.allow);
      charts.tx.data.datasets[1].data = bins.map(b => b.block);
      charts.tx.update();
    }

    if (contract && charts.role) {
      const signers = await contract.getSigners();
      const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
      const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
      const VIEWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VIEWER_ROLE'));

      let adminCount = 0, operatorCount = 0, viewerCount = 0, signerCount = 0;
      for (const addr of signers) {
        const [isAdmin, isOperator, isViewer] = await Promise.all([
          contract.hasRole(ADMIN_ROLE, addr),
          contract.hasRole(OPERATOR_ROLE, addr),
          contract.hasRole(VIEWER_ROLE, addr)
        ]);
        if (isAdmin) adminCount++;
        else if (isOperator) operatorCount++;
        else if (isViewer) viewerCount++;
        else signerCount++;
      }
      charts.role.data.datasets[0].data = [adminCount, operatorCount, viewerCount, signerCount];
      charts.role.update();
    }
  } catch (error) {
    console.error('Chart data load failed:', error);
    showToast('图表数据加载失败', 'error');
  }
}

// ========== Sepolia Network Detection ==========
async function checkNetwork() {
  if (!provider) return;
  try {
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    const networkBadge = _el('networkBadge');
    if (networkBadge) {
      if (chainId === 11155111n) {
        networkBadge.textContent = 'Sepolia';
        networkBadge.style.background = 'var(--success)';
        networkBadge.style.color = '#fff';
      } else {
        networkBadge.textContent = 'Network: ' + chainId.toString();
        networkBadge.style.background = 'var(--warning)';
        networkBadge.style.color = '#000';
      }
    }
  } catch(e) {
    console.error('Network check failed:', e);
  }
}

// ========== Original Functions ==========

document.addEventListener('DOMContentLoaded', () => {
  // [AUDIT FIX 2026-09-18 R3-L5] chart.min.js 加载失败时 new Chart 抛错会中止
  // 整个回调（事件委托与设置加载全部不注册 → 整页功能死亡）。隔离失败域。
  try { initCharts(); } catch (e) { console.error('图表初始化失败:', e); }
  loadSettings();

  // Change event listeners for filter selects (CSP compliance)
  const filterStatus = _el('filterStatus');
  if (filterStatus) filterStatus.addEventListener('change', filterQuarantineRecords);
  const filterDecision = _el('filterDecision');
  if (filterDecision) filterDecision.addEventListener('change', filterComplianceLogs);

  document.body.addEventListener('click', function(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (!action) return;

    switch (action) {
      case 'showPage': showPage(el.dataset.page); break;
      case 'closeModal': closeModal(el.dataset.modal); break;
      case 'connectWallet': connectWallet(); break;
      case 'connectMetaMask': connectMetaMask(); break;
      // [AUDIT FIX 2026-09-18 R3] viewProfile 原无 dispatch 分支 → 死按钮
      case 'viewProfile': viewProfile(el.dataset.address || ''); break;
      case 'loadBlockedTransfers': loadBlockedTransfers(); break;
      case 'refreshMonitor': refreshMonitor(); break;
      case 'openTagModal': openTagModal(); break;
      case 'openTimelockConfigModal': openTimelockConfigModal(); break;
      case 'loadPendingOperations': loadPendingOperations(); break;
      case 'openAddSignerModal': openAddSignerModal(); break;
      case 'updateRequiredSigs': updateRequiredSigs(); break;
      case 'loadSigners': loadSigners(); break;
      case 'loadQuarantineRecords': loadQuarantineRecords(); break;
      case 'loadIncomingBlocks': loadIncomingBlocks(); break;
      case 'emergencyPause': emergencyPause(); break;
      case 'emergencyUnpause': emergencyUnpause(); break;
      case 'loadLogs': loadLogs(); break;
      case 'loadPolicies': loadPolicies(); break;
      case 'openPolicyModal': openPolicyModal(); break;
      case 'loadSubgraphComplianceChecks': loadSubgraphComplianceChecks(); break;
      case 'saveSettings': saveSettings(); break;
      case 'submitTag': submitTag(); break;
      case 'submitAddSigner': submitAddSigner(); break;
      case 'submitTimelockConfig': submitTimelockConfig(); break;
      case 'submitPolicy': submitPolicy(); break;
      case 'toggleMobileSidebar': toggleMobileSidebar(); break;
      case 'filterQuarantineRecords': filterQuarantineRecords(); break;
      case 'filterComplianceLogs': filterComplianceLogs(); break;
      default: console.warn('[Event] Unknown data-action:', action);
    }
  });
});

function initCharts() {
  const chartConfig = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8' }
      }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
    }
  };

  charts.risk = new Chart(document.getElementById('riskChart'), {
    type: 'doughnut',
    data: {
      labels: ['VIP', '普通', '灰名单', '黑名单'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#f59e0b', '#22c55e', '#94a3b8', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
  });

  charts.role = new Chart(document.getElementById('roleChart'), {
    type: 'pie',
    data: {
      labels: ['Admin', 'Operator', 'Viewer', 'Signer'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#c9a96e', '#06b6d4', '#94a3b8', '#ec4899'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
  });

  charts.tx = new Chart(document.getElementById('txChart'), {
    type: 'line',
    data: {
      labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
      datasets: [
        {
          label: '正常交易',
          data: [0, 0, 0, 0, 0, 0],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: '拦截次数',
          data: [0, 0, 0, 0, 0, 0],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: chartConfig
  });

  /* [AUDIT FIX 2026-09-17 R1-006/B2-003] 「实时TPS」图表原由 Math.random()
     伪随机数驱动（每 2 秒编造一条曲线）——合规产品的运营后台不得展示虚构
     实时指标（同仓 M-15 修复原则）。无真实 TPS 数据源，图表与定时器整体移除，
     HTML 侧替换为「暂无实时数据源」说明。 */
}

async function connectWallet() {
  document.getElementById('connectModal').classList.add('active');
}

async function connectMetaMask() {
  try {
    if (!window.ethereum) {
      alert('请安装 MetaMask!');
      return;
    }
    const eth = window.ethereum;
    if (typeof eth.request !== 'function' || typeof eth.on !== 'function') {
      alert('检测到不兼容的 Web3 Provider。请使用 MetaMask 或其他标准 EIP-1193 钱包。');
      return;
    }
    const isMetaMask = eth.isMetaMask === true;
    const allowedProviders = window.ALLOWED_WEB3_PROVIDERS || ['MetaMask'];
    if (!isMetaMask && !allowedProviders.some(name =>
      (eth.isMetaMask && name === 'MetaMask') ||
      (eth.isCoinbaseWallet && name === 'CoinbaseWallet') ||
      (eth.isWalletConnect && name === 'WalletConnect') ||
      (eth.isTrust && name === 'TrustWallet')
    )) {
      console.error('[Web3] Unknown provider detected:', eth);
      alert('不支持的 Web3 Provider。请使用 MetaMask 或联系管理员添加白名单。');
      return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    /* [AUDIT FIX 2026-09-18 R3] 原实现不监听 accountsChanged/chainChanged：
       切换账户后 UI 显示旧身份而 signer 用新账户签名（身份不一致）；
       切换网络后读写静默打到错误的链。切换后重新初始化连接。 */
    if (!window.ethereum._fidesListenersBound) {
      window.ethereum._fidesListenersBound = true;
      window.ethereum.on('accountsChanged', function () { location.reload(); });
      window.ethereum.on('chainChanged', function () { location.reload(); });
    }
    // [R1-008] 策略读写走 ComplianceEngine（策略不在代币合约上）
    policyContract = new ethers.Contract(SEPOLIA_ADDRESSES.ComplianceEngine, POLICY_ABI, signer);

    const ws = _el('walletStatus');
    if (ws) ws.className = 'wallet-status connected';
    const sd = ws ? ws.querySelector('.status-dot') : null;
    if (sd) sd.className = 'status-dot connected';
    const wa = _el('walletAddress');
    if (wa) wa.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
    const cb = _el('connectBtn');
    if (cb) cb.style.display = 'none';

    closeModal('connectModal');

    await checkNetwork();
    await loadSubgraphStats();
    await loadSubgraphRiskProfiles();
    await loadSubgraphComplianceChecks();
    await loadSubgraphChartData();
    await loadQuarantineRecordsFromSubgraph();
    await loadIncomingBlocksFromSubgraph();
    await loadBlockedTransfers();
    await loadContractData();
    await loadUserRole();
    startDataPolling();

  } catch (error) {
    console.error('连接失败:', error);
    alert('连接失败: ' + error.message);
  }
}

async function loadContractData() {
  if (!contract) return;
  try {
    const info = await contract.getContractInfo();

    const ts = _el('totalSupply');
    /* [AUDIT FIX 2026-09-17 R1-012] 原硬编码 formatUnits(..., 18)，而
       CompliantStableCoin TOKEN_DECIMALS = 6 → 总供应量被放大 10^12 倍。
       改用 getContractInfo 返回的 decimals 字段动态格式化。 */
    if (ts) ts.textContent = Number(ethers.formatUnits(info.totalSupply, Number(info.decimals ?? 6))).toLocaleString();

    const totalTagged = Number(info.vipCount) + Number(info.greyCount) + Number(info.blackCount);
    const tt = _el('totalTagged');
    if (tt) tt.textContent = totalTagged;
    const vc = _el('vipCount');
    if (vc) vc.textContent = info.vipCount;
    const bc = _el('blackCount');
    if (bc) bc.textContent = info.blackCount;

    const cs = _el('contractStatus');
    if (cs) {
      cs.textContent = info.paused ? '已暂停' : '正常';
      cs.style.color = info.paused ? 'var(--danger)' : 'var(--success)';
    }
    /* [AUDIT FIX 2026-09-17 B2-004] 紧急暂停页的 pauseStatus 原为硬编码
       「合约运行正常」静态文案，与合约真实 paused 状态无关。接入真实状态。 */
    const ps = _el('pauseStatus');
    if (ps) {
      ps.innerHTML = info.paused
        ? '<div style="font-size: 4rem; margin-bottom: 16px;">⏸️</div><div style="font-size: 1.5rem; font-weight: 600; color: var(--danger);">合约已暂停</div><div style="color: var(--text-secondary); margin-top: 8px;">转账、铸造等操作已被阻止</div>'
        : '<div style="font-size: 4rem; margin-bottom: 16px;">✅</div><div style="font-size: 1.5rem; font-weight: 600; color: var(--success);">合约运行正常</div><div style="color: var(--text-secondary); margin-top: 8px;">所有功能正常运行</div>';
    }
    const ss = _el('signerStatus');
    if (ss) ss.textContent = '签名者: ' + info.signerCount;

    /* [AUDIT FIX 2026-09-18 R3-L4] 原实现与 loadSubgraphChartData 双写同一图表
       且 normal 恒 0 → 加载顺序决定「普通」分片被谁抹掉。合约版改为只在
       subgraph 数据尚未到达时写入（互不覆盖）。 */
    if (charts.risk && !charts.risk._subgraphLoaded) {
      charts.risk.data.datasets[0].data = [
        Number(info.vipCount), 0, Number(info.greyCount), Number(info.blackCount)
      ];
      charts.risk.update();
    }

    const pending = await contract.getPendingOperations();
    const po = _el('pendingOps');
    if (po) po.textContent = pending.length;
    const pc = _el('pendingCount');
    if (pc) pc.textContent = pending.length;

  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

async function loadUserRole() {
  if (!contract || !userAddress) return;
  try {
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
    const VIEWER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('VIEWER_ROLE'));

    const [isAdmin, isOperator, isViewer] = await Promise.all([
      contract.hasRole(ADMIN_ROLE, userAddress),
      contract.hasRole(OPERATOR_ROLE, userAddress),
      contract.hasRole(VIEWER_ROLE, userAddress)
    ]);

    let role = '无权限';
    if (isAdmin) role = '管理员 (Admin)';
    else if (isOperator) role = '操作员 (Operator)';
    else if (isViewer) role = '查看者 (Viewer)';

    const ur = _el('userRole');
    if (ur) ur.textContent = role;

  } catch (error) {
    console.error('加载角色失败:', error);
  }
}

// ========== Quarantine Functions ==========
async function loadQuarantineRecords() {
  await loadQuarantineRecordsFromSubgraph();
}

async function loadQuarantineRecordsFromSubgraph(statusFilter = '') {
  const tbody = _clear('quarantineTable');
  if (!tbody) return;
  _loading('quarantineTable', '加载中...');

  try {
    const data = await querySubgraph(`
      query {
        holdRecords(first: 50, orderBy: timestamp, orderDirection: desc) {
          id
          owner { id }
          token
          amount
          reason
          timestamp
          released
          releasedAt
        }
      }
    `);

    if (data && data.holdRecords) {
      const tbody2 = _clear('quarantineTable');
      let totalHeld = 0n;
      let pendingCount = 0;
      let frozenCount = 0;
      // [R1-010] 应用状态下拉过滤
      const records = statusFilter === 'active'
        ? data.holdRecords.filter(r => !r.released)
        : statusFilter === 'released'
        ? data.holdRecords.filter(r => r.released)
        : data.holdRecords;

      records.forEach(record => {
        const amount = BigInt(record.amount);
        const amountFormatted = ethers.formatUnits(amount, 6);
        totalHeld += amount;
        if (!record.released) pendingCount++;

        const tr = _create('tr');
        tr.appendChild(_cell(_fmtAddr(record.id), 'address-cell'));
        const owner = record.owner ? record.owner.id : record.id;
        tr.appendChild(_cell(_fmtAddr(owner), 'address-cell'));
        tr.appendChild(_cell(record.token || 'TUSD', ''));
        tr.appendChild(_cell(amountFormatted, ''));
        tr.appendChild(_cell(_fmtTime(record.timestamp), ''));
        tr.appendChild(_cell(record.reason || '-', ''));

        tr.appendChild(_badgeCell(record.released ? '已释放' : '待处理', record.released ? 'tag-success' : 'tag-warning'));

        const tdActions = _create('td');
        if (!record.released) {
          const btnRelease = _create('button', { text: '释放', className: 'btn btn-sm btn-success' });
          btnRelease.onclick = function() { releaseFunds(record.id); };
          tdActions.appendChild(btnRelease);
        } else {
          tdActions.appendChild(_cell('-', ''));
        }
        tr.appendChild(tdActions);
        tbody2.appendChild(tr);
      });

      const tq = _el('totalQuarantined');
      if (tq) tq.textContent = ethers.formatUnits(totalHeld, 6);
      const rc = _el('recordCount');
      if (rc) rc.textContent = data.holdRecords.length;
      const pr = _el('pendingRelease');
      if (pr) pr.textContent = pendingCount;
      const pf = _el('permanentlyFrozen');
      // [AUDIT FIX 2026-09-18 R3-L1] 原硬编码 '0' 伪装成真实指标；subgraph 无此状态字段
    if (pf) pf.textContent = '—';
    } else {
      _empty('quarantineTable', '暂无隔离记录', 8);
    }
  } catch (error) {
    console.error('加载隔离记录失败:', error);
    showToast('隔离记录加载失败', 'error');
    _empty('quarantineTable', '加载失败，请重试', 8);
  }
}

async function releaseFunds(recordId) {
  /* [AUDIT FIX 2026-09-17 R1-011] 原为演示桩：confirm 后仅 alert 假成功，
     不产生任何链上交易——运营人员会得到虚假反馈。隔离资金释放在
     QuarantineVault 合约上，当前后台未接入该合约写路径；在接入前明确
     拒绝操作并说明，不再伪装成功。 */
  alert('释放功能尚未接入链上执行路径（QuarantineVault 写操作未接通）。\n记录 ' + recordId + ' 未被修改，请通过合约多签流程处理。');
}

/* [R1-011] freezePermanently 已删除：同样是无链上交易的演示桩，且全站
   无任何按钮引用（死代码）。 */

/* [AUDIT FIX 2026-09-17 R1-010] 原实现直接全量重载，下拉过滤值完全被忽略。
   现把筛选值传入并按 released 标志做前端过滤（subgraph holdRecords 无 frozen
   状态字段，「永久冻结」选项已从下拉移除——见 index.html 同步修改）。 */
async function filterQuarantineRecords() {
  const sel = _el('filterStatus');
  await loadQuarantineRecordsFromSubgraph(sel ? sel.value : '');
}

async function loadIncomingBlocks() {
  await loadIncomingBlocksFromSubgraph();
}

async function loadIncomingBlocksFromSubgraph() {
  _loading('incomingBlocksTable', '加载中...');

  try {
    const data = await querySubgraph(`
      query {
        complianceChecks(
          first: 50,
          orderBy: timestamp,
          orderDirection: desc,
          where: { decision: "BLOCK" }
        ) {
          id
          transactionHash
          from
          to
          amount
          decision
          reason
          timestamp
        }
      }
    `);

    if (data && data.complianceChecks) {
      const tbody = _clear('incomingBlocksTable');
      data.complianceChecks.forEach(check => {
        const date = _fmtTime(check.timestamp);
        const tr = _create('tr');
        tr.appendChild(_cell(date, ''));
        tr.appendChild(_cell(_fmtAddr(check.from), 'address-cell'));
        tr.appendChild(_cell(_fmtAddr(check.to), 'address-cell'));
        // [AUDIT FIX 2026-09-18 R3] 本表是 receive() 拦截的 ETH 转账（表头「金额 (ETH)」），
        // ETH 为 18 位 decimals——原按 6 位格式化会把 0.01 ETH 显示成 10,000,000,000.01。
        tr.appendChild(_cell(ethers.formatUnits(check.amount, 18), ''));
        tr.appendChild(_badgeCell('黑名单', 'tag-black'));
        tr.appendChild(_cell(_fmtAddr(check.transactionHash), 'address-cell'));
        tbody.appendChild(tr);
      });
    } else {
      _empty('incomingBlocksTable', '暂无拦截记录', 6);
    }
  } catch (error) {
    console.error('加载拦截记录失败:', error);
    showToast('拦截记录加载失败', 'error');
    _empty('incomingBlocksTable', '加载失败，请重试', 6);
  }
}

async function loadBlockedTransfers() {
  _loading('blockedTable', '加载中...');

  try {
    const data = await querySubgraph(`
      query {
        complianceChecks(
          first: 20,
          orderBy: timestamp,
          orderDirection: desc,
          where: { decision_in: ["BLOCK", "FLAG"] }
        ) {
          id
          transactionHash
          from
          to
          amount
          decision
          reason
          timestamp
        }
      }
    `);

    if (data && data.complianceChecks) {
      const tbody = _clear('blockedTable');
      data.complianceChecks.forEach(check => {
        const date = _fmtTime(check.timestamp);
        const tagClass = check.decision === 'BLOCK' ? 'tag-black' : 'tag-grey';
        const tagLabel = check.decision === 'BLOCK' ? '黑名单' : '标记';
        const tr = _create('tr');
        tr.appendChild(_cell(date, ''));
        tr.appendChild(_cell(_fmtAddr(check.from), 'address-cell'));
        tr.appendChild(_badgeCell(tagLabel, tagClass));
        tr.appendChild(_cell(check.reason || '-', ''));
        tr.appendChild(_cell(ethers.formatUnits(check.amount, 6), ''));
        tbody.appendChild(tr);
      });
    } else {
      _empty('blockedTable', '暂无拦截记录', 5);
    }
  } catch (error) {
    console.error('加载拦截记录失败:', error);
    showToast('拦截记录加载失败', 'error');
    _empty('blockedTable', '加载失败，请重试', 5);
  }
}

async function refreshMonitor() {
  _loading('monitorTable', '加载中...');

  try {
    const data = await querySubgraph(`
      query {
        complianceChecks(
          first: 20,
          orderBy: timestamp,
          orderDirection: desc
        ) {
          id
          transactionHash
          from
          to
          amount
          decision
          reason
          timestamp
        }
      }
    `);

    if (data && data.complianceChecks) {
      const tbody = _clear('monitorTable');
      const statusColors = { ALLOW: 'tag-success', BLOCK: 'tag-black', FLAG: 'tag-grey', HOLD: 'tag-warning' };
      const statusLabels = { ALLOW: '允许', BLOCK: '拦截', FLAG: '标记', HOLD: '冻结' };

      data.complianceChecks.forEach(check => {
        const tr = _create('tr');
        tr.appendChild(_cell(_fmtAddr(check.id), ''));
        tr.appendChild(_cell(_fmtAddr(check.transactionHash), 'address-cell'));
        tr.appendChild(_cell(_fmtAddr(check.from), 'address-cell'));
        tr.appendChild(_cell(_fmtAddr(check.to), 'address-cell'));
        tr.appendChild(_cell(ethers.formatUnits(check.amount, 6), ''));
        tr.appendChild(_badgeCell(statusLabels[check.decision] || check.decision, statusColors[check.decision] || 'tag-grey'));
        tbody.appendChild(tr);
      });
    } else {
      _empty('monitorTable', '暂无数据', 6);
    }
  } catch (error) {
    console.error('加载监控数据失败:', error);
    showToast('监控数据加载失败', 'error');
    _empty('monitorTable', '加载失败，请重试', 6);
  }
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = _el('overlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
}

function showPage(pageId) {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });
  const page = _el(pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeNav = document.querySelector('.nav-item[data-page="' + pageId + '"]');
  if (activeNav) activeNav.classList.add('active');

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const overlay = _el('overlay');
  if (overlay) overlay.classList.remove('show');

  if (pageId === 'tags') loadTags();
  if (pageId === 'multisig') loadSigners();
  if (pageId === 'timelock') loadPendingOperations();
  if (pageId === 'logs') loadLogsFromSubgraph();
  if (pageId === 'customers') loadSubgraphRiskProfiles();
  if (pageId === 'monitor') refreshMonitor();
  if (pageId === 'dashboard') loadBlockedTransfers();
  if (pageId === 'quarantine') loadQuarantineRecordsFromSubgraph();
  if (pageId === 'incomingBlocks') loadIncomingBlocksFromSubgraph();
  if (pageId === 'complianceLogs') loadSubgraphComplianceChecks();
  if (pageId === 'policies') loadPolicies();
}

async function loadTags() {
  if (!contract) return;
  try {
    const [vips, greys, blacks] = await Promise.all([
      contract.getVIPList(),
      contract.getGreyList(),
      contract.getBlackList()
    ]);

    const tbody = _clear('tagsTable');
    if (!tbody) return;

    const tagClassMap = ['', 'tag-vip', '', 'tag-grey', 'tag-black'];
    const tagNameMap = ['', 'VIP', '', '灰名单', '黑名单'];

    [...vips.map(a => ({addr: a, level: 1, reason: 'VIP User'})),
     ...greys.map(a => ({addr: a, level: 3, reason: 'Risk Observation'})),
     ...blacks.map(a => ({addr: a, level: 4, reason: 'Known Risk'}))]
    .forEach(item => {
      const tr = _create('tr');
      tr.appendChild(_cell(item.addr, 'address-cell'));
      tr.appendChild(_badgeCell(tagNameMap[item.level] || '', tagClassMap[item.level] || ''));
      tr.appendChild(_cell(item.reason, ''));
      tr.appendChild(_cell('--', ''));

      const tdAction = _create('td');
      const btnRemove = _create('button', { text: '移除', className: 'btn btn-sm btn-secondary' });
      btnRemove.onclick = function() { removeTag(item.addr); };
      tdAction.appendChild(btnRemove);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('加载标签失败:', error);
  }
}

function openTagModal() {
  const modal = _el('tagModal');
  if (modal) modal.classList.add('active');
}

function isValidAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

async function submitTag() {
  const address = _el('tagAddress');
  const level = _el('tagLevel');
  const reason = _el('tagReason');
  const addr = address ? address.value.trim() : '';

  if (!isValidAddress(addr)) {
    alert('无效的以太坊地址，请输入以0x开头的40位十六进制地址');
    return;
  }
  if (!contract) {
    alert('请先连接钱包');
    return;
  }

  try {
    const tx = await contract.tagAddress(addr, level ? level.value : '1', reason ? reason.value : '');
    await tx.wait();
    alert('标签添加成功!');
    closeModal('tagModal');
    loadTags();
  } catch (error) {
    alert('添加失败: ' + error.message);
  }
}

async function loadSigners() {
  if (!contract) return;
  try {
    const signers = await contract.getSigners();
    const info = await contract.getContractInfo();

    const sc = _el('signerCount');
    if (sc) sc.textContent = info.signerCount;

    const tbody = _clear('signersTable');
    if (!tbody) return;

    signers.forEach(addr => {
      const isCurrentUser = addr.toLowerCase() === (userAddress ? userAddress.toLowerCase() : '');
      const tr = _create('tr');
      tr.appendChild(_cell(addr + (isCurrentUser ? ' (你)' : ''), 'address-cell'));
      tr.appendChild(_badgeCell('签名者', 'tag-admin'));
      tr.appendChild(_badgeCell('活跃', 'tag-success'));

      const tdAction = _create('td');
      const btnRemove = _create('button', { text: '移除', className: 'btn btn-sm btn-danger' });
      btnRemove.onclick = function() { removeSigner(addr); };
      tdAction.appendChild(btnRemove);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error('加载签名者失败:', error);
  }
}

function openAddSignerModal() {
  const modal = _el('signerModal');
  if (modal) modal.classList.add('active');
}

async function submitAddSigner() {
  const address = _el('signerAddress');
  const addr = address ? address.value.trim() : '';
  if (!isValidAddress(addr)) {
    alert('无效的以太坊地址，请输入以0x开头的40位十六进制地址');
    return;
  }
  if (!contract) {
    alert('请先连接钱包');
    return;
  }

  try {
    const tx = await contract.addSigner(addr);
    await tx.wait();
    alert('签名者添加成功!');
    closeModal('signerModal');
    loadSigners();
  } catch (error) {
    alert('添加失败: ' + error.message);
  }
}

async function updateRequiredSigs() {
  const newRequired = _el('requiredSigs');
  if (!contract) {
    alert('请先连接钱包');
    return;
  }
  // [AUDIT FIX 2026-09-18 R3-L9] 前端范围校验（input min/max 可被绕过）
  const reqVal = parseInt(newRequired ? newRequired.value : '2', 10);
  if (!Number.isInteger(reqVal) || reqVal < 1 || reqVal > 20) {
    alert('所需签名数必须为 1-20 的整数');
    return;
  }
  try {
    const tx = await contract.updateRequiredSignatures(reqVal);
    await tx.wait();
    alert('更新成功!');
  } catch (error) {
    alert('更新失败: ' + error.message);
  }
}

async function loadPendingOperations() {
  if (!contract) return;
  try {
    const pending = await contract.getPendingOperations();
    const tbody = _clear('pendingOpsTable');
    if (!tbody) return;

    const opTypes = ['MINT', 'BURN', 'OWNERSHIP', 'LIMITS', 'TAG', 'UNTAG', 'TIMELOCK', 'PAUSE', 'UNPAUSE'];

    for (const opId of pending) {
      const details = await contract.getOperationDetails(opId);
      const opType = opTypes[details.operationType] || 'UNKNOWN';
      const executeTime = new Date(Number(details.timestamp) * 1000).toLocaleString();

      const tr = _create('tr');
      tr.appendChild(_cell(_fmtAddr(opId), 'address-cell'));
      tr.appendChild(_cell(opType, ''));
      tr.appendChild(_cell(_fmtAddr(details.target), 'address-cell'));
      tr.appendChild(_cell(executeTime, ''));
      tr.appendChild(_cell(details.signatureCount + '/' + details.requiredSignatures, ''));

      const tdAction = _create('td');
      const btnSign = _create('button', { text: '签名', className: 'btn btn-sm btn-primary' });
      btnSign.onclick = function() { signOperation(opId); };
      tdAction.appendChild(btnSign);
      tdAction.appendChild(document.createTextNode(' '));
      const btnExec = _create('button', { text: '执行', className: 'btn btn-sm btn-success' });
      btnExec.onclick = function() { executeOperation(opId); };
      tdAction.appendChild(btnExec);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    }

    if (pending.length === 0) {
      _empty('pendingOpsTable', '暂无待执行操作', 6);
    }

  } catch (error) {
    console.error('加载待执行操作失败:', error);
  }
}

function openTimelockConfigModal() {
  const modal = _el('timelockConfigModal');
  if (modal) modal.classList.add('active');
}

async function submitTimelockConfig() {
  const days = _el('timelockDays');
  if (!contract) {
    alert('请先连接钱包');
    return;
  }
  // [AUDIT FIX 2026-09-18 R3-L9] 前端范围校验：0/负数天数不应直接上链
  const daysVal = parseFloat(days ? days.value : '2');
  if (!Number.isFinite(daysVal) || daysVal <= 0 || daysVal > 365) {
    alert('时间锁天数必须为 0-365 之间的正数');
    return;
  }
  try {
    const delayInSeconds = Math.floor(daysVal * 24 * 60 * 60);
    const tx = await contract.updateTimelockDelay(delayInSeconds);
    await tx.wait();
    alert('时间锁配置已提交，等待多签确认!');
    closeModal('timelockConfigModal');
  } catch (error) {
    alert('配置失败: ' + error.message);
  }
}

async function signOperation(opId) {
  if (!contract) return;
  try {
    const tx = await contract.signOperation(opId);
    await tx.wait();
    alert('签名成功!');
    loadPendingOperations();
  } catch (error) {
    alert('签名失败: ' + error.message);
  }
}

async function executeOperation(opId) {
  if (!contract) return;
  try {
    const tx = await contract.executeOperation(opId);
    await tx.wait();
    alert('执行成功!');
    loadPendingOperations();
  } catch (error) {
    alert('执行失败: ' + error.message);
  }
}

async function emergencyPause() {
  if (!contract) {
    alert('请先连接钱包');
    return;
  }
  if (!confirm('确定要紧急暂停合约吗？此操作需要多签确认。')) return;

  try {
    const tx = await contract.emergencyPause();
    await tx.wait();
    alert('紧急暂停已执行!');
    loadContractData();
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

async function emergencyUnpause() {
  if (!contract) {
    alert('请先连接钱包');
    return;
  }
  if (!confirm('确定要解除暂停吗？')) return;

  try {
    const tx = await contract.emergencyUnpause();
    await tx.wait();
    alert('合约已恢复运行!');
    loadContractData();
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

async function loadLogs() {
  await loadLogsFromSubgraph();
}

async function loadLogsFromSubgraph() {
  const container = _clear('logsTimeline');
  if (!container) return;

  const loading = _create('div', { className: 'table-loading' });
  loading.appendChild(_create('div', { className: 'spinner' }));
  loading.appendChild(_create('div', { text: '加载日志...' }));
  container.appendChild(loading);

  try {
    const data = await querySubgraph(`
      query {
        operationLogs(first: 50, orderBy: timestamp, orderDirection: desc) {
          id
          operationType
          operator
          target
          details
          timestamp
          blockNumber
          transactionHash
        }
      }
    `);

    if (data && data.operationLogs) {
      const container2 = _clear('logsTimeline');
      const typeLabels = {
        TAG_ADDRESS: '地址标签',
        MINT: '铸造',
        EMERGENCY_PAUSE: '紧急暂停',
        SET_POLICY: '策略更新',
        SIGN_OPERATION: '签名操作',
        EXECUTE_OPERATION: '执行操作',
        UNLOCK_FUNDS: '释放资金',
        FREEZE_FUNDS: '冻结资金'
      };

      data.operationLogs.forEach(log => {
        const date = _fmtTime(log.timestamp);
        const typeLabel = typeLabels[log.operationType] || log.operationType;

        const item = _create('div', { className: 'timeline-item' });
        const timeDiv = _create('div', { text: date, className: 'timeline-time' });
        const contentDiv = _create('div', { className: 'timeline-content' });

        const strong = _create('strong', { text: typeLabel });
        contentDiv.appendChild(strong);
        contentDiv.appendChild(document.createTextNode(' - ' + (log.details || '-')));
        contentDiv.appendChild(_create('br'));

        const opSpan = _create('span');
        opSpan.style.color = 'var(--text-muted)';
        opSpan.textContent = '操作者: ' + _fmtAddr(log.operator);
        contentDiv.appendChild(opSpan);

        if (log.blockNumber) {
          contentDiv.appendChild(_create('br'));
          const blockSpan = _create('span');
          blockSpan.style.color = 'var(--text-muted)';
          blockSpan.textContent = '区块: ' + log.blockNumber;
          contentDiv.appendChild(blockSpan);
        }

        item.appendChild(timeDiv);
        item.appendChild(contentDiv);
        container2.appendChild(item);
      });
    } else {
      const empty = _create('div', {
        text: '暂无日志',
        className: 'table-loading'
      });
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.padding = '24px';
      container.appendChild(empty);
    }
  } catch (error) {
    console.error('加载日志失败:', error);
    showToast('日志加载失败', 'error');
    const err = _create('div', { text: '加载失败，请重试' });
    err.style.textAlign = 'center';
    err.style.color = 'var(--danger)';
    err.style.padding = '24px';
    container.appendChild(err);
  }
}

function loadSettings() {
  const savedAddress = sessionStorage.getItem('contractAddress');
  if (savedAddress) {
    const ca = _el('contractAddress');
    if (ca) ca.value = savedAddress;
  }
}

function saveSettings() {
  const address = _el('contractAddress');
  if (address) {
    /* [AUDIT FIX 2026-09-18 R3-L6] 原不校验格式：存入非法值后下次加载
       new ethers.Contract 抛错，用户只看到误导性的「连接失败」。 */
    if (!isValidAddress(address.value.trim())) {
      alert('合约地址格式无效（应为 0x 开头的 42 位十六进制）');
      return;
    }
    sessionStorage.setItem('contractAddress', address.value.trim());
    alert('设置已保存（会话级别），刷新页面后生效');
  }
}

function startDataPolling() {
  setInterval(() => {
    loadContractData();
    loadSubgraphStats();
    loadSubgraphChartData();
    loadBlockedTransfers();
    const monitor = _el('monitor');
    if (monitor && monitor.classList.contains('active')) {
      refreshMonitor();
    }
  }, 30000);
}

async function loadPolicies() {
  /* [AUDIT FIX 2026-09-17 R1-008] 原实现读 contract.getContractInfo() 的
     maxTxAmount/dailyLimit/allowMediumRisk 等字段——该 11 元组里没有这些字段，
     策略页所有字段恒显示 '--'。改为读 ComplianceEngine.getIssuerPolicy(token)。 */
  if (!policyContract) return;
  try {
    const policy = await policyContract.getIssuerPolicy(CONTRACT_ADDRESS);

    const pmt = _el('policyMaxTx');
    if (pmt) pmt.textContent = policy.maxTxAmount > 0n ? ethers.formatUnits(policy.maxTxAmount, 6) + ' fUSD' : '--';
    const pdl = _el('policyDailyLimit');
    if (pdl) pdl.textContent = policy.dailyLimit > 0n ? ethers.formatUnits(policy.dailyLimit, 6) + ' fUSD' : '--';
    const pam = _el('policyAllowMedium');
    if (pam) pam.textContent = policy.allowMediumRisk ? '\u2705 允许' : '\u274c 禁止';
    const pah = _el('policyAllowHigh');
    if (pah) pah.textContent = policy.allowHighRisk ? '\u2705 允许' : '\u274c 禁止';
    const pbm = _el('policyBlockMixer');
    if (pbm) pbm.textContent = policy.blockMixer ? '\u2705 拦截' : '\u274c 放行';
    const pkyc = _el('policyRequireKYC');
    if (pkyc) pkyc.textContent = policy.requireDestinationKYC ? '\u2705 需要' : '\u274c 不需要';

    const tbody = _clear('policyHistoryTable');
    if (tbody) {
      const tr = _create('tr');
      tr.appendChild(_cell('当前策略', ''));
      tr.appendChild(_cell(policy.maxTxAmount > 0n ? ethers.formatUnits(policy.maxTxAmount, 6) : '--', ''));
      tr.appendChild(_cell(policy.dailyLimit > 0n ? ethers.formatUnits(policy.dailyLimit, 6) : '--', ''));
      tr.appendChild(_cell(policy.allowMediumRisk ? '是' : '否', ''));
      tr.appendChild(_cell(policy.allowHighRisk ? '是' : '否', ''));
      tr.appendChild(_cell('链上实时读取', ''));

      // [R1-008] 合约无 rollbackToVersion（链上不存在策略版本机制），
      // 原「回滚」按钮调用不存在的函数必然失败，已移除。
      const tdAction = _create('td');
      tdAction.textContent = '-';
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    }
  } catch (error) {
    console.error('加载策略失败:', error);
  }
}

function openPolicyModal() {
  const modal = _el('policyModal');
  if (modal) modal.classList.add('active');
}

async function submitPolicy() {
  /* [AUDIT FIX 2026-09-17 R1-008] 原实现三处致命错误：
     ① ABI 未声明 setIssuerPolicy（ethers v6 调未声明函数直接 TypeError）；
     ② 调错合约——策略在 ComplianceEngine，不在 CompliantStableCoin；
     ③ 参数签名错误——真实签名是 setIssuerPolicy(address token, IssuerPolicy
        struct)，原为 7 个散装位置参数且缺 cooldownPeriod/blockedTokens。
     现按合约源码（ComplianceEngine.sol:445 + PolicyEngine.sol:104 struct）对齐。 */
  if (!policyContract) { alert('请先连接钱包'); return; }
  try {
    const maxTx = _el('policyMaxTxInput');
    const dailyLimit = _el('policyDailyLimitInput');
    const allowMedium = _el('policyAllowMediumInput');
    const allowHigh = _el('policyAllowHighInput');
    const blockMixer = _el('policyBlockMixerInput');
    const requireKYC = _el('policyRequireKYCInput');

    const policy = {
      maxTxAmount: ethers.parseUnits((maxTx ? maxTx.value : '1000000') || '1000000', 6),
      dailyLimit: ethers.parseUnits((dailyLimit ? dailyLimit.value : '500') || '500', 6),
      allowMediumRisk: allowMedium ? allowMedium.checked : false,
      allowHighRisk: allowHigh ? allowHigh.checked : false,
      blockMixer: blockMixer ? blockMixer.checked : false,
      requireDestinationKYC: requireKYC ? requireKYC.checked : false,
      cooldownPeriod: 0,
      blockedTokens: []
    };

    const tx = await policyContract.setIssuerPolicy(CONTRACT_ADDRESS, policy);
    await tx.wait();
    alert('策略更新成功!');
    closeModal('policyModal');
    loadPolicies();
  } catch (error) {
    alert('策略更新失败: ' + error.message);
  }
}
/* [R1-008] rollbackPolicy 已删除：合约不存在 rollbackToVersion / 策略版本机制，
   原实现是对不存在函数的空调用 + 虚假「回滚成功」反馈。 */

async function filterComplianceLogs() {
  const decision = _el('filterDecision');
  await loadSubgraphComplianceChecks(decision ? decision.value : '');
}

function closeModal(modalId) {
  const modal = _el(modalId);
  if (modal) modal.classList.remove('active');
}

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

function removeTag(addr) {
  if (!contract) { alert('请先连接钱包'); return; }
  if (!confirm('确定要移除地址 ' + addr + ' 的标签吗？')) return;
  contract.untagAddress(addr).then(tx => tx.wait())
    .then(() => { alert('标签已移除'); loadTags(); })
    .catch(err => alert('移除失败: ' + err.message));
}

function removeSigner(addr) {
  if (!contract) { alert('请先连接钱包'); return; }
  if (!confirm('确定要移除签名者 ' + addr + ' 吗？')) return;
  contract.removeSigner(addr).then(tx => tx.wait())
    .then(() => { alert('签名者已移除'); loadSigners(); })
    .catch(err => alert('移除失败: ' + err.message));
}

/* [AUDIT FIX 2026-09-17 B2-004] openAddCustomerModal / saveLimits / exportLogs
   三个 alert 占位桩已随按钮禁用一并移除（见 index.html 对应按钮的 disabled 标注）。 */

function viewProfile(id) {
  alert('查看地址: ' + id);
}
