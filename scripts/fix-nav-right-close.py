#!/usr/bin/env python3
"""
修复 nav-right 缺少闭合 div 的问题
"""

import os
import re

base_dir = '/root/.openclaw/workspace/fidesorigin-demo/public'
fixed = 0

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if not f.endswith('.html'):
            continue
        filepath = os.path.join(root, f)
        rel_path = os.path.relpath(filepath, base_dir)
        
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        original = content
        
        # Pattern: nav-right contains lang-switch and nav-mobile-btn, but nav-right not closed
        # Look for: </div> (closing lang-switch) followed by <button class="nav-mobile-btn">
        # and then </div> (closing nav-inner) without closing nav-right first
        pattern = r'(<div class="lang-switch">.*?</div>)(\s*<button class="nav-mobile-btn".*?)</button>\s*(</div>\s*</header>)'
        
        def fix_nav_right(match):
            lang_switch_close = match.group(1)
            nav_mobile_btn = match.group(2)
            nav_inner_close_and_header = match.group(3)
            return f'{lang_switch_close}\n    </div>{nav_mobile_btn}</button>\n  {nav_inner_close_and_header}'
        
        content = re.sub(pattern, fix_nav_right, content, flags=re.DOTALL)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            fixed += 1
            print(f'FIXED: {rel_path}')

print(f'\nDone: {fixed} files fixed')
