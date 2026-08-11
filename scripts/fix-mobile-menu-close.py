#!/usr/bin/env python3
"""
修复 mobile-menu div 缺少闭合标签的问题
"""

import os
import re

base_dir = '/root/.openclaw/workspace/fidesorigin-demo/public'
fixed = 0
already_ok = 0

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if not f.endswith('.html'):
            continue
        filepath = os.path.join(root, f)
        rel_path = os.path.relpath(filepath, base_dir)
        
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # 检查是否有 mobile-menu
        if '<div class="mobile-menu"' not in content:
            continue
        
        # 找到 mobile-menu 开始位置
        mm_start = content.find('<div class="mobile-menu"')
        # 找到 mobile-menu 之后第一个 <section class="hero" 或 <!-- HERO
        hero_match = re.search(r'(<section class="hero"|<!--\s*H)', content[mm_start:])
        
        if not hero_match:
            # 尝试找 body 结束或其他主要部分
            hero_match = re.search(r'(<div class="container"|<!--\s*═)', content[mm_start:])
        
        if not hero_match:
            print(f'SKIP: Cannot find boundary after mobile-menu in {rel_path}')
            continue
        
        hero_start = mm_start + hero_match.start()
        segment = content[mm_start:hero_start]
        
        # 计算 div 平衡
        opens = segment.count('<div')
        closes = segment.count('</div>')
        
        if opens > closes:
            # 需要在 hero 之前添加 </div>
            # 在 hero 标记前插入 </div>
            insert_pos = hero_start
            # 确保前面有换行
            new_content = content[:insert_pos] + '</div>\n\n' + content[insert_pos:]
            
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(new_content)
            
            fixed += 1
            print(f'FIXED: {rel_path} (added </div>, open={opens}, close={closes})')
        else:
            already_ok += 1

print(f'\nDone: {fixed} files fixed, {already_ok} already ok')
