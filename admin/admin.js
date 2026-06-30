// FidesOrigin Admin 核心逻辑 (安全重构版)
// 钱包连接、图表渲染、数据加载、交互功能
// 所有 innerHTML 已替换为安全 DOM API
// 无 eval(), 无 new Function()

// ==================== 全局状态 ====================
let walletConnected = false;
let walletAddress = null;
let provider = null;
let signer = null;
let currentPage = 'dashboard';
let charts = {};
let updateInterval = null;

// [M-17 Security Note] The following functions are exposed to window for HTML onclick
// compatibility. In production, migrate to event delegation (addEventListener) and
// remove these global assignments to reduce the attack surface from malicious scripts.

// ==================== 工具函数 ====================
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function formatAddress(address) {
  if (!address) return '--';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '--';
  return new Intl.NumberFormat('en-US').format(num);
}

function formatCurrency(value, currency = 'TUSD') {
  if (value === null || value === undefined) return '--';
  return `${formatNumber(value)} ${currency}`;
}

function formatDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

function getRiskColor(score) {
  if (score <= 30) return CONFIG.riskLevels.low.color;
  if (score <= 70) return CONFIG.riskLevels.medium.color;
  return CONFIG.riskLevels.high.color;
}

function getRiskLabel(score) {
  if (score <= 30) return CONFIG.riskLevels.low.label;
  if (score <= 70) return CONFIG.riskLevels.medium.label;
  return CONFIG.riskLevels.high.label;
}

// ==================== 页面切换 ====================
function showPage(pageId) {
  // 隐藏所有页面
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // 显示目标页面
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === pageId) {
      item.classList.add('active');
    }
  });
  
  currentPage = pageId;
  
  // 页面特定初始化
  if (pageId === 'dashboard') initDashboard();
  if (pageId === 'monitor') initMonitor();
  if (pageId === 'customers') loadCustomers();
  if (pageId === 'tags') loadTags();
  if (pageId === 'timelock') loadTimelock();
  if (pageId === 'multisig') loadMultisig();
  if (pageId === 'quarantine') loadQuarantine();
  if (pageId === 'policies') loadPolicies();
  if (pageId === 'complianceLogs') loadSubgraphComplianceChecks();
  if (pageId === 'incomingBlocks') loadIncomingBlocks();
  if (pageId === 'logs') loadLogs();
  
  // 移动端关闭侧边栏
  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar').classList.remove('mobile-open');
    document.getElementById('overlay').classList.remove('show');
  }
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('show');
}

// ==================== 钱包连接 ====================
async function connectWallet() {
  try {
    if (!window.ethereum) {
      showToast('请安装 MetaMask 钱包', 'error');
      return;
    }
    
    // [P2 Fix] 验证 provider 来源，防止恶意注入
    const isMetaMask = window.ethereum.isMetaMask === true;
    const isCoinbaseWallet = window.ethereum.isCoinbaseWallet === true;
    const isWalletConnect = !!window.ethereum.provider;
    
    if (!isMetaMask && !isCoinbaseWallet && !isWalletConnect) {
      console.warn('[SECURITY] Unknown wallet provider detected:', window.ethereum);
      showToast('检测到未知钱包提供者，请使用 MetaMask 或 Coinbase Wallet', 'warning');
      // 继续连接但记录警告
    }
    
    // [P2 Fix] 如果存在多个 provider（如同时安装了 MetaMask 和 Coinbase），优先使用 MetaMask
    const selectedProvider = window.ethereum.providers?.find(p => p.isMetaMask) || window.ethereum;
    provider = new ethers.BrowserProvider(selectedProvider);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length > 0) {
      walletAddress = accounts[0];
      signer = await provider.getSigner();
      walletConnected = true;
      
      // 更新 UI
      const walletAddrEl = document.getElementById('walletAddress');
      const walletStatusEl = document.getElementById('walletStatus');
      const connectBtn = document.getElementById('connectBtn');
      const networkBadge = document.getElementById('networkBadge');
      const statusDot = document.querySelector('.status-dot');
      
      if (walletAddrEl) walletAddrEl.textContent = formatAddress(walletAddress);
      if (walletStatusEl) {
        walletStatusEl.classList.remove('disconnected');
        walletStatusEl.classList.add('connected');
      }
      if (statusDot) {
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
      }
      if (connectBtn) {
        connectBtn.textContent = '🔓 断开连接';
      }
      
      // 获取网络信息
      const network = await provider.getNetwork();
      const networkConfig = Object.values(CONFIG.networks).find(n => n.chainId === Number(network.chainId));
      const networkName = networkConfig ? networkConfig.name : '未知网络';
      if (networkBadge) networkBadge.textContent = networkName;
      
      showToast('钱包连接成功', 'success');
      
      // 加载数据
      initDashboard();
    }
  } catch (error) {
    console.error('连接钱包失败:', error);
    showToast('连接钱包失败: ' + error.message, 'error');
  }
}

async function disconnectWallet() {
  walletConnected = false;
  walletAddress = null;
  provider = null;
  signer = null;
  
  // 更新 UI
  const walletAddrEl = document.getElementById('walletAddress');
  const walletStatusEl = document.getElementById('walletStatus');
  const connectBtn = document.getElementById('connectBtn');
  const networkBadge = document.getElementById('networkBadge');
  const statusDot = document.querySelector('.status-dot');
  
  if (walletAddrEl) walletAddrEl.textContent = '未连接钱包';
  if (walletStatusEl) {
    walletStatusEl.classList.remove('connected');
    walletStatusEl.classList.add('disconnected');
  }
  if (statusDot) {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
  }
  if (connectBtn) {
    connectBtn.textContent = '🔗 连接 MetaMask';
  }
  if (networkBadge) networkBadge.textContent = '未连接';
  
  showToast('钱包已断开', 'info');
}

// ==================== 图表初始化 ====================
function destroyCharts() {
  Object.values(charts).forEach(chart => {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  });
  charts = {};
}

function initCharts() {
  // 先销毁旧图表防止内存泄漏
  destroyCharts();
  // 风险分布饼图
  const riskCtx = document.getElementById('riskChart');
  if (riskCtx) {
    charts.risk = new Chart(riskCtx, {
      type: 'doughnut',
      data: {
        labels: ['低风险', '中风险', '高风险'],
        datasets: [{
          data: [65, 25, 10],
          backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8' }
          }
        }
      }
    });
  }
  
  // 角色分布饼图
  const roleCtx = document.getElementById('roleChart');
  if (roleCtx) {
    charts.role = new Chart(roleCtx, {
      type: 'doughnut',
      data: {
        labels: ['VIP', '普通', '灰名单', '黑名单'],
        datasets: [{
          data: [15, 70, 10, 5],
          backgroundColor: ['#f59e0b', '#22c55e', '#94a3b8', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8' }
          }
        }
      }
    });
  }
  
  // 交易监控折线图
  const txCtx = document.getElementById('txChart');
  if (txCtx) {
    const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
    const txData = Array.from({length: 24}, () => Math.floor(Math.random() * 100) + 20);
    
    charts.tx = new Chart(txCtx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          label: '交易数',
          data: txData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
        }
      }
    });
  }
  
  // 实时交易流量图
  const realtimeCtx = document.getElementById('realtimeChart');
  if (realtimeCtx) {
    const now = new Date();
    const minutes = Array.from({length: 60}, (_, i) => {
      const d = new Date(now.getTime() - (59 - i) * 60000);
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    });
    
    charts.realtime = new Chart(realtimeCtx, {
      type: 'line',
      data: {
        labels: minutes,
        datasets: [{
          label: '交易流量',
          data: Array.from({length: 60}, () => Math.floor(Math.random() * 50) + 10),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
        }
      }
    });
  }
}

// ==================== 数据加载 (安全DOM版) ====================

// ==================== [M-16 Fix] DEMO DATA — 所有数据为 Mock/Demo 展示用 ====================
// 注意: 以下所有 dashboard / monitor / customers / tags / timelock / multisig /
// quarantine / policies / logs / complianceLogs / incomingBlocks 数据均为硬编码
// 演示数据。生产部署前必须替换为真实合约调用和 GraphQL 查询。
// ============================================================================

async function initDashboard() {
  if (!walletConnected) return;
  
  const totalSupply = document.getElementById('totalSupply');
  const totalTagged = document.getElementById('totalTagged');
  const vipCount = document.getElementById('vipCount');
  const blackCount = document.getElementById('blackCount');
  const pendingOps = document.getElementById('pendingOps');
  const contractStatus = document.getElementById('contractStatus');
  const signerStatus = document.getElementById('signerStatus');
  
  // [DEMO] Mock dashboard numbers — replace with on-chain query
  if (totalSupply) totalSupply.textContent = formatCurrency(1250000);
  if (totalTagged) totalTagged.textContent = formatNumber(15420);
  if (vipCount) vipCount.textContent = formatNumber(230);
  if (blackCount) blackCount.textContent = formatNumber(45);
  if (pendingOps) pendingOps.textContent = formatNumber(3);
  if (contractStatus) {
    contractStatus.textContent = '正常';
    contractStatus.style.color = '#22c55e';
  }
  if (signerStatus) signerStatus.textContent = `签名者: ${formatAddress(walletAddress)}`;
  
  // Subgraph 数据 (DEMO)
  const subgraphTotalChecks = document.getElementById('subgraphTotalChecks');
  const subgraphBlocked = document.getElementById('subgraphBlocked');
  const subgraphSanctioned = document.getElementById('subgraphSanctioned');
  const subgraphHeld = document.getElementById('subgraphHeld');
  
  // [DEMO] Mock subgraph stats — replace with Subgraph GraphQL query
  if (subgraphTotalChecks) subgraphTotalChecks.textContent = formatNumber(45230);
  if (subgraphBlocked) subgraphBlocked.textContent = formatNumber(128);
  if (subgraphSanctioned) subgraphSanctioned.textContent = formatNumber(67);
  if (subgraphHeld) subgraphHeld.textContent = formatCurrency(45000);
  
  // 加载拦截记录
  loadBlockedTransfers();
}

async function loadBlockedTransfers() {
  const tbody = document.getElementById('blockedTable');
  if (!tbody) return;
  
  // 安全设置加载状态
  clearElement(tbody);
  const tr = createEl('tr');
  const td = createEl('td', {
    className: 'table-loading',
    attrs: { colspan: '5' }
  });
  td.appendChild(createEl('div', { className: 'spinner' }));
  td.appendChild(createEl('div', { text: '加载中...' }));
  tr.appendChild(td);
  tbody.appendChild(tr);
  
  // [DEMO] Mock blocked transfers — replace with on-chain event query
  setTimeout(() => {
    const mockData = [
      { time: '2026-06-16 14:30:00', address: '0x1234...5678', tag: '黑名单', reason: 'OFAC 制裁', amount: '10,000 TUSD' },
      { time: '2026-06-16 13:15:00', address: '0xabcd...efgh', tag: '灰名单', reason: '高风险评分', amount: '5,000 TUSD' },
      { time: '2026-06-16 11:45:00', address: '0x9876...5432', tag: '黑名单', reason: '已知诈骗地址', amount: '25,000 TUSD' }
    ];
    renderBlockedTable(mockData);
  }, 1000);
}

async function initMonitor() {
  const monitorTable = document.getElementById('monitorTable');
  if (!monitorTable) return;
  
  if (!walletConnected) {
    clearElement(monitorTable);
    const tr = createEl('tr');
    const td = createEl('td', {
      attrs: { colspan: '6' },
      styles: { textAlign: 'center', color: 'var(--text-secondary)' }
    });
    td.textContent = '连接钱包后查看数据';
    tr.appendChild(td);
    monitorTable.appendChild(tr);
    return;
  }
  
  // [DEMO] Mock monitor data — replace with on-chain event query
  const mockData = [
    { id: 'TX001', hash: '0xabc...def', from: '0x111...222', to: '0x333...444', amount: '1,000 TUSD', status: '已拦截' },
    { id: 'TX002', hash: '0xdef...abc', from: '0x555...666', to: '0x777...888', amount: '500 TUSD', status: '已通过' },
    { id: 'TX003', hash: '0x999...000', from: '0xaaa...bbb', to: '0xccc...ddd', amount: '10,000 TUSD', status: '待审核' }
  ];
  
  renderMonitorTable(mockData);
}

function refreshMonitor() {
  initMonitor();
  showToast('监控数据已刷新', 'success');
}

// ==================== 客户管理 (DEMO) ====================
async function loadCustomers() {
  if (!walletConnected) return;
  
  // [DEMO] Mock customer data — replace with on-chain profile query
  const mockData = [
    { address: '0x1234...5678', risk: 15, daily: 100000, used: 45000, balance: 125000 },
    { address: '0xabcd...efgh', risk: 65, daily: 10000, used: 8000, balance: 25000 },
    { address: '0x9876...5432', risk: 85, daily: 1000, used: 500, balance: 5000 }
  ];
  
  renderCustomersTable(mockData);
}

function openAddCustomerModal() {
  const modal = document.getElementById('addCustomerModal');
  if (modal) modal.classList.add('active');
}

function closeAddCustomerModal() {
  const modal = document.getElementById('addCustomerModal');
  if (modal) modal.classList.remove('active');
}

function submitAddCustomer() {
  showToast('客户添加功能开发中', 'info');
  closeAddCustomerModal();
}

function viewCustomer(address) {
  showToast(`查看客户: ${address}`, 'info');
}

function editCustomer(address) {
  showToast(`编辑客户: ${address}`, 'info');
}

// ==================== 标签管理 (DEMO) ====================
async function loadTags() {
  if (!walletConnected) return;
  
  // [DEMO] Mock tag data — replace with on-chain tag query
  const mockData = [
    { address: '0x1234...5678', tag: 'VIP', reason: '机构客户', operator: 'Admin' },
    { address: '0xabcd...efgh', tag: '灰名单', reason: '异常交易模式', operator: 'System' },
    { address: '0x9876...5432', tag: '黑名单', reason: 'OFAC 制裁', operator: 'Admin' }
  ];
  
  renderTagsTable(mockData);
}

function openTagModal() {
  const modal = document.getElementById('tagModal');
  if (modal) modal.classList.add('active');
}

function closeTagModal() {
  const modal = document.getElementById('tagModal');
  if (modal) modal.classList.remove('active');
}

function submitTag() {
  const address = document.getElementById('tagAddress');
  const level = document.getElementById('tagLevel');
  const reason = document.getElementById('tagReason');
  
  if (!address || !address.value) {
    showToast('请输入地址', 'error');
    return;
  }
  showToast(`标签已添加: ${formatAddress(address.value)}`, 'success');
  closeTagModal();
}

function editTag(address) {
  showToast(`编辑标签: ${address}`, 'info');
}

function removeTag(address) {
  safeConfirm('确定要删除这个标签吗？', function() {
    showToast(`标签已删除: ${address}`, 'success');
  });
}

// ==================== 限额配置 ====================
function saveLimits() {
  const vipDaily = document.getElementById('vipDaily');
  const vipSingle = document.getElementById('vipSingle');
  const normalDaily = document.getElementById('normalDaily');
  const normalSingle = document.getElementById('normalSingle');
  const greyDaily = document.getElementById('greyDaily');
  const greySingle = document.getElementById('greySingle');
  
  const limits = {
    vip: { daily: vipDaily ? vipDaily.value : 100000, single: vipSingle ? vipSingle.value : 50000 },
    normal: { daily: normalDaily ? normalDaily.value : 10000, single: normalSingle ? normalSingle.value : 5000 },
    grey: { daily: greyDaily ? greyDaily.value : 1000, single: greySingle ? greySingle.value : 500 }
  };
  
  console.log('保存限额配置:', limits);
  showToast('限额配置已保存', 'success');
}

// ==================== 时间锁管理 (DEMO) ====================
async function loadTimelock() {
  if (!walletConnected) return;
  
  const currentDelay = document.getElementById('currentDelay');
  const pendingCount = document.getElementById('pendingCount');
  const executedCount = document.getElementById('executedCount');
  const cancelledCount = document.getElementById('cancelledCount');
  
  // [DEMO] Mock timelock stats — replace with on-chain TimelockController query
  if (currentDelay) currentDelay.textContent = '3 天';
  if (pendingCount) pendingCount.textContent = '3';
  if (executedCount) executedCount.textContent = '12';
  if (cancelledCount) cancelledCount.textContent = '1';
  
  // [DEMO] Mock pending operations
  const mockOps = [
    { id: 'OP001', type: '添加标签', target: '0x1234...5678', scheduled: '2026-06-19 14:30:00', status: '待执行' },
    { id: 'OP002', type: '修改限额', target: 'VIP', scheduled: '2026-06-18 10:00:00', status: '待执行' },
    { id: 'OP003', type: '移除地址', target: '0xabcd...efgh', scheduled: '2026-06-20 16:00:00', status: '待执行' }
  ];
  
  renderTimelockTable(mockOps);
}

function loadPendingOperations() {
  loadTimelock();
}

function openTimelockConfigModal() {
  const modal = document.getElementById('timelockConfigModal');
  if (modal) modal.classList.add('active');
}

function closeTimelockConfigModal() {
  const modal = document.getElementById('timelockConfigModal');
  if (modal) modal.classList.remove('active');
}

function submitTimelockConfig() {
  const delay = document.getElementById('timelockDays');
  if (delay) {
    console.log('保存时间锁配置:', delay.value);
  }
  showToast('时间锁配置已保存', 'success');
  closeTimelockConfigModal();
}

function cancelOperation(opId) {
  safeConfirm('确定要取消这个操作吗？', function() {
    showToast(`操作已取消: ${opId}`, 'success');
  });
}

// ==================== 多签管理 (DEMO) ====================
async function loadMultisig() {
  if (!walletConnected) return;
  
  const signerCount = document.getElementById('signerCount');
  const requiredSigs = document.getElementById('requiredSigs');
  const userRole = document.getElementById('userRole');
  
  // [DEMO] Mock multisig stats — replace with on-chain Gnosis Safe / MultiSig query
  if (signerCount) signerCount.textContent = '3';
  if (requiredSigs) requiredSigs.value = '2';
  if (userRole) userRole.textContent = 'Owner';
  
  const mockSigners = [
    { address: '0x1234...5678', role: 'Owner', status: '已确认' },
    { address: '0xabcd...efgh', role: 'Signer', status: '已确认' },
    { address: '0x9876...5432', role: 'Signer', status: '待确认' }
  ];
  
  renderSignersTable(mockSigners);
}

function loadSigners() {
  loadMultisig();
}

function updateRequiredSigs() {
  const requiredSigs = document.getElementById('requiredSigs');
  if (requiredSigs) {
    showToast(`所需签名数已更新为: ${requiredSigs.value}`, 'success');
  }
}

function openAddSignerModal() {
  const modal = document.getElementById('addSignerModal');
  if (modal) modal.classList.add('active');
}

function closeAddSignerModal() {
  const modal = document.getElementById('addSignerModal');
  if (modal) modal.classList.remove('active');
}

function addSigner() {
  const address = document.getElementById('newSignerAddress');
  if (!address || !address.value) {
    showToast('请输入地址', 'error');
    return;
  }
  showToast(`签名者已添加: ${formatAddress(address.value)}`, 'success');
  closeAddSignerModal();
}

function submitAddSigner() {
  addSigner();
}

// ==================== 隔离风控 (DEMO) ====================
async function loadQuarantine() {
  if (!walletConnected) return;
  
  const totalQuarantined = document.getElementById('totalQuarantined');
  const recordCount = document.getElementById('recordCount');
  const pendingRelease = document.getElementById('pendingRelease');
  const permanentlyFrozen = document.getElementById('permanentlyFrozen');
  
  // [DEMO] Mock quarantine stats — replace with on-chain vault query
  if (totalQuarantined) totalQuarantined.textContent = formatCurrency(45000);
  if (recordCount) recordCount.textContent = '5';
  if (pendingRelease) pendingRelease.textContent = '2';
  if (permanentlyFrozen) permanentlyFrozen.textContent = '0';
  
  const mockHeld = [
    { id: 'H001', address: '0x1234...5678', token: 'TUSD', amount: '25,000 TUSD', reason: '高风险评分', heldSince: '2026-06-15', status: '待处理' },
    { id: 'H002', address: '0xabcd...efgh', token: 'TUSD', amount: '20,000 TUSD', reason: '待审核', heldSince: '2026-06-16', status: '待处理' }
  ];
  
  renderQuarantineTable(mockHeld);
}

function loadQuarantineRecords() {
  loadQuarantine();
}

function filterQuarantineRecords() {
  const filter = document.getElementById('filterStatus');
  if (filter) {
    showToast(`筛选状态: ${filter.value || '全部'}`, 'info');
  }
  loadQuarantine();
}

function releaseFunds(id) {
  safeConfirm('确定要释放这笔资金吗？', function() {
    showToast(`资金已释放: ${id}`, 'success');
  });
}

// ==================== 收款拦截 (DEMO) ====================
async function loadIncomingBlocks() {
  const tbody = document.getElementById('incomingBlocksTable');
  if (!tbody) return;
  
  // [DEMO] Mock incoming block data — replace with on-chain event query
  const mockData = [
    { time: '2026-06-16 14:30:00', from: '0x1234...5678', to: '0xabcd...efgh', amount: '1.5', reason: '黑名单地址', hash: '0xabc...def' }
  ];
  
  renderIncomingBlocks(mockData);
}

// ==================== 紧急暂停 ====================
function emergencyPause() {
  safeConfirm('确定要紧急暂停合约吗？此操作需要多签确认。', function() {
    showToast('紧急暂停请求已提交', 'success');
    const pauseStatus = document.getElementById('pauseStatus');
    if (pauseStatus) {
      clearElement(pauseStatus);
      const icon = createEl('div', { text: '🛑', styles: { fontSize: '4rem', marginBottom: '16px' } });
      const title = createEl('div', { 
        text: '合约已暂停',
        styles: { fontSize: '1.5rem', fontWeight: '600', color: 'var(--danger)' }
      });
      const desc = createEl('div', { 
        text: '所有功能已暂停，只有管理员可以解除',
        styles: { color: 'var(--text-secondary)', marginTop: '8px' }
      });
      pauseStatus.appendChild(icon);
      pauseStatus.appendChild(title);
      pauseStatus.appendChild(desc);
    }
  });
}

function emergencyUnpause() {
  safeConfirm('确定要解除合约暂停吗？', function() {
    showToast('合约已恢复正常运行', 'success');
    const pauseStatus = document.getElementById('pauseStatus');
    if (pauseStatus) {
      clearElement(pauseStatus);
      const icon = createEl('div', { text: '✅', styles: { fontSize: '4rem', marginBottom: '16px' } });
      const title = createEl('div', { 
        text: '合约运行正常',
        styles: { fontSize: '1.5rem', fontWeight: '600', color: 'var(--success)' }
      });
      const desc = createEl('div', { 
        text: '所有功能正常运行',
        styles: { color: 'var(--text-secondary)', marginTop: '8px' }
      });
      pauseStatus.appendChild(icon);
      pauseStatus.appendChild(title);
      pauseStatus.appendChild(desc);
    }
  });
}

// ==================== 日志 (DEMO) ====================
async function loadLogs() {
  const timeline = document.getElementById('logsTimeline');
  if (!timeline) return;
  
  clearElement(timeline);
  
  // [DEMO] Mock audit logs — replace with on-chain event query or backend API
  const mockLogs = [
    { time: '2026-06-16 14:30:00', content: 'Admin 添加了地址标签: 0x1234...5678 → 黑名单' },
    { time: '2026-06-16 13:15:00', content: 'System 自动拦截交易: 0xabcd...efgh' },
    { time: '2026-06-16 11:45:00', content: 'Admin 修改了限额配置' }
  ];
  
  mockLogs.forEach(log => {
    const item = createEl('div', { className: 'timeline-item' });
    const time = createEl('div', { className: 'timeline-time', text: log.time });
    const content = createEl('div', { className: 'timeline-content', text: log.content });
    item.appendChild(time);
    item.appendChild(content);
    timeline.appendChild(item);
  });
}

function exportLogs() {
  showToast('日志导出中...', 'info');
  setTimeout(() => showToast('日志导出完成', 'success'), 2000);
}

// ==================== 策略配置 (DEMO) ====================
async function loadPolicies() {
  const policyMaxTx = document.getElementById('policyMaxTx');
  const policyDailyLimit = document.getElementById('policyDailyLimit');
  const policyAllowMedium = document.getElementById('policyAllowMedium');
  const policyAllowHigh = document.getElementById('policyAllowHigh');
  const policyBlockMixer = document.getElementById('policyBlockMixer');
  const policyRequireKYC = document.getElementById('policyRequireKYC');
  
  // [DEMO] Mock policy values — replace with on-chain PolicyEngine query
  if (policyMaxTx) policyMaxTx.textContent = formatNumber(1000000);
  if (policyDailyLimit) policyDailyLimit.textContent = formatNumber(500000);
  if (policyAllowMedium) policyAllowMedium.textContent = '是';
  if (policyAllowHigh) policyAllowHigh.textContent = '否';
  if (policyBlockMixer) policyBlockMixer.textContent = '是';
  if (policyRequireKYC) policyRequireKYC.textContent = '是';
  
  // [DEMO] Mock policy history — replace with on-chain event query
  const mockHistory = [
    { version: 'v1.2', maxTx: 1000000, dailyLimit: 500000, allowMedium: true, allowHigh: false, updatedAt: '2026-06-15' },
    { version: 'v1.1', maxTx: 500000, dailyLimit: 250000, allowMedium: true, allowHigh: false, updatedAt: '2026-05-20' },
    { version: 'v1.0', maxTx: 100000, dailyLimit: 50000, allowMedium: false, allowHigh: false, updatedAt: '2026-04-01' }
  ];
  
  renderPolicyHistory(mockHistory);
}

function openPolicyModal() {
  const modal = document.getElementById('policyModal');
  if (modal) modal.classList.add('active');
}

function submitPolicy() {
  showToast('策略已保存', 'success');
  const modal = document.getElementById('policyModal');
  if (modal) modal.classList.remove('active');
}

// ==================== 合规日志 (DEMO) ====================
async function loadSubgraphComplianceChecks() {
  const tbody = document.getElementById('complianceLogsTable');
  if (!tbody) return;
  
  // [DEMO] Mock compliance logs — replace with Subgraph GraphQL query
  const mockData = [
    { from: '0x1234...5678', to: '0xabcd...efgh', amount: '10,000 TUSD', decision: 'BLOCK', reason: 'OFAC 制裁', time: '2026-06-16 14:30:00' },
    { from: '0x1111...2222', to: '0x3333...4444', amount: '5,000 TUSD', decision: 'ALLOW', reason: '低风险', time: '2026-06-16 14:25:00' },
    { from: '0x5555...6666', to: '0x7777...8888', amount: '25,000 TUSD', decision: 'HOLD', reason: '待审核', time: '2026-06-16 14:20:00' }
  ];
  
  renderComplianceLogs(mockData);
}

function filterComplianceLogs() {
  const filter = document.getElementById('filterDecision');
  if (filter) {
    showToast(`筛选决策: ${filter.value || '全部'}`, 'info');
  }
  loadSubgraphComplianceChecks();
}

// ==================== 系统设置 ====================
function saveSettings() {
  const contractAddress = document.getElementById('contractAddress');
  const networkSelect = document.getElementById('networkSelect');
  const rpcUrl = document.getElementById('rpcUrl');
  
  console.log('保存设置:', {
    contractAddress: contractAddress ? contractAddress.value : '',
    network: networkSelect ? networkSelect.value : '',
    rpcUrl: rpcUrl ? rpcUrl.value : ''
  });
  showToast('设置已保存', 'success');
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
  // 初始化图表
  initCharts();
  
  // 初始化所有事件监听
  if (typeof initAllEvents === 'function') {
    initAllEvents();
  }
  
  // 检查 MetaMask
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', function(accounts) {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        walletAddress = accounts[0];
        const walletAddrEl = document.getElementById('walletAddress');
        if (walletAddrEl) walletAddrEl.textContent = formatAddress(walletAddress);
      }
    });
    
    window.ethereum.on('chainChanged', function() {
      window.location.reload();
    });
  }
  
  // 默认显示 dashboard
  showPage('dashboard');
});

// [Medium Fix #9] Window global function exports — kept for backward compatibility with HTML onclick attributes.
// TODO: Migrate all HTML onclick handlers to addEventListener and remove these window assignments.
// This reduces the attack surface from DOM-based XSS.
// Export functions for HTML invocation (backward compatibility)
window.showPage = showPage;
window.toggleMobileSidebar = toggleMobileSidebar;
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;
window.loadBlockedTransfers = loadBlockedTransfers;
window.initMonitor = initMonitor;
window.refreshMonitor = refreshMonitor;
window.openAddCustomerModal = openAddCustomerModal;
window.closeAddCustomerModal = closeAddCustomerModal;
window.submitAddCustomer = submitAddCustomer;
window.viewCustomer = viewCustomer;
window.editCustomer = editCustomer;
window.openTagModal = openTagModal;
window.closeTagModal = closeTagModal;
window.submitTag = submitTag;
window.editTag = editTag;
window.removeTag = removeTag;
window.saveLimits = saveLimits;
window.openTimelockConfigModal = openTimelockConfigModal;
window.closeTimelockConfigModal = closeTimelockConfigModal;
window.submitTimelockConfig = submitTimelockConfig;
window.cancelOperation = cancelOperation;
window.loadPendingOperations = loadPendingOperations;
window.openAddSignerModal = openAddSignerModal;
window.closeAddSignerModal = closeAddSignerModal;
window.addSigner = addSigner;
window.submitAddSigner = submitAddSigner;
window.loadSigners = loadSigners;
window.updateRequiredSigs = updateRequiredSigs;
window.loadQuarantine = loadQuarantine;
window.loadQuarantineRecords = loadQuarantineRecords;
window.filterQuarantineRecords = filterQuarantineRecords;
window.releaseFunds = releaseFunds;
window.loadIncomingBlocks = loadIncomingBlocks;
window.emergencyPause = emergencyPause;
window.emergencyUnpause = emergencyUnpause;
window.loadLogs = loadLogs;
window.exportLogs = exportLogs;
window.loadPolicies = loadPolicies;
window.openPolicyModal = openPolicyModal;
window.submitPolicy = submitPolicy;
window.loadSubgraphComplianceChecks = loadSubgraphComplianceChecks;
window.filterComplianceLogs = filterComplianceLogs;
window.saveSettings = saveSettings;
window.closeModal = closeModal;
window.connectMetaMask = connectWallet;
