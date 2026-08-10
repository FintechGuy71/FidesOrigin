#!/usr/bin/env python3
"""
批量更新所有 HTML 文件的导航栏
- 移除旧的 inline nav 样式
- 引入新的 nav.css
- 重构 nav HTML 结构（lang-switch 移出 nav-links）
"""

import os
import re
import glob

# 新导航栏 HTML 模板（桌面端 + 移动端菜单）
# 注意：需要保留每个文件原有的 lang-switch active 状态

def get_new_nav(active_lang="en"):
    """生成新的导航栏 HTML"""
    lang_map = {
        "en": ("/", "/cn/", "/tw/", "/jp/"),
        "cn": ("/cn/", "/", "/tw/", "/jp/"),
        "tw": ("/tw/", "/", "/cn/", "/jp/"),
        "jp": ("/jp/", "/", "/cn/", "/tw/"),
    }
    paths = lang_map.get(active_lang, lang_map["en"])
    
    return f'''<!-- Navigation -->
<header class="nav" id="mainNav">
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

# 旧导航栏样式正则（匹配 index.html 中的 inline style 块）
OLD_NAV_STYLE_PATTERN = r'/\* Navigation \*/.*?@media\(min-width:900px\)\{ \.nav-links \{ display:flex; \} \.nav-mobile-btn \{ display:none; \} \}'

# 旧 lang-switch 样式
OLD_LANG_STYLE_PATTERN = r'/\* ─── Language Switcher ─── \*/.*?\.lang-switch a\.active \{ color:var\(--fio-gold\); background:var\(--fio-gold-dim\); \}'

# 旧导航栏 HTML 结构正则（大致匹配）
def replace_nav_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检测语言版本
    active_lang = "en"
    if '/cn/' in filepath or 'public/cn/' in filepath:
        active_lang = "cn"
    elif '/tw/' in filepath or 'public/tw/' in filepath:
        active_lang = "tw"
    elif '/jp/' in filepath or 'public/jp/' in filepath:
        active_lang = "jp"
    
    new_nav = get_new_nav(active_lang)
    
    # 查找并替换旧的 <header class="nav"> ... </header> 块
    # 匹配从 <!-- Navigation --> 到 </header> 的内容
    nav_pattern = r'(<!--\s*Navigation\s*-->\s*)?<header\s+class="nav"[^>]*>.*?</header>'
    
    # 也尝试匹配旧格式（可能没有 Navigation 注释）
    if re.search(nav_pattern, content, re.DOTALL):
        content = re.sub(nav_pattern, new_nav, content, count=1, flags=re.DOTALL)
        return True, content
    
    return False, content

def add_nav_css_link(content):
    """在 </head> 前添加 nav.css 链接"""
    if 'styles/nav.css' in content:
        return content
    
    # 在 </head> 前插入
    content = content.replace(
        '</head>',
        '  <link rel="stylesheet" href="/styles/nav.css"/>\n</head>',
        1
    )
    return content

def remove_old_inline_nav_styles(content):
    """移除旧的 inline nav 样式"""
    # 匹配 Navigation CSS 块
    patterns = [
        r'/\*\s*Navigation\s*\*/.*?\.nav-mobile-btn\s*\{[^}]*\}[^}]*\}[^}]*\}',
        r'/\*\s*───\s*Language Switcher\s*───\s*\*/.*?\.lang-switch a\.active\s*\{[^}]*\}',
    ]
    
    for pattern in patterns:
        content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    return content

# 主程序
def main():
    base_dir = '/root/.openclaw/workspace/fidesorigin-demo/public'
    
    # 找到所有 HTML 文件
    html_files = []
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            if f.endswith('.html'):
                html_files.append(os.path.join(root, f))
    
    updated = 0
    skipped = 0
    
    for filepath in sorted(html_files):
        rel_path = os.path.relpath(filepath, base_dir)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否有旧导航栏
        if '<header class="nav"' not in content:
            skipped += 1
            continue
        
        # 执行替换
        replaced, content = replace_nav_in_file(filepath)
        
        if replaced:
            # 添加 nav.css 链接
            content = add_nav_css_link(content)
            
            # 移除旧的 inline 样式
            content = remove_old_inline_nav_styles(content)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            updated += 1
            print(f"Updated: {rel_path}")
        else:
            skipped += 1
            print(f"Skipped (no match): {rel_path}")
    
    print(f"\nDone: {updated} updated, {skipped} skipped")

if __name__ == '__main__':
    main()
