/**
 * FidesOrigin — Shared Language Utilities
 * Extracted from cn/index.html and tw/index.html to eliminate duplication
 */

(function() {
  'use strict';

  // ===== Navigation =====
  window.openNav = function() {
    var nav = document.getElementById('mainNav');
    var overlay = document.getElementById('navOverlay');
    if (nav) nav.classList.add('show');
    if (overlay) overlay.classList.add('show');
    document.body.classList.add('nav-open');
  };

  window.closeNav = function() {
    var nav = document.getElementById('mainNav');
    var overlay = document.getElementById('navOverlay');
    if (nav) nav.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('nav-open');
  };

  // ===== Language Detection =====
  // [Critical Fix #9] Removed IP geolocation auto-redirect.
  // Only uses navigator.language for language detection. No external IP APIs.
  window.detectLang = async function() {
    var lang = navigator.language || navigator.userLanguage || 'en';
    if (lang.startsWith('zh-Hans') || lang === 'zh-CN') return 'cn';
    if (lang.startsWith('zh-Hant') || lang === 'zh-TW' || lang === 'zh-HK') return 'tw';
    if (lang.startsWith('ja') || lang.startsWith('jp')) return 'jp';
    return 'en';
  };

  window.getBasePath = function() {
    var path = window.location.pathname;
    if (path.includes('/cn/') || path.includes('/tw/')) return '../';
    return './';
  };

  window.getLangPath = function(lang) {
    var base = window.getBasePath();
    if (lang === 'en') return base;
    return base + lang + '/';
  };

  window.switchLang = function(lang) {
    localStorage.setItem('lang-pref', lang);
    window.location.href = window.getLangPath(lang);
  };

  window.toggleDropdown = function(id, event) {
    event.stopPropagation();
    var dropdown = document.getElementById(id);
    if (!dropdown) return;
    var isOpen = dropdown.classList.contains('open');
    document.querySelectorAll('.lang-dropdown').forEach(function(d) { d.classList.remove('open'); });
    if (!isOpen) dropdown.classList.add('open');
  };

  window.closeAllDropdowns = function() {
    document.querySelectorAll('.lang-dropdown').forEach(function(d) { d.classList.remove('open'); });
  };

  // ===== Demo Risk Check =====
  // [Medium Fix #14] Freeze global variables to prevent tampering
  window.KNOWN_ADDRESSES = Object.freeze({
    '0x1234567890123456789012345678901234567890': { score: 95, tier: 'BLACK', source: 'OFAC', tags: 'Sanctioned' },
    '0xab5801a7d398351b8be11c439e05c5b3259aec9b': { score: 90, tier: 'BLACK', source: 'Chainalysis', tags: 'Hacker' },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { score: 85, tier: 'GREY', source: 'Etherscan', tags: 'Scam' }
  });

  window.checkRisk = function() {
    var input = document.getElementById('demoAddress');
    var result = document.getElementById('demoResult');
    var badge = document.getElementById('riskBadge');
    if (!input || !result || !badge) return;

    var val = input.value.trim().toLowerCase();

    if (!val.match(/^0x[a-f0-9]{40}$/)) {
      badge.className = 'risk-indicator risk-low';
      badge.textContent = window.LANG_INVALID_ADDRESS || 'Invalid Address';
      var scoreEl = document.getElementById('riskScore');
      var sourceEl = document.getElementById('riskSource');
      var tagsEl = document.getElementById('riskTags');
      if (scoreEl) scoreEl.textContent = '';
      if (sourceEl) sourceEl.textContent = '-';
      if (tagsEl) tagsEl.textContent = '-';
      result.classList.add('show');
      return;
    }

    result.classList.add('show');
    var data = window.KNOWN_ADDRESSES[val];
    if (data) {
      badge.className = data.tier === 'BLACK' ? 'risk-indicator risk-high' : 'risk-indicator risk-low';
      badge.textContent = data.tier === 'BLACK'
        ? (window.LANG_HIGH_RISK || 'High Risk')
        : (window.LANG_FLAGGED || 'Flagged');
      var scoreEl2 = document.getElementById('riskScore');
      var sourceEl2 = document.getElementById('riskSource');
      var tagsEl2 = document.getElementById('riskTags');
      if (scoreEl2) scoreEl2.textContent = (window.LANG_SCORE || 'Score: ') + data.score + '/100';
      if (sourceEl2) sourceEl2.textContent = data.source;
      if (tagsEl2) tagsEl2.textContent = data.tags;
    } else {
      badge.className = 'risk-indicator risk-safe';
      badge.textContent = window.LANG_NOT_IN_DB || 'Not in Database';
      var scoreEl3 = document.getElementById('riskScore');
      var sourceEl3 = document.getElementById('riskSource');
      var tagsEl3 = document.getElementById('riskTags');
      if (scoreEl3) scoreEl3.textContent = window.LANG_NO_RISK || 'No risk signals detected';
      if (sourceEl3) sourceEl3.textContent = 'N/A';
      if (tagsEl3) tagsEl3.textContent = window.LANG_NONE || 'None';
    }
  };

  // [Critical Fix #9] Auto-init: no IP-based redirect. Only sets language preference.
  window.initLangAutoRedirect = async function() {
    var saved = localStorage.getItem('lang-pref');
    if (saved) return;
    // No auto-redirect. User can manually switch language via UI.
  };

  // ===== Global Event Listeners =====
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.lang-dropdown')) window.closeAllDropdowns();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.closeAllDropdowns();
      window.closeNav();
    }
  });

})();
