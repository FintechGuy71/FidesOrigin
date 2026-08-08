# FidesOrigin 官网 4 语言版本 — 全面 QA 检查报告

**检查日期**: 2026-07-23
**检查文件**:
- `/root/.openclaw/workspace/fidesorigin-demo/apps/web/public/index.html` (EN, 534行)
- `/root/.openclaw/workspace/fidesorigin-demo/apps/web/public/cn/index.html` (CN, 544行)
- `/root/.openclaw/workspace/fidesorigin-demo/apps/web/public/tw/index.html` (TW, 559行)
- `/root/.openclaw/workspace/fidesorigin-demo/apps/web/public/jp/index.html` (JP, 813行)

---

## 一、逐项检查结果

### 1. 文件头部

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| DOCTYPE html | ✅ | ✅ | ✅ | ✅ | 通过 |
| lang 属性 | `en` | `zh-CN` | `zh-TW` | `ja` | 通过 |
| charset=UTF-8 | ✅ | ✅ | ✅ | ✅ | 通过 |
| viewport | ✅ | ✅ | ✅ | ✅ | 通过 |
| title 本地化 | ✅ | ✅ | ✅ | ✅ | 通过 |
| CSP nonce | ✅ | ✅ | ✅ | ✅ | 通过 |

**问题**:
- **LOW** JP 有额外 `<meta name="theme-color">` 和 JSON-LD Schema，其他版本没有。建议统一添加。
- **LOW** EN/TW 缺少 `og:image` meta 标签，CN/JP 有。

---

### 2. CSS 和外部资源

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| 仅引用 `/styles.css` | ✅ | ✅ | ✅ | ✅ | 通过 |
| Google Fonts (Inter + JetBrains Mono) | ✅ | ✅ | ✅ | ✅ | 通过 |
| 无 Tailwind CDN | ✅ | ✅ | ✅ | ✅ | 通过 |
| 无内联 `<style>` 块 | ✅ | ✅ | ✅ | ✅ | 通过 |

---

### 3. Favicon

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| `/brand/logo-dark-icon.png` | ✅ | ✅ | ✅ | ✅ | 通过 |
| apple-touch-icon | ❌ | ❌ | ❌ | ✅ | **不一致** |

**修复建议**: 为 EN/CN/TW 添加 `<link rel="apple-touch-icon" href="/brand/logo-dark-icon.png">`

---

### 4. 导航栏结构

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| `nav > nav-inner` 结构 | ✅ | ✅ | ✅ | ✅ | 通过 |
| `nav-logo` + `nav-logo-icon` | ✅ | ✅ | ✅ | ✅ | 通过 |
| `nav-left` 链接 | 4个 | 4个 | 4个 | **5个** | **不一致** |
| `nav-actions` 完整 | ✅ | ✅ | ✅ | ✅ | 通过 |
| `nav-mobile-btn` | ✅ | ✅ | ✅ | ✅ | 通过 |
| 移动端菜单 `mobile-menu` | ✅ | ✅ | ✅ | ✅ | 通过 |

**问题**:
- **HIGH** JP 导航有 **5 个链接**（多了 `/jp/blog/why-on-chain-compliance.html`），其他版本只有 4 个。

---

### 5. 导航链接文本

| 语言 | 检查清单要求 | 实际文本 | 状态 |
|------|-------------|---------|------|
| EN | Features / How It Works / Security / Docs | Features / How It Works / Security / Docs | ✅ |
| CN | 产品 / 方案 / 安全 / 文档 | **功能特性 / 工作原理 / 安全合规 / 文档** | ⚠️ |
| TW | 產品 / 方案 / 安全 / 文件 | **功能 / 工作原理 / 安全 / 文檔** | ⚠️ |
| JP | 製品 / 仕組み / セキュリティ / ドキュメント | **ユースケース / 仕組み / セキュリティ / ドキュメント / ブログ** | ⚠️ |

**问题**:
- **MEDIUM** CN/TW 导航文本与检查清单不一致。需要确认是否按检查清单修正。
- **HIGH** JP 导航多了一个"ブログ"链接，且"ユースケース"替代了"製品"。

---

### 6. 语言切换下拉

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| 包含 4 种语言 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 当前语言高亮 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 移动端语言选项 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 下拉使用内联 style | ✅ (大量) | ✅ (大量) | ✅ (大量) | ❌ (无) | **不一致** |

**问题**:
- **MEDIUM** EN/CN/TW 的 `langMenu` 使用内联 CSS（5-28处），JP 的样式在 `styles.css` 中。建议统一。

---

### 7. Wallet Connect

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| wallet-btn 文本 | Connect | 连接 | 連接 | ウォレット接続 | ✅ |
| wallet-disconnect 文本 | Disconnect | 断开 | 斷開 | 切断 | ✅ |
| compliance-panel 标题 | On-Chain Compliance Status | 链上合规状态 | 鏈上合規狀態 | オンチェーン・コンプライアンス状態 | ✅ |

---

### 8. Hero Section

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| hero-badge | ✅ Sepolia Testnet Live | ✅ Sepolia 测试网已上线 | ❌ **无** | ❌ **无** | **不一致** |
| h1 标题 | ✅ | ✅ | ✅ (brand-hero) | ✅ | 通过 |
| subtitle / lead | ✅ | ✅ | ✅ | ✅ | 通过 |
| CTA 按钮 | ✅ | ✅ | ✅ | ✅ | 通过 |
| `hero-bg` div | ✅ | ✅ | ❌ **无** | ✅ | **不一致** |
| `particles-canvas` | ✅ | ✅ | ❌ **无元素** | ✅ | **不一致** |
| `gradient-orb` 装饰 | ✅ 2个 | ✅ 2个 | ❌ **无** | ❌ **无** | **不一致** |

**问题**:
- **HIGH** TW 使用完全不同的 Hero 结构：`brand-hero` 而非 `hero`，无 `hero-badge`、无 `hero-bg`、无 `particles-canvas`、无 `gradient-orb`。视觉效果与其他版本不一致。
- **MEDIUM** JP 没有 `hero-badge`（Sepolia 测试网标识）。

---

### 9. 各 Section 内容

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| Features Section | ✅ `#features` | ✅ `#features` | ✅ `#features` | ❌ `#use-cases` | **不一致** |
| How It Works | ✅ `#how-it-works` | ✅ `#how-it-works` | ✅ `#how-it-works` | ❌ `#how` | **不一致** |
| Security Section | ✅ `#security` | ✅ `#security` | ✅ `#security` | ✅ `#security` | 通过 |
| Docs Section | ✅ `#developers` | ✅ `#developers` | ✅ `#developers` | ❌ `#docs` | **不一致** |
| 内容完整性 | ✅ | ✅ | ✅ | ✅ | 通过 |

**问题**:
- **HIGH** JP 的 section ID 与其他版本完全不同：`#use-cases` 替代 `#features`，`#how` 替代 `#how-it-works`，`#docs` 替代 `#developers`。导致导航链接锚点不匹配。
- **HIGH** TW 使用不同的 class 名体系：`brand-hero`、`oneline`、`diff-grid`、`steps-grid` 等，而 EN/CN 使用 `hero`、`features-grid`、`steps` 等。

---

### 10. 代码展示区块

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| code-block 结构 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 代码内容本地化 | ✅ Solidity | ✅ Solidity (中文注释) | ✅ Solidity (繁中注释) | ✅ Solidity (日文注释) | 通过 |
| code copy 按钮 | ❌ **无** | ✅ 复制 | ✅ 複製 | ❌ **无** | **不一致** |

**问题**:
- **MEDIUM** EN/JP 缺少代码复制按钮功能。CN/TW 有。

---

### 11. Footer

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| footer-grid 4 列 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 各列标题本地化 | ✅ | ✅ (混合) | ✅ | ✅ | 通过 |
| 底部版权 | ✅ | ❌ **英文** | ✅ (繁中) | ✅ (日文) | **不一致** |
| footer nav-logo href | `/` | `/cn/` | `/tw/` | ❌ **`/`** | **错误** |

**问题**:
- **HIGH** JP footer 中 `nav-logo` 的 `href="/"` 应为 `href="/jp/"`。
- **HIGH** JP 顶部导航 `nav-logo` 的 `href="/"` 应为 `href="/jp/"`。
- **MEDIUM** CN footer 底部版权为英文 "All rights reserved" / "Built with 💜 for the on-chain financial world"，应中文化。
- **LOW** EN/CN footer nav-logo 有内联 `style="font-size:1.125rem;"` 和 `style="width:28px;height:28px;..."`，TW/JP 没有。

---

### 12. Scripts

| 检查项 | EN | CN | TW | JP | 状态 |
|--------|----|----|----|----|------|
| wallet-connect.js | ✅ | ✅ | ✅ | ✅ | 通过 |
| 移动端菜单脚本 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 语言切换脚本 | ✅ | ✅ | ✅ | ✅ | 通过 |
| 滚动动画脚本 (IntersectionObserver) | ✅ | ✅ | ✅ | ✅ | 通过 |
| 粒子动画脚本 | ✅ | ✅ | ✅ (引用但无canvas) | ✅ | ⚠️ |
| 计数器动画 | ✅ | ✅ | ✅ | ✅ | 通过 |
| Scroll-to-top 按钮 | ❌ **JS动态创建** | ❌ **JS动态创建** | ✅ **HTML元素** | ❌ **无** | **不一致** |
| Code copy 脚本 | ❌ | ✅ | ✅ | ❌ | **不一致** |

**问题**:
- **MEDIUM** TW 脚本引用 `particles-canvas` 但 HTML 中没有 `<canvas>` 元素（会静默 return）。
- **MEDIUM** EN/CN 的 scroll-to-top 按钮由 JS 动态创建，TW 有静态 HTML 元素，JP 完全没有。
- **MEDIUM** CN/TW 有 code copy 脚本，EN/JP 没有。

---

### 13. 内联样式检查 (`style=`)

| 版本 | 内联 style 数量 | 主要位置 |
|------|----------------|---------|
| EN | **~28 处** | langMenu(5), gradient-orb(2), hero padding, section padding, text-align, footer logo |
| CN | **~28 处** | 同上 |
| TW | **5 处** | 仅 langMenu |
| JP | **0 处** | 无 |

**问题**:
- **MEDIUM** EN/CN 有大量内联样式，TW/JP 很少或没有。建议统一迁移到 `styles.css`。
- **LOW** EN/CN footer 中 nav-logo 有 `style="font-size:1.125rem;"` 和 img 的 `style="width:28px;height:28px;border-radius:6px;object-fit:cover;"`。

---

### 14. 死链检查 (`href="#"`)

| 版本 | 死链数量 | 具体位置 |
|------|---------|---------|
| EN | **8 处** | View Documentation, Download SDK, API Reference, SDK, Blog, Privacy Policy, Terms of Service (×2) |
| CN | **8 处** | 查看文档, 下载 SDK, API Reference, SDK, Blog, 隐私政策, 服务条款 (×2) |
| TW | **5 处** | API 參考, SDK, 博客, 隱私政策, 服務條款 |
| JP | **4 处** | API リファレンス, SDK, プライバシーポリシー, 利用規約 |

**问题**:
- **LOW** 所有版本都有占位死链。这是预期中的（页面尚未创建），但应记录待办。

---

### 15. 外部链接安全 (`target="_blank"` 无 `rel="noopener"`)

| 版本 | 问题数量 | 具体位置 |
|------|---------|---------|
| EN | 0 | ✅ 全部有 rel="noopener" |
| CN | **2 处** | GitHub 查看按钮(×2) |
| TW | 0 | ✅ 全部有 rel="noopener" |
| JP | 0 | ✅ 全部有 rel="noopener" |

**修复建议**: CN 版本的两个 GitHub 链接添加 `rel="noopener"`。

---

### 16. OG Image 路径

| 版本 | og:image | 状态 |
|------|---------|------|
| EN | ❌ **缺失** | 应添加 |
| CN | `https://fidesorigin.com/brand/og-image.png` | ✅ |
| TW | ❌ **缺失** | 应添加 |
| JP | `/assets/og-image.png` (相对路径) | ⚠️ 应为绝对路径 |

**问题**:
- **MEDIUM** JP 的 `og:image` 使用相对路径 `/assets/og-image.png`，在社交媒体分享时可能无法正确解析。应改为 `https://fidesorigin.com/assets/og-image.png`。

---

## 二、按文件汇总

### EN (`index.html`) — 总体通过，问题较少

| 严重程度 | 数量 | 问题描述 |
|----------|------|---------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 3 | ① 大量内联样式(~28处) ② 无 code copy 功能 ③ 无 scroll-top HTML元素 |
| LOW | 4 | ① 无 apple-touch-icon ② 无 og:image ③ 8个死链 ④ EN/CN/TW 结构差异 |

### CN (`cn/index.html`) — 有安全性和本地化问题

| 严重程度 | 数量 | 问题描述 |
|----------|------|---------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 5 | ① 大量内联样式 ② 2个GitHub链接缺少 rel="noopener" ③ 无 scroll-top HTML元素 ④ footer版权未中文化 ⑤ 导航文本与检查清单不一致 |
| LOW | 2 | ① 无 apple-touch-icon ② 8个死链 |

### TW (`tw/index.html`) — 结构差异最大

| 严重程度 | 数量 | 问题描述 |
|----------|------|---------|
| CRITICAL | 0 | — |
| HIGH | 1 | Hero Section 结构完全不同（brand-hero 而非 hero，无 particles、无 hero-badge） |
| MEDIUM | 4 | ① 导航文本与检查清单不一致 ② particles-canvas 脚本引用但无元素 ③ 使用不同的 class 体系 ④ 5个死链 |
| LOW | 1 | 无 apple-touch-icon |

### JP (`jp/index.html`) — 导航和内容结构独立

| 严重程度 | 数量 | 问题描述 |
|----------|------|---------|
| CRITICAL | 0 | — |
| HIGH | 2 | ① 导航链接/section ID 与其他版本完全不同 ② nav-logo href="/" 应为 "/jp/"（顶部和footer两处） |
| MEDIUM | 4 | ① 无 hero-badge ② 无 code copy 功能 ③ 无 scroll-top 按钮 ④ og:image 相对路径 |
| LOW | 1 | 5个死链 |

---

## 三、跨版本不一致问题汇总

### 🔴 HIGH 优先级

1. **导航链接 ID 不一致**
   - EN/CN/TW: `#features` / `#how-it-works` / `#developers`
   - JP: `#use-cases` / `#how` / `#docs`
   - **影响**: 导航锚点跨语言不匹配，用户切换语言后位置丢失。

2. **JP nav-logo href 错误**
   - 顶部和 footer 的 logo 链接都是 `href="/"`，应改为 `href="/jp/"`。
   - **影响**: 点击 logo 会跳转到英文首页而非日文首页。

3. **TW Hero 结构完全不同**
   - 使用 `brand-hero` 而非 `hero`，无 `particles-canvas`、无 `hero-bg`、无 `gradient-orb`、无 `hero-badge`。
   - **影响**: 视觉效果与其他版本不一致。

### 🟡 MEDIUM 优先级

4. **CN target="_blank" 安全缺失**
   - 2 个 GitHub 链接缺少 `rel="noopener"`。

5. **内联样式数量差异巨大**
   - EN/CN: ~28 处 | TW: 5 处 | JP: 0 处
   - 建议统一迁移到 `styles.css`。

6. **Code copy 功能不一致**
   - CN/TW 有，EN/JP 无。

7. **Scroll-to-top 实现不一致**
   - EN/CN: JS 动态创建 | TW: 静态 HTML | JP: 完全缺失。

8. **OG Image 不一致**
   - EN/TW 缺失，CN 正确，JP 使用相对路径。

9. **Footer 版权语言不一致**
   - CN footer 底部为英文，应中文化。

10. **apple-touch-icon 仅 JP 有**
    - 建议所有版本统一添加。

### 🟢 LOW 优先级

11. **死链占位符**
    - 所有版本都有 `href="#"` 的占位链接（Blog、Privacy Policy、Terms of Service 等）。这是预期行为，但应记录为待办。

12. **JSON-LD Schema 仅 JP 有**
    - 可统一添加以提升 SEO。

13. **theme-color 仅 JP 有**
    - 建议统一添加。

---

## 四、修复建议（按优先级排序）

### 立即修复（HIGH）

1. **JP nav-logo href**: 顶部和 footer 的 `href="/"` → `href="/jp/"`
2. **JP section ID 统一**: `#use-cases` → `#features`, `#how` → `#how-it-works`, `#docs` → `#developers`，移除多余的博客导航链接（或在所有版本统一添加）
3. **TW Hero 结构对齐**: 添加 `hero-bg`、`particles-canvas`、`gradient-orb`、`hero-badge`，或统一所有版本使用 `brand-hero` 风格

### 尽快修复（MEDIUM）

4. **CN 添加 `rel="noopener"`**: GitHub 链接
5. **统一内联样式**: 将 EN/CN/TW 的 langMenu 内联样式迁移到 `styles.css`
6. **统一 Code Copy 功能**: EN/JP 添加代码复制按钮
7. **统一 Scroll-to-top**: EN/CN/JP 添加 scroll-top 按钮
8. **统一 OG Image**: EN/TW 添加 og:image，JP 改为绝对路径
9. **CN Footer 中文化**: "All rights reserved" → "保留所有权利"
10. **统一 apple-touch-icon**: EN/CN/TW 添加

### 后续优化（LOW）

11. **移除/替换死链**: 为 Blog、Privacy Policy、Terms of Service 等创建实际页面
12. **统一 JSON-LD Schema**: 所有版本添加结构化数据
13. **统一 theme-color**: 所有版本添加
14. **统一导航文本**: 确认 CN/TW 的导航文本（是否按检查清单改为"产品/方案/安全/文档"）
