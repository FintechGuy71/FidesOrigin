#!/usr/bin/env python3
"""
第三波：升级为 mega-menu dropdown 导航栏
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
      <!-- Products Dropdown -->
      <div class="nav-item">
        <button>Products <svg class="chevron" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="nav-dropdown">
          <div class="dropdown-grid">
            <a href="/architecture.html#compliance-engine" class="dropdown-link">
              <div class="dropdown-icon">⚡</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Compliance Engine</span>
                <span class="dropdown-desc">On-chain compliance checks for every transfer</span>
              </div>
            </a>
            <a href="/architecture.html#risk-registry" class="dropdown-link">
              <div class="dropdown-icon">📊</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Risk Registry</span>
                <span class="dropdown-desc">Real-time risk profiles powered by AI Oracles</span>
              </div>
            </a>
            <a href="/architecture.html#policy-engine" class="dropdown-link">
              <div class="dropdown-icon">📜</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Policy Engine</span>
                <span class="dropdown-desc">Customizable rules for issuers and operators</span>
              </div>
            </a>
            <a href="/architecture.html#quarantine" class="dropdown-link">
              <div class="dropdown-icon">🔒</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Quarantine Vault</span>
                <span class="dropdown-desc">Asset freezing with time-locked recovery</span>
              </div>
            </a>
          </div>
        </div>
      </div>
      <!-- Solutions Dropdown -->
      <div class="nav-item">
        <button>Solutions <svg class="chevron" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="nav-dropdown">
          <div class="dropdown-grid single">
            <a href="/use-cases/stablecoin-compliance.html" class="dropdown-link">
              <div class="dropdown-icon">💰</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Stablecoin Compliance</span>
                <span class="dropdown-desc">HKMA / MiCA-ready on-chain compliance</span>
              </div>
            </a>
            <a href="/use-cases/rwa-tokenization.html" class="dropdown-link">
              <div class="dropdown-icon">🏛️</div>
              <div class="dropdown-text">
                <span class="dropdown-title">RWA Tokenization</span>
                <span class="dropdown-desc">Tokenized real-world assets with built-in compliance</span>
              </div>
            </a>
            <a href="/use-cases/smart-wallet.html" class="dropdown-link">
              <div class="dropdown-icon">👛</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Smart Wallet</span>
                <span class="dropdown-desc">Account abstraction with policy enforcement</span>
              </div>
            </a>
          </div>
        </div>
      </div>
      <!-- Developers Dropdown -->
      <div class="nav-item">
        <button>Developers <svg class="chevron" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="nav-dropdown">
          <div class="dropdown-grid single">
            <a href="/docs/" class="dropdown-link">
              <div class="dropdown-icon">📖</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Documentation</span>
                <span class="dropdown-desc">Protocol architecture and integration guides</span>
              </div>
            </a>
            <a href="/docs/api.html" class="dropdown-link">
              <div class="dropdown-icon">🔌</div>
              <div class="dropdown-text">
                <span class="dropdown-title">API Reference</span>
                <span class="dropdown-desc">REST API and GraphQL endpoints</span>
              </div>
            </a>
            <a href="/docs/sdk.html" class="dropdown-link">
              <div class="dropdown-icon">🧰</div>
              <div class="dropdown-text">
                <span class="dropdown-title">SDK</span>
                <span class="dropdown-desc">JavaScript/TypeScript integration toolkit</span>
              </div>
            </a>
            <a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener noreferrer" class="dropdown-link">
              <div class="dropdown-icon">🐙</div>
              <div class="dropdown-text">
                <span class="dropdown-title">GitHub</span>
                <span class="dropdown-desc">Open-source contracts and tooling</span>
              </div>
            </a>
          </div>
        </div>
      </div>
      <!-- Company Dropdown -->
      <div class="nav-item">
        <button>Company <svg class="chevron" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="nav-dropdown">
          <div class="dropdown-grid single">
            <a href="/about.html" class="dropdown-link">
              <div class="dropdown-icon">ℹ️</div>
              <div class="dropdown-text">
                <span class="dropdown-title">About</span>
                <span class="dropdown-desc">Our mission and team</span>
              </div>
            </a>
            <a href="/blog/" class="dropdown-link">
              <div class="dropdown-icon">✍️</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Blog</span>
                <span class="dropdown-desc">Insights on on-chain compliance</span>
              </div>
            </a>
            <a href="/case-studies.html" class="dropdown-link">
              <div class="dropdown-icon">📋</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Case Studies</span>
                <span class="dropdown-desc">Real-world implementations</span>
              </div>
            </a>
            <a href="/contact.html" class="dropdown-link">
              <div class="dropdown-icon">📧</div>
              <div class="dropdown-text">
                <span class="dropdown-title">Contact</span>
                <span class="dropdown-desc">Get in touch with our team</span>
              </div>
            </a>
          </div>
        </div>
      </div>
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
  <div class="mobile-section">
    <div class="mobile-section-title">Products</div>
    <a href="/architecture.html#compliance-engine">Compliance Engine</a>
    <a href="/architecture.html#risk-registry">Risk Registry</a>
    <a href="/architecture.html#policy-engine">Policy Engine</a>
    <a href="/architecture.html#quarantine">Quarantine Vault</a>
  </div>
  <div class="mobile-section">
    <div class="mobile-section-title">Solutions</div>
    <a href="/use-cases/stablecoin-compliance.html">Stablecoin Compliance</a>
    <a href="/use-cases/rwa-tokenization.html">RWA Tokenization</a>
    <a href="/use-cases/smart-wallet.html">Smart Wallet</a>
  </div>
  <div class="mobile-section">
    <div class="mobile-section-title">Developers</div>
    <a href="/docs/">Documentation</a>
    <a href="/docs/api.html">API Reference</a>
    <a href="/docs/sdk.html">SDK</a>
    <a href="https://github.com/FintechGuy71/FidesOrigin" target="_blank" rel="noopener noreferrer">GitHub</a>
  </div>
  <div class="mobile-section">
    <div class="mobile-section-title">Company</div>
    <a href="/about.html">About</a>
    <a href="/blog/">Blog</a>
    <a href="/case-studies.html">Case Studies</a>
    <a href="/contact.html">Contact</a>
  </div>
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
        
        # 检查是否有 header.nav
        if '<header class="nav"' not in content:
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
        
        # 匹配从 <header class="nav"> 到 </header> 的内容
        pattern = r'<header\s+class="nav"[^>]*>.*?</header>'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            content = content[:match.start()] + new_nav + content[match.end():]
            
            # 也替换旧的 mobile menu（如果存在）
            old_mobile_pattern = r'<!--\s*Mobile Menu\s*-->\s*<div\s+class="mobile-menu"[^>]*>.*?</div>'
            content = re.sub(old_mobile_pattern, '', content, flags=re.DOTALL)
            
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            
            updated += 1
            print(f"Updated: {rel_path}")
        else:
            skipped += 1

print(f"\nDone: {updated} updated, {skipped} skipped")
