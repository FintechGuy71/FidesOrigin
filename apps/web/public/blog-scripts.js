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

    // ===== Scroll-to-top =====
    (function() {
      var btn = document.createElement('button');
      btn.className = 'scroll-top';
      btn.innerHTML = '&uarr;';
      btn.setAttribute('aria-label', 'Scroll to top');
      document.body.appendChild(btn);
      window.addEventListener('scroll', function() {
        btn.classList.toggle('visible', window.scrollY > 400);
      });
      btn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    })();
