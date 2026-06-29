# DevOps 修复报告 — fix-devops.md

> **生成时间**: 2026-06-29  
> **基于审计**: `docs/final-audit/devops.md` (v2.4.1)  
> **验证状态**: node --check ✅ | YAML ✅ | JSON ✅

---

## 一、Medium 修复 (6项)

### M-03: `scripts/generate-wallet.js` — 助记词明文 → 加密存储

**修复内容**:
- 移除明文助记词写入 JSON 文件
- 使用 `ethers.encrypt(password)` 生成加密 Keystore JSON
- 要求 `WALLET_PASSWORD` 环境变量（失败则拒绝执行）
- 添加随机 salt 到文件名中，增加不可预测性
- 控制台仅显示 **地址**；助记词仅在生成时一次性打印到终端供用户抄写
- 文件权限仍为 `0o600`

**验证**: `node --check scripts/generate-wallet.js` ✅

---

### M-04: `scripts/quarantine-keeper.js` — 私钥明文 → KMS/Vault 支持

**修复内容**:
- 新增 `KMS_PROVIDER` + `KMS_KEY_ID` 路径（AWS/GCP KMS）
- 新增 `VAULT_ADDR` + `VAULT_TOKEN` + `VAULT_SECRET_PATH` 路径（HashiCorp Vault）
- 保留 `PRIVATE_KEY` 作为 dev/test 回退，但打印 **WARNING** 提示仅用于开发
- 如果三者皆无，抛出明确的错误，列出三种配置方式
- 生产环境脚本默认 `throw` 要求实现 KMS/Vault SDK 集成

**验证**: `node --check scripts/quarantine-keeper.js` ✅

---

### M-05: `.keeper-state.json` 无权限保护

**修复内容**:
- 在 `KeeperState.save()` 写入后执行 `fs.chmodSync(statePath, 0o600)`
- 捕获 Windows 等不支持 chmod 的环境异常并静默忽略

---

### M-10: `.github/workflows/deploy.yml` — 非官方 Vercel Action → 官方 CLI

**修复内容**:
- 移除 `uses: vercel/action-deploy@v1`
- 改为 `pnpm add -g vercel@latest` + `vercel pull/build/deploy --prod --token=...`
- 使用官方 CLI 消除第三方 Action 供应链攻击面
- 保留 `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets

**验证**: YAML 语法 ✅

---

### M-14: `vercel.json` 冲突 → 明确 scope

**修复内容**:
- 根目录 `vercel.json` 添加 `_comment` 字段说明：
  - 此文件为 **LEGACY** 静态营销站配置
  - 主 Next.js 应用位于 `apps/web/`，拥有独立的 `vercel.json`
  - 建议用 **独立的 Vercel 项目** 部署营销站，避免路由冲突
- JSON 语法修复（移除字符串拼接 `+` 运算符）

**验证**: JSON 解析 ✅

---

### M-16: `admin/admin.js` — Mock 数据 → 标注 Demo

**修复内容**:
- 在 `admin.js` 顶部添加统一的 **DEMO 数据声明注释块**
- 所有以下函数中的 `mockData` 均添加 `[DEMO]` 行注释，指明替换目标：
  - `initDashboard` → 替换为 on-chain / subgraph 查询
  - `loadBlockedTransfers` → 替换为 on-chain event 查询
  - `initMonitor` → 替换为 on-chain event 查询
  - `loadCustomers` → 替换为 on-chain profile 查询
  - `loadTags` → 替换为 on-chain tag 查询
  - `loadTimelock` → 替换为 TimelockController 查询
  - `loadMultisig` → 替换为 Gnosis Safe / MultiSig 查询
  - `loadQuarantine` → 替换为 on-chain vault 查询
  - `loadIncomingBlocks` → 替换为 on-chain event 查询
  - `loadLogs` → 替换为 on-chain event / backend API 查询
  - `loadPolicies` → 替换为 PolicyEngine 查询
  - `loadSubgraphComplianceChecks` → 替换为 Subgraph GraphQL 查询

**验证**: `node --check admin/admin.js` ✅

---

### M-17: `admin/admin.js` — 全局函数暴露

**修复内容**:
- 在全局状态区域后添加 **Security Note** 注释：
  - 说明 `window.*` 挂载是为了 HTML `onclick` 兼容
  - 建议生产环境迁移到 `addEventListener` 事件委托，移除全局暴露以降低恶意脚本攻击面

---

### K8s 加固 (M-12 + M-13 + L-17)

**M-12: 镜像固定**:
- `k8s/deployment.yaml` 中 `image` 改为 `fidesorigin/data-publisher@sha256:PLACEHOLDER_DIGEST`
- `imagePullPolicy` 从 `Always` 改为 `IfNotPresent`
- 注释说明：部署时必须替换为实际镜像 digest

**M-13: Secret 拆分**:
- 将单一 `fidesorigin-keys` Secret 拆分为三个：
  - `fidesorigin-publisher-keys` — 发布者私钥 + FATF oracle 私钥
  - `fidesorigin-cloud-keys` — AWS 凭证
  - `fidesorigin-vault-keys` — Vault token
- 限制 Pod 被攻破后的横向读取范围

**L-17: NetworkPolicy**:
- 新增 `k8s/networkpolicy.yaml`:
  - Ingress: 仅允许 `monitoring` namespace 的 Prometheus 在 9090 端口抓取
  - Egress: 允许 DNS (UDP 53)、HTTPS (TCP 443)、HTTP (TCP 80)、Redis (TCP 6379)
  - 禁止所有其他出站连接

**验证**: YAML 解析 ✅ (`deployment.yaml`, `networkpolicy.yaml`, `cronjob.yaml`)

---

## 二、Low + Info 修复 (10+项)

### L-06: `quarantine-keeper.js` — 轮询与批量扫描共用同一间隔

**修复内容**:
- 新增 `CONFIG.batchInterval`（默认 `300000` = 5 分钟），与 `checkInterval`（默认 30 秒）分离
- 批量扫描定时器使用 `CONFIG.batchInterval`
- 轮询监听仍使用 `CONFIG.checkInterval`

---

### L-07: `quarantine-keeper.js` — 风险检查失败时跳过交易

**修复内容**:
- 将 `catch (riskErr) { continue; }` 改为 **Fail-Closed** 策略：
  - 风险检查失败时，将 `risk` 标记为 `isBlacklisted: true, isHighRisk: true, riskLevel: 99`
  - 交易会被触发隔离（quarantine），而非跳过
- 添加日志警告：`Risk check failed ... Treating as HIGH RISK (fail-closed)`

---

### L-18: `k8s/configmap.yaml` — `DRY_RUN: "false"` 默认写操作

**修复内容**:
- `DRY_RUN` 默认值从 `"false"` 改为 `"true"`
- 注释说明：生产环境部署前必须显式将 `DRY_RUN` 设为 `false`

---

### L-20: `k8s/cronjob.yaml` — 资源限制低于 Deployment

**修复内容**:
- CronJob `limits.memory` 从 `512Mi` 提升到 `1Gi`（与 Deployment 对齐）
- 注释说明：批量同步可能加载大量 OFAC 数据，512Mi 不足

---

### L-27: `admin/admin-config.js` — Sepolia RPC 硬编码

**修复内容**:
- `SEPOLIA_RPC_URL` 从硬编码 `'https://rpc.sepolia.org'` 改为 `ENV.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'`
- `MAINNET_RPC_URL` 从模板字符串改为 `ENV.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/...'`
- 网络配置中 `rpcUrl` 使用变量而非硬编码字符串

**验证**: `node --check admin/admin-config.js` ✅

---

### L-29 / L-30: `.gitignore` — 缺少敏感文件模式

**修复内容**:
- 新增 `.key`, `.pem`, `.p12`, `.pfx`, `.crt`, `.ssh/`, `.vercel/` 忽略规则
- 防止 TLS 证书、SSH 密钥、Vercel 本地配置被意外提交

---

### L-31: `subgraph/src/mappings/riskRegistry.ts` — RiskProfileUpdated 解除制裁不清理 SanctionedAddress

**修复内容**:
- 在 `handleRiskProfileUpdated` 的 `if (isSanctioned)` 分支中新增 `else` 块：
  - 当 `isSanctioned` 变为 `false` 时，查找 `SanctionedAddress`
  - 如果存在且 `isActive == true`，将其设为 `isActive = false` 并记录 `removedAt`
  - 同步更新 `stats.totalSanctioned`（带下溢保护）
  - 添加 `log.info` 记录解除制裁事件
- 确保子图与链上状态一致，无论制裁是通过 `SanctionRemoved` 还是 `RiskProfileUpdated` 解除

---

### I-01: `ARCHITECTURE.md` — 版本号不匹配

**修复内容**:
- 版本号从 `v0.2.1` 更新为 `v2.4.1`
- 最后更新日期改为 `2026-06-29`

### I-02: Tempo 链未在代码中体现

**修复内容**:
- 架构图中 Tempo 列标注为 `[I-02] Tempo — Planned, not yet implemented`

### I-03: Gnosis Safe 2/3 未在代码中体现

**修复内容**:
- 安全架构图 `2/3 Gnosis Safe` 标注为 `[I-03] Planned, not yet implemented in code`

---

### M-15: `admin/admin-config.js` — MAINNET/ALCHEMY 对测试环境不必要

**修复内容**:
- 根据 `NETWORK` 环境变量动态决定必需变量：
  - `sepolia` / `testnet`: 仅 `SEPOLIA_CONTRACT_ADDR` 必需；`ALCHEMY_API_KEY` / `SUBGRAPH_ID` 可选
  - `mainnet` / `production`: 全部必需
  - 未知网络：安全回退，要求全部变量
- `MAINNET_CONTRACT_ADDR` 仅在主网模式下执行 `validateContractAddress`
- 测试网模式下未设置 `MAINNET_CONTRACT_ADDR` 时填充零地址（不会触发验证错误）

**验证**: `node --check admin/admin-config.js` ✅

---

## 三、验证结果

| 文件 | 类型 | 验证方式 | 结果 |
|------|------|----------|------|
| `scripts/generate-wallet.js` | JS | `node --check` | ✅ |
| `scripts/quarantine-keeper.js` | JS | `node --check` | ✅ |
| `admin/admin-config.js` | JS | `node --check` | ✅ |
| `admin/admin.js` | JS | `node --check` | ✅ |
| `k8s/deployment.yaml` | YAML | `yaml.safe_load` | ✅ |
| `k8s/configmap.yaml` | YAML | `yaml.safe_load` | ✅ |
| `k8s/cronjob.yaml` | YAML | `yaml.safe_load_all` | ✅ |
| `k8s/networkpolicy.yaml` | YAML | `yaml.safe_load` | ✅ |
| `.github/workflows/deploy.yml` | YAML | `yaml.safe_load` | ✅ |
| `vercel.json` | JSON | `json.load` | ✅ |
| `apps/web/vercel.json` | JSON | `json.load` | ✅ |

---

## 四、未修复项（需人工决策）

以下项需要产品/团队决策或外部依赖，本次未自动修复：

| 审计项 | 文件 | 原因 | 建议 |
|--------|------|------|------|
| M-06 | `deploy-v2.3.js` | `BYPASS_TIMELOCK` 绕过保护 | 添加交互式确认（需 TTY 支持），或改为 CI 审批流程 |
| M-07 | `upgrade-proxy.js` | `initializeV2` 重复调用 | 需读取合约 `initialized` 状态，依赖具体 ABI |
| M-08 | `recovery-upgrade.js` | 缺少数据完整性检查 | 恢复脚本特性，建议注释说明风险并加人工审批 |
| M-09 | `ci.yml` | 缺少 Slither / npm audit | 需安装 Slither + 配置 CI 步骤，超出文本修复范围 |
| M-11 | `deploy.yml` vs `vercel.json` | 构建工具不一致 | 已统一为 pnpm，但 `apps/web/vercel.json` 仍使用 npm；建议删除根目录 vercel.json 或统一为 pnpm |
| M-02 | `deploy-full.js` | 硬编码真实 USDT 地址 | 已标记，需替换为完全虚构地址或移除测试注入 |
| L-08 | `deploy-v2.3.js` | `totalProfiles` 硬编码 2636 | 需参数化或从环境变量读取，取决于测试环境 |
| L-10 | `upgrade-v2.3.js` | 硬编码 gasLimit 500000 | 建议根据网络动态估算，需 Ethers.js 代码 |
| L-11 | `recovery-upgrade.js` | 硬编码 selector | 建议改为 ABI 编码，但需保留兼容性 |
| L-32 | `riskRegistry.ts` | 合约地址无区分标记 | 建议添加 `isContract` 字段到 Graph schema，需 schema 修改 |

---

## 五、总结

**本次修复统计**:
- **Medium**: 6项全部修复 (M-03, M-04, M-10, M-14, M-16 + M-17, K8s M-12+M-13+L-17)
- **Low/Info**: 10+项修复 (L-06, L-07, L-18, L-20, L-27, L-29/30, L-31, I-01, I-02, I-03, M-15)
- **新建文件**: 1个 (`k8s/networkpolicy.yaml`)
- **修改文件**: 12个

**生产部署前仍需完成**:
1. 替换 `k8s/deployment.yaml` 中 `PLACEHOLDER_DIGEST` 为实际镜像 SHA256
2. 在 `quarantine-keeper.js` 中实现 KMS/Vault SDK 集成（目前为 `throw` 占位）
3. 将 `admin/admin.js` 中所有 `[DEMO]` 区块替换为真实合约交互
4. 统一 Vercel 构建工具为 pnpm（更新 `apps/web/vercel.json`）
5. 在 CI 中集成 Slither + `pnpm audit`
