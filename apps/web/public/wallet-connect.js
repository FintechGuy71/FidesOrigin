/**
 * FidesOrigin Wallet Connect Module
 * Connects MetaMask, queries on-chain compliance status via FidesCompliance contract
 * Supports: Sepolia Testnet, Ethereum Mainnet, Base
 * Uses ethers.js v6 (self-hosted)
 */
(function () {
  'use strict';

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
      contract: '0x1176db6ECa38AA9C4d153Ae4d21C3972c6335707',
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
        showNotification('No wallet detected. Please install MetaMask or another Web3 wallet.', 'error');
        return;
      }

      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        showNotification('Please connect a wallet account.', 'warning');
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
          showNotification('Please switch to Sepolia Testnet in your wallet.', 'warning');
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
      console.error('Wallet connect error:', err);
      if (err.code === 4001) {
        setText('wallet-status', 'Connection rejected');
      } else {
        setText('wallet-status', 'Connection failed');
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

    setText('compliance-status', 'Checking…');
    show('compliance-result', true);
    const resultEl = el('compliance-result');
    if (resultEl) {
      resultEl.classList.remove('compliant', 'non-compliant', 'error');
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
        badgeText = 'SANCTIONED';
        badgeClass = 'status-danger';
      } else if (!isCompliant || score >= 80) {
        resultClass = 'non-compliant';
        badgeText = 'HIGH RISK';
        badgeClass = 'status-danger';
      } else if (score >= 40) {
        resultClass = 'warning';
        badgeText = 'MEDIUM RISK';
        badgeClass = 'status-warning';
      } else {
        resultClass = 'compliant';
        badgeText = 'COMPLIANT';
        badgeClass = 'status-safe';
      }

      if (statusEl) statusEl.appendChild(createBadge(badgeText, badgeClass));
      if (resultEl) resultEl.classList.add(resultClass);

      const updatedDate = lastUpdated > 0
        ? new Date(Number(lastUpdated) * 1000).toLocaleDateString()
        : 'N/A';

      const riskClass = score >= 80 ? 'risk-score-high' : score >= 40 ? 'risk-score-medium' : 'risk-score-low';

      if (detailsEl) {
        detailsEl.appendChild(createComplianceRow('Risk Score', String(score), riskClass));
        detailsEl.appendChild(createComplianceRow('Profile Score', String(profileScore), ''));
        detailsEl.appendChild(createComplianceRow('Sanctioned', isSanctioned ? 'Yes' : 'No', ''));
        detailsEl.appendChild(createComplianceRow('Last Updated', updatedDate, ''));
      }

    } catch (err) {
      console.error('Compliance query error:', err);
      if (resultEl) resultEl.classList.add('error');

      const statusEl = clearElement('compliance-status');
      if (statusEl) statusEl.appendChild(createBadge('Query Failed', 'status-error'));

      const detailsEl = clearElement('compliance-details');
      if (detailsEl) {
        const errDiv = document.createElement('div');
        errDiv.className = 'compliance-error';
        errDiv.textContent = err.message || 'Unable to query contract';
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
        showNotification('Please install MetaMask or another Web3 wallet to connect. Download: https://metamask.io', 'error');
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
