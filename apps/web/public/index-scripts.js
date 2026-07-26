// FidesOrigin shared index scripts — language-aware
(function() {
  var lang = (document.documentElement.lang || 'en').toLowerCase();
  var isZhCN = lang.startsWith('zh-cn');
  var isZhTW = lang.startsWith('zh-tw') || lang.startsWith('zh-hk');
  var isJa = lang.startsWith('ja');

  var i18n = {
    copy: isZhCN ? '复制' : isZhTW ? '複製' : isJa ? 'コピー' : 'Copy',
    copied: isZhCN ? '已复制' : isZhTW ? '已複製' : isJa ? 'コピー済' : 'Copied',
    scrollTop: isZhCN ? '回到顶部' : isZhTW ? '回到頂部' : isJa ? 'トップへ戻る' : 'Scroll to top'
  };

  // ===== Mobile Menu =====
  function toggleMobileMenu() {
    var menu = document.getElementById('mobileMenu');
    var isActive = menu.classList.toggle('active');
    document.body.style.overflow = isActive ? 'hidden' : '';
    var btn = document.querySelector('.nav-mobile-btn');
    if (btn) btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  }
  document.addEventListener('DOMContentLoaded', function() {
    var mobileBtn = document.querySelector('.nav-mobile-btn');
    if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileMenu);
    var closeBtn = document.querySelector('.mobile-menu-close');
    if (closeBtn) closeBtn.addEventListener('click', toggleMobileMenu);
    document.querySelectorAll('#mobileMenu a').forEach(function(link) {
      link.addEventListener('click', toggleMobileMenu);
    });
  });

  // ===== Language Menu =====
  function toggleLangMenu(e) {
    e.stopPropagation();
    var menu = document.getElementById('langMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  }
  document.addEventListener('DOMContentLoaded', function() {
    var langBtn = document.getElementById('langToggleBtn');
    if (langBtn) langBtn.addEventListener('click', toggleLangMenu);
  });
  document.addEventListener('click', function() {
    var menu = document.getElementById('langMenu');
    if (menu) menu.style.display = 'none';
  });

  // ===== Intersection Observer for scroll animations =====
  (function() {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(function(el) {
      observer.observe(el);
    });
  })();

  // ===== Counter Animation =====
  (function() {
    function animateCounter(el) {
      var target = parseFloat(el.dataset.count);
      if (isNaN(target)) return;
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      var duration = 2000;
      var start = performance.now();
      var isFloat = target % 1 !== 0;

      function update(now) {
        var progress = Math.min((now - start) / duration, 1);
        var ease = 1 - Math.pow(1 - progress, 3);
        var current = target * ease;
        if (isFloat) {
          el.textContent = prefix + current.toFixed(1) + suffix;
        } else {
          el.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
        }
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }

    var counterObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
          entry.target.dataset.animated = '1';
          animateCounter(entry.target);
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-count]').forEach(function(el) {
      counterObserver.observe(el);
    });
  })();

  // ===== Particle Canvas =====
  (function() {
    var canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var PARTICLE_COUNT = (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0 : 60;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, ' + p.opacity + ')';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // ===== Scroll-to-top =====
  (function() {
    var btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.innerHTML = '&uarr;';
    btn.setAttribute('aria-label', i18n.scrollTop);
    document.body.appendChild(btn);
    window.addEventListener('scroll', function() {
      btn.classList.toggle('visible', window.scrollY > 400);
    });
    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  // ===== Code copy buttons =====
  document.querySelectorAll('.code-block').forEach(function(block) {
    var btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = i18n.copy;
    btn.setAttribute('aria-label', i18n.copy);
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('type', 'button');
    var doCopy = function() {
      var code = block.querySelector('code') || block.querySelector('pre');
      if (code) {
        navigator.clipboard.writeText(code.textContent).then(function() {
          btn.textContent = i18n.copied;
          btn.classList.add('copied');
          setTimeout(function() { btn.textContent = i18n.copy; btn.classList.remove('copied'); }, 2000);
        });
      }
    };
    btn.addEventListener('click', doCopy);
    btn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doCopy();
      }
    });
    block.appendChild(btn);
  });
})();
