/* Language Switcher — shared behavior
   toggleLangDropdown 供 onclick 调用；另提供：点击外部关闭 / ESC 关闭 / 记录偏好 */
(function () {
  'use strict';

  window.toggleLangDropdown = function (dropdownId, btnId) {
    var dd = document.getElementById(dropdownId);
    var btn = document.getElementById(btnId);
    if (!dd || !btn) return;
    var isOpen = dd.classList.contains('open');
    closeAll();
    if (!isOpen) {
      dd.classList.add('open');
      btn.classList.add('active');
    }
  };

  function closeAll() {
    document.querySelectorAll('.lang-switch-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    document.querySelectorAll('.lang-switch-btn.active').forEach(function (b) { b.classList.remove('active'); });
  }

  // 点击切换器外部任意处 → 关闭所有下拉
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.lang-switch')) closeAll();
  });

  // ESC 关闭
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  // 用户主动切换语言时记录偏好（不自动跳转，仅备将来使用）
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.lang-switch-dropdown a');
    if (!a) return;
    try { localStorage.setItem('fio-lang', a.getAttribute('href') || ''); } catch (_) {}
  });
})();
