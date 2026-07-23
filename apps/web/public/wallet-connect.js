/**
 * FidesOrigin Wallet Connect Module
 * Connects MetaMask, queries on-chain compliance status via FidesCompliance contract
 * Supports: Sepolia Testnet, Ethereum Mainnet, Base
 * Uses ethers.js v6 from CDN
 */
(function () {
  'use strict';

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
      contract: null, // not deployed yet
      explorer: 'https://etherscan.io',
    },
    base: {
      chainId: 8453,
      chainIdHex: '0x2105',
      name: 'Base',
      rpc: 'https://mainnet.base.org',
      contract: null, // not deployed yet
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

  function setHtml(id, html) {
    const e = el(id);
    if (e) e.innerHTML = html;
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
      script.src = 'https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.umd.min.js';
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
      // 4902 = chain not added
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
        alert('No wallet detected. Please install MetaMask or another Web3 wallet.');
        return;
      }

      // Request accounts
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        alert('Please connect a wallet account.');
        return;
      }

      currentAddress = accounts[0];
      provider = new ethersLib.BrowserProvider(eth);
      signer = await provider.getSigner();

      // Detect network
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      // Check if on supported network
      let networkKey = null;
      for (const [key, cfg] of Object.entries(CONFIG)) {
        if (cfg.chainId === chainId) {
          networkKey = key;
          break;
        }
      }

      if (!networkKey) {
        // Not on a supported network, try to switch to Sepolia
        const switched = await switchToSepolia(eth);
        if (!switched) {
          alert('Please switch to Sepolia Testnet in your wallet.');
          return;
        }
        // Re-create provider after switch
        provider = new ethersLib.BrowserProvider(eth);
        signer = await provider.getSigner();
        networkKey = 'sepolia';
      }

      currentNetwork = networkKey;
      const cfg = CONFIG[currentNetwork];

      // Only create contract if deployed on this network
      if (cfg.contract) {
        contract = new ethersLib.Contract(cfg.contract, FIDES_ABI, provider);
      } else {
        contract = null;
      }

      updateUIConnected();
      await queryCompliance();

      // Listen for account changes
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged', handleChainChanged);

    } catch (err) {
      console.error('Wallet connect error:', err);
      if (err.code === 4001) {
        // User rejected
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
    el('compliance-result').classList.remove('compliant', 'non-compliant', 'error');

    try {
      const [isCompliant, riskScore] = await contract.quickCheckAddress(currentAddress);
      const [riskProfileScore, isSanctioned, lastUpdated] = await contract.getRiskProfile(currentAddress);

      const score = Number(riskScore);
      const profileScore = Number(riskProfileScore);

      // Build status display
      let statusHtml = '';
      let resultClass = '';

      if (isSanctioned) {
        resultClass = 'non-compliant';
        statusHtml = `<span class="status-badge status-danger">SANCTIONED</span>`;
      } else if (!isCompliant || score >= 80) {
        resultClass = 'non-compliant';
        statusHtml = `<span class="status-badge status-danger">HIGH RISK</span>`;
      } else if (score >= 40) {
        resultClass = 'warning';
        statusHtml = `<span class="status-badge status-warning">MEDIUM RISK</span>`;
      } else {
        resultClass = 'compliant';
        statusHtml = `<span class="status-badge status-safe">COMPLIANT</span>`;
      }

      const updatedDate = lastUpdated > 0
        ? new Date(Number(lastUpdated) * 1000).toLocaleDateString()
        : 'N/A';

      setHtml('compliance-status', statusHtml);
      el('compliance-result').classList.add(resultClass);

      setHtml('compliance-details', `
        <div class="compliance-row"><span>Risk Score</span><span class="risk-score-${score >= 80 ? 'high' : score >= 40 ? 'medium' : 'low'}">${score}</span></div>
        <div class="compliance-row"><span>Profile Score</span><span>${profileScore}</span></div>
        <div class="compliance-row"><span>Sanctioned</span><span>${isSanctioned ? 'Yes' : 'No'}</span></div>
        <div class="compliance-row"><span>Last Updated</span><span>${updatedDate}</span></div>
      `);

    } catch (err) {
      console.error('Compliance query error:', err);
      el('compliance-result').classList.add('error');
      setHtml('compliance-status', '<span class="status-badge status-error">Query Failed</span>');
      setHtml('compliance-details', `<div class="compliance-error">${err.message || 'Unable to query contract'}</div>`);
    }
  }

  // ── UI Updates ──────────────────────────────────────────────────────
  function updateUIConnected() {
    show('wallet-btn', false);
    show('wallet-connected', true);
    setText('wallet-address', shorten(currentAddress));

    // Mobile
    showBlock('mobile-wallet-btn', false);
    show('mobile-wallet-connected', true);
    setText('mobile-wallet-address', shorten(currentAddress));

    // Update network badge
    const cfg = CONFIG[currentNetwork];
    const badge = el('wallet-network');
    if (badge && cfg) {
      badge.textContent = cfg.name;
      badge.className = 'wallet-network-badge';
    }

    // Show compliance panel
    show('compliance-panel', true);

    // Update disconnect buttons
    bindClick('wallet-disconnect', disconnectWallet);
    bindClick('mobile-wallet-disconnect', disconnectWallet);
  }

  function updateUIDisconnected() {
    show('wallet-btn', true);
    show('wallet-connected', false);
    show('compliance-panel', false);
    show('compliance-result', false);
    setText('wallet-address', '');

    // Mobile
    showBlock('mobile-wallet-btn', true);
    show('mobile-wallet-connected', false);
    setText('mobile-wallet-address', '');
  }

  // ── Init ────────────────────────────────────────────────────────────
  function init() {
    if (!hasWallet()) {
      // No wallet: show button but it will prompt to install
      var noWalletHandler = function() {
        alert('Please install MetaMask or another Web3 wallet to connect.\n\nDownload: https://metamask.io');
      };
      bindClick('wallet-btn', noWalletHandler);
      bindClick('mobile-wallet-btn', noWalletHandler);
      return;
    }

    bindClick('wallet-btn', connectWallet);
    bindClick('mobile-wallet-btn', connectWallet);

    // Try auto-connect if previously connected
    const eth = getEthereum();
    if (eth && eth.request) {
      eth.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts && accounts.length > 0) {
          connectWallet();
        }
      }).catch(() => {});
    }
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
