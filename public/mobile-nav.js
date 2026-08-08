/**
 * FIDESORIGIN — MOBILE BOTTOM NAVIGATION (Optional Enhancement)
 * P2-11: Bottom tab bar for mobile devices
 *
 * Usage:
 *   1. Include mobile-nav.css in <head>:
 *      <link rel="stylesheet" href="/mobile-nav.css">
 *   2. Add a container in <body> before </body>:
 *      <nav class="fio-mobile-nav" id="mobileBottomNav" aria-label="Mobile navigation"></nav>
 *   3. Include this script:
 *      <script src="/mobile-nav.js"></script>
 *   4. Call initMobileNav() with your page config:
 *      <script>initMobileNav({ active: 'home' });</script>
 *
 * Available active keys: 'home', 'products', 'docs', 'check', 'contact'
 */

(function () {
  'use strict';

  const NAV_ITEMS = [
    {
      key: 'home',
      label: 'Home',
      href: '/',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
    },
    {
      key: 'products',
      label: 'Products',
      href: '/#products',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8m-4-4v4"/></svg>',
    },
    {
      key: 'docs',
      label: 'Docs',
      href: '/docs/',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    },
    {
      key: 'check',
      label: 'Check',
      href: '/address-check.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    },
    {
      key: 'contact',
      label: 'Contact',
      href: '/contact-form.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>',
    },
  ];

  function render(container, activeKey) {
    if (!container) return;

    const ul = document.createElement('ul');
    ul.className = 'fio-mobile-nav__list';

    NAV_ITEMS.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'fio-mobile-nav__item';

      const a = document.createElement('a');
      a.href = item.href;
      a.className = 'fio-mobile-nav__link';
      if (item.key === activeKey) {
        a.classList.add('fio-mobile-nav__link--active');
        a.setAttribute('aria-current', 'page');
      }
      a.innerHTML = item.icon + '<span>' + item.label + '</span>';

      li.appendChild(a);
      ul.appendChild(li);
    });

    container.appendChild(ul);
  }

  // Auto-detect active page from current pathname
  function detectActiveKey() {
    const path = window.location.pathname;
    if (path === '/' || path.endsWith('/index.html')) return 'home';
    if (path.includes('address-check')) return 'check';
    if (path.includes('contact')) return 'contact';
    if (path.includes('docs')) return 'docs';
    return 'home';
  }

  // Exposed API
  window.initMobileNav = function (options) {
    options = options || {};
    const container =
      options.container ||
      document.getElementById('mobileBottomNav') ||
      document.querySelector('.fio-mobile-nav');
    const activeKey = options.active || detectActiveKey();

    if (!container) {
      console.warn('[mobile-nav] No container found. Add <nav class="fio-mobile-nav" id="mobileBottomNav"> to your HTML.');
      return;
    }

    render(container, activeKey);
  };

  // Auto-init if data-autoinit is present on the container
  document.addEventListener('DOMContentLoaded', function () {
    const autoContainer = document.querySelector('.fio-mobile-nav[data-autoinit]');
    if (autoContainer) {
      window.initMobileNav({ container: autoContainer });
    }
  });
})();
