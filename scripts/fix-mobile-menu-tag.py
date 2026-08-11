#!/usr/bin/env python3
"""
修复 mobile-menu 开始标签缺失问题
"""

import os
import re

base_dir = '/root/.openclaw/workspace/fidesorigin-demo/public'
updated = 0

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if not f.endswith('.html'):
            continue
        filepath = os.path.join(root, f)
        
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        original = content
        
        # 检查是否有 mobile menu 内容但没有开始标签
        # 模式：</header> 后面直接跟着 mobile-section 或 Compliance Engine 链接
        pattern = r'(</header>\s*)(\n\s*<a href="/architecture.html#compliance-engine">)'
        
        if re.search(pattern, content):
            # 需要添加 mobile-menu 开始标签和 close 按钮
            replacement = r'''\1

<!-- Mobile Menu -->
<div class="mobile-menu" id="mobileMenu">
  <button class="mobile-menu-close" onclick="document.getElementById('mobileMenu').classList.remove('active')" aria-label="Close menu">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
  </button>
  <div class="mobile-section">
    <div class="mobile-section-title">Products</div>
    \2'''
            content = re.sub(pattern, replacement, content)
        
        # 删除多余的重复 Contact 按钮和 </div>
        # 匹配 </div> 后面跟着重复的 Contact
        dup_pattern = r'(</div>\s*)(\n\s*<a href="/contact\.html" class="nav-cta"[^>]*>Contact</a>\s*</div>)'
        content = re.sub(dup_pattern, r'\1', content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            updated += 1
            rel_path = os.path.relpath(filepath, base_dir)
            print(f"Fixed: {rel_path}")

print(f"\nDone: {updated} files fixed")
