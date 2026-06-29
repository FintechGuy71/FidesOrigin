# FidesOrigin 前端代码第2轮验证审计报告

**审计时间**: 2026-06-17
**审计范围**: website/index.html, admin/index.html, admin/admin.js, admin/admin-config.js
**审计目标**: 验证第1轮发现的问题是否已修复

---

## 一、website/index.html 验证

### 1.1 CSP 包含 unsafe-inline ✅ 已修复
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; ...">
```
- `script-src` 指令中明确包含 `'unsafe-inline'`
- **状态**: ✅ 通过

### 1.2 移动菜单 ARIA 属性 ✅ 已修复
```html
<button ... aria-label="打开菜单" aria-expanded="false" aria-controls="mobileMenu" id="mobileMenuBtn">
<div id="mobileMenu" ... role="dialog" aria-label="移动端导航" aria-modal="true">
```
- 按钮有 `aria-label`, `aria-expanded`, `aria-controls`
- 菜单有 `role="dialog"`, `aria-label`, `aria-modal="true"`
- **状态**: ✅ 通过

### 1.3 scroll 事件节流 ✅ 已修复
```javascript
let scrollTicking = false;
window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        window.requestAnimationFrame(() => {
            // ...
            scrollTicking = false;
        });
        scrollTicking = true;
    }
});
```
- 使用 `requestAnimationFrame` 实现节流
- **状态**: ✅ 通过

### 1.4 theme-color meta ✅ 已修复
```html
<meta name="theme-color" content="#0a0a0f">
```
- **状态**: ✅ 通过

---

## 二、admin/index.html 验证

### 2.1 无多余 `</div>` ❌ 未修复
**问题**: 存在 **Logs Page 重复定义** 导致的结构问题

```html
<!-- 第一个 logs 页面 -->
<div id="logs" class="page-section">
    ...
</div>

</div>  <!-- ❌ 多余的闭合 div -->

<!-- 第二个 logs 页面（重复定义） -->
<div id="logs" class="page-section">
    ...
</div>
```

在 `</main>` 之前，有一个多余的 `</div>`（约第1130行附近），然后紧跟一个重复的 `logs` 页面定义。这会导致：
1. DOM 结构混乱
2. 第二个 `logs` 页面可能无法正确显示
3. 页面 ID 重复 (`id="logs"` 出现两次)

**状态**: ❌ **未修复 - 严重问题**

### 2.2 CSP 包含 unsafe-inline ✅ 已修复
```html
<meta http-equiv="Content-Security-Policy" content="... script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/chart.js@4.4.1 https://cdn.jsdelivr.net/npm/ethers@6.8.0; ...">
```
- **状态**: ✅ 通过

### 2.3 addCustomerModal 存在 ❌ 未修复
**问题**: `admin.js` 中引用了 `addCustomerModal`，但 HTML 中 **不存在** 该模态框元素。

```javascript
// admin.js:395-399
function openAddCustomerModal() {
  document.getElementById('addCustomerModal').classList.add('active');  // ❌ 元素不存在
}
function closeAddCustomerModal() {
  document.getElementById('addCustomerModal').classList.remove('active');  // ❌ 元素不存在
}
```

HTML 中存在的模态框：
- `connectModal` ✅
- `tagModal` ✅
- `signerModal` ✅
- `timelockConfigModal` ✅
- `policyModal` ✅

**缺失**: `addCustomerModal` ❌

**状态**: ❌ **未修复 - 运行时错误**

### 2.4 closeModal 函数存在 ❌ 未修复
**问题**: HTML 中多处调用 `closeModal('xxx')`，但 `admin.js` 中 **未定义** 该函数。

HTML 中的调用点：
- `onclick="closeModal('connectModal')"`
- `onclick="closeModal('tagModal')"`
- `onclick="closeModal('signerModal')"`
- `onclick="closeModal('timelockConfigModal')"`
- `onclick="closeModal('policyModal')"`

`admin.js` 中只有单独的关闭函数：
- `closeAddCustomerModal()`
- `closeTagModal()`
- `closeTimelockConfigModal()`
- `closeAddSignerModal()`

**缺少通用的 `closeModal(modalId)` 函数**。

**状态**: ❌ **未修复 - 运行时错误**

### 2.5 connectMetaMask 别名存在 ❌ 未修复
**问题**: HTML 中调用 `connectMetaMask()`，但 `admin.js` 中 **未定义** 该函数。

```html
<!-- admin/index.html:1603 -->
<button ... onclick="connectMetaMask()">连接 MetaMask</button>
```

`admin.js` 中只有 `connectWallet()`，没有 `connectMetaMask()` 别名。

**状态**: ❌ **未修复 - 运行时错误**

### 2.6 所有被调用函数已定义 ❌ 未修复

以下 HTML 中调用的函数在 `admin.js` 中 **不存在**：

| 函数名 | 调用位置 | 状态 |
|--------|----------|------|
| `closeModal()` | 多个模态框关闭按钮 | ❌ 未定义 |
| `connectMetaMask()` | 连接钱包模态框 | ❌ 未定义 |
| `submitTag()` | tagModal 确认按钮 | ❌ 未定义 |
| `submitAddSigner()` | signerModal 提交按钮 | ❌ 未定义 |
| `submitTimelockConfig()` | timelockConfigModal 提交按钮 | ❌ 未定义 |
| `submitPolicy()` | policyModal 保存按钮 | ❌ 未定义 |
| `updateRequiredSigs()` | 多签配置更新按钮 | ❌ 未定义 |
| `loadPendingOperations()` | 时间锁刷新按钮 | ❌ 未定义 |
| `loadSigners()` | 多签刷新按钮 | ❌ 未定义 |
| `loadQuarantineRecords()` | 隔离资金刷新按钮 | ❌ 未定义 |
| `filterQuarantineRecords()` | 隔离状态下拉框 | ❌ 未定义 |
| `loadIncomingBlocks()` | 收款拦截刷新按钮 | ❌ 未定义 |
| `emergencyPause()` | 紧急暂停按钮 | ❌ 未定义 |
| `emergencyUnpause()` | 解除暂停按钮 | ❌ 未定义 |
| `loadLogs()` | 日志刷新按钮 | ❌ 未定义 |
| `exportLogs()` | 日志导出按钮 | ❌ 未定义 |
| `loadPolicies()` | 策略刷新按钮 | ❌ 未定义 |
| `openPolicyModal()` | 新建策略按钮 | ❌ 未定义 |
| `loadSubgraphComplianceChecks()` | 合规日志刷新按钮 | ❌ 未定义 |
| `filterComplianceLogs()` | 合规日志筛选下拉框 | ❌ 未定义 |
| `saveSettings()` | 设置保存按钮 | ⚠️ 存在但空实现 |

**状态**: ❌ **大量函数未定义 - 严重运行时错误**

### 2.7 元素 ID 与 JS 匹配 ❌ 未修复

`admin.js` 中引用了多个 HTML 中 **不存在** 的元素 ID：

| JS 引用 | 状态 | 备注 |
|---------|------|------|
| `addCustomerModal` | ❌ 不存在 | 模态框缺失 |
| `timelockDelay` | ❌ 不存在 | 时间锁配置输入框缺失 |
| `requiredSigners` | ❌ 不存在 | 多签页面元素 ID 不匹配 |
| `totalSigners` | ❌ 不存在 | 多签页面元素 ID 不匹配 |
| `pendingTxCount` | ❌ 不存在 | 多签页面元素 ID 不匹配 |
| `totalHeld` | ❌ 不存在 | 隔离页面元素 ID 不匹配 |
| `releasedToday` | ❌ 不存在 | 隔离页面元素 ID 不匹配 |
| `heldFundsTable` | ❌ 不存在 | 隔离页面元素 ID 不匹配 |

HTML 中实际存在的 ID 与 JS 期望的不一致：
- HTML: `signerCount`, `requiredSigs`, `userRole`, `pendingCount`, `executedCount`, `cancelledCount`
- JS 期望: `requiredSigners`, `totalSigners`, `pendingTxCount`, `totalHeld`, `releasedToday`

**状态**: ❌ **大量 ID 不匹配 - 运行时错误**

### 2.8 模态框 ARIA 属性 ❌ 未修复

所有模态框都 **缺少 ARIA 属性**：

```html
<!-- 当前实现 -->
<div id="connectModal" class="modal">
<div id="tagModal" class="modal">
<div id="signerModal" class="modal">
<div id="timelockConfigModal" class="modal">
<div id="policyModal" class="modal">
```

**缺少**: 
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` 或 `aria-label`

**状态**: ❌ **未修复 - 可访问性问题**

---

## 三、admin/admin.js 验证

### 3.1 escapeHtml 函数存在 ❌ 未修复
**问题**: 代码中 **不存在** `escapeHtml` 函数。

动态生成的 HTML（如 `loadBlockedTransfers`, `loadCustomers`, `loadTags` 等）直接拼接用户可控数据，存在 **XSS 漏洞风险**。

```javascript
// 示例：直接拼接，无转义
tbody.innerHTML = mockData.map(row => `
  <tr>
    <td>${row.time}</td>
    <td>${row.address}</td>
    ...
  </tr>
`).join('');
```

**状态**: ❌ **未修复 - 安全风险**

### 3.2 showPage 导航高亮修复 ❌ 未修复
```javascript
function showPage(pageId) {
  // ...
  event?.target?.classList?.add('active');  // ❌ 不可靠
  // ...
}
```
- 使用 `event.target` 设置导航高亮不可靠（可能指向 `<span>` 而非 `<a>`）
- 没有根据 `pageId` 查找对应的导航项

**状态**: ❌ **未修复 - 导航高亮可能失效**

### 3.3 无未使用变量 ⚠️ 部分修复
- `updateInterval` 声明但未使用
- `currentPage` 被赋值但未被读取
- **状态**: ⚠️ **仍有未使用变量**

### 3.4 所有 async 函数有 try-catch ❌ 未修复

| 函数 | try-catch | 状态 |
|------|-----------|------|
| `connectWallet()` | ✅ 有 | 通过 |
| `disconnectWallet()` | ❌ 无 | 缺失 |
| `initDashboard()` | ❌ 无 | 缺失 |
| `loadBlockedTransfers()` | ❌ 无 | 缺失 |
| `initMonitor()` | ❌ 无 | 缺失 |
| `loadCustomers()` | ❌ 无 | 缺失 |
| `loadTags()` | ❌ 无 | 缺失 |
| `loadTimelock()` | ❌ 无 | 缺失 |
| `loadMultisig()` | ❌ 无 | 缺失 |
| `loadQuarantine()` | ❌ 无 | 缺失 |

**状态**: ❌ **大量 async 函数缺少错误处理**

---

## 四、admin/admin-config.js 验证

### 4.1 配置完整性 ✅ 已修复
- 版本信息 ✅
- 网络配置 ✅
- API 配置 ✅
- Subgraph 配置 ✅
- 风险等级配置 ✅
- 标签配置 ✅
- 限额配置 ✅
- 时间锁配置 ✅
- 多签配置 ✅
- 缓存配置 ✅
- 告警配置 ✅

**状态**: ✅ 通过

---

## 五、验证汇总

| 检查项 | 状态 | 优先级 |
|--------|------|--------|
| website: CSP 包含 unsafe-inline | ✅ | - |
| website: 移动菜单 ARIA 属性 | ✅ | - |
| website: scroll 事件节流 | ✅ | - |
| website: theme-color meta | ✅ | - |
| admin: 无多余 `</div>` | ❌ | **高** |
| admin: CSP 包含 unsafe-inline | ✅ | - |
| admin: addCustomerModal 存在 | ❌ | **高** |
| admin: closeModal 函数存在 | ❌ | **高** |
| admin: connectMetaMask 别名存在 | ❌ | **高** |
| admin: 所有被调用函数已定义 | ❌ | **高** |
| admin: 元素 ID 与 JS 匹配 | ❌ | **高** |
| admin: 模态框 ARIA 属性 | ❌ | 中 |
| admin.js: escapeHtml 函数存在 | ❌ | **高** |
| admin.js: showPage 导航高亮修复 | ❌ | 中 |
| admin.js: 无未使用变量 | ⚠️ | 低 |
| admin.js: 所有 async 函数有 try-catch | ❌ | 中 |
| admin-config.js: 配置完整性 | ✅ | - |

---

## 六、第2轮修复建议（按优先级排序）

### 🔴 P0 - 立即修复（运行时错误）

1. **修复 HTML 结构问题**
   - 删除重复的 `logs` 页面定义
   - 删除多余的 `</div>`

2. **补充缺失的模态框**
   - 添加 `addCustomerModal` HTML 结构

3. **添加缺失的通用函数**
   ```javascript
   function closeModal(modalId) {
     document.getElementById(modalId).classList.remove('active');
   }
   
   function connectMetaMask() {
     return connectWallet();
   }
   ```

4. **实现所有缺失的函数存根**
   - `submitTag()`, `submitAddSigner()`, `submitTimelockConfig()`, `submitPolicy()`
   - `updateRequiredSigs()`, `loadPendingOperations()`, `loadSigners()`
   - `loadQuarantineRecords()`, `filterQuarantineRecords()`, `loadIncomingBlocks()`
   - `emergencyPause()`, `emergencyUnpause()`
   - `loadLogs()`, `exportLogs()`, `loadPolicies()`, `openPolicyModal()`
   - `loadSubgraphComplianceChecks()`, `filterComplianceLogs()`

5. **统一元素 ID**
   - 统一 HTML 和 JS 中的元素 ID 命名

### 🟡 P1 - 尽快修复（安全/可访问性）

6. **添加 XSS 防护**
   ```javascript
   function escapeHtml(text) {
     const div = document.createElement('div');
     div.textContent = text;
     return div.innerHTML;
   }
   ```

7. **为所有模态框添加 ARIA 属性**
   ```html
   <div id="xxxModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="xxxTitle">
   ```

8. **为所有 async 函数添加 try-catch**

### 🟢 P2 - 建议修复（体验优化）

9. **修复 showPage 导航高亮逻辑**
10. **清理未使用变量**

---

## 七、结论

**第2轮验证结果：大量问题未修复。**

website/index.html 的所有问题已修复，但 admin 端存在严重的结构问题和运行时错误：
- HTML 结构混乱（重复页面定义、多余闭合标签）
- 大量函数未实现（20+ 个函数缺失）
- 元素 ID 不匹配
- XSS 防护缺失
- 模态框可访问性属性缺失

**建议**：优先修复 P0 级别问题，确保页面能正常加载和运行，再逐步处理 P1/P2 级别问题。
