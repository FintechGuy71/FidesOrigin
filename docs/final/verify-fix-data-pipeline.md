# Data Pipeline — 最终验证与修复报告

> 生成时间: 2026-06-29  
> 范围: `data-publisher/src/*` + `data-sync/src/*` + `docker-compose.yml` + `k8s/cronjob.yaml`

---

## 编译验证结果

| 项目 | 结果 | 备注 |
|------|------|------|
| `data-publisher` TypeScript 编译 | ✅ PASS | `npx tsc --noEmit` 无错误 |
| `data-sync` JS 语法检查 | ✅ PASS | `node --check` 全部通过 |

---

## 阶段一: Critical/High/P0 修复验证

逐文件确认 C/H/P0 问题已正确修复：

| 文件 | 问题 | 状态 | 验证方法 |
|------|------|------|----------|
| `collector.ts` | SSRF防护 (maxRedirects:0, validateStatus) | ✅ 已修复 | 代码审查 |
| `batch-collector.ts` | 状态文件原子写入 + 文件锁 | ✅ 已修复 | 代码审查 |
| `batch-collector.ts` | DATA_DIR 使用 `/app/data` (K8s PVC) | ✅ 已修复 | 代码审查 |
| `processor.ts` | 地址格式验证 (0x+40hex) | ✅ 已修复 | 代码审查 |
| `key-manager.ts` | 私钥格式验证 | ✅ 已修复 | 代码审查 |
| `config.ts` | 生产环境禁止明文私钥 | ✅ 已修复 | 代码审查 |
| `monitor.ts` | webhook 10s超时 (AbortController) | ✅ 已修复 | 代码审查 |
| `monitor.ts` | 告警冷却Map内存泄漏防护 | ✅ 已修复 | 代码审查 |
| `scheduler.ts` | 分布式锁 + 本地锁双重防重入 | ✅ 已修复 | 代码审查 |
| `chainSyncer.js` | DER签名严格边界校验 | ✅ 已修复 | 代码审查 |
| `blockchainService.js` | 优雅停机 + 重试队列持久化 | ✅ 已修复 | 代码审查 |
| `validators.js` | SSRF URL黑名单 | ✅ 已修复 | 代码审查 |
| `nonceManager.js` | 双检锁 + nonce范围校验 | ✅ 已修复 | 代码审查 |
| `healthCheck.js` | 内存/数据库/区块链健康检查 | ✅ 已修复 | 代码审查 |

---

## 阶段二: P1/P2/P3 修复详情

### P1 — 高危问题

#### 1. processor.ts: `confidence=0` 被 `||` 误判为 `0.5`
**修复前:**
```typescript
confidence: Math.min(1, Math.max(0, item.confidence || 0.5))
```
**问题:** 当 `confidence=0` 时，`0 || 0.5` → `0.5` (falsy 0 被覆盖)。  
**修复后:**
```typescript
confidence: Math.min(1, Math.max(0, item.confidence ?? 0.5))
```
**验证:** ✅ `??` 正确区分 `0` 和 `undefined`

---

#### 2. batch-collector.ts: 单个无效地址导致整批失败
**修复:** 在调用合约前预验证所有地址，过滤无效地址到 `failedAddresses`，仅对有效地址调用 `batchUpdateRiskProfiles`。
```typescript
const validIndices: number[] = [];
const invalidAddresses: string[] = [];
for (let idx = 0; idx < batchAddrs.length; idx++) {
  if (isValidEthAddress(addr)) validIndices.push(idx);
  else invalidAddresses.push(addr);
}
if (validIndices.length === 0) continue;
```
**验证:** ✅ 无效地址不会进入合约调用

---

#### 3. batch-collector.ts: 批次交易成功即标记所有地址成功
**问题:** 合约内部可能跳过部分地址（重复、无变化），但代码将整批标记为成功。  
**修复:** 交易成功后，对每个地址调用 `getRiskProfile` 验证 `lastUpdated > 0`：
```typescript
const profile = await registry.getRiskProfile(addr);
if (profile && profile[3] && Number(profile[3]) > 0) {
  verifiedSuccess.push(addr);
} else {
  contractSkipped.push(addr);  // 标记为失败，下次重试
}
```
**验证:** ✅ 合约跳过的地址会被标记为 failed，下次 sync 重试

---

#### 4. key-manager.ts / kms-key-manager.ts: `recId` 硬编码为 27
**问题:** 
- `key-manager.ts` AWS KMS `signTransaction` 中 `baseV = chainId*2+35`，对 `chainId=0` 的链，`baseV=35` 而非正确的 `27/28`
- 未尝试 canonical `v=27/28` 值
- 若循环未找到匹配，`recId` 保持错误值，未抛出异常

**修复 (key-manager.ts AWS):**
```typescript
let recId: bigint | null = null;
for (const v of [27n, 28n]) {  // 先尝试 canonical
  try { if (recovered matches) { recId = v; break; } } catch { continue; }
}
if (recId === null && chainId > 0n) {  // 再尝试 EIP-155
  const baseV = chainId * 2n + 35n;
  for (let v = 0n; v <= 1n; v++) { ... }
}
if (recId === null) throw new Error('Unable to determine signature recovery ID');
```

**修复 (key-manager.ts Azure):** 同样逻辑，先尝试 27/28，再尝试 EIP-155。  
**修复 (kms-key-manager.ts):** 已有正确逻辑（先 27/28 再 EIP-155），无需改动。

**验证:** ✅ 所有签名恢复路径现在覆盖 canonical 和 EIP-155 两种格式

---

#### 5. logger.ts: 日志脱敏只检查顶层键
**修复前:** 仅遍历 `info` 的顶层键脱敏。  
**修复后:** 新增 `deepRedact()` 递归函数，支持：
- 嵌套对象递归扫描
- 数组元素递归扫描
- 循环引用防护 (`WeakSet`)
- 扩展敏感词列表: `vaultToken`, `kmsKeyId`, `oraclePrivateKey`
```typescript
function deepRedact(obj: any, seen = new WeakSet()): any { ... }
```
**验证:** ✅ 嵌套对象中的 `apiKey` 等字段现在会被脱敏

---

#### 6. index.ts: `uncaughtException` 处理器是 async 的
**问题:** `process.on('uncaughtException', ...)` 的回调中调用 `shutdown().catch().finally()` — Node.js 不等待 async handler 完成，可能导致清理未完成就退出。

**修复后:** 同步执行关键清理（停止 scheduler、batchScheduler、fatfScheduler、monitor），然后立即 `process.exit(1)`：
```typescript
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.stack });
  try {
    scheduler.stop();
    batchScheduler.stop();
    if (fatfScheduler) fatfScheduler.stop();
    monitor.stop();
  } catch (cleanupErr) { ... }
  process.exit(1);
});
```
**验证:** ✅ 处理器现在是同步的，清理操作不会悬空

---

#### 7. docker-compose.yml: 默认弱密码 + 端口暴露
**修复:**
- **Redis 端口:** 注释掉 `ports: - "6379:6379"`，Redis 仅通过 Docker 网络内部访问
- **Grafana 密码:** 将 `${GRAFANA_ADMIN_PASSWORD:-admin}` 改为 `${GRAFANA_ADMIN_PASSWORD:?GRAFANA_ADMIN_PASSWORD is required}`，强制要求设置环境变量，无默认值

**验证:** ✅ 无弱密码默认值，Redis 不暴露到主机

---

### P2 — 中危问题

#### 1. data-publisher 和 data-sync 两套独立密钥管理体系
**修复:** 在 `config.ts` 中统一支持两套环境变量命名：
| data-publisher 风格 | data-sync 风格 | 配置项 |
|---------------------|----------------|--------|
| `PUBLISHER_PRIVATE_KEY` | `PRIVATE_KEY` / `SYNC_PRIVATE_KEY` | privateKey |
| `KMS_PROVIDER=aws` + `KMS_KEY_ID` | `AWS_KMS_KEY_ID` (auto-detect provider) | kmsProvider + kmsKeyId |
| `VAULT_SECRET_PATH` + `VAULT_KEY_NAME` | `VAULT_KEY_PATH` | vault.secretPath |
| — | `AWS_REGION` | awsRegion (新增) |

**验证:** ✅ 新增 `awsRegion` 字段到 `PublisherConfig` 类型，KMS 客户端使用传入的 region

---

#### 2. K8s cronjob 私钥 optional 不一致
**修复:**
- 从 `cronjob.yaml` 中移除 `PUBLISHER_PRIVATE_KEY` 引用（生产环境不应使用明文私钥）
- 新增 `KMS_PROVIDER`, `KMS_KEY_ID`, `VAULT_ADDR`, `VAULT_SECRET_PATH`, `VAULT_KEY_NAME` 等配置项的 ConfigMap 引用
- 保留 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `VAULT_TOKEN` 的 Secret 引用

**验证:** ✅ 生产 K8s cronjob 不再引用明文私钥

---

### P3 — 低危问题

#### 1. 配置优化
- `getEnvInt('OFAC_WEIGHT', 1.0)` → `getEnvInt('OFAC_WEIGHT', 1)` (7处，统一整数默认值)

#### 2. 日志级别调整
- `config.ts` 中 `logLevel` 默认已是 `'info'`，无需修改
- 生产环境默认 `info` 级别合理

---

## 修改文件清单

| 文件 | 修改类型 | 问题级别 |
|------|----------|----------|
| `data-publisher/src/processor.ts` | 编辑 | P1 |
| `data-publisher/src/logger.ts` | 重写脱敏逻辑 | P1 |
| `data-publisher/src/index.ts` | 编辑 | P1 |
| `data-publisher/src/batch-collector.ts` | 编辑 + 新增ABI | P1 |
| `data-publisher/src/key-manager.ts` | 编辑 (AWS + Azure) | P1 |
| `data-publisher/src/kms-key-manager.ts` | 编辑 (region支持) | P2 |
| `data-publisher/src/config.ts` | 编辑 (统一密钥管理) | P2 |
| `data-publisher/src/types.ts` | 编辑 (新增awsRegion) | P2 |
| `docker-compose.yml` | 编辑 | P1 |
| `k8s/cronjob.yaml` | 编辑 | P2 |

---

## 未修复项（已确认不存在或已修复）

| 问题 | 状态 | 说明 |
|------|------|------|
| `processor.ts` 单个无效地址导致整批失败 | 已修复 | 通过 `filter` 移除无效地址 + 新增预验证 |
| `batch-collector.ts` 交易成功标记所有成功 | 已修复 | 新增 `getRiskProfile` 验证 |
| `key-manager.ts` recId 硬编码为 27 | 已修复 | 改为先尝试 27/28 再 EIP-155 |

---

## 验证命令

```bash
# TypeScript 编译
cd data-publisher && npx tsc --noEmit

# JS 语法检查
cd data-sync
node --check src/chainSyncer.js
node --check src/services/blockchainService.js
node --check src/validators.js
node --check src/utils/nonceManager.js
node --check src/utils/healthCheck.js
```

**全部通过。**
