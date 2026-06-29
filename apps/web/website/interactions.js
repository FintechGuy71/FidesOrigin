/**
 * FidesOrigin — Page Interactions
 * Modular initialization: only runs features for DOM elements present on current page
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // ===== Feature Detection =====
  var hasHero = !!document.querySelector('.hero');
  var hasFadeIn = document.querySelectorAll('.fade-in').length > 0;
  var hasHeader = !!document.querySelector('.header');
  var hasNavLinks = document.querySelectorAll('.nav a[href^="#"]').length > 0;
  var hasSmoothScroll = document.querySelectorAll('a[href^="#"]').length > 0;

  // ===== Initialize Features (conditional) =====

  // 1. Scroll Spy (header shadow) — always if header exists
  if (hasHeader && typeof window.initScrollSpy === 'function') {
    window.initScrollSpy();
  }

  // 2. Hero Parallax — only on pages with hero
  if (hasHero && typeof window.initHeroParallax === 'function') {
    window.initHeroParallax();
  }

  // 3. Fade-in animations — only if elements exist
  if (hasFadeIn && typeof window.observeElements === 'function') {
    window.observeElements('.fade-in', { threshold: 0.1 });
  }

  // 4. Smooth scroll — only if anchor links exist
  if (hasSmoothScroll && typeof window.initSmoothScroll === 'function') {
    window.initSmoothScroll();
  }

  // 5. Active nav link — only if nav + sections exist
  if (hasNavLinks && typeof window.initActiveNav === 'function') {
    window.initActiveNav();
  }

  // ===== Staggered Animation Delays =====
  document.querySelectorAll('.stagger-1, .stagger-2, .stagger-3, .stagger-4').forEach(function(el) {
    var delay = 0;
    if (el.classList.contains('stagger-1')) delay = 0.1;
    else if (el.classList.contains('stagger-2')) delay = 0.2;
    else if (el.classList.contains('stagger-3')) delay = 0.3;
    else if (el.classList.contains('stagger-4')) delay = 0.4;
    el.style.transitionDelay = delay + 's';
  });

  // ===== Hero Entrance Animations =====
  if (hasHero) {
    setTimeout(function() {
      document.querySelectorAll('.delay-1').forEach(function(el) { el.style.transitionDelay = '0.1s'; el.classList.add('visible'); });
    }, 100);
    setTimeout(function() {
      document.querySelectorAll('.delay-2').forEach(function(el) { el.style.transitionDelay = '0.2s'; el.classList.add('visible'); });
    }, 200);
    setTimeout(function() {
      document.querySelectorAll('.delay-3').forEach(function(el) { el.style.transitionDelay = '0.3s'; el.classList.add('visible'); });
    }, 300);
  }

  // ===== Code Block Copy =====
  document.querySelectorAll('.code-block').forEach(function(block) {
    var copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.title = 'Copy';
    copyBtn.addEventListener('click', function() {
      var code = block.querySelector('code');
      if (code) {
        navigator.clipboard.writeText(code.textContent).then(function() {
          copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(function() {
            copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 2000);
        });
      }
    });
    block.appendChild(copyBtn);
  });

  // ===== Demo Input Focus =====
  var demoInput = document.getElementById('demoAddress');
  if (demoInput) {
    demoInput.addEventListener('focus', function() {
      this.parentElement.classList.add('focused');
    });
    demoInput.addEventListener('blur', function() {
      this.parentElement.classList.remove('focused');
    });
  }

  // ===== Pricing Card Hover =====
  document.querySelectorAll('.pricing-card').forEach(function(card) {
    card.addEventListener('mouseenter', function() {
      if (!this.classList.contains('pricing-highlight')) {
        this.style.transform = 'translateY(-4px)';
      }
    });
    card.addEventListener('mouseleave', function() {
      if (!this.classList.contains('pricing-highlight')) {
        this.style.transform = 'translateY(0)';
      }
    });
  });

  // ===== Trust Logo Hover =====
  document.querySelectorAll('.trust-logo').forEach(function(logo) {
    logo.addEventListener('mouseenter', function() {
      this.style.opacity = '1';
    });
    logo.addEventListener('mouseleave', function() {
      this.style.opacity = '0.6';
    });
  });
});
