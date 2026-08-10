#!/usr/bin/env python3
"""
第二波：处理 <nav class="nav"> 类型的文件（styles.css 体系）
"""

import os
import re

def get_new_nav(active_lang="en"):
    lang_map = {
        "en": ("/", "/cn/", "/tw/", "/jp/"),
        "cn": ("/cn/", "/", "/tw/", "/jp/"),
        "tw": ("/tw/", "/", "/cn/", "/jp/"),
        "jp": ("/jp/", "/", "/cn/", "/tw/"),
    }
    paths = lang_map.get(active_lang, lang_map["en"])
    
    return f'''<header class="nav" id="mainNav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <img src="/brand/logo-dark-icon.png" alt="FidesOrigin" width="26" height="26" style="border-radius:6px">
      <span class="nav-logo-text">FidesOrigin</span>
    </a>
    <nav class="nav-links">
      <a href="/about.html">About</a>
      <a href="/architecture.html">Architecture</a>
      <a href="/docs/">Docs</a>
      <a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener noreferrer">GitHub</a>
    </nav>
    <div class="nav-right">
      <div class="lang-switch">
        <a href="{paths[0]}" class="{'active' if active_lang == 'en' else ''}">EN</a>
        <a href="{paths[1]}" class="{'active' if active_lang == 'cn' else ''}">CN</a>
        <a href="{paths[2]}" class="{'active' if active_lang == 'tw' else ''}">TW</a>
        <a href="{paths[3]}" class="{'active' if active_lang == 'jp' else ''}">JP</a>
      </div>
      <a href="/contact.html" class="nav-cta">Contact</a>
    </div>
    <button class="nav-mobile-btn" onclick="document.getElementById('mobileMenu').classList.add('active')" aria-label="Open menu">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </div>
</header>

<!-- Mobile Menu -->
<div class="mobile-menu" id="mobileMenu">
  <button class="mobile-menu-close" onclick="document.getElementById('mobileMenu').classList.remove('active')" aria-label="Close menu">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
  </button>
  <a href="/about.html">About</a>
  <a href="/architecture.html">Architecture</a>
  <a href="/docs/">Docs</a>
  <a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener noreferrer">GitHub</a>
  <div class="lang-switch">
    <a href="{paths[0]}" class="{'active' if active_lang == 'en' else ''}">EN</a>
    <a href="{paths[1]}" class="{'active' if active_lang == 'cn' else ''}">CN</a>
    <a href="{paths[2]}" class="{'active' if active_lang == 'tw' else ''}">TW</a>
    <a href="{paths[3]}" class="{'active' if active_lang == 'jp' else ''}">JP</a>
  </div>
  <a href="/contact.html" class="nav-cta" style="margin-top:8px;text-align:center">Contact</a>
</div>'''

base_dir = '/root/.openclaw/workspace/fidesorigin-demo/public'
updated = 0
skipped = 0

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if not f.endswith('.html'):
            continue
        filepath = os.path.join(root, f)
        rel_path = os.path.relpath(filepath, base_dir)
        
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # 检查是否有 <nav class="nav"> 类型（未被第一波处理的）
        if '<nav class="nav"' not in content:
            skipped += 1
            continue
        
        # 检测语言
        active_lang = "en"
        if '/cn/' in rel_path:
            active_lang = "cn"
        elif '/tw/' in rel_path:
            active_lang = "tw"
        elif '/jp/' in rel_path:
            active_lang = "jp"
        
        new_nav = get_new_nav(active_lang)
        
        # 匹配 <nav class="nav" ... > ... </nav>
        # 但要小心别匹配到内部的 <nav class="nav-links">
        pattern = r'<nav\s+class="nav"[^>]*>.*?</nav>'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            content = content[:match.start()] + new_nav + content[match.end():]
            
            # 添加 nav.css
            if 'styles/nav.css' not in content:
                content = content.replace('</head>', '  <link rel="stylesheet" href="/styles/nav.css"/>\n</head>', 1)
            
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            
            updated += 1
            print(f"Updated: {rel_path}")
        else:
            skipped += 1

print(f"\nDone: {updated} updated, {skipped} skipped")
