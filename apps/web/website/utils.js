/**
 * FidesOrigin — Shared Utilities
 * Extracted from interactions.js for reuse across pages
 */

// ===== Throttle (setTimeout-based, P3-2) =====
window.throttle = function(func, limit) {
  var inThrottle;
  return function() {
    var args = arguments;
    var context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(function() { inThrottle = false; }, limit);
    }
  };
};

// ===== Intersection Observer Helper =====
window.observeElements = function(selector, options) {
  var opts = options || {};
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        if (!opts.keepObserving) {
          observer.unobserve(entry.target);
        }
      }
    });
  }, { threshold: opts.threshold || 0.1, rootMargin: opts.rootMargin || '0px' });

  document.querySelectorAll(selector).forEach(function(el) {
    observer.observe(el);
  });
  return observer;
};

// ===== Smooth Scroll =====
window.initSmoothScroll = function() {
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
};

// ===== Scroll Spy (Header shadow) =====
window.initScrollSpy = function() {
  var header = document.querySelector('.header');
  if (!header) return;
  window.addEventListener('scroll', window.throttle(function() {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, 100));
};

// ===== Hero Parallax =====
window.initHeroParallax = function() {
  var heroBg = document.querySelector('.hero-bg-effect');
  if (!heroBg) return;
  window.addEventListener('scroll', window.throttle(function() {
    var scrolled = window.pageYOffset;
    heroBg.style.transform = 'translateY(' + (scrolled * 0.3) + 'px)';
  }, 16));
};

// ===== Active Nav Link =====
window.initActiveNav = function() {
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav a[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  window.addEventListener('scroll', window.throttle(function() {
    var current = '';
    sections.forEach(function(section) {
      var sectionTop = section.offsetTop;
      if (window.pageYOffset >= sectionTop - 200) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(function(link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }, 100));
};
