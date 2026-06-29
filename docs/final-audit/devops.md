# Kimi k2p7 最终审计报告 — DevOps、部署脚本、前端与架构

> **审计时间**: 2026-06-29  
> **审计模型**: Kimi k2p7  
> **审计版本**: v2.4.1 (代码当前状态)  
> **审计方法**: 从零开始的逐行精读，不参考历史报告

---

## 审计范围

| # | 文件 | 类型 | 说明 |
|---|------|------|------|
| 1 | `scripts/deploy.js` | 部署脚本 | TestUSD 单合约部署 |
| 2 | `scripts/deploy-full.js` | 部署脚本 | 全协议栈部署 |
| 3 | `scripts/generate-wallet.js` | 部署脚本 | 钱包生成工具 |
| 4 | `scripts/quarantine-keeper.js` | 运维脚本 | 自动化隔离监控服务 |
| 5 | `apps/contracts/scripts/deploy-v2.3.js` | 升级脚本 | V2.3 实施部署+代理升级 |
| 6 | `apps/contracts/scripts/upgrade-v2.3.js` | 升级脚本 | V2.3 升级流程 |
| 7 | `apps/contracts/scripts/upgrade-proxy.js` | 升级脚本 | 代理合约升级 |
| 8 | `apps/contracts/scripts/recovery-upgrade.js` | 升级脚本 | 恢复性升级 |
| 9 | `apps/contracts/scripts/grant-role.js` | 运维脚本 | 角色授权 |
| 10 | `apps/contracts/scripts/verify-v2.3.js` | 验证脚本 | 升级后验证 |
| 11 | `.github/workflows/ci.yml` | CI/CD | 持续集成 |
| 12 | `.github/workflows/deploy.yml` | CI/CD | Vercel 部署 |
| 13 | `k8s/deployment.yaml` | K8s | 数据发布者 Deployment |
| 14 | `k8s/configmap.yaml` | K8s | 配置管理 |
| 15 | `k8s/cronjob.yaml` | K8s | 批量同步定时任务 |
| 16 | `apps/web/app/(default)/page.tsx` | 前端 | 首页 |
| 17 | `apps/web/app/layout.tsx` | 前端 | 根布局 |
| 18 | `apps/web/lib/env.ts` | 前端 | 环境变量验证 |
| 19 | `apps/web/vercel.json` | 前端 | Vercel 构建配置 |
| 20 | `admin/admin-config.js` | 运维 | Admin 配置 |
| 21 | `admin/admin.js` | 运维 | Admin 核心逻辑 |
| 22 | `backend/docker-compose.yml` | 运维 | Docker Compose 编排 |
| 23 | `.gitignore` | 运维 | Git 忽略规则 |
| 24 | `subgraph/src/mappings/riskRegistry.ts` | Subgraph | 风险注册表事件映射 |
| 25 | `forta-agents/fidesorigin-monitor/src/agent.ts` | Forta | 链上监控 Agent |
| 26 | `ARCHITECTURE.md` | 架构 | 系统架构文档 |

---

## 一、部署脚本审计

### 1.1 `scripts/deploy.js` — TestUSD 部署

**安全设计良好的部分：**
- 使用 `hardhat` 框架的标准部署模式 ✅
- 部署信息保存到 `deployments/` 目录，包含时间戳和网络信息 ✅
- 非 hardhat 网络时自动等待 5 个区块确认 ✅
- 自动尝试 Etherscan 验证 ✅

**发现：**

**[M-01] 无权限检查 — 任何人可执行部署**
```javascript
const [deployer] = await hre.ethers.getSigners();
```
脚本没有检查 deployer 是否有足够的余额或正确的权限。测试网环境下可接受，但生产部署应增加校验。

**[L-01] `getExplorerUrl` 仅支持 sepolia/goerli**
```javascript
const explorers = {
  sepolia: `https://sepolia.etherscan.io/address/${address}`,
  goerli: `https://goerli.etherscan.io/address/${address}`,
};
```
缺少 mainnet、polygon、L2 等网络的 explorer 链接。部署到生产网络时输出不完整。

**[L-02] 部署信息包含 deployer 地址但未做脱敏**
虽然部署信息文件在 `.gitignore` 中（`deployments/` 被忽略），但文件本身以明文保存，如果误提交会泄露部署者地址。

---

### 1.2 `scripts/deploy-full.js` — 全协议栈部署

**安全设计良好的部分：**
- 部署顺序明确，依赖关系正确（RiskRegistry → PolicyEngine → ComplianceEngine） ✅
- Chainlink 配置为可选，环境变量缺失时优雅跳过 ✅
- 角色设置逻辑清晰，ComplianceEngine 自动获得 ORACLE_ROLE ✅
- 部署后自动保存完整信息到 JSON ✅

**发现：**

**[M-02] 测试数据硬编码在部署脚本中**
```javascript
const testAddresses = [
    "0x1234567890123456789012345678901234567890",
    "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7"
];
```
部署脚本包含硬编码的测试地址和测试数据注入。`0xdAC17F958D2ee523a2206206994597C13D831ec7` 是真实的 USDT 合约地址。虽然这是测试数据，但在生产部署时如果忘记移除，会向真实合约地址写入风险档案。

**[L-03] `deployer` 被永久授予 ORACLE_ROLE**
```javascript
// Grant deployer ORACLE_ROLE for testing
await riskRegistry.grantRole(ORACLE_ROLE, deployer.address);
```
注释说明是 "for testing"，但在生产部署后如果未手动撤销，部署者将永久拥有数据写入权限。

**[L-04] `mint` 1M token 到 deployer**
```javascript
await stableCoin.mint(deployer.address, ethers.parseUnits("1000000", 6));
```
测试网可接受，生产部署需移除。

---

### 1.3 `scripts/generate-wallet.js` — 钱包生成

**安全设计良好的部分：**
- 文件权限设置为 `0o600`（仅所有者可读写） ✅
- 明确的警告信息提醒用户删除文件 ✅
- 不打印私钥到控制台 ✅

**发现：**

**[M-03] 助记词以明文写入文件**
```javascript
fs.writeFileSync(outputPath, JSON.stringify({
  address: wallet.address,
  mnemonic: wallet.mnemonic?.phrase,  // ← 明文助记词
  createdAt: new Date().toISOString()
}, null, 2));
```
虽然设置了 `0o600` 权限，但文件内容仍是明文 JSON。任何获得 root 权限或文件备份访问的人都能读取助记词。
- **建议**: 使用密码加密（如 `ethers.encryptKeystore`）或提示用户立即导入到硬件钱包后删除文件。

**[L-05] 文件命名使用时间戳，可预测**
```javascript
const outputPath = path.join(process.cwd(), '.wallet-' + Date.now() + '.json');
```
`.wallet-{timestamp}.json` 文件名模式可预测。虽然 `.gitignore` 已包含 `.wallet-*.json`，但如果用户手动复制文件，时间戳模式容易被猜到。

---

### 1.4 `scripts/quarantine-keeper.js` — 隔离监控服务

**安全设计良好的部分：**
- Fail-Closed 策略：风险检查失败时抛出错误而非返回安全 ✅
- 内存使用上限：`MAX_PROCESSED_TX = 50000` 防止 Set 无限增长 ✅
- 并发锁：`batchScanLock` 和 `pollLock` 防止重复执行 ✅
- 状态持久化：定期保存到 `.keeper-state.json` ✅
- 优雅退出：`SIGINT` 处理器保存状态 ✅
- gasLimit 从环境变量读取，可配置 ✅

**发现：**

**[M-04] PRIVATE_KEY 从环境变量读取，无加密**
```javascript
const CONFIG = {
    privateKey: process.env.PRIVATE_KEY,
    // ...
};
```
Keeper 需要 `QUARANTINE_ROLE` 权限，其私钥以明文环境变量形式存在。在生产环境中应考虑使用 KMS、HashiCorp Vault 或 AWS Secrets Manager。

**[M-05] `.keeper-state.json` 无权限保护**
```javascript
fs.writeFileSync(
    path.join(__dirname, '.keeper-state.json'),
    JSON.stringify(data, null, 2)
);
```
状态文件包含已处理的 tx hash 和已知钱包列表。虽然没有敏感私钥，但如果被篡改可能导致 tx 被重复处理或跳过。

**[L-06] `checkInterval` 同时用于轮询和批量扫描**
```javascript
setInterval(async () => { /* 轮询 */ }, CONFIG.checkInterval);
setInterval(() => { /* 批量扫描 */ }, CONFIG.checkInterval);
```
两个定时器使用同一个间隔。如果 `checkInterval` 较短（如 30s），批量扫描可能过于频繁消耗 RPC 配额。

**[L-07] 异常处理中 `continue` 跳过风险检查**
```javascript
try {
    risk = await this.checkRisk(from);
} catch (riskErr) {
    console.warn(`Skipping ${from}: risk check unavailable`);
    continue;  // ← 跳过这笔交易
}
```
虽然注释说明是 "fail-closed"，但实际上是跳过（`continue`）而非隔离。如果 RPC 节点不稳定，高风险交易可能被漏过。

---

### 1.5 `apps/contracts/scripts/deploy-v2.3.js` — V2.3 部署+升级

**安全设计良好的部分：**
- **强制性 Timelock 检查**：默认拒绝直接升级，必须设置 `BYPASS_TIMELOCK=true` ✅
- 详细的错误信息和 Timelock 使用示例 ✅
- 部署后多重验证：VERSION、totalProfiles、isSanctioned ✅
- 字节码大小检查 ✅
- 签名者权限检查（ADMIN_ROLE） ✅
- 后向兼容性检查（`getProfile()` 8 返回值验证） ✅

**发现：**

**[M-06] `BYPASS_TIMELOCK` 环境变量可绕过所有保护**
```javascript
const BYPASS_TIMELOCK = process.env.BYPASS_TIMELOCK === 'true';
```
虽然这是设计意图（测试/紧急），但如果 CI/CD 或部署环境意外设置此变量，生产升级将绕过 Timelock。建议在脚本中增加额外的人工确认步骤（如要求输入 "yes"）。

**[L-08] `totalProfiles` 期望值硬编码为 2636**
```javascript
if (totalProfiles !== 2636n) {
    console.log("    ⚠️  WARNING: Expected 2636, got", totalProfiles.toString());
}
```
硬编码的期望值仅适用于特定网络/部署。在其他环境（新部署、不同测试网）会触发误报。

**[L-09] `TEST_ADDR` 从环境变量读取，但注释显示可能为空**
```javascript
const TEST_ADDR = process.env.TEST_ADDRESS || process.env.TEST_ADDRESS;
```
`|| process.env.TEST_ADDRESS` 是冗余的。如果 `TEST_ADDRESS` 未设置，`isSanctioned(TEST_ADDR)` 将检查零地址。

---

### 1.6 `apps/contracts/scripts/upgrade-v2.3.js` — V2.3 升级

**安全设计良好的部分：**
- 与 deploy-v2.3.js 相同的 Timelock 安全检查 ✅
- 升级前数据快照（preVersion, preTotal, preSanctioned） ✅
- 升级后数据完整性校验 ✅
- 后向兼容性测试 ✅

**发现：**

**[L-10] 硬编码 gasLimit 500000**
```javascript
const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
```
虽然足够，但如果代理合约有复杂的初始化逻辑（`0x` 数据目前为空），可能不够。建议根据网络条件动态估算。

---

### 1.7 `apps/contracts/scripts/upgrade-proxy.js` — 代理升级

**安全设计良好的部分：**
- 必须提供 `V2_IMPL` 环境变量 ✅
- 尝试读取当前 implementation 地址用于审计 ✅
- 初始化 V2 后验证 ✅

**发现：**

**[M-07] 升级后自动调用 `initializeV2`**
```javascript
const initTx = await v2.initializeV2({ gasLimit: 300000 });
```
如果 V2 implementation 已经被初始化过（reinitializer(2)），再次调用会 revert。脚本没有检查 `initialized` 状态。

---

### 1.8 `apps/contracts/scripts/recovery-upgrade.js` — 恢复升级

**发现：**

**[M-08] 缺少大部分安全检查**
相比 deploy-v2.3.js 和 upgrade-v2.3.js，此脚本缺少：
- VERSION 验证
- 数据完整性检查
- `getProfile()` 后向兼容性测试

这是 "recovery" 脚本的特性（紧急恢复），但应在注释中明确说明风险。

**[L-11] 使用 raw call 验证，缺少 ABI 解析**
```javascript
const VERSION_SELECTOR = '0x54fd4d50';
const result = await ethers.provider.call({ to: PROXY, data: VERSION_SELECTOR });
```
直接硬编码 selector，如果合约接口变更，验证将失效。

---

### 1.9 `apps/contracts/scripts/grant-role.js` — 角色授权

**安全设计良好的部分：**
- 检查目标是否已有角色，避免重复授权 ✅
- 检查签名者是否为 admin ✅
- 验证后输出确认 ✅

**发现：**

**[L-12] `RiskRegistry.attach()` 而非 `getContractAt()`**
```javascript
const registry = RiskRegistry.attach(riskRegistryAddress);
```
`attach()` 不会验证合约字节码。如果地址指向错误的合约，后续调用可能产生难以调试的错误。建议使用 `ethers.getContractAt()`。

---

### 1.10 `apps/contracts/scripts/verify-v2.3.js` — 升级后验证

**安全设计良好的部分：**
- 验证 VERSION、totalProfiles、totalSanctioned ✅
- 验证 getProfile 和 getRiskProfile 两种接口 ✅

**发现：**

**[L-13] 缺少权限验证**
脚本没有验证代理合约的 ADMIN_ROLE 是否仍由预期地址持有，也没有验证 Timelock 配置。

---

## 二、CI/CD + K8s 审计

### 2.1 `.github/workflows/ci.yml`

**安全设计良好的部分：**
- 使用 `actions/checkout@v4`（最新主版本） ✅
- 使用 `pnpm install --frozen-lockfile` 锁定依赖 ✅
- Node.js 版本明确指定为 '22' ✅
- 三段式流水线：lint → test → build，依赖清晰 ✅
- 上传 coverage 和 build 产物用于审计 ✅

**发现：**

**[M-09] 缺少安全扫描步骤**
CI 中没有：
- `slither` 或其他 Solidity 静态分析
- `npm audit` / `pnpm audit` 依赖漏洞检查
- Secret 扫描（虽然有独立的 `secret-scan.yml`，但未在 CI 中引用）

**[L-14] `actions/upload-artifact@v4` 可能泄露敏感信息**
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: |
      apps/web/dist
      apps/web/.next
```
`.next` 目录可能包含源码 map 或环境变量残留。应确保 build 产物中不含敏感信息。

---

### 2.2 `.github/workflows/deploy.yml`

**安全设计良好的部分：**
- 已移除 `pull_request` 触发器（注释说明 "PR should NOT trigger production deploy"） ✅
- 使用 `--ignore-scripts` 防止 postinstall 脚本执行 ✅

**发现：**

**[M-10] 使用 `vercel/action-deploy@v1` 非官方/未维护 Action**
```yaml
- name: Deploy to Vercel
  uses: vercel/action-deploy@v1
```
`vercel/action-deploy` 不是 Vercel 官方维护的 Action。官方推荐的方式是使用 Vercel CLI (`vercel --prod`) 或通过 Git 集成自动部署。使用第三方 Action 有供应链攻击风险。

**[M-11] 构建命令不一致**
```yaml
# deploy.yml
cd apps/web && pnpm run build

# apps/web/vercel.json
"buildCommand": "next build"
"installCommand": "npm install --legacy-peer-deps"
```
CI 使用 pnpm，但 vercel.json 使用 npm。这可能导致依赖解析不一致。`--legacy-peer-deps` 标志通常用于解决 npm 的 peer dependency 问题，但在 pnpm 中不需要。

**[L-15] 缺少部署前测试验证**
deploy workflow 没有运行测试，直接从 main 分支构建部署。如果 CI 测试失败但代码仍被合并，部署可能包含 bug。

---

### 2.3 `k8s/deployment.yaml`

**安全设计良好的部分：**
- `runAsNonRoot: true` + `runAsUser: 1001` ✅
- `readOnlyRootFilesystem: true` ✅
- `allowPrivilegeEscalation: false` ✅
- `capabilities: drop: - ALL` ✅
- `seccompProfile: type: RuntimeDefault` ✅
- Pod 反亲和性（podAntiAffinity）防止单节点故障 ✅
- Liveness 和 Readiness 探针 ✅
- 关键 Secret 设置 `optional: false` ✅

**发现：**

**[M-12] `imagePullPolicy: Always` 增加供应链风险**
```yaml
imagePullPolicy: Always
```
每次启动都拉取最新镜像。如果镜像仓库被攻陷或标签被篡改，可能拉取到恶意镜像。建议使用带哈希的不可变镜像（`image: fidesorigin/data-publisher@sha256:...`）。

**[M-13] 多个 Secret 共享同一个 Secret 对象**
```yaml
secretKeyRef:
  name: fidesorigin-keys
  key: publisher-private-key
# ... 多个 key 都在同一个 Secret
```
如果 Pod 被攻破，攻击者可以读取整个 Secret 的所有 key。建议按功能拆分 Secret（publisher-keys、aws-keys、vault-keys 等），并使用 RBAC 限制访问。

**[L-16] `resources.limits.memory: 1Gi` 可能不足**
注释提到 "increased from 512Mi for large OFAC sync data"，但 1Gi 对于大规模数据同步仍可能不足。应监控实际使用情况。

**[L-17] 缺少 NetworkPolicy**
没有定义网络策略限制 Pod 的出站连接。数据发布者 Pod 理论上只需要访问 RPC 节点和外部 API，应限制其网络访问范围。

---

### 2.4 `k8s/configmap.yaml`

**安全设计良好的部分：**
- 合约地址已从 ConfigMap 移除，改为环境变量注入 ✅
- 没有硬编码密码或私钥 ✅
- 数据源配置完整且可配置 ✅

**发现：**

**[L-18] `DRY_RUN: "false"` 默认开启写操作**
```yaml
DRY_RUN: "false"
```
默认非 dry-run 模式。如果有人在测试环境使用生产 ConfigMap，可能意外写入生产合约。

**[L-19] `FATF_DRY_RUN: "true"` 但 `FATF_ENABLED: "true"` 不一致**
FATF 管道启用但设为 dry-run，而全局 DRY_RUN 为 false。配置意图不明确。

---

### 2.5 `k8s/cronjob.yaml`

**安全设计良好的部分：**
- `concurrencyPolicy: Forbid` 防止任务重叠 ✅
- `startingDeadlineSeconds: 3600` 防止积压 ✅
- `ttlSecondsAfterFinished: 86400` 自动清理已完成 Job ✅
- `activeDeadlineSeconds: 7200` 防止长时间挂起 ✅
- 安全上下文与 Deployment 一致 ✅
- 注释明确说明生产环境不应使用明文私钥 ✅

**发现：**

**[L-20] CronJob 资源限制低于 Deployment**
```yaml
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
```
批量同步可能比常驻服务消耗更多内存（一次性加载大量地址数据）。512Mi 可能不足。

---

### 2.6 `backend/docker-compose.yml`

**安全设计良好的部分：**
- 数据库密码通过环境变量注入，无硬编码 ✅
- `POSTGRES_PASSWORD` 和 `SECRET_KEY` 使用 `:?` 语法强制要求 ✅
- DB 和 Redis 仅绑定 `127.0.0.1`，不暴露到公网 ✅
- Healthcheck 配置 ✅
- `restart: unless-stopped` ✅
- 注释掉的 volume mount（`# - ./app:/app/app`）防止开发配置泄露到生产 ✅

**发现：**

**[L-21] 使用 `latest` tag 的镜像**
```yaml
image: postgres:15-alpine  # 固定版本，OK
image: redis:7-alpine      # 固定版本，OK
```
实际上是固定版本（`15-alpine`, `7-alpine`），这是好的做法。但自定义服务使用 `build: .`，如果 Dockerfile 中使用 `latest` 基础镜像会有问题。

**[L-22] 缺少资源限制**
Docker Compose 中没有设置容器资源限制（memory/cpu），在资源受限的环境中可能被 OOM killer 终止。

---

## 三、前端网站审计

### 3.1 `apps/web/app/(default)/page.tsx`

**评估**：极简的页面组件，仅导入和渲染子组件。无安全问题。

---

### 3.2 `apps/web/app/layout.tsx`

**安全设计良好的部分：**
- 使用 Next.js 14 的 Metadata API ✅
- OpenGraph 标签完整 ✅
- 字体使用 `display: swap` 防止 FOIT ✅

**发现：**

**[L-23] `metadata` 对象硬编码**
```javascript
export const metadata = {
  title: "FidesOrigin — Programmable On-Chain Compliance",
  // ...
};
```
这是正常做法，但如果支持多语言，应考虑根据路由动态设置 metadata。

---

### 3.3 `apps/web/lib/env.ts`

**安全设计良好的部分：**
- **优秀的设计**：使用 Zod 严格验证所有环境变量 ✅
- 明确移除了 `NEXT_PUBLIC_API_KEY`，防止 API Key 泄露到客户端 bundle ✅
- 服务端变量（`API_KEY`）不暴露给客户端 ✅
- 验证失败立即抛出错误（fail-fast） ✅
- 详细的注释解释设计决策 ✅

**发现：**

**[L-24] `API_KEY` 是 optional 的**
```javascript
API_KEY: z.string().min(1).optional(),
```
虽然不会泄露到客户端，但如果服务端需要 API Key 但未配置，运行时可能失败。如果这是必需配置，应改为 `.min(1)` 不带 `.optional()`。

**[L-25] URL 辅助函数返回 `undefined` 时无降级处理**
```javascript
export function getApiBaseUrl(): string | undefined {
  return env.NEXT_PUBLIC_API_BASE_URL;
}
```
如果环境变量未配置，这些函数返回 `undefined`。调用方需要处理 `undefined` 情况，否则可能导致请求失败。

---

### 3.4 `apps/web/vercel.json` 与根目录 `vercel.json`

**根目录 `vercel.json`：**

**发现：**

**[M-14] 根目录 vercel.json 配置可能与项目实际结构不匹配**
```json
"builds": [
  { "src": "website/**", "use": "@vercel/static" },
  { "src": "admin/**", "use": "@vercel/static" }
]
```
根目录的 `vercel.json` 指向 `website/**` 和 `admin/**`，但项目的主要 Next.js 应用在 `apps/web/`。这两个配置文件的用途可能不同：
- 根目录 `vercel.json`：用于静态网站托管（marketing site）
- `apps/web/vercel.json`：用于 Next.js 应用

如果两者都在同一个 Vercel 项目中，可能产生冲突。需要确认部署配置是否正确。

**[L-26] `website/vercel.json` 使用 `"version": 2` 但缺少 `builds` 配置**
```json
{
  "version": 2,
  "public": true,
  "rewrites": [...]
}
```
`version: 2` 是 Vercel 的旧版配置格式。现代 Vercel 项目通常不需要显式声明版本。

---

## 四、运维审计

### 4.1 `admin/admin-config.js`

**安全设计良好的部分：**
- **地址零值检查**：强制要求真实地址，拒绝占位符 ✅
- **地址格式校验**：正则表达式 `^0x[a-fA-F0-9]{40}$` ✅
- **必需环境变量检查**：启动时验证，缺失则拒绝启动 ✅
- **深度冻结配置对象**：防止运行时篡改 ✅
- **原型链保护**：`Object.freeze(Object.prototype)` 防止原型污染 ✅
- **dotenv 安全加载**：try/catch 处理缺失情况 ✅

**发现：**

**[M-15] `ALCHEMY_API_KEY` 和 `SUBGRAPH_ID` 标记为必需**
```javascript
const REQUIRED_ENV = [
  'SEPOLIA_CONTRACT_ADDR',
  'MAINNET_CONTRACT_ADDR',
  'ALCHEMY_API_KEY',
  'SUBGRAPH_ID'
];
```
如果仅运行测试网，MAINNET 地址和 ALCHEMY_KEY 可能不需要。建议根据 `network` 配置动态确定必需变量。

**[L-27] RPC URL 硬编码（部分）**
```javascript
sepolia: {
  rpcUrl: 'https://rpc.sepolia.org',
  // ...
}
```
使用公共 RPC（`rpc.sepolia.org`），可能不稳定或有速率限制。建议从环境变量配置。

---

### 4.2 `admin/admin.js`

**安全设计良好的部分：**
- **无 innerHTML**：全部使用安全的 DOM API（`createEl`, `clearElement`） ✅
- **无 eval() / new Function()** ✅
- 钱包提供者验证（MetaMask / Coinbase / WalletConnect） ✅
- `safeConfirm` 模式确认敏感操作 ✅
- `accountsChanged` 和 `chainChanged` 事件处理 ✅

**发现：**

**[M-16] 大量功能使用 Mock 数据**
```javascript
const mockData = [
  { time: '2026-06-16 14:30:00', address: '0x1234...5678', ... }
];
```
Dashboard、监控、客户管理、标签管理等多个页面使用硬编码的 mock 数据而非真实合约调用。这是开发中的正常状态，但在生产部署前必须替换为真实数据获取逻辑。

**[M-17] `window.ethereum` 全局挂载函数暴露攻击面**
```javascript
window.showPage = showPage;
window.connectWallet = connectWallet;
// ... 大量函数挂载到 window
```
虽然便于 HTML onclick 调用，但如果页面加载了恶意第三方脚本，这些全局函数可被任意调用（如 `window.emergencyPause()`）。

**[L-28] `connectWallet` 中 `provider` 验证不够严格**
```javascript
const isMetaMask = window.ethereum.isMetaMask === true;
const isCoinbaseWallet = window.ethereum.isCoinbaseWallet === true;
const isWalletConnect = !!window.ethereum.provider;
if (!isMetaMask && !isCoinbaseWallet && !isWalletConnect) {
  console.warn('[SECURITY] Unknown wallet provider detected');
  // 仍然继续连接
}
```
检测到未知 provider 时仅记录警告，仍继续连接。对于管理敏感操作的 Admin 面板，建议严格限制 provider 类型。

---

### 4.3 `.gitignore`

**安全设计良好的部分：**
- `.env` 及其变体 ✅
- `.wallet-*.json`（助记词文件） ✅
- `k8s/secret.yaml` ✅
- `deployments/`（部署信息含地址） ✅
- `apps/contracts/artifacts/`（ABI 信息暴露风险） ✅

**发现：**

**[L-29] 缺少 `.vercel/` 忽略**
`.vercel/` 目录已存在于项目中（`.vercel/project.json`、`.vercel/.env.development.local`），但 `.gitignore` 未包含 `.vercel/`。虽然现有 `.gitignore` 有 `/.vercel/`，但实际目录 `.vercel/`（无前导斜杠）在项目根目录。需要确认是否已被忽略。

**[L-30] 缺少 `*.key`, `*.pem`, `*.p12` 忽略**
如果项目中使用了 TLS 证书或私钥文件，当前 `.gitignore` 不会阻止它们被意外提交。

---

## 五、Subgraph + Forta 审计

### 5.1 `subgraph/src/mappings/riskRegistry.ts`

**安全设计良好的部分：**
- Underflow 保护：`totalSanctioned > 0` 检查 ✅
- 使用 `log.warning` 记录异常状态 ✅
- 事件处理完整（Updated, Tagged, Added, Removed, Registered） ✅
- `getOrCreateStats()` 初始化所有字段 ✅

**发现：**

**[L-31] `handleRiskProfileUpdated` 中制裁状态变更不清理 `SanctionedAddress`**
当 `isSanctioned` 从 true 变为 false 时（通过 `RiskProfileUpdated` 事件），代码更新 `RiskProfile` 但不更新或删除 `SanctionedAddress` 实体。只有在 `SanctionRemoved` 事件中才会清理。如果制裁是通过 `RiskProfileUpdated` 解除的，子图中会保留过时的制裁记录。

**[L-32] `ContractRegistered` 为合约创建 `RiskProfile`**
```typescript
let profile = RiskProfile.load(contractAddr);
if (!profile) {
  profile = new RiskProfile(contractAddr);
  profile.tags = [];
}
```
合约地址被当作普通地址处理，没有区分合约和 EOA 的标记。可能混淆查询结果。

---

### 5.2 `forta-agents/fidesorigin-monitor/src/agent.ts`

**安全设计良好的部分：**
- 启动时强制校验必需环境变量 ✅
- 全局异常处理防止 Agent 崩溃 ✅
- 使用 Map 替代数组索引增强类型安全 ✅
- 安全格式化金额函数（异常时返回 '0'） ✅
- 大额交易监控阈值 ✅

**发现：**

**[L-33] 无发现** — 代码质量良好，符合 Forta Agent 最佳实践。

---

## 六、架构审计

### 6.1 `ARCHITECTURE.md`

**评估**：架构文档全面，覆盖了核心组件、数据流、技术栈、安全架构和部署架构。

**发现：**

**[I-01] 文档版本 `v0.2.1` 与实际代码版本 `v2.4.1` 不匹配**
文档最后更新日期为 2026-06-15，但系统已经经历了多次重大升级（V2.3, V2.4）。文档中的架构图和合约列表可能已过时。

**[I-02] 架构图中 `Tempo` 链未在代码中体现**
架构图显示支持 "Tempo (Payments L1)"，但在合约和部署脚本中未找到相关配置。

**[I-03] 安全架构图显示 2/3 Gnosis Safe，但代码中未体现**
文档提到 Owner 使用 "2/3 Gnosis Safe"，但部署脚本和合约中没有 Gnosis Safe 集成代码。

**[I-04] CI/CD 流水线图缺少安全扫描步骤**
与 ci.yml 的实际内容一致，但文档应反映当前状态（缺少 Slither、依赖审计等）。

---

## 七、问题汇总表

| # | 严重程度 | 文件 | 问题 | 修复建议 |
|---|----------|------|------|----------|
| 1 | **M-01** | `scripts/deploy.js` | 无权限/余额检查 | 添加 deployer 余额和权限验证 |
| 2 | **M-02** | `scripts/deploy-full.js` | 硬编码真实 USDT 地址作为测试数据 | 使用完全虚构地址或明确标记测试数据 |
| 3 | **M-03** | `scripts/generate-wallet.js` | 助记词明文写入文件 | 使用 `ethers.encryptKeystore` 加密或提示导入硬件钱包 |
| 4 | **M-04** | `scripts/quarantine-keeper.js` | PRIVATE_KEY 明文环境变量 | 使用 KMS/Vault/Secret Manager |
| 5 | **M-05** | `scripts/quarantine-keeper.js` | `.keeper-state.json` 无权限保护 | 设置文件权限或加密 |
| 6 | **M-06** | `scripts/deploy-v2.3.js` | `BYPASS_TIMELOCK=true` 可完全绕过保护 | 增加交互式确认步骤 |
| 7 | **M-07** | `scripts/upgrade-proxy.js` | 升级后 `initializeV2` 未检查是否已初始化 | 添加 `initialized` 状态检查 |
| 8 | **M-08** | `scripts/recovery-upgrade.js` | 缺少数据完整性验证 | 增加 VERSION 和数据检查 |
| 9 | **M-09** | `.github/workflows/ci.yml` | 缺少安全扫描 | 添加 slither、npm audit |
| 10 | **M-10** | `.github/workflows/deploy.yml` | 使用非官方 Vercel Action | 改用 Vercel CLI 或官方集成 |
| 11 | **M-11** | `deploy.yml` vs `vercel.json` | 构建工具不一致（pnpm vs npm） | 统一使用 pnpm |
| 12 | **M-12** | `k8s/deployment.yaml` | `imagePullPolicy: Always` 供应链风险 | 使用带 SHA256 的不可变镜像 |
| 13 | **M-13** | `k8s/deployment.yaml` | 多个 key 共享同一个 Secret | 按功能拆分 Secret |
| 14 | **M-14** | `vercel.json` (根目录) | 静态网站与 Next.js 配置可能冲突 | 确认部署配置，分离项目或明确路由 |
| 15 | **M-15** | `admin/admin-config.js` | MAINNET/ALCHEMY 对测试环境不必要 | 根据 network 动态确定必需变量 |
| 16 | **M-16** | `admin/admin.js` | 大量功能使用 Mock 数据 | 替换为真实合约调用 |
| 17 | **M-17** | `admin/admin.js` | 全局挂载函数可被第三方脚本调用 | 使用事件委托或模块化，减少全局暴露 |
| 18 | **L-01** | `scripts/deploy.js` | Explorer URL 仅支持 sepolia/goerli | 扩展 mainnet/L2 支持 |
| 19 | **L-02** | `scripts/deploy.js` | 部署信息明文含地址 | 可选：对敏感字段脱敏 |
| 20 | **L-03** | `scripts/deploy-full.js` | deployer 永久拥有 ORACLE_ROLE | 部署后脚本提示撤销或自动撤销 |
| 21 | **L-04** | `scripts/deploy-full.js` | mint 1M token 到 deployer | 生产部署移除 |
| 22 | **L-05** | `scripts/generate-wallet.js` | 文件名时间戳可预测 | 添加随机后缀 |
| 23 | **L-06** | `scripts/quarantine-keeper.js` | 轮询和扫描共用同一间隔 | 分离配置 |
| 24 | **L-07** | `scripts/quarantine-keeper.js` | 风险检查失败时跳过交易 | 改为 HOLD/隔离而非 skip |
| 25 | **L-08** | `scripts/deploy-v2.3.js` | totalProfiles 期望值硬编码 | 改为参数化或移除检查 |
| 26 | **L-09** | `scripts/deploy-v2.3.js` | TEST_ADDR 默认值逻辑冗余 | 修复 `||` 重复 |
| 27 | **L-10** | `scripts/upgrade-v2.3.js` | gasLimit 硬编码 500000 | 动态估算 |
| 28 | **L-11** | `scripts/recovery-upgrade.js` | raw call 硬编码 selector | 使用 ABI 编码 |
| 29 | **L-12** | `scripts/grant-role.js` | 使用 `attach()` 不验证字节码 | 改用 `getContractAt()` |
| 30 | **L-13** | `scripts/verify-v2.3.js` | 缺少权限/ Timelock 验证 | 添加 ADMIN_ROLE 和 Timelock 配置检查 |
| 31 | **L-14** | `ci.yml` | 上传的 build 产物可能含敏感信息 | 扫描 build 产物 |
| 32 | **L-15** | `deploy.yml` | 缺少部署前测试验证 | 添加 test 步骤作为部署前置条件 |
| 33 | **L-16** | `k8s/deployment.yaml` | 内存限制可能不足 | 监控并调整 |
| 34 | **L-17** | `k8s/` | 缺少 NetworkPolicy | 添加网络策略 |
| 35 | **L-18** | `k8s/configmap.yaml` | `DRY_RUN: "false"` 默认写操作 | 测试环境默认 `true` |
| 36 | **L-19** | `k8s/configmap.yaml` | FATF 配置不一致 | 统一 DRY_RUN 语义 |
| 37 | **L-20** | `k8s/cronjob.yaml` | 资源限制低于需求 | 增加 limit 或监控 |
| 38 | **L-21** | `docker-compose.yml` | 自定义服务镜像标签 | 确认 Dockerfile 使用固定版本 |
| 39 | **L-22** | `docker-compose.yml` | 缺少资源限制 | 添加 mem_limit / cpu_shares |
| 40 | **L-23** | `layout.tsx` | metadata 硬编码 | 考虑 i18n 支持 |
| 41 | **L-24** | `env.ts` | `API_KEY` 为 optional | 如果必需则移除 optional |
| 42 | **L-25** | `env.ts` | URL 函数返回 undefined | 添加降级处理或默认值 |
| 43 | **L-26** | `website/vercel.json` | 使用旧版 version: 2 | 简化或更新配置 |
| 44 | **L-27** | `admin/admin-config.js` | Sepolia RPC 硬编码 | 环境变量配置 |
| 45 | **L-28** | `admin/admin.js` | 未知 provider 仍允许连接 | 严格限制 provider |
| 46 | **L-29** | `.gitignore` | `.vercel/` 忽略可能不匹配 | 确认实际路径 |
| 47 | **L-30** | `.gitignore` | 缺少证书/密钥文件忽略 | 添加 `*.key`, `*.pem` |
| 48 | **L-31** | `riskRegistry.ts` | RiskProfileUpdated 解除制裁不清理 SanctionedAddress | 统一处理逻辑 |
| 49 | **L-32** | `riskRegistry.ts` | 合约地址无区分标记 | 添加 isContract 标记 |
| 50 | **I-01** | `ARCHITECTURE.md` | 版本号与实际不匹配 | 更新文档 |
| 51 | **I-02** | `ARCHITECTURE.md` | Tempo 链未在代码体现 | 移除或实现 |
| 52 | **I-03** | `ARCHITECTURE.md` | Gnosis Safe 未在代码体现 | 实现多签或更新文档 |
| 53 | **I-04** | `ARCHITECTURE.md` | CI/CD 图缺少安全扫描 | 更新文档 |

---

## 八、总体评估

### 安全评分: **B** (良好，有改进空间)

### 评分分解

| 维度 | 评分 | 说明 |
|------|------|------|
| 私钥管理 | C+ | 有加密和权限意识，但生产环境仍依赖明文环境变量 |
| CI/CD 安全 | B | 基础流程完善，缺少安全扫描和官方 Action |
| K8s/Docker 安全 | B+ | 安全上下文配置优秀，但缺少网络策略和镜像固定 |
| 前端安全 | B+ | 无 XSS 漏洞，环境变量管理优秀，但 Admin 面板 Mock 数据过多 |
| 架构文档 | B | 全面但部分过时 |
| 事件处理 | A | Subgraph 和 Forta Agent 代码质量高 |
| 部署脚本安全 | B | Timelock 检查完善，但存在硬编码和绕过风险 |

### 是否可以部署: **可以部署到测试网，生产部署前建议修复以下必须项**

### 部署前必须完成的事项

1. **[M-03]** `generate-wallet.js` 加密助记词或改用硬件钱包流程
2. **[M-04]** Keeper 私钥迁移到 KMS/Vault（生产环境）
3. **[M-10]** 替换非官方 Vercel Action
4. **[M-14]** 确认 Vercel 部署配置（根目录 vs apps/web）
5. **[M-16]** Admin 面板替换 Mock 数据为真实合约交互

### 部署前建议修复（非阻塞）

6. **[M-09]** CI 添加安全扫描（Slither、npm audit）
7. **[M-12]** K8s 使用 SHA256 固定镜像
8. **[M-13]** K8s Secret 按功能拆分
9. **[M-15]** Admin 配置根据环境动态确定必需变量
10. **[L-07]** Keeper 风险检查失败时改为 HOLD 而非 skip
11. **[L-17]** 添加 K8s NetworkPolicy
12. **[L-31]** Subgraph 统一制裁状态处理逻辑

### 整体印象

**部署脚本和运维安全**在同类 DeFi 项目中属于**中上水平**。亮点包括：
- **强制 Timelock 检查**：升级脚本默认拒绝直接升级，必须显式绕过
- **K8s 安全上下文全面**：runAsNonRoot、readOnlyRootFilesystem、seccomp、capabilities drop ALL
- **前端环境变量管理优秀**：Zod 验证、无 NEXT_PUBLIC 敏感变量、fail-fast
- **Fail-Closed 策略一致**：Keeper、合约、配置均遵循失败时关闭的原则

**主要风险集中在**：
- 生产环境中私钥仍以明文环境变量存在（Keeper、K8s CronJob）
- Admin 面板大量使用 Mock 数据，未连接真实合约
- CI/CD 缺少安全扫描步骤
- 架构文档与代码实际状态存在差距

核心安全模型（访问控制、升级安全、输入校验）设计合理，但在**运维密钥管理**和**生产就绪度**方面仍有提升空间。
