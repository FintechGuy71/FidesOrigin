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

const SUBGRAPH_URL = (typeof window !== 'undefined' && window.FIDESORIGIN_SUBGRAPH_URL) || '';
const CONTRACT_ADDRESS = sessionStorage.getItem('contractAddress') || SEPOLIA_ADDRESSES.CompliantStableCoin;

let provider, signer, contract, userAddress;
let charts = {};

// ========== The Graph Subgraph Queries ==========
async function querySubgraph(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/subgraph', {
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
  setTimeout(() => toast.classList.remove('show'), 5000);
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
      if (elHeld) elHeld.textContent = s.totalFundsHeld || '0';
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
          if (addr && !lastCheckMap[addr]) {
            lastCheckMap[addr] = c.timestamp;
          }
        });
      }

      const tierColors = { UNKNOWN: '#94a3b8', LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

      data.riskProfiles.forEach(profile => {
        const tagTime = _fmtTime(profile.lastUpdated);
        const lastTx = lastCheckMap[profile.id] ? _fmtTime(lastCheckMap[profile.id]) : '-';
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
          tr.appendChild(_badge('已处理', 'badge-success'));
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
        const h = new Date(c.timestamp * 1000).getHours();
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
  initCharts();
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
      case 'loadBlockedTransfers': loadBlockedTransfers(); break;
      case 'refreshMonitor': refreshMonitor(); break;
      case 'openAddCustomerModal': openAddCustomerModal(); break;
      case 'openTagModal': openTagModal(); break;
      case 'saveLimits': saveLimits(); break;
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
      case 'exportLogs': exportLogs(); break;
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

  charts.realtime = new Chart(document.getElementById('realtimeChart'), {
    type: 'line',
    data: {
      labels: Array.from({length: 20}, (_, i) => i),
      datasets: [{
        label: '实时TPS',
        data: Array.from({length: 20}, () => 0),
        borderColor: '#c9a96e',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      ...chartConfig,
      animation: { duration: 0 },
      scales: {
        x: { display: false },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
      }
    }
  });

  setInterval(() => {
    if (charts.realtime) {
      const data = charts.realtime.data.datasets[0].data;
      data.shift();
      data.push(Math.floor(Math.random() * 10) + 5);
      charts.realtime.update();
    }
  }, 2000);
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
    if (ts) ts.textContent = Number(ethers.formatUnits(info.totalSupply, 18)).toLocaleString();

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
    const ss = _el('signerStatus');
    if (ss) ss.textContent = '签名者: ' + info.signerCount;

    if (charts.risk) {
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

async function loadQuarantineRecordsFromSubgraph() {
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

      data.holdRecords.forEach(record => {
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

        let statusBadge;
        if (record.released) {
          statusBadge = _badge('已释放', 'tag-success');
        } else {
          statusBadge = _badge('待处理', 'tag-warning');
        }
        tr.appendChild(_create('td').appendChild(statusBadge) || _create('td'));

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
      if (pf) pf.textContent = '0';
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
  if (!confirm('确认释放记录 ' + recordId + ' 的隔离资金？')) return;
  alert('释放交易已提交（演示模式）');
}

async function freezePermanently(recordId) {
  if (!confirm('⚠️ 警告：永久冻结后资金将无法恢复！\n\n确认永久冻结记录 ' + recordId + '？')) return;
  alert('永久冻结交易已提交（演示模式）');
}

async function filterQuarantineRecords() {
  loadQuarantineRecords();
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
        tr.appendChild(_cell(ethers.formatUnits(check.amount, 6), ''));
        tr.appendChild(_badge('黑名单', 'tag-black'));
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
        tr.appendChild(_badge(tagLabel, tagClass));
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
        tr.appendChild(_badge(statusLabels[check.decision] || check.decision, statusColors[check.decision] || 'tag-grey'));
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
      tr.appendChild(_cell(tagNameMap[item.level] || '', '').appendChild(_badge(tagNameMap[item.level] || '', tagClassMap[item.level] || '')) || _create('td'));
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
      tr.appendChild(_badge('签名者', 'tag-admin'));
      tr.appendChild(_badge('活跃', 'tag-success'));

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
  try {
    const tx = await contract.updateRequiredSignatures(newRequired ? newRequired.value : 2);
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
  try {
    const delayInSeconds = (days ? days.value : 2) * 24 * 60 * 60;
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
  const savedAddress = localStorage.getItem('contractAddress');
  if (savedAddress) {
    const ca = _el('contractAddress');
    if (ca) ca.value = savedAddress;
  }
}

function saveSettings() {
  const address = _el('contractAddress');
  if (address) {
    sessionStorage.setItem('contractAddress', address.value);
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
  if (!contract) return;
  try {
    const info = await contract.getContractInfo();

    const pmt = _el('policyMaxTx');
    if (pmt) pmt.textContent = info.maxTxAmount ? ethers.formatUnits(info.maxTxAmount, 6) + ' fUSD' : '--';
    const pdl = _el('policyDailyLimit');
    if (pdl) pdl.textContent = info.dailyLimit ? ethers.formatUnits(info.dailyLimit, 6) + ' fUSD' : '--';
    const pam = _el('policyAllowMedium');
    if (pam) pam.textContent = info.allowMediumRisk !== undefined ? (info.allowMediumRisk ? '\u2705 允许' : '\u274c 禁止') : '--';
    const pah = _el('policyAllowHigh');
    if (pah) pah.textContent = info.allowHighRisk !== undefined ? (info.allowHighRisk ? '\u2705 允许' : '\u274c 禁止') : '--';
    const pbm = _el('policyBlockMixer');
    if (pbm) pbm.textContent = info.blockMixer !== undefined ? (info.blockMixer ? '\u2705 拦截' : '\u274c 放行') : '--';
    const pkyc = _el('policyRequireKYC');
    if (pkyc) pkyc.textContent = info.requireKYC !== undefined ? (info.requireKYC ? '\u2705 需要' : '\u274c 不需要') : '--';

    const tbody = _clear('policyHistoryTable');
    if (tbody) {
      const tr = _create('tr');
      tr.appendChild(_cell('v' + (info.policyVersion || 0), ''));
      tr.appendChild(_cell(info.maxTxAmount ? ethers.formatUnits(info.maxTxAmount, 6) : '--', ''));
      tr.appendChild(_cell(info.dailyLimit ? ethers.formatUnits(info.dailyLimit, 6) : '--', ''));
      tr.appendChild(_cell(info.allowMediumRisk !== undefined ? (info.allowMediumRisk ? '是' : '否') : '--', ''));
      tr.appendChild(_cell(info.allowHighRisk !== undefined ? (info.allowHighRisk ? '是' : '否') : '--', ''));
      tr.appendChild(_cell(new Date().toLocaleString(), ''));

      const tdAction = _create('td');
      const btnRollback = _create('button', { text: '回滚', className: 'btn btn-sm btn-secondary' });
      btnRollback.onclick = function() { rollbackPolicy(0); };
      tdAction.appendChild(btnRollback);
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
  if (!contract) { alert('请先连接钱包'); return; }
  try {
    const maxTx = _el('policyMaxTxInput');
    const dailyLimit = _el('policyDailyLimitInput');
    const allowMedium = _el('policyAllowMediumInput');
    const allowHigh = _el('policyAllowHighInput');
    const blockMixer = _el('policyBlockMixerInput');
    const requireKYC = _el('policyRequireKYCInput');

    const tx = await contract.setIssuerPolicy(
      await signer.getAddress(),
      ethers.parseUnits((maxTx ? maxTx.value : '1000000') || '1000000', 6),
      ethers.parseUnits((dailyLimit ? dailyLimit.value : '500') || '500', 6),
      allowMedium ? allowMedium.checked : false,
      allowHigh ? allowHigh.checked : false,
      blockMixer ? blockMixer.checked : false,
      requireKYC ? requireKYC.checked : false
    );
    await tx.wait();
    alert('策略更新成功!');
    closeModal('policyModal');
    loadPolicies();
  } catch (error) {
    alert('策略更新失败: ' + error.message);
  }
}

async function rollbackPolicy(version) {
  if (!contract) { alert('请先连接钱包'); return; }
  if (!confirm('确定要回滚到版本 ' + version + ' 吗?')) return;
  try {
    const tx = await contract.rollbackToVersion(await signer.getAddress(), version);
    await tx.wait();
    alert('回滚成功!');
    loadPolicies();
  } catch (error) {
    alert('回滚失败: ' + error.message);
  }
}

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

function openAddCustomerModal() {
  alert('新增客户功能开发中...');
}

function saveLimits() {
  alert('限额配置保存功能开发中...');
}

function exportLogs() {
  alert('导出功能开发中...');
}

function viewProfile(id) {
  alert('查看地址: ' + id);
}
