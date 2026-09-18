/**
 * FidesOrigin Wallet Connect Module
 * Connects MetaMask, queries on-chain compliance status via FidesCompliance contract
 * Supports: Sepolia Testnet, Ethereum Mainnet, Base
 * Uses ethers.js v6 (self-hosted)
 */
(function () {
  'use strict';

  /* [AUDIT FIX 2026-09-17 R1-018] address-check 页四语言共用本脚本，原实现
     用户可见文案全部硬编码英文 → /cn /tw /jp 页面中英混杂。按 <html lang>
     （en / zh-CN / zh-TW / ja）选择文案，缺键回退英文。 */
  var WC_LANG = (document.documentElement.lang || 'en').toLowerCase();
  var WC_I18N = {
    'zh-cn': {
      noWallet: '未检测到钱包。请安装 MetaMask 或其他 Web3 钱包。',
      connectFirst: '请先连接钱包账户。',
      switchSepolia: '请在钱包中切换至 Sepolia 测试网。',
      connRejected: '连接已拒绝',
      connFailed: '连接失败',
      checking: '查询中…',
      sanctioned: '已制裁',
      highRisk: '高风险',
      medRisk: '中风险',
      compliant: '合规',
      riskScore: '风险评分',
      profileScore: '档案评分',
      sanctionedLabel: '制裁名单',
      yes: '是', no: '否', na: '无记录',
      lastUpdated: '最近更新',
      queryFailed: '查询失败',
      queryError: '无法查询合约',
      installWallet: '请安装 MetaMask 或其他 Web3 钱包后再连接。下载: https://metamask.io'
    },
    'zh-tw': {
      noWallet: '未偵測到錢包。請安裝 MetaMask 或其他 Web3 錢包。',
      connectFirst: '請先連接錢包帳戶。',
      switchSepolia: '請在錢包中切換至 Sepolia 測試網。',
      connRejected: '連接已拒絕',
      connFailed: '連接失敗',
      checking: '查詢中…',
      sanctioned: '已制裁',
      highRisk: '高風險',
      medRisk: '中風險',
      compliant: '合規',
      riskScore: '風險評分',
      profileScore: '檔案評分',
      sanctionedLabel: '制裁名單',
      yes: '是', no: '否', na: '無記錄',
      lastUpdated: '最近更新',
      queryFailed: '查詢失敗',
      queryError: '無法查詢合約',
      installWallet: '請安裝 MetaMask 或其他 Web3 錢包後再連接。下載: https://metamask.io'
    },
    'ja': {
      noWallet: 'ウォレットが検出されません。MetaMask などの Web3 ウォレットをインストールしてください。',
      connectFirst: '先にウォレットアカウントを接続してください。',
      switchSepolia: 'ウォレットで Sepolia テストネットに切り替えてください。',
      connRejected: '接続が拒否されました',
      connFailed: '接続に失敗しました',
      checking: '確認中…',
      sanctioned: '制裁対象',
      highRisk: '高リスク',
      medRisk: '中リスク',
      compliant: '適合',
      riskScore: 'リスクスコア',
      profileScore: 'プロファイルスコア',
      sanctionedLabel: '制裁リスト',
      yes: 'はい', no: 'いいえ', na: '記録なし',
      lastUpdated: '最終更新',
      queryFailed: 'クエリ失敗',
      queryError: 'コントラクトを照会できません',
      installWallet: '接続するには MetaMask などの Web3 ウォレットをインストールしてください。ダウンロード: https://metamask.io'
    }
  };
  var WC_EN = {
    noWallet: 'No wallet detected. Please install MetaMask or another Web3 wallet.',
    connectFirst: 'Please connect a wallet account.',
    switchSepolia: 'Please switch to Sepolia Testnet in your wallet.',
    connRejected: 'Connection rejected',
    connFailed: 'Connection failed',
    checking: 'Checking…',
    sanctioned: 'SANCTIONED',
    highRisk: 'HIGH RISK',
    medRisk: 'MEDIUM RISK',
    compliant: 'COMPLIANT',
    riskScore: 'Risk Score',
    profileScore: 'Profile Score',
    sanctionedLabel: 'Sanctioned',
    yes: 'Yes', no: 'No', na: 'N/A',
    lastUpdated: 'Last Updated',
    queryFailed: 'Query Failed',
    queryError: 'Unable to query contract',
    installWallet: 'Please install MetaMask or another Web3 wallet to connect. Download: https://metamask.io'
  };
  function t(key) {
    var dict = WC_I18N[WC_LANG] || WC_EN;
    return dict[key] || WC_EN[key] || key;
  }

  // Non-blocking notification helper
  function showNotification(message, type) {
    var existing = document.querySelector('.wallet-notification');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'wallet-notification wallet-notification--' + (type || 'info');
    el.textContent = message;
    el.setAttribute('role', 'alert');
    var bg = 'rgba(6,182,212,0.15)', color = '#67e8f9', border = '1px solid rgba(6,182,212,0.3)';
    if (type === 'error') { bg = 'rgba(239,68,68,0.15)'; color = '#fca5a5'; border = '1px solid rgba(239,68,68,0.3)'; }
    else if (type === 'warning') { bg = 'rgba(245,158,11,0.15)'; color = '#fcd34d'; border = '1px solid rgba(245,158,11,0.3)'; }
    el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-size:0.9rem;z-index:10000;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);background:' + bg + ';color:' + color + ';border:' + border + ';opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(el);
    requestAnimationFrame(function() { el.style.opacity = '1'; });
    setTimeout(function() {
      el.style.opacity = '0';
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 5000);
  }

  // ── Config ──────────────────────────────────────────────────────────
  const CONFIG = {
    sepolia: {
      chainId: 11155111,
      chainIdHex: '0xaa36a7',
      name: 'Sepolia',
      rpc: 'https://rpc.sepolia.org',
      /* [AUDIT FIX] FidesCompliance 当前生产代（v3.1.0）地址，
         与 packages/config/deployments.json、public/admin/admin-config.js 对齐。
         原值 0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707 在 deployments.json
         中已被标注为 deprecated（FidesCompliance_admin_config），指向旧部署，
         quickCheckAddress/getRiskProfile 查询的是过期合约。 */
      contract: '0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5',
      explorer: 'https://sepolia.etherscan.io',
    },
    mainnet: {
      chainId: 1,
      chainIdHex: '0x1',
      name: 'Ethereum',
      rpc: 'https://ethereum-rpc.publicnode.com',
      contract: null,
      explorer: 'https://etherscan.io',
    },
    base: {
      chainId: 8453,
      chainIdHex: '0x2105',
      name: 'Base',
      rpc: 'https://mainnet.base.org',
      contract: null,
      explorer: 'https://basescan.org',
    },
  };

  const DEFAULT_NETWORK = 'sepolia';

  // Minimal ABI for FidesCompliance (only functions we need)
  const FIDES_ABI = [
    {
      inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
      name: 'quickCheckAddress',
      outputs: [
        { internalType: 'bool', name: 'isCompliant', type: 'bool' },
        { internalType: 'uint256', name: 'riskScore', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
      name: 'getRiskProfile',
      outputs: [
        { internalType: 'uint256', name: 'riskScore', type: 'uint256' },
        { internalType: 'bool', name: 'isSanctioned', type: 'bool' },
        { internalType: 'uint256', name: 'lastUpdated', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  // ── State ───────────────────────────────────────────────────────────
  let provider = null;
  let signer = null;
  let contract = null;
  let currentAddress = null;
  let currentNetwork = DEFAULT_NETWORK;
  let ethersLib = null;

  // ── Utils ───────────────────────────────────────────────────────────
  function shorten(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function show(id, visible) {
    const e = el(id);
    if (e) e.style.display = visible ? 'flex' : 'none';
  }

  function setText(id, text) {
    const e = el(id);
    if (e) e.textContent = text;
  }

  /** [SEC-004 Fix] Replaced setHtml with DOM-safe clear + append approach */
  function clearElement(id) {
    const e = el(id);
    if (e) {
      while (e.firstChild) {
        e.removeChild(e.firstChild);
      }
    }
    return e;
  }

  function createBadge(text, className) {
    const span = document.createElement('span');
    span.className = 'status-badge ' + className;
    span.textContent = text;
    return span;
  }

  function createComplianceRow(label, valueText, valueClass) {
    const row = document.createElement('div');
    row.className = 'compliance-row';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    row.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    if (valueClass) valueSpan.className = valueClass;
    valueSpan.textContent = valueText;
    row.appendChild(valueSpan);

    return row;
  }

  function showBlock(id, visible) {
    const e = el(id);
    if (e) e.style.display = visible ? '' : 'none';
  }

  function bindClick(id, handler) {
    const e = el(id);
    if (e) e.addEventListener('click', handler);
  }

  // ── Ethers.js loader ────────────────────────────────────────────────
  async function loadEthers() {
    if (ethersLib) return ethersLib;
    if (window.ethers) {
      ethersLib = window.ethers;
      return ethersLib;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // [SEC-009 Fix] Self-hosted ethers.js instead of CDN
      script.src = '/ethers.umd.min.js';
      script.async = true;
      script.onload = () => {
        ethersLib = window.ethers;
        resolve(ethersLib);
      };
      script.onerror = () => reject(new Error('Failed to load ethers.js'));
      document.head.appendChild(script);
    });
  }

  // ── Wallet detection ────────────────────────────────────────────────
  function getEthereum() {
    return window.ethereum || (window.web3 && window.web3.currentProvider);
  }

  function hasWallet() {
    return !!getEthereum();
  }

  // ── Chain switching ─────────────────────────────────────────────────
  async function switchToSepolia(eth) {
    const cfg = CONFIG.sepolia;
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cfg.chainIdHex }] });
      return true;
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: cfg.chainIdHex,
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [cfg.rpc, 'https://ethereum-sepolia-rpc.publicnode.com'],
              blockExplorerUrls: [cfg.explorer],
            }],
          });
          return true;
        } catch (addErr) {
          return false;
        }
      }
      return false;
    }
  }

  // ── Connect ─────────────────────────────────────────────────────────
  async function connectWallet() {
    const btn = el('wallet-btn');
    if (btn) btn.disabled = true;

    try {
      await loadEthers();
      const eth = getEthereum();
      if (!eth) {
        showNotification(t('noWallet'), 'error');
        return;
      }

      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        showNotification(t('connectFirst'), 'warning');
        return;
      }

      currentAddress = accounts[0];
      provider = new ethersLib.BrowserProvider(eth);
      signer = await provider.getSigner();

      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      let networkKey = null;
      for (const [key, cfg] of Object.entries(CONFIG)) {
        if (cfg.chainId === chainId) {
          networkKey = key;
          break;
        }
      }

      if (!networkKey) {
        const switched = await switchToSepolia(eth);
        if (!switched) {
          showNotification(t('switchSepolia'), 'warning');
          return;
        }
        provider = new ethersLib.BrowserProvider(eth);
        signer = await provider.getSigner();
        networkKey = 'sepolia';
      }

      currentNetwork = networkKey;
      const cfg = CONFIG[currentNetwork];

      if (cfg.contract) {
        contract = new ethersLib.Contract(cfg.contract, FIDES_ABI, provider);
      } else {
        contract = null;
      }

      updateUIConnected();
      await queryCompliance();

      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged', handleChainChanged);

    } catch (err) {
      // console.error('Wallet connect error:', err);
      if (err.code === 4001) {
        setText('wallet-status', t('connRejected'));
      } else {
        setText('wallet-status', t('connFailed'));
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      currentAddress = accounts[0];
      updateUIConnected();
      queryCompliance();
    }
  }

  function handleChainChanged() {
    window.location.reload();
  }

  // ── Disconnect ──────────────────────────────────────────────────────
  function disconnectWallet() {
    provider = null;
    signer = null;
    contract = null;
    currentAddress = null;

    const eth = getEthereum();
    if (eth) {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    }

    updateUIDisconnected();
  }

  // ── Compliance query ────────────────────────────────────────────────
  async function queryCompliance() {
    if (!contract || !currentAddress) return;

    setText('compliance-status', t('checking'));
    show('compliance-result', true);
    const resultEl = el('compliance-result');
    if (resultEl) {
      /* [AUDIT FIX 2026-09-17 B2-006] 清除列表补 'warning'：原列表缺它，
         先查中风险（warning）再查合规（compliant）时两类共存，而 CSS 中
         .warning 优先级高于 .compliant → COMPLIANT 结果被染成告警黄。 */
      resultEl.classList.remove('compliant', 'non-compliant', 'warning', 'error');
    }

    try {
      const [isCompliant, riskScore] = await contract.quickCheckAddress(currentAddress);
      const [riskProfileScore, isSanctioned, lastUpdated] = await contract.getRiskProfile(currentAddress);

      const score = Number(riskScore);
      const profileScore = Number(riskProfileScore);

      // [SEC-004 Fix] Build status display using DOM APIs instead of innerHTML
      const statusEl = clearElement('compliance-status');
      const detailsEl = clearElement('compliance-details');

      let resultClass = '';
      let badgeText = '';
      let badgeClass = '';

      if (isSanctioned) {
        resultClass = 'non-compliant';
        badgeText = t('sanctioned');
        badgeClass = 'status-danger';
      } else if (!isCompliant || score >= 70) { // [AUDIT FIX 2026-09-18 R3-L14] 阈值统一为 shared RISK_THRESHOLDS（high≥70）
        resultClass = 'non-compliant';
        badgeText = t('highRisk');
        badgeClass = 'status-danger';
      } else if (score >= 30) { // [R3-L14] medium≥30
        resultClass = 'warning';
        badgeText = t('medRisk');
        badgeClass = 'status-warning';
      } else {
        resultClass = 'compliant';
        badgeText = t('compliant');
        badgeClass = 'status-safe';
      }

      if (statusEl) statusEl.appendChild(createBadge(badgeText, badgeClass));
      if (resultEl) resultEl.classList.add(resultClass);

      const updatedDate = lastUpdated > 0
        ? new Date(Number(lastUpdated) * 1000).toLocaleDateString()
        : t('na');

      const riskClass = score >= 70 ? 'risk-score-high' : score >= 30 ? 'risk-score-medium' : 'risk-score-low'; // [R3-L14]

      if (detailsEl) {
        detailsEl.appendChild(createComplianceRow(t('riskScore'), String(score), riskClass));
        detailsEl.appendChild(createComplianceRow(t('profileScore'), String(profileScore), ''));
        detailsEl.appendChild(createComplianceRow(t('sanctionedLabel'), isSanctioned ? t('yes') : t('no'), ''));
        detailsEl.appendChild(createComplianceRow(t('lastUpdated'), updatedDate, ''));
      }

    } catch (err) {
      // console.error('Compliance query error:', err);
      if (resultEl) resultEl.classList.add('error');

      const statusEl = clearElement('compliance-status');
      if (statusEl) statusEl.appendChild(createBadge(t('queryFailed'), 'status-error'));

      const detailsEl = clearElement('compliance-details');
      if (detailsEl) {
        const errDiv = document.createElement('div');
        errDiv.className = 'compliance-error';
        errDiv.textContent = err.message || t('queryError');
        detailsEl.appendChild(errDiv);
      }
    }
  }

  // ── UI Updates ──────────────────────────────────────────────────────
  function updateUIConnected() {
    show('wallet-btn', false);
    show('wallet-connected', true);
    setText('wallet-address', shorten(currentAddress));

    showBlock('mobile-wallet-btn', false);
    show('mobile-wallet-connected', true);
    setText('mobile-wallet-address', shorten(currentAddress));

    const cfg = CONFIG[currentNetwork];
    const badge = el('wallet-network');
    if (badge && cfg) {
      badge.textContent = cfg.name;
      badge.className = 'wallet-network-badge';
    }

    show('compliance-panel', true);

    bindClick('wallet-disconnect', disconnectWallet);
    bindClick('mobile-wallet-disconnect', disconnectWallet);
  }

  function updateUIDisconnected() {
    show('wallet-btn', true);
    show('wallet-connected', false);
    show('compliance-panel', false);
    show('compliance-result', false);
    setText('wallet-address', '');

    showBlock('mobile-wallet-btn', true);
    show('mobile-wallet-connected', false);
    setText('mobile-wallet-address', '');
  }

  // ── Init ────────────────────────────────────────────────────────────
  function init() {
    if (!hasWallet()) {
      var noWalletHandler = function() {
        showNotification(t('installWallet'), 'error');
      };
      bindClick('wallet-btn', noWalletHandler);
      bindClick('mobile-wallet-btn', noWalletHandler);
      return;
    }

    bindClick('wallet-btn', connectWallet);
    bindClick('mobile-wallet-btn', connectWallet);

    const eth = getEthereum();
    if (eth && eth.request) {
      eth.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts && accounts.length > 0) {
          connectWallet();
        }
      }).catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
