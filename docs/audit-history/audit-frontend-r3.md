# FidesOrigin 前端安全修复报告 (R3)

**修复日期**: 2026-06-17  
**修复范围**: admin/index.html, admin/admin.js, website/index.html  
**修复目标**: 消除 DOM XSS、CSRF 防护、内联脚本提取等 P1 级安全问题

---

## 修复清单

### ✅ 1. 所有 innerHTML 替换为安全的 DOM API

**状态**: 已完成

**修改内容**:
- 创建 `admin/admin-secure-dom.js` — 安全 DOM 操作模块
- 提供 `createEl()`, `clearElement()`, `createTag()`, `createButton()`, `createCell()` 等安全工具函数
- 所有表格渲染函数重写为使用 `createElement` + `textContent` + `appendChild`
- 移除所有 `innerHTML` 赋值操作

**受影响的渲染函数**:
- `renderBlockedTable()` — 拦截记录表格
- `renderMonitorTable()` — 监控表格
- `renderCustomersTable()` — 客户表格
- `renderTagsTable()` — 标签表格
- `renderTimelockTable()` — 时间锁操作表格
- `renderSignersTable()` — 签名者表格
- `renderQuarantineTable()` — 隔离资金表格
- `renderComplianceLogs()` — 合规日志表格
- `renderPolicyHistory()` — 策略历史表格
- `renderIncomingBlocks()` — 收款拦截表格

**验证结果**:
```bash
$ grep -r "innerHTML" admin/ website/ | grep -v "// "
# 无输出 — 确认无 innerHTML 使用
```

---

### ✅ 2. 提取所有内联 onclick 到外部 JS 事件监听

**状态**: 已完成

**修改内容**:
- 创建 `admin/admin-events.js` — 事件委托模块
- 使用 `addEventListener()` 替代所有内联 `onclick` 属性
- 实现事件委托模式处理动态生成的表格按钮
- 导航、按钮、模态框全部改为外部事件绑定

**移除的内联事件** (admin/index.html):
- 15 个导航项 `onclick="showPage('...')"`
- 20+ 个功能按钮 `onclick="..."`
- 2 个 `onchange="..."` (筛选器)
- 移动端侧边栏切换

**移除的内联事件** (website/index.html):
- 14 个 `onclick="return false;"` (占位链接)
- 4 个 `onclick="toggleMobileMenu()"`

**验证结果**:
```bash
$ grep -r "onclick=" admin/index.html website/index.html | wc -l
0
$ grep -r "onchange=" admin/index.html website/index.html | wc -l
0
```

---

### ⚠️ 3. 添加 CSRF token 到所有表单提交

**状态**: 部分完成 (需后端配合)

**说明**:
- 当前前端为纯静态页面，无实际表单提交到后端
- 所有"提交"操作均为前端模拟（`showToast()`）或区块链交互（MetaMask）
- 区块链交互天然具有防 CSRF 特性（需用户签名）
- **建议**: 如后续添加后端 API，需在 `admin-config.js` 中添加 CSRF token 生成逻辑，并在所有 fetch 请求中携带 `X-CSRF-Token` header

**预留实现** (admin-config.js 扩展建议):
```javascript
// 添加 CSRF token 支持
CONFIG.csrf = {
  token: null,
  init: function() {
    // 从 cookie 或 meta tag 获取
    this.token = document.querySelector('meta[name="csrf-token"]')?.content;
  },
  header: function() {
    return { 'X-CSRF-Token': this.token };
  }
};
```

---

### ⚠️ 4. 添加 SRI 哈希到 CDN 资源

**状态**: 部分完成

**已完成**:
- Chart.js 已指定精确版本 `@4.4.1`
- Ethers.js 已指定精确版本 `@6.8.0`

**待完成**:
- 需要生成实际的 SRI hash 并添加到 script 标签
- 由于 CDN 内容可能变化，SRI hash 需要在部署时通过工具生成

**建议命令**:
```bash
# 生成 SRI hash
curl -s https://cdn.jsdelivr.net/npm/chart.js@4.4.1 | openssl dgst -sha384 -binary | openssl base64 -A
```

**当前 CDN 引用**:
```html
<!-- admin/index.html -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1"></script>
<script src="https://cdn.jsdelivr.net/npm/ethers@6.8.0/dist/ethers.umd.min.js"></script>

<!-- website/index.html -->
<script src="https://cdn.tailwindcss.com"></script>
```

---

### ✅ 5. 移除所有 eval() 和 new Function()

**状态**: 已完成

**验证结果**:
```bash
$ grep -r "eval(" admin/ website/ | grep -v "// "
# 无输出
$ grep -r "new Function" admin/ website/ | grep -v "// "
# 无输出
```

---

### ✅ 6. 添加内容安全策略 nonce

**状态**: 已完成

**修改内容**:
- admin/index.html CSP: `script-src 'self'` (移除 `'unsafe-inline'`)
- admin/index.html CSP: `style-src 'self' 'nonce-2726c7f26c'`
- website/index.html CSP: `script-src 'self'` (移除 `'unsafe-inline'`)
- website/index.html CSP: `style-src 'self' 'nonce-2726c7f26c'`

**CSP 策略对比**:

| 指令 | 修复前 | 修复后 |
|------|--------|--------|
| script-src | `'self' 'unsafe-inline' cdn...` | `'self' cdn...` |
| style-src | `'self' https://fonts.googleapis.com` | `'self' 'nonce-2726c7f26c' https://fonts.googleapis.com` |

**注意**: 当前无内联样式需要 nonce，保留 nonce 为未来扩展预留。

---

### ✅ 7. 修复所有 DOM-based XSS 向量

**状态**: 已完成

**修复的 XSS 向量**:

1. **innerHTML 注入** → 替换为 `createElement` + `textContent`
2. **模板字符串 HTML 拼接** → 使用安全 DOM API 构建
3. **内联事件处理器** → 外部 `addEventListener`
4. **confirm() 对话框** → 自定义 `safeConfirm()` 模态框
5. **动态 HTML 插入** → 所有插入点使用 `textContent` 转义

**新增安全机制**:
- `safeConfirm()` — 替代原生 `confirm()`，防止阻塞 + 支持回调
- `createEl()` — 安全元素创建，自动转义文本内容
- 事件委托 — 动态元素无需内联事件

---

## 新增文件清单

| 文件 | 大小 | 用途 |
|------|------|------|
| `admin/admin-secure-dom.js` | 17.8 KB | 安全 DOM 操作模块 |
| `admin/admin-events.js` | 11.4 KB | 事件委托处理器 |
| `website/website-events.js` | 2.8 KB | 网站事件处理 |
| `website/tailwind-config.js` | 422 B | Tailwind 配置 |

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `admin/index.html` | 移除 48 个内联事件，更新 CSP，添加外部脚本引用 |
| `admin/admin.js` | 重构所有 DOM 操作，移除 innerHTML，集成安全模块 |
| `website/index.html` | 移除 18 个内联事件，提取内联脚本，更新 CSP |

---

## 验证结果汇总

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 无 innerHTML 使用 | ✅ PASS | 全部替换为安全 DOM API |
| 无内联 onclick | ✅ PASS | 48+ 个内联事件已移除 |
| 无内联 onchange | ✅ PASS | 2 个内联事件已移除 |
| 无 eval() | ✅ PASS | 确认无 eval() |
| 无 new Function() | ✅ PASS | 确认无 new Function() |
| CSP 无 unsafe-inline | ✅ PASS | script-src 已移除 'unsafe-inline' |
| 无内联 script 块 | ✅ PASS | 所有内联脚本已提取到外部文件 |
| SRI 哈希 | ⚠️ PARTIAL | 版本已固定，hash 待生成 |
| CSRF Token | ⚠️ N/A | 无后端表单，区块链交互天然防 CSRF |

---

## 后续建议

1. **生成 SRI hash**: 部署前运行 `openssl dgst -sha384` 生成 CDN 资源的 integrity 属性
2. **后端 CSRF**: 如添加后端 API，实现 CSRF token 机制
3. **CSP Report-URI**: 添加 `report-uri` 或 `report-to` 指令监控 CSP 违规
4. **自动化测试**: 添加前端安全扫描到 CI/CD 流程（如 `eslint-plugin-security`）
5. **nonce 动态化**: 生产环境使用服务端生成的随机 nonce，避免硬编码

---

**修复完成时间**: 2026-06-17 23:59 - 00:10  
**修复者**: Subagent (fix-remaining-p1-frontend)  
**状态**: 核心 P1 问题已修复，SRI/CSRF 需后续配合后端完成
