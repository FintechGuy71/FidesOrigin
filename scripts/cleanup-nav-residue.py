#!/usr/bin/env python3
"""
清理残留的旧导航样式和 HTML
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
        
        # 1. 删除旧的 nav inline 样式（如果 nav.css 已加载）
        if 'styles/nav.css' in content:
            # 删除 Navigation CSS block
            nav_style_patterns = [
                r'/\*\s*Navigation\s*\*/.*?@media\(min-width:900px\)\{[^}]*\}[^}]*\}',
                r'/\*\s*───\s*Language Switcher\s*───\s*\*/.*?\.lang-switch a\.active\s*\{[^}]*\}',
                r'\.nav\s*\{[^}]*\}[^}]*\}.*?\.nav-mobile-btn\s*\{[^}]*\}',
            ]
            for pattern in nav_style_patterns:
                content = re.sub(pattern, '', content, flags=re.DOTALL)
        
        # 2. 删除 body 开始后的孤立 </div> 和 mailto 链接
        # 匹配 </head> 和 <!-- Navigation --> 之间的垃圾内容
        garbage_pattern = r'(</head>\s*<body[^>]*>)(\s*<a href="mailto:[^"]*"[^>]*>.*?</a>\s*</div>\s*)?(\s*<!--\s*Navigation\s*-->)'
        def clean_garbage(match):
            return match.group(1) + '\n\n' + match.group(3)
        content = re.sub(garbage_pattern, clean_garbage, content, flags=re.DOTALL)
        
        # 3. 删除 style 标签内的孤立 "}"（前面没有规则内容的行）
        # 匹配 style 标签内的 "  }" 或 "   }" 这样的孤立闭合括号
        content = re.sub(r'(\n\s+\}\s*\n)(\s*\}\s*\n)', r'\1', content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            updated += 1
            rel_path = os.path.relpath(filepath, base_dir)
            print(f"Fixed: {rel_path}")

print(f"\nDone: {updated} files fixed")
