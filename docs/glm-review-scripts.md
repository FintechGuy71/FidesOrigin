# GLM-5.2 独立审计报告 — 部署脚本 + 运维 + CI/CD

> **审计员**: GLM-5.2 (独立审计)
> **审计日期**: 2026-06-29
> **审计范围**: 34 个文件（16 部署脚本 + 6 运维脚本 + 12 CI/CD/运维配置）
> **审计方法**: 逐行精读，关注安全、正确性、一致性

---

## 🚨 审计摘要

| 严重等级 | 数量 | 关键问题 |
|----------|------|----------|
| **Critical** | 11 | 未定义变量导致脚本立即崩溃；硬编码地址 |
| **High** | 9 | 缺失 BYPASS_TIMELOCK 保护；助记词明文存储；CI/CD 配置不一致 |
| **Medium** | 10 | 资源限制缺失；Mock 数据误导；环境变量校验不足 |
| **Low** | 7 | 错误处理不一致；缺安全扫描 |

**总体评价**: 核心升级脚本 (deploy-v2.3.js, deploy-v2.3.1.js, upgrade-v2.3.js) 质量较高，包含完整的安全检查和验证步骤。但大量早期脚本（upgrade-proxy.js, verify-*.js 等）存在**未定义变量引用**的 Critical 级别缺陷，表明这些脚本无法实际运行。CI/CD pipeline 基本合理但存在版本不一致问题。

---

## 🚨 Critical 级别发现

### C-01: `upgrade-proxy.js` — 未定义变量 `proxyAddress` 和 `v2Impl`

**文件**: `apps/contracts/scripts/upgrade-proxy.js`  
**行号**: 3-5

```javascript
const PROXY = proxyAddress;       // ❌ proxyAddress is not defined
const V2_IMPL = v2Impl;           // ❌ v2Impl is not defined
```

**影响**: 脚本加载时立即抛出 `ReferenceError`，完全无法运行。  
**修复**: 应使用 `process.env.PROXY_ADDRESS` 和 `process.env.V2_IMPL_ADDRESS`，并添加环境变量校验。

---

### C-02: `verify-v2.3.js` — 未定义变量 `proxyAddress`

**文件**: `apps/contracts/scripts/verify-v2.3.js`  
**行号**: 2

```javascript
const PROXY = proxyAddress;       // ❌ not defined
```

**影响**: 脚本无法运行。  
**修复**: `const PROXY = process.env.PROXY_ADDRESS;` + 校验。

---

### C-03: `verify-v2.3.1.js` — 未定义变量 `proxyAddress` 和 `testAddr`

**文件**: `apps/contracts/scripts/verify-v2.3.1.js`  
**行号**: 3, 36

```javascript
const PROXY = proxyAddress;       // ❌ not defined
// ...
const testAddr = testAddr;        // ❌ self-reference, not defined
```

**影响**: 脚本无法运行。`testAddr = testAddr` 形成循环引用。  
**修复**: 从 `process.env` 读取。

---

### C-04: `verify-v2.2.js` — 字符串字面量代替环境变量引用

**文件**: `apps/contracts/scripts/verify-v2.2.js`  
**行号**: 6, 16, 17

```javascript
const v2 = new ethers.Contract(proxyAddress || "process.env.PROXY_ADDRESS", ...);
// ❌ "process.env.PROXY_ADDRESS" 是字符串字面量，不是变量引用
await v2.isSanctioned("process.env.TEST_ADDRESS");
// ❌ 同上，会查询地址 "process.env.TEST_ADDRESS" 这个无效字符串
```

**影响**: 即使 `proxyAddress` 奇迹般定义了，后续所有查询都用字符串字面量作为地址参数，Ethers 将抛出无效地址错误。  
**修复**: 移除引号，使用模板变量或 `process.env` 直接引用。

---

### C-05: `deploy-reader.js` — 未定义变量 `proxyAddress` 和 `testAddr`

**文件**: `apps/contracts/scripts/deploy-reader.js`  
**行号**: 3, 18

```javascript
const PROXY = proxyAddress;       // ❌ not defined
// ...
const ofacAddr = testAddr;        // ❌ not defined
```

**影响**: 脚本无法运行。

---

### C-06: `deploy-v2-upgrade.js` — 未定义变量 `proxyAddress` 和 `testAddr`

**文件**: `apps/contracts/scripts/deploy-v2-upgrade.js`  
**行号**: 3, 27

**影响**: 同 C-05，脚本完全不可运行。

---

### C-07: `recovery-v220.js` — 未定义变量 + 原始数据中的硬编码地址

**文件**: `apps/contracts/scripts/recovery-v220.js`  
**行号**: 3, 33

```javascript
const PROXY = proxyAddress;       // ❌ not defined
// ...
const testAddr = testAddr;        // ❌ circular
```

**影响**: 脚本无法运行。

---

### C-08: `upgrade-v2.1-backfill.js` — 未定义变量

**文件**: `apps/contracts/scripts/upgrade-v2.1-backfill.js`  
**行号**: 3

```javascript
const PROXY = proxyAddress;       // ❌ not defined
```

**影响**: 脚本无法运行。

---

### C-09: `upgrade-v2.2.js` — 未定义变量

**文件**: `apps/contracts/scripts/upgrade-v2.2.js`  
**行号**: 3

```javascript
const PROXY = proxyAddress;       // ❌ not defined
```

**影响**: 脚本无法运行。

---

### C-10: `recovery-upgrade.js` — 原始调用数据中硬编码地址

**文件**: `apps/contracts/scripts/recovery-upgrade.js`  
**行号**: 44

```javascript
const data = '0x9948b18d000000000000000000000000e950dc316b836e4eefb8308bf32bf7c72a1358ff';
```

**影响**: 硬编码了测试地址在 raw call data 中。如果此脚本被用于其他地址查询，将产生错误结果。此外，硬编码地址方式不安全，不灵活。  
**修复**: 从 `process.env.TEST_ADDRESS` 读取，动态编码 calldata。

---

### C-11: `.gitignore` — 缺少 `.wallet-*.json` 模式

**文件**: `.gitignore`

**影响**: `generate-wallet.js` 输出文件格式为 `.wallet-{timestamp}.json`，包含明文助记词。如果开发者不小心 `git add .`，助记词将被提交到版本库。  
**修复**: 添加 `.wallet-*.json` 和 `*.wallet.json` 到 `.gitignore`。

---

## ⚠️ High 级别发现

### H-01: 6 个升级脚本缺失 BYPASS_TIMELOCK 保护

**文件**:
- `upgrade-proxy.js` (虽然无法运行，但代码中无 BYPASS_TIMELOCK 检查)
- `deploy-v2-upgrade.js`
- `recovery-v220.js`
- `upgrade-v2.1-backfill.js`
- `upgrade-v2.2.js`
- `recovery-upgrade.js`

**影响**: 这些脚本直接调用 `upgradeToAndCall` 但没有 `BYPASS_TIMELOCK` 安全检查。虽然 `deploy-v2.3.js` 和 `upgrade-v2.3.js` 正确实现了此检查，但旧脚本没有。  
**修复**: 为所有升级脚本添加 BYPASS_TIMELOCK 检查，或标记为 `@deprecated` 并引导用户使用新版本。

---

### H-02: `generate-wallet.js` — 助记词明文写入未加密文件

**文件**: `scripts/generate-wallet.js`  
**行号**: 8-13

```javascript
fs.writeFileSync(outputPath, JSON.stringify({
  address: wallet.address,
  mnemonic: wallet.mnemonic?.phrase,    // ❌ 明文助记词
  createdAt: new Date().toISOString()
}, null, 2));
```

**影响**: 助记词以明文 JSON 写入工作目录。任何有文件系统访问权限的人都能获取。  
**修复**:
1. 不写出助记词到文件
2. 或使用密码加密 (AES-256-GCM)
3. 提示用户手抄助记词后立即删除文件
4. 最低限度：设置文件权限 `0600`

---

### H-03: `deploy-v2.3.js` — TEST_ADDR 冗余 fallback

**文件**: `apps/contracts/scripts/deploy-v2.3.js`  
**行号**: 10

```javascript
const TEST_ADDR = process.env.TEST_ADDRESS || process.env.TEST_ADDRESS;
```

**影响**: `||` 两边是同一个表达式，fallback 无效。如果 `TEST_ADDRESS` 未设置，`TEST_ADDR` 为 `undefined`。  
**修复**: 改为 `process.env.TEST_ADDRESS || '0xe950...'`（明确默认值）或直接在缺少时报错退出。

---

### H-04: `deploy.yml` — 使用非官方 Vercel Action

**文件**: `.github/workflows/deploy.yml`  
**行号**: 26

```yaml
- name: Deploy to Vercel
  uses: vercel/action-deploy@v1
```

**影响**: `vercel/action-deploy@v1` 不是 Vercel 官方维护的 GitHub Action。官方推荐使用 Vercel CLI (`vercel deploy`)。第三方 Action 可能存在供应链风险。  
**修复**: 使用 `vercel/action@v1` (如果确认是官方) 或直接 `npm i -g vercel && vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}`。

---

### H-05: CI/CD 版本不一致

**文件**: `.github/workflows/ci.yml` vs `.github/workflows/deploy.yml`

| 配置项 | ci.yml | deploy.yml |
|--------|--------|------------|
| Node 版本 | 20 | **22** |
| pnpm 版本 | **9** | **11.6.0** |
| pnpm action | v4 | **v3** |

**影响**: CI 环境和部署环境不一致，可能导致 "在我机器上能跑" 问题。pnpm v3 是过时版本。  
**修复**: 统一两个 workflow 的 Node、pnpm 版本。

---

### H-06: `diagnose-contracts.js` — 硬coded合约地址

**文件**: `scripts/diagnose-contracts.js`  
**行号**: 6, 38

```javascript
const tokenAddress = '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A';    // 硬编码
const registryAddress = '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3'; // 硬编码
```

**影响**: 诊断脚本硬编码了 Sepolia 测试网地址，无法用于其他网络或主网。  
**修复**: 从 `process.env` 或 `deployments/latest.json` 读取。

---

### H-07: `deploy.yml` — PR 触发部署

**文件**: `.github/workflows/deploy.yml`  
**行号**: 4-7

```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

**影响**: 每个 PR 都会触发 Vercel 部署（使用 production token），可能导致：
1. 预览部署消耗 production 配额
2. Secret 泄露风险（PR 来自 fork 时可访问 secrets）

**修复**: PR 触发应使用 `pull_request_target` 或限制为内部 PR，或仅在 `push` 到 main 时部署。

---

### H-08: `docker-compose.yml` — 生产配置中挂载源码

**文件**: `backend/docker-compose.yml`  
**行号**: 18-19, 62-63

```yaml
volumes:
  - ./app:/app/app    # 开发模式热重载，不应在生产中使用
```

**影响**: `api` 和 `worker` 服务都挂载了宿主机源码目录。在生产中，容器应使用镜像内的代码，不应挂载宿主机目录（破坏不可变性，可能被篡改）。  
**修复**: 分离 `docker-compose.yml` (生产) 和 `docker-compose.dev.yml` (开发)，或使用 profiles 控制。

---

### H-09: `quarantine-keeper.js` — 批量扫描无并发锁

**文件**: `scripts/quarantine-keeper.js`  
**行号**: ~330

```javascript
setInterval(() => {
    if (walletList.length > 0) {
        this.runBatchScan(walletList, tokenList);  // ❌ 无并发锁
    }
    this.printStats();
    this.state.save();
}, CONFIG.checkInterval);
```

**影响**: 虽然轮询监听器 (`startPollingListener`) 有 `pollLock` 保护，但批量扫描 (`runBatchScan`) 的 `setInterval` 回调没有并发锁。如果一次扫描耗时超过 `checkInterval`，多个扫描会并发执行，可能导致重复隔离交易。  
**修复**: 为批量扫描添加类似的锁机制。

---

## 🔶 Medium 级别发现

### M-01: `docker-compose.yml` — 无资源限制

**文件**: `backend/docker-compose.yml`

**影响**: `api` 和 `worker` 容器没有 `deploy.resources.limits` 配置。在高负载下可能消耗宿主机所有资源（OOM）。  
**修复**: 添加 memory/CPU limits（参考 K8s cronjob 的配置：256Mi-512Mi）。

---

### M-02: `admin-config.js` — 强制要求两个网络地址同时存在

**文件**: `admin/admin-config.js`  
**行号**: 37-44

```javascript
const REQUIRED_ENV = [
  'SEPOLIA_CONTRACT_ADDR',
  'MAINNET_CONTRACT_ADDR',     // ❌ 开发环境不需要主网地址
  'ALCHEMY_API_KEY',
  'SUBGRAPH_ID'
];
```

**影响**: 仅在 Sepolia 测试网开发时也必须提供 MAINNET_CONTRACT_ADDR，否则拒绝启动。过于严格。  
**修复**: 按当前网络配置动态校验，或标记为可选。

---

### M-03: `env.ts` — 所有关键 URL 都是 optional

**文件**: `apps/web/lib/env.ts`

```typescript
NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
NEXT_PUBLIC_RISK_API_URL: z.string().url().optional(),
NEXT_PUBLIC_SUBGRAPH_URL: z.string().url().optional(),
```

**影响**: 前端可以在没有任何 API URL 配置的情况下构建成功，但运行时所有 API 调用都会失败。用户看到的是空白页面或错误。  
**修复**: 在 production 环境中设为 required。

---

### M-04: `admin.js` — 全部使用 Mock 数据

**文件**: `admin/admin.js`

**影响**: Dashboard、监控、客户管理等所有数据都是硬编码的 mock 数据（`mockData`），没有实际连接后端 API。在生产中用户会看到虚假信息。  
**修复**: 实现 API 集成或明确标注为 "Demo Mode"。

---

### M-05: `recovery-upgrade.js` — 不检查 ADMIN_ROLE

**文件**: `apps/contracts/scripts/recovery-upgrade.js`

**影响**: 与 `deploy-v2.3.js` 和 `upgrade-v2-fix.js` 不同，此恢复脚本不验证签名者是否有 ADMIN_ROLE。如果无权限的用户运行，交易将链上 revert 但脚本不提供有意义的错误信息。  
**修复**: 添加 ADMIN_ROLE 检查。

---

### M-06: `configmap.yaml` — KMS 配置为空

**文件**: `k8s/configmap.yaml`

```yaml
KMS_PROVIDER: ""
KMS_KEY_ID: ""
```

**影响**: KMS 配置为空字符串。如果 CronJob 依赖 KMS 解密私钥，空值可能导致运行时错误。  
**修复**: 添加启动时校验或提供明确的 "NOT_CONFIGURED" 标记。

---

### M-07: `quarantine-keeper.js` — 状态文件无加密

**文件**: `scripts/quarantine-keeper.js`

**影响**: `.keeper-state.json` 包含 `knownWallets` 地址列表和统计数据。虽然不包含私钥，但泄露了被监控的钱包地址，可能违反隐私政策。  
**修复**: 设置文件权限 `0600`，或加密敏感字段。

---

### M-08: `deploy-full.js` — 测试数据包含真实地址

**文件**: `scripts/deploy-full.js`  
**行号**: ~85

```javascript
const testAddresses = [
    "0x1234567890123456789012345678901234567890",           // 无效地址
    "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",           // Vitalik's address
    "0xdAC17F958D2ee523a2206206994597C13D831ec7"            // Tether USDT
];
```

**影响**: 部署脚本使用真实知名地址作为测试数据。在生产部署时可能导致混淆。第一个地址实际上是无效的（checksum 错误）。  
**修复**: 使用明确的测试地址如 `0x0000...0001`。

---

### M-09: `deploy.yml` — `--ignore-scripts` 标志

**文件**: `.github/workflows/deploy.yml`  
**行号**: 22

```yaml
run: pnpm install --frozen-lockfile --ignore-scripts
```

**影响**: `--ignore-scripts` 跳过 postinstall 脚本。如果项目依赖 native 模块或需要 build 步骤，这可能导致运行时错误。  
**评估**: 在 CI 中使用 `--ignore-scripts` 是**安全最佳实践**（防止供应链攻击），但应确认无依赖需要 install scripts。

---

### M-10: `forta-agent` — 无告警去重

**文件**: `forta-agents/fidesorigin-monitor/src/agent.ts`

**影响**: Agent 对每笔合规事件都生成 Finding，没有去重机制。在大量交易的区块中可能产生大量重复告警，导致告警疲劳。  
**修复**: 添加时间窗口去重或计数聚合。

---

## 📝 Low 级别发现

### L-01: 错误处理不一致

不同脚本的 `.catch()` 处理方式不一致：
- `deploy-v2.3.js`: `console.error("❌ DEPLOYMENT FAILED:", e.message)` + stack trace
- `deploy-v2.3.1.js`: `console.error(error)` (无自定义消息)
- `upgrade-v2-fix.js`: `console.error('❌ Upgrade failed:', error)`

**修复**: 统一错误处理模式。

---

### L-02: `deploy-v2.3.js` — 使用 console.warn 输出安全警告

```javascript
console.warn("⚠️  BYPASSING TIMELOCK — direct upgradeToAndCall will be used");
```

**建议**: 安全相关的绕过警告应使用 `console.error` 确保被日志系统捕获。

---

### L-03: `CI` — 无安全扫描

**文件**: `.github/workflows/ci.yml`

**影响**: CI pipeline 只有 lint/typecheck/test/build，缺少：
- SAST (静态应用安全测试) 如 Semgrep / CodeQL
- 依赖漏洞扫描 如 `pnpm audit` / Snyk
- 密钥泄露扫描如 Gitleaks

**修复**: 添加安全扫描 step。

---

### L-04: `vercel.json` — 使用 `npm install` 而非 `pnpm`

```json
{
  "installCommand": "npm install --legacy-peer-deps",
}
```

**影响**: Vercel 构建使用 npm 安装而非 pnpm，但项目使用 pnpm workspace。可能导致依赖解析不一致。  
**修复**: `"installCommand": "pnpm install --frozen-lockfile"`。

---

### L-05: `subgraph` mapping — `sanctionedBy` 未在 SanctionAdded 中设置

**文件**: `subgraph/src/mappings/riskRegistry.ts`  
**行号**: handleSanctionAdded

**影响**: `handleSanctionAdded` 创建 `SanctionedAddress` 时设置了 `addedBy`，但没有设置 `reason` 字段的初始值（在 `sanctioned.reason = reason;` 之前先创建）。不过后续有 `sanctioned.reason = reason;` 赋值，所以不是 bug，只是代码结构略混乱。

---

### L-06: `upgrade-v2-fix.js` 和 `upgrade-v2-fix.ts` — 代码重复

**影响**: 同一个升级逻辑同时存在 `.js` 和 `.ts` 版本，内容几乎完全相同。维护负担。  
**修复**: 删除 `.js` 版本，仅保留 `.ts`。

---

### L-07: 多个脚本缺少 `gasLimit` 估算

`deploy-v2.3.js` 的 deploy 调用没有设置 gasLimit：
```javascript
const impl = await Factory.deploy();    // 无 gasLimit
```

而升级调用有些设置了 `gasLimit: 500000`，有些没有。  
**影响**: 在网络拥堵时可能因 gas 不足而失败。  
**修复**: 统一使用 `ethers.provider.estimateGas()` 或至少设置合理默认值。

---

## ✅ 正面发现

### 良好实践

1. **`deploy-v2.3.js` 和 `deploy-v2.3.1.js`**: 实现了完整的 BYPASS_TIMELOCK 保护、pre/post 验证、数据完整性检查、VERSION 校验。
2. **`upgrade-v2.3.js`**: 同样有完整的 BYPASS_TIMELOCK 保护和全面的 post-upgrade 验证。
3. **`upgrade-v2-fix.js`**: 验证 ADMIN_ROLE，原子化升级+初始化，统计保持检查。
4. **`grant-role.js`**: 验证 admin 权限，检查角色是否已授予（幂等）。
5. **`admin-config.js`**: 深度冻结配置对象，校验零地址，环境变量注入。
6. **`env.ts`**: 使用 Zod 进行环境变量验证，移除 NEXT_PUBLIC_API_KEY 防泄露。
7. **`K8s cronjob.yaml`**: 良好的安全实践：`runAsNonRoot`, `readOnlyRootFilesystem`, `drop ALL capabilities`, `seccompProfile: RuntimeDefault`。
8. **`docker-compose.yml`**: 使用 `${VAR:?error}` 语法强制要求环境变量，DB 端口只绑定 `127.0.0.1`。
9. **`.gitignore`**: 包含 `.env`, `deployments/`, `apps/contracts/artifacts/` 等敏感路径。
10. **`forta-agent`**: 完整的异常处理，环境变量校验，使用 Map 替代数组索引。
11. **`quarantine-keeper.js`**: Fail-closed 风险检查，内存增长上限，轮询并发锁。

---

## 📊 文件质量评分

| 文件 | 评分 | 说明 |
|------|------|------|
| deploy-v2.3.js | 🟢 8/10 | 完善的安全检查和验证，TEST_ADDR fallback 有 bug |
| deploy-v2.3.1.js | 🟢 8/10 | 良好的 pre/post 验证 |
| upgrade-v2.3.js | 🟢 8/10 | 同上 |
| upgrade-v2-fix.js | 🟢 8/10 | ADMIN_ROLE 检查，原子升级 |
| upgrade-v2-fix.ts | 🟢 8/10 | 同 .js 版本 |
| grant-role.js | 🟢 7/10 | 幂等检查，权限验证 |
| deploy-full.js | 🟡 6/10 | 完整部署流程但测试数据有问题 |
| recovery-upgrade.js | 🟡 5/10 | 缺 ADMIN_ROLE 检查，硬编码地址 |
| quarantine-keeper.js | 🟡 6/10 | 功能完整但批量扫描缺并发锁 |
| update-merkle-root-v11.js | 🟢 7/10 | 良好的输入验证 |
| diagnose-contracts.js | 🟡 5/10 | 硬编码地址 |
| diagnose-wallet.js | 🟡 6/10 | 基本诊断功能正常 |
| generate-wallet.js | 🔴 3/10 | 助记词明文存储 |
| admin.js | 🟡 5/10 | 安全 DOM API 但全 mock 数据 |
| admin-config.js | 🟢 7/10 | 深度冻结，环境变量校验，但过度严格 |
| env.ts | 🟢 7/10 | Zod 验证良好但全 optional |
| ci.yml | 🟡 6/10 | 基本流程但缺安全扫描 |
| deploy.yml | 🟡 4/10 | 版本不一致，非官方 action，PR 泄露风险 |
| configmap.yaml | 🟢 7/10 | 敏感配置已注释，KMS 集成 |
| cronjob.yaml | 🟢 9/10 | K8s 安全最佳实践 |
| docker-compose.yml | 🟡 5/10 | 密码注入已修复但生产挂载源码 |
| vercel.json | 🟡 5/10 | npm 替代 pnpm |
| .gitignore | 🟡 6/10 | 基本完善但遗漏 .wallet-*.json |
| riskRegistry.ts | 🟢 7/10 | 下溢保护，事件处理正确 |
| forta agent.ts | 🟢 8/10 | 异常处理，环境变量校验 |
| upgrade-proxy.js | 🔴 1/10 | 完全无法运行（未定义变量） |
| verify-v2.3.js | 🔴 1/10 | 完全无法运行 |
| verify-v2.3.1.js | 🔴 1/10 | 完全无法运行 |
| verify-v2.2.js | 🔴 1/10 | 字符串字面量代替变量 |
| deploy-reader.js | 🔴 1/10 | 完全无法运行 |
| deploy-v2-upgrade.js | 🔴 1/10 | 完全无法运行 |
| recovery-v220.js | 🔴 1/10 | 完全无法运行 |
| upgrade-v2.1-backfill.js | 🔴 1/10 | 完全无法运行 |
| upgrade-v2.2.js | 🔴 1/10 | 完全无法运行 |

---

## 🏗️ 架构建议

### 1. 废弃旧脚本

当前 `apps/contracts/scripts/` 目录下有 **16 个脚本**，但只有 3-4 个（v2.3 系列）是可用的。建议：

1. **标记不可用脚本为 `@deprecated`** 或移动到 `scripts/archive/` 目录
2. **统一使用 v2.3+ 系列脚本**
3. **合并重复逻辑** — deploy 和 upgrade 的 90% 代码相同，可以抽取为共享库

### 2. 脚本安全增强

```javascript
// 推荐的通用安全框架
const SAFETY_CHECKS = {
  requireEnv: (key) => {
    if (!process.env[key]) {
      console.error(`❌ ${key} env var required`);
      process.exit(1);
    }
    return process.env[key];
  },
  
  requireBypassTimelock: () => {
    if (process.env.BYPASS_TIMELOCK !== 'true') {
      console.error('❌ SECURITY HALT: Set BYPASS_TIMELOCK=true to proceed');
      process.exit(1);
    }
    console.warn('⚠️ BYPASSING TIMELOCK');
  },
  
  requireAdminRole: async (proxy, signer) => {
    const ADMIN_ROLE = await proxy.ADMIN_ROLE();
    const hasRole = await proxy.hasRole(ADMIN_ROLE, signer.address);
    if (!hasRole) throw new Error('Signer lacks ADMIN_ROLE');
  },
};
```

### 3. CI/CD 统一化

```yaml
# 建议的 CI/CD 版本矩阵
constants:
  NODE_VERSION: &node-version '20'
  PNPM_VERSION: &pnpm-version '9'
  PNPM_ACTION: &pnpm-action 'v4'
```

### 4. 生产 Docker Compose 分离

```yaml
# docker-compose.prod.yml — 不挂载源码，使用构建镜像
services:
  api:
    image: fidesorigin/api:${TAG:-latest}
    # 无 volumes 挂载
```

---

## 🔧 修复优先级排序

| 优先级 | 编号 | 修复内容 | 预估工时 |
|--------|------|----------|----------|
| P0 | C-01~C-09 | 修复/归档 9 个不可运行脚本 | 2h |
| P0 | C-11 | .gitignore 添加 .wallet-*.json | 5min |
| P1 | H-02 | generate-wallet.js 助记词安全 | 1h |
| P1 | H-05 | CI/CD 版本统一 | 30min |
| P1 | H-07 | deploy.yml PR 安全 | 30min |
| P1 | H-08 | docker-compose 生产分离 | 1h |
| P2 | H-01 | 旧脚本添加 BYPASS_TIMELOCK 或归档 | 1h |
| P2 | H-04 | 替换非官方 Vercel Action | 30min |
| P2 | H-09 | quarantine-keeper 批量扫描并发锁 | 1h |
| P3 | M-01~M-10 | 中等优先级修复 | 各 30min |
| P4 | L-01~L-07 | 低优先级改进 | 各 15min |

**总预估工时**: ~16 小时

---

## 📋 结论

FidesOrigin 的核心部署脚本（v2.3 系列）质量较高，具备完整的安全检查、数据完整性验证和详细的日志输出。K8s CronJob 配置遵循安全最佳实践。

但项目存在显著的**技术债务**：
1. **9 个不可运行的旧脚本**仍留在代码库中
2. **CI/CD 配置不一致**（Node 版本、pnpm 版本、Action 版本）
3. **生产 Docker 配置**混用了开发模式（源码挂载）
4. **助记词明文存储**是严重安全风险
5. **Admin 面板**完全使用 mock 数据

建议按优先级修复，优先处理 P0 和 P1 级别问题。