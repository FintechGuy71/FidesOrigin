# Round 2 审计报告 — 部署脚本、运维配置与二次审计

**审计日期:** 2026-06-29  
**审计范围:** 部署脚本、CI/CD、K8s配置、前端代码、运维配置  
**审计方式:** 基于 git diff HEAD~1 验证修复 + 全量重新审计  
**审计工具:** git diff, grep, 手工代码审查

---

## 一、Phase A：修复验证（git diff HEAD~1）

### 1.1 修复文件变更概览

| # | 文件 | 是否被修改 | 修改内容 |
|---|------|-----------|---------|
| 1 | `scripts/generate-wallet.js` | ❌ 无变更 | — |
| 2 | `scripts/quarantine-keeper.js` | ❌ 无变更 | — |
| 3 | `scripts/update-merkle-root-v11.js` | ❌ 无变更 | — |
| 4 | `scripts/deploy-full.js` | ❌ 无变更 | — |
| 5 | `apps/contracts/scripts/deploy-v2.3.js` | ❌ 无变更 | — |
| 6 | `apps/contracts/scripts/upgrade-v2.3.js` | ❌ 无变更 | — |
| 7 | `apps/contracts/scripts/upgrade-proxy.js` | ❌ 无变更 | — |
| 8 | `apps/contracts/scripts/recovery-upgrade.js` | ❌ 无变更 | — |
| 9 | `apps/contracts/scripts/grant-role.js` | ❌ 无变更 | — |
| 10 | `admin/admin-config.js` | ❌ 无变更 | — |
| 11 | `admin/admin.js` | ❌ 无变更 | — |
| 12 | `apps/web/lib/env.ts` | ❌ 无变更 | — |
| 13 | `backend/docker-compose.yml` | ✅ **已变更** | SECRET_KEY 改为强制必填；DB/Redis 端口绑定到 127.0.0.1 |

> **结论**: 仅 `backend/docker-compose.yml` 在最新 commit 中被修改。其余 12 个文件在本次 commit 中无变更，说明修复是在更早的 commit 中完成的，或这些文件本身没有需要修复的问题。

---

### 1.2 逐个文件修复验证

#### 1.2.1 `scripts/generate-wallet.js` ✅ 安全

- **私钥暴露**: ❌ 无硬编码私钥。脚本仅生成新钱包并打印到控制台，属于预期行为。
- **硬编码地址**: ❌ 无。
- **时间锁/多签**: N/A（非升级脚本）。
- **状态**: ✅ 安全，无需修复。

#### 1.2.2 `scripts/quarantine-keeper.js` ✅ 安全（已修复）

- **私钥暴露**: ❌ 从 `process.env.PRIVATE_KEY` 读取，无硬编码。
- **硬编码地址**: ❌ 合约地址从 `process.env.FIDES_COMPLIANCE` / `process.env.WALLET_FACTORY` 读取。
- **关键改进**: ✅ `MAX_PROCESSED_TX = 50000` 上限防止内存无限增长；✅ 失败时 fail-closed（风险检查失败视为高风险）。
- **遗留问题**: ⚠️ `gasLimit: 500000` 硬编码（低风险）。
- **状态**: ✅ 安全。

#### 1.2.3 `scripts/update-merkle-root-v11.js` ✅ 安全

- **私钥暴露**: ❌ 从 `process.env.PRIVATE_KEY` 读取。
- **硬编码地址**: ❌ 从 `process.env.CONTRACT_ADDRESS` 读取。
- **状态**: ✅ 安全。

#### 1.2.4 `scripts/deploy-full.js` ⚠️ 需改进

- **私钥暴露**: ❌ 使用 `getSigners()`，无私钥硬编码。
- **硬编码地址**: ⚠️ 第 126-128 行有 3 个测试地址硬编码（`0x1234...`, `0xAb58...`, `0xdAC1...`）。这些是测试数据，但建议改为从配置文件读取。
- **时间锁/多签**: ❌ 部署脚本直接授予 `ORACLE_ROLE`，无时间锁延迟。虽然部署脚本通常需要直接操作，但生产环境建议通过 Timelock 执行。
- **状态**: ⚠️ 低-中风险（测试地址硬编码）。

#### 1.2.5 `apps/contracts/scripts/deploy-v2.3.js` 🚨 高风险

- **私钥暴露**: ❌ 无硬编码私钥。
- **硬编码地址**: 🚨 `PROXY_ADDR = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'` 和 `TEST_ADDR = '0xe950dc316b836e4eefb8308bf32bf7c72a1358ff'` 硬编码。
- **时间锁/多签**: 🚨 **直接调用 `upgradeToAndCall`**，无任何时间锁延迟或多签验证。虽然脚本检查了 `ADMIN_ROLE`，但缺少：
  - Timelock 延迟等待验证
  - 多签确认检查
  - 升级提议-执行两阶段流程
- **状态**: 🚨 **高风险** — 升级脚本缺少时间锁/多签保护（Round 1 要求未满足）。

#### 1.2.6 `apps/contracts/scripts/upgrade-v2.3.js` 🚨 高风险

- **私钥暴露**: ❌ 无硬编码私钥。
- **硬编码地址**: 🚨 `PROXY = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'` 硬编码。
- **时间锁/多签**: 🚨 **直接调用 `upgradeToAndCall`**，无任何时间锁或多签验证。
- **状态**: 🚨 **高风险** — 同上。

#### 1.2.7 `apps/contracts/scripts/upgrade-proxy.js` 🚨 高风险

- **私钥暴露**: ❌ 无硬编码私钥。
- **硬编码地址**: 🚨 `PROXY = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'` 和 `V2_IMPL = '0x788c534acd7E377b86a2f7E9284C2f3b03DD749a'` 硬编码。
- **时间锁/多签**: 🚨 **直接调用 `upgradeToAndCall`**，无任何时间锁或多签验证。
- **状态**: 🚨 **高风险**。

#### 1.2.8 `apps/contracts/scripts/recovery-upgrade.js` 🚨 高风险

- **私钥暴露**: ❌ 无硬编码私钥。
- **硬编码地址**: 🚨 `PROXY = '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'` 硬编码。
- **时间锁/多签**: 🚨 **直接调用 `upgradeToAndCall`**，无任何时间锁或多签验证。
- **状态**: 🚨 **高风险**。

#### 1.2.9 `apps/contracts/scripts/grant-role.js` ⚠️ 中风险

- **私钥暴露**: ❌ 无硬编码私钥。
- **硬编码地址**: ⚠️ 第 14 行有 fallback 地址：`process.env.RISK_REGISTRY || '0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc'`。如果环境变量未设置，会 fallback 到硬编码地址。应改为**无 fallback**。
- **状态**: ⚠️ 中风险 — 建议移除 fallback，强制要求环境变量。

#### 1.2.10 `admin/admin-config.js` ✅ 已修复（优秀）

- **私钥暴露**: ✅ 无。所有敏感配置从环境变量读取。
- **硬编码地址**: ✅ 合约地址通过 `validateContractAddress()` 校验，拒绝零地址。
- **配置保护**: ✅ 深度冻结（`deepFreeze`）+ 原型链保护（`Object.freeze(Object.prototype)`）。
- **必需环境变量**: ✅ 启动时校验 `REQUIRED_ENV`，缺失则拒绝启动。
- **状态**: ✅ 安全（修复范例）。

#### 1.2.11 `admin/admin.js` ✅ 安全

- **XSS**: ✅ 无 `innerHTML`，使用安全 DOM API（`createEl`, `textContent`）。
- **Eval**: ✅ 无 `eval()` 或 `new Function()`。
- **状态**: ✅ 安全。

#### 1.2.12 `apps/web/lib/env.ts` ✅ 安全

- **环境变量验证**: ✅ Zod Schema 验证，无 fallback 默认值。
- **敏感信息泄露**: ✅ 仅使用 `NEXT_PUBLIC_` 前缀变量，服务端变量不外泄。
- **状态**: ✅ 安全。

#### 1.2.13 `backend/docker-compose.yml` ✅ 已修复

- **SECRET_KEY**: ✅ `${SECRET_KEY:?SECRET_KEY must be set}` — 强制必填，无默认值。
- **端口暴露**: ✅ DB 和 Redis 端口绑定到 `127.0.0.1:5432` 和 `127.0.0.1:6379`，不再对外暴露。
- **数据库密码**: ⚠️ 仍使用硬编码密码 `fidesorigin_pass`（中风险，建议改为环境变量）。
- **状态**: ✅ 大部分修复完成；⚠️ 数据库密码建议改为 env var。

---

## 二、Phase B：二次审计 — 新发现问题

### 2.1 升级脚本时间锁/多签缺失（Round 1 遗漏）

| 脚本 | 硬编码地址 | 时间锁 | 多签 | 风险等级 |
|------|-----------|--------|------|---------|
| `deploy-v2.3.js` | PROXY, TEST_ADDR | ❌ | ❌ | 🚨 Critical |
| `upgrade-v2.3.js` | PROXY | ❌ | ❌ | 🚨 Critical |
| `upgrade-proxy.js` | PROXY, V2_IMPL | ❌ | ❌ | 🚨 Critical |
| `recovery-upgrade.js` | PROXY | ❌ | ❌ | 🚨 Critical |
| `deploy-v2.3.1.js` | PROXY | ❌ | ❌ | 🚨 Critical |
| `upgrade-v2-fix.js` | PROXY (env fallback) | ❌ | ❌ | 🚨 Critical |

> **说明**: 虽然合约层 `FidesOriginTimelock.sol` 已添加 `UPGRADE_TIMELOCK` 和 `proposeUpgrade()`，但**所有升级脚本均未使用这些机制**。脚本直接调用 `upgradeToAndCall`，完全绕过了时间锁。这是一个**严重的设计-实现脱节**。

**修复建议**:  
- 升级脚本应改为**两阶段流程**: `proposeUpgrade()` → 等待 `UPGRADE_TIMELOCK` 延迟 → `executeUpgrade()`。  
- 或至少在脚本中添加**时间锁状态检查**（检查 `proposedUpgrades[impl]` 是否存在且已过期）。  
- 添加**多签检查**（确认至少 N/M 个签名者已批准）。

---

### 2.2 新增/扩展脚本中的硬编码地址

以下脚本不在 Round 1 审计列表中，但存在硬编码地址，建议统一改为环境变量配置：

| 脚本 | 硬编码地址 | 建议 |
|------|-----------|------|
| `scripts/release-all-records.js` | wallet, vault, token | 改为 env vars |
| `scripts/fix-wallet-vault-role.js` | wallet, vault | 改为 env vars |
| `scripts/test-transfer-sizes.js` | token, wallet, deployer | 改为 env vars |
| `scripts/diagnose-transfer.js` | token, wallet, deployer | 改为 env vars |
| `scripts/diagnose-contracts.js` | token, wallet, deployer, registry | 改为 env vars |
| `scripts/diagnose-quarantine.js` | wallet | 改为 env vars |
| `scripts/fix-wallet-config.js` | wallet, riskRegistry | 改为 env vars |
| `scripts/cleanup-quarantine.js` | wallet, token, vault | 改为 env vars |
| `scripts/check-balances.js` | deployer, wallet | 改为 env vars |
| `scripts/e2e-sepolia.js` | 从 `deployments/sepolia-latest.json` 加载 | 建议改为 env 或参数 |

---

### 2.3 K8s 配置问题

#### 2.3.1 `k8s/configmap.yaml` ⚠️ 中风险

- **硬编码合约地址**: `RISK_REGISTRY_ADDRESS: "0x7ead67622f6A47318a55502634A429eF9dC5cebc"` 和 `FATF_RISK_REGISTRY_ADDRESS: "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc"` 硬编码。
- **建议**: 生产环境应通过环境变量注入，ConfigMap 仅保留非敏感配置。

#### 2.3.2 `k8s/secret.yaml` ⚠️ 低风险

- **当前状态**: 所有值为空字符串 `""`，带有注释警告不要提交真实值。
- **风险**: 虽然当前安全，但开发者容易在本地修改后误提交。建议：
  - 将 `k8s/secret.yaml` 添加到 `.gitignore`
  - 提供 `k8s/secret.yaml.example` 作为模板

#### 2.3.3 `k8s/deployment.yaml` ✅ 安全

- 所有敏感值通过 `valueFrom.secretKeyRef` 从 Secret 注入，无硬编码。✅
- `optional: false` 对关键 secret（PUBLISHER_PRIVATE_KEY, FATF_ORACLE_PRIVATE_KEY）设置正确。✅
- 安全上下文配置完整：`runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities.drop: ALL`。✅

---

### 2.4 CI/CD 安全审计 ✅ 整体安全

| 工作流 | 状态 | 说明 |
|--------|------|------|
| `ci.yml` | ✅ | 无 secrets 暴露，标准 lint/test/build 流程 |
| `deploy.yml` | ✅ | 使用 `secrets.VERCEL_TOKEN` 等，正确 |
| `deploy-web.yml` | ✅ | 使用 `secrets.VERCEL_TOKEN` 等，正确 |
| `deploy-subgraph.yml` | ✅ | 使用 `secrets.SUBGRAPH_ACCESS_TOKEN`，正确 |
| `publish-sdk.yml` | ✅ | 使用 `secrets.NPM_TOKEN`，正确 |
| `secret-scan.yml` | ✅ | TruffleHog 扫描 + `.env` 文件检查，正确 |

**未发现 CI/CD 配置安全问题**。

---

### 2.5 `.gitignore` 审计 ⚠️ 需改进

当前 `.gitignore` 内容：

```
/.next/
/dist/
/build/
/node_modules/
/.turbo/
/coverage/
/.vercel/
*.log
.env
.env.local
.env.*.local
.DS_Store
*.tsbuildinfo
data-publisher/node_modules/
data-publisher/.env
data-publisher/dist/
data-publisher/node_modules/
*.bak.js
*.tmp.js
```

**缺失项**:

| 缺失项 | 风险 | 建议 |
|--------|------|------|
| `deployments/` | 包含部署地址、部署者信息、ABI | 添加 `deployments/` 或至少 `deployments/*.json` |
| `k8s/secret.yaml` | 可能包含真实 secret | 添加 `k8s/secret.yaml`，提供 `k8s/secret.yaml.example` |
| `scripts/.keeper-state.json` | 包含已处理交易哈希和已知钱包 | 添加 `scripts/.keeper-state.json` |
| `.env.example` | 已跟踪，但可能包含示例密钥 | 确保 `.env.example` 中所有值为占位符 |

---

### 2.6 前端代码安全审计 ✅ 安全

#### 2.6.1 `apps/web/lib/env.ts` ✅
- Zod 验证，无 fallback，无敏感信息泄露。

#### 2.6.2 `admin/admin.js` ✅
- 无 `innerHTML`，使用安全 DOM API。
- 无 `eval()` 或 `new Function()`。
- 无敏感信息硬编码。

#### 2.6.3 其他前端文件
- 检查 `hooks/useRiskAnalysis.ts`、`lib/api.ts`、`stores/rules.ts` 等：
  - 无硬编码 API 密钥或私钥。
  - 所有 API 端点通过 `CONFIG` 或 `env` 获取。

---

### 2.7 修复引入的新问题

| 问题 | 影响 | 说明 |
|------|------|------|
| `admin-config.js` 严格启动校验 | ⚠️ 开发体验 | 所有 `REQUIRED_ENV` 必须存在，否则启动失败。开发环境需要完整 `.env` 配置。这不是安全问题，但需要文档说明。 |
| `docker-compose.yml` 强制 SECRET_KEY | ⚠️ 开发体验 | 无默认值，开发环境必须设置。建议提供 `.env.example` 并文档说明。 |
| 升级脚本与 Timelock 合约脱节 | 🚨 安全风险 | 合约已部署时间锁，但脚本未使用。这是**最大的遗留风险**。 |

---

## 三、风险汇总

### 3.1 按严重程度

| 等级 | 数量 | 问题 |
|------|------|------|
| 🚨 Critical | 6 | 升级脚本直接调用 `upgradeToAndCall`，完全绕过时间锁和多签 |
| 🔴 High | 1 | `grant-role.js` 有 fallback 硬编码地址，环境变量未设置时自动使用 |
| 🟡 Medium | 3 | ① K8s ConfigMap 硬编码合约地址；② DB 密码硬编码；③ `.gitignore` 缺少 `deployments/` 和 `k8s/secret.yaml` |
| 🟢 Low | 4 | ① 测试脚本硬编码地址；② 升级脚本 hardcoded gasLimit；③ `deploy-full.js` 测试地址硬编码；④ `e2e-sepolia.js` 依赖本地 deployment JSON |

### 3.2 修复优先级矩阵

| 优先级 | 任务 | 预估工作量 |
|--------|------|-----------|
| P0 | 重写所有升级脚本以使用 Timelock 两阶段流程 | 2-3 天 |
| P1 | 移除 `grant-role.js` 的 fallback 地址 | 10 分钟 |
| P1 | 将 K8s ConfigMap 中的合约地址改为 env 注入 | 30 分钟 |
| P2 | 添加 `deployments/` 和 `k8s/secret.yaml` 到 `.gitignore` | 10 分钟 |
| P2 | 将 DB 密码改为环境变量 | 30 分钟 |
| P3 | 统一测试脚本地址为环境变量配置 | 1-2 天 |
| P3 | 提供 `k8s/secret.yaml.example` 模板 | 10 分钟 |

---

## 四、验证检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 私钥是否不再明文暴露 | ✅ 通过 | 所有脚本从 env 读取，无硬编码私钥 |
| 硬编码地址是否已改为配置读取 | ⚠️ 部分通过 | 升级脚本和测试脚本仍有大量硬编码地址 |
| 升级脚本是否添加时间锁/多签验证 | ❌ **未通过** | 合约层有时间锁，但**脚本层完全未使用** |
| K8s secret 是否已移除 | ✅ 通过 | `secret.yaml` 值为空，通过 `secretKeyRef` 注入；但建议加 `.gitignore` |
| `.gitignore` 是否包含敏感文件 | ⚠️ 部分通过 | 缺少 `deployments/`、`k8s/secret.yaml` |
| CI/CD 配置是否安全 | ✅ 通过 | 所有 secrets 通过 GitHub Secrets 注入 |
| 前端代码是否安全 | ✅ 通过 | 无 XSS、无 eval、无硬编码密钥 |

---

## 五、结论

### 5.1 修复效果评估

Round 1 要求的修复中：
- ✅ **已完成**: `admin-config.js` 重构（优秀范例）、`docker-compose.yml` 安全加固、前端环境变量验证、K8s Secret 空值化。
- ❌ **未完成**: 升级脚本的时间锁/多签验证。这是**最核心的安全风险** — 合约层已部署时间锁机制，但所有升级脚本仍直接调用 `upgradeToAndCall`，完全绕过这些保护。

### 5.2 最大遗留风险

> **升级脚本与 Timelock 合约的设计-实现脱节。**
>
> `FidesOriginTimelock` 和 `RiskRegistryV2` 已实现了 `UPGRADE_TIMELOCK` 和 `proposeUpgrade()`，但 6 个升级脚本中没有任何一个使用这些功能。如果生产环境使用这些脚本，等于时间锁白做。

### 5.3 建议下一步

1. **立即（P0）**: 重写所有升级脚本，实现 `proposeUpgrade()` → `wait(timelock)` → `executeUpgrade()` 两阶段流程。
2. **本周（P1）**: 移除 `grant-role.js` fallback；K8s ConfigMap 地址 env 化；更新 `.gitignore`。
3. **下周（P2-P3）**: 统一测试脚本地址管理；完善文档和模板。

---

*报告生成时间: 2026-06-29*  
*审计员: Round 2 Subagent*
