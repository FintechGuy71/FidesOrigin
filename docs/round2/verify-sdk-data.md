# Round 2 验证报告：SDK + 数据管道修复验证 + 二次审计

**日期**: 2026-06-29
**执行者**: Subagent (Round 2 Verify)
**范围**: SDK/前端修复 + 数据管道修复 + 二次审计
**结果**: 修复总体正确，但引入 3 处新的 TypeScript 编译错误

---

## 执行摘要

| 类别 | 文件数 | 修复正确 | 引入新问题 | 严重级别 |
|------|--------|----------|------------|----------|
| SDK/前端 | 9 | 7 | 2 | 高 |
| 数据管道 | 10 | 7 | 3 | 高 |
| 二次审计发现 | — | — | 4 | 中 |

**TypeScript 编译**: `data-publisher` 未通过编译（6 个错误，其中 3 个为本次修复引入）

---

## Phase A：SDK/前端修复验证

### 1. `packages/sdk/src/client.ts` — ✅ 正确

**修复**: 敏感数据正则捕获组修正 + SSR 安全浏览器检测 + API Key 前缀检查

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| 正则 `(?:...)` → `(...)` + `$1` | ✅ 正确 | 非捕获组改为捕获组，`$1` 现在正确引用匹配前缀 |
| SSR 浏览器检测 | ✅ 正确 | 从 `typeof window !== 'undefined' \|\| WorkerGlobalScope` 改为 `window.document.createElement` 检测，Worker 环境不再误判为浏览器 |
| `pk_` 前缀检查 | ✅ 正确 | 新增 `apiKey.startsWith('pk_')` 检查，仅在非 `pk_` 前缀时抛出错误或警告 |

**潜在问题**: 无。`allowBrowserUsage` + `pk_` 前缀的组合逻辑正确：
- 浏览器环境 + Secret Key (`sk_` 或无前缀) + `allowBrowserUsage=false` → 抛错
- 浏览器环境 + Secret Key + `allowBrowserUsage=true` → 警告
- 浏览器环境 + Public Key (`pk_`) → 不警告不抛错

---

### 2. `packages/sdk/src/types.ts` — ✅ 正确（有破坏性变更）

**修复**: 新增 `RiskCheckResult`、`BatchRiskCheckResult`、`ClientOptions` 等类型；`baseUrl` 改为可选；接口方法签名更新

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `baseUrl?: string` | ✅ 正确 | 允许运行时配置或默认值 |
| 新增 `retryConfig` | ✅ 正确 | 与 `client.ts` 实际实现一致 |
| `ClientOptions` 从 `client.ts` 迁移到 `types.ts` | ✅ 正确 | `react.ts` 已同步更新 import 路径 |
| 接口方法重命名 | ⚠️ 破坏性变更 | `checkAddress` → `checkRisk`, `checkBatchAddresses` → `batchCheckRisk`, `checkCompliance` → `checkRisk` |

**注意**: 接口变更属于 **Breaking Change**。使用旧接口的外部代码会编译失败。但这是一个 demo 项目，且所有内部引用已同步更新，可以接受。

---

### 3. `packages/sdk/src/error.ts` — ✅ 正确

**修复**: `toJSON()` 移除 `stack` 和 `context`，新增 `toDebugJSON()`

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `toJSON()` 安全化 | ✅ 正确 | 防止敏感信息（stack trace 可能含路径/参数）通过日志外泄 |
| `toDebugJSON()` 新增 | ✅ 正确 | 调试场景下可用，显式标记 "use with caution" |

---

### 4. `packages/sdk/src/react.ts` — ✅ 正确（有 minor 问题）

**修复**: 请求去竞态（requestId + abort controller）、options 变化时重新创建 client、类型同步更新

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `requestIdRef` 去竞态 | ✅ 正确 | `++requestIdRef.current` 在每次请求前递增，配合 `if (requestId !== requestIdRef.current) return` 丢弃过期响应 |
| `useEffect` 重建 client | ✅ 正确 | 通过 `JSON.stringify(options)` 比较，options 变化时重新实例化 `FidesOriginClient` |
| `batchCheck` → `batchCheckRisk` | ✅ 正确 | 方法名与 `client.ts` / `types.ts` 一致 |

**Minor 问题**:
- `useBatchRiskCheck` 中 `result.results as unknown as RiskCheckResult[]` 使用了 `as unknown as`，类型断言过于粗暴。虽然 `BatchRiskCheckResult.results` 当前类型是 `AddressRisk[]`，但直接 `as unknown as` 掩盖了实际类型不匹配。建议改为 `result.results.map(...)` 逐个字段映射或更新 `BatchRiskCheckResult.results` 类型为 `RiskCheckResult[]`。
- `useComplianceCheck` 的语义变化：`data` 类型从 `ComplianceCheck[] | null` 变为 `RiskCheckResult | null`，返回的是单条风险检查结果而非合规规则列表。这改变了 Hook 的语义，但代码实现正确。

---

### 5. `packages/sdk/src/websocket.ts` — ✅ 正确

**修复**: 强制 wss:// + 连接后发送 auth + BigInt 序列化

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `ws:` → `wss:` 强制 | ✅ 正确 | 防止 API Key 明文传输，同时检查 `connectUrl.startsWith('wss:')` 二次确认 |
| 连接后发送 auth | ✅ 正确 | `apiKey` 不再出现在 URL query 中，避免 server log / proxy cache 泄漏 |
| BigInt 序列化 | ✅ 正确 | `JSON.stringify(message, (_, v) => typeof v === 'bigint' ? v.toString() : v)` 正确处理链上数据中的 BigInt |
| Debug log 脱敏 | ✅ 正确 | 打印 "Sending auth message" 而非实际 key 值 |

---

### 6. `packages/sdk/on-chain/src/compliance.ts` — ✅ 正确

**修复**: 合约地址校验（零地址、格式、EIP-55 checksum）

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| 零地址检查 | ✅ 正确 | `0x0000...0000` 被显式拒绝 |
| 格式校验 | ✅ 正确 | `/^0x[a-fA-F0-9]{40}$/` 基础校验 + `ethers.getAddress()` EIP-55 checksum 验证 |
| 错误信息 | ✅ 正确 | 包含合约名称和地址值，便于调试 |

---

### 7. `hooks/useRiskAnalysis.ts` — ✅ 正确

**修复**: AbortController 请求取消 + requestId 去竞态 + unmount cleanup

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `abortControllerRef` | ✅ 正确 | 新请求开始时取消旧请求，clear 时取消当前请求 |
| `requestIdRef` 去竞态 | ✅ 正确 | 每个 analyze 调用递增 ID，过期响应直接返回 `performLocalAnalysis(address)` |
| `finally` 加载状态保护 | ✅ 正确 | `if (requestId === requestIdRef.current) setLoading(false)` 防止过期请求关闭 loading |
| `useEffect` cleanup | ✅ 正确 | unmount 时 abort 任何 pending 请求 |

---

### 8. `lib/api.ts` — ✅ 正确

**修复**: 拦截器快照 + AbortError SSR 兼容 + 安全 URL 校验修正

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| 拦截器快照 | ✅ 正确 | `[...requestInterceptors]` 在 `apiFetch` 开始时复制数组，防止并发请求修改全局拦截器时互相污染 |
| `isAbortError` 特征检测 | ✅ 正确 | `error instanceof Error && error.name === "AbortError"` 替代 `DOMException instanceof`，兼容 Node.js SSR 环境 |
| `startsWith("/\\")` 修正 | ✅ 正确 | 从 `"/\")` 修正为 `"/\\")`，正确匹配反斜杠开头的 URL |

---

### 9. `stores/rules.ts` — ✅ 正确

**修复**: SSR 安全 localStorage 访问

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `typeof window === 'undefined'` 检查 | ✅ 正确 | Next.js SSR 环境下不会 crash |
| `window.localStorage` 存在性检查 | ✅ 正确 | 覆盖隐私模式 / 沙箱环境 localStorage 被禁用的情况 |

---

## Phase B：数据管道修复验证

### 1. `data-publisher/src/collector.ts` — ✅ 正确

**修复**: OFAC SDN 地址提取逻辑修正 + 地址类型校验 + 退避抖动

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `idList.id` 替代 `addressList.address` | ✅ 正确 | OFAC SDN XML 实际结构：数字地址在 `idList.id.idNumber` 中，类型为 `idType` |
| `idType` 匹配 | ✅ 正确 | `toLowerCase().includes('digital currency address')` 匹配 OFAC 的 "Digital Currency Address - ETH" 等格式 |
| 地址类型校验 | ✅ 正确 | `typeof item.address !== 'string'` 和 `typeof addr !== 'string'` 防御 |
| 退避抖动 | ✅ 正确 | `+ Math.random() * 1000` 防止多个实例同时重试导致 thundering herd |

---

### 2. `data-publisher/src/batch-collector.ts` — ✅ 正确

**修复**: 动态 gas 估算 + KMS 集成

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `estimateGas` + 20% buffer | ✅ 正确 | 防止固定 gas limit 导致交易失败或 gas 浪费 |
| 5M gas 上限 | ✅ 正确 | 防止异常情况下 gas 无限增长 |
| `createKeyManager` 替代明文私钥 | ✅ 正确 | 统一使用 KMS/Vault/Plain 密钥管理器，不再直接从 `ORACLE_PRIVATE_KEY` 创建 Wallet |

---

### 3. `data-publisher/src/processor.ts` — ✅ 正确

**修复**: 校验错误 graceful 处理 + 标签截断 + 类型收窄

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `throw` → `return null` | ✅ 正确 | 单条记录无效不再导致整个批次失败 |
| `.filter((item): item is RiskProfile => item !== null)` | ✅ 正确 | 类型安全过滤 null 值 |
| 标签截断 | ✅ 正确 | 最多 10 个标签，超出时警告并截断，防止链上数据过大 |
| `r.confidence ?? 0.5` | ✅ 正确 | `??` 替代 `\|\|`，避免 `confidence=0` 被误判为 falsy |

---

### 4. `data-publisher/src/key-manager.ts` — ❌ 引入 3 个 TypeScript 错误

**修复意图**: 正确的 recovery id 计算（从硬编码 `recId = 27` 改为通过 `ethers.recoverAddress` 尝试推导）

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| recovery id 推导逻辑 | ✅ 概念正确 | 尝试 `v=0` 和 `v=1`，通过 `recoverAddress` 匹配签名地址 |

**引入问题**:
1. **TS2339**: `Property 'address' does not exist on type 'AWSKMSKeyManager'`（第 123 行）
   - 原因：`this.address` 在 `AWSKMSKeyManager` 中不存在，类中只有 `cachedAddress`（私有，可选）
   - 修复建议：在 `getSigner` 中 `const cachedAddress = address;` 并在闭包中引用 `cachedAddress`，或改为 `(this as any).cachedAddress`
2. **TS2451**: `Cannot redeclare block-scoped variable 'txBytes'`（第 186、195 行）
   - 原因：`AzureKeyVaultManager.getSigner` 中 `const txBytes` 声明了两次（一次在 `signTransaction` 开头，一次在 recovery id 推导区域）
   - 修复建议：重命名第二个 `txBytes` 为 `txHash` 或复用第一个变量
3. **TS2339**: `Property 'address' does not exist on type 'AzureKeyVaultManager'`（第 199 行）
   - 原因：`this.address` 在 `AzureKeyVaultManager` 中不存在，类中只有 `deriveAddress` 方法，没有 `address` 属性
   - 修复建议：在 `getSigner` 中 `const derivedAddress = address;` 并在闭包中引用 `derivedAddress`

**Round 1 遗漏**: 原始代码硬编码 `recId = 27` 在以太坊主网（chainId=1）是正确的，但 `baseV = chainId * 2 + 35` 对于主网是 `37`（EIP-155），而非 `27`（pre-EIP-155）。修复将 recovery id 改为链相关的 EIP-155 格式是正确的，但闭包中引用了不存在的属性。

---

### 5. `data-publisher/src/index.ts` — ✅ 正确

**修复**: `uncaughtException` 同步处理 + `unhandledRejection` 退出

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `async` → 同步 | ✅ 正确 | Node.js 不会等待 `uncaughtException` 中的 async 函数，`.catch(() => {}).finally(() => process.exit(1))` 是正确模式 |
| `unhandledRejection` 退出 | ✅ 正确 | 防止未处理 rejection 导致进程处于不确定状态 |

---

### 6. `data-publisher/src/config.ts` — ✅ 正确

**修复**: 生产环境明文私钥检查扩大范围

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `hasPlainKeyAnywhere` | ✅ 正确 | 新增检查 `config.fatf.oraclePrivateKey` 和 `process.env.ORACLE_PRIVATE_KEY`，防止通过替代环境变量绕过安全检查 |

---

### 7. `data-publisher/src/scheduler.ts` — ⚠️ 引入 2 个 TypeScript 错误

**修复**: 本地锁防止并发 + 唯一 job ID + skipped 状态

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `localLock` | ✅ 正确 | 防止同一实例内的并发 sync |
| `uniqueJobId` | ✅ 正确 | `${type}-${Date.now()}` 避免 job ID 冲突 |

**引入问题**:
1. **TS2322**: `Type '"skipped"' is not assignable to type '"failed" | "running" | "completed"'`（第 91、112 行）
   - 原因：`SyncJob` 接口的 `status` 类型未包含 `'skipped'`
   - 修复建议：在 `types.ts` 的 `SyncJob` 中，将 `status: 'running' | 'completed' | 'failed'` 改为 `status: 'running' | 'completed' | 'failed' | 'skipped'`

---

### 8. `data-publisher/src/address-enricher.ts` — ✅ 正确

**修复**: 地址字段存在性校验

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `!ca.address \|\| typeof ca.address !== 'string'` | ✅ 正确 | 防止 `cryptoAddresses` 数组中某一项缺少 `address` 字段时 crash |

---

### 9. `data-sync/src/chainSyncer.js` — ✅ 正确

**修复**: nonce 回滚后重新同步

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `nonceManager.resetNonce()` → `nonceManager.syncFromChain()` | ✅ 正确 | 交易回滚后重新从链上读取 nonce，而非盲目重置为 0，避免 nonce 冲突或过低 |

---

### 10. `data-sync/src/services/blockchainService.js` — ✅ 正确

**修复**: 生产环境 KMS 初始化从 TODO 改为抛错

| 修复项 | 验证结果 | 说明 |
|--------|----------|------|
| `throw new Error` 替代 `return` | ✅ 正确 | 原代码 `return` 会导致 wallet 未初始化，后续调用 `this.wallet.signTransaction` 时 crash。改为抛错明确告知未实现，避免运行时 NPE |

---

## Phase C：二次审计（新发现问题）

### 1. 🔴 严重：`data-publisher` TypeScript 编译未通过（修复引入）

```
src/key-manager.ts(123,50): error TS2339: Property 'address' does not exist on type 'AWSKMSKeyManager'.
src/key-manager.ts(186,15): error TS2451: Cannot redeclare block-scoped variable 'txBytes'.
src/key-manager.ts(195,15): error TS2451: Cannot redeclare block-scoped variable 'txBytes'.
src/key-manager.ts(199,50): error TS2339: Property 'address' does not exist on type 'AzureKeyVaultManager'.
src/scheduler.ts(91,154): error TS2322: Type '"skipped"' is not assignable to type '"failed" | "running" | "completed"'.
src/scheduler.ts(112,9): error TS2322: Type '"skipped"' is not assignable to type '"failed" | "running" | "completed"'.
```

**修复建议**:
1. `key-manager.ts`: 在 `AWSKMSKeyManager.getSigner` 中 `const ownerAddress = address;`（在 `this.cachedAddress = address;` 之后），闭包中引用 `ownerAddress`；在 `AzureKeyVaultManager.getSigner` 中 `const ownerAddress = address;`（在 `const address = await this.deriveAddress(keyBundle.key);` 之后），闭包中引用 `ownerAddress`；将第二个 `const txBytes` 改为 `const txHash`。
2. `types.ts`: 扩展 `SyncJob.status` 为 `'running' | 'completed' | 'failed' | 'skipped'`。

### 2. 🟡 中等：`packages/sdk/src/react.ts` 类型断言粗暴

```typescript
data: result.results as unknown as RiskCheckResult[],
```

- `as unknown as` 是 TypeScript 中最弱的类型断言，绕过所有类型检查
- 如果 `result.results` 结构与 `RiskCheckResult` 不兼容，运行时会出错但编译器不会报错
- 建议：定义 `AddressRisk → RiskCheckResult` 的转换函数，或统一 `BatchRiskCheckResult.results` 类型

### 3. 🟡 中等：`packages/sdk/src/react.ts` `useComplianceCheck` 语义变化

- 旧接口返回 `ComplianceCheck[]`（合规规则列表）
- 新接口返回 `RiskCheckResult`（单条风险检查结果）
- 使用方如果按旧类型消费数据，会编译/运行错误
- 建议：将 `useComplianceCheck` 重命名为 `useComplianceRiskCheck` 或恢复 `checkCompliance` 接口，避免语义混淆

### 4. 🟡 中等：`packages/sdk/src/react.ts` `JSON.stringify(options)` 比较

```typescript
if (JSON.stringify(optionsRef.current) !== JSON.stringify(options)) {
  clientRef.current = new FidesOriginClient(options);
}
```

- 如果 `options` 包含函数或循环引用，`JSON.stringify` 会抛错或结果不一致
- 如果对象 key 顺序不同，`JSON.stringify` 结果不同，会导致不必要的 client 重建
- 建议：使用 `useMemo` 或浅比较 `Object.keys(options).length` + 逐 key 比较，或接受 `useEffect` 依赖 `options` 直接重建（`FidesOriginClient` 构造开销通常不大）

### 5. 🟡 中等：`data-publisher/src/collector.ts` 地址正则仅匹配以太坊

```typescript
if (address.match(/^0x[0-9a-f]{40}$/)) {
```

- 仅匹配小写 hex，但 `toLowerCase()` 已调用，所以没问题
- 但仅支持以太坊地址格式（40 hex），不支持比特币（不同长度）、Solana（base58）等其他链
- 如果项目未来支持多链，需要扩展地址校验
- 当前范围：可接受，建议加注释说明 "Ethereum only"

### 6. 🟢 低：`packages/sdk/src/client.ts` 浏览器检测仍可能误判

```typescript
const isBrowser =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement === 'function';
```

- 在 JSDOM 等测试环境中会误判为浏览器，导致测试时抛错
- 建议：增加 `process.env.NODE_ENV !== 'test'` 检查或提供 `isBrowser` 覆盖参数

### 7. 🟢 低：`lib/api.ts` 拦截器快照是浅拷贝

```typescript
const currentRequestInterceptors = [...requestInterceptors];
```

- 数组是新的，但拦截器函数对象本身不是深拷贝
- 如果拦截器内部修改了共享状态，仍可能产生竞争
- 建议：拦截器应设计为无状态纯函数，当前实现可以接受，但需文档约束

### 8. 🟢 低：`data-publisher/src/scheduler.ts` `localLock` 非进程级

- `localLock` 是内存变量，进程重启后丢失
- 如果进程 crash 重启，新的 sync 可能立即启动，与分布式锁 `cluster.acquireLock` 之间没有协调
- 建议：启动时检查 `this.jobs` 中是否有状态为 `'running'` 的旧 job，若有则设为 `'failed'` 或等待超时

---

## 修复优先级建议

| 优先级 | 问题 | 文件 | 工作量 |
|--------|------|------|--------|
| 🔴 P0 | `key-manager.ts` `this.address` 不存在 + `txBytes` 重复声明 | `data-publisher/src/key-manager.ts` | 10 min |
| 🔴 P0 | `SyncJob.status` 缺少 `'skipped'` | `data-publisher/src/types.ts` | 2 min |
| 🟡 P1 | `react.ts` `as unknown as` 类型断言 | `packages/sdk/src/react.ts` | 15 min |
| 🟡 P1 | `react.ts` `JSON.stringify(options)` 比较缺陷 | `packages/sdk/src/react.ts` | 15 min |
| 🟢 P2 | `useComplianceCheck` 语义变化 | `packages/sdk/src/react.ts` | 20 min |
| 🟢 P2 | 地址校验仅支持以太坊 | `data-publisher/src/collector.ts` | 注释即可 |
| 🟢 P2 | JSDOM 测试环境误判 | `packages/sdk/src/client.ts` | 10 min |
| 🟢 P2 | 启动时清理旧 running job | `data-publisher/src/scheduler.ts` | 20 min |

---

## 结论

**Round 2 修复整体质量高**，核心安全漏洞（API Key 泄漏、SSR 兼容、请求竞态、明文私钥检查）均已正确修复。但 **修复引入了 3 个新的 TypeScript 编译错误**（`key-manager.ts` 3 个 + `scheduler.ts` 2 个，共 5 个错误中的 3 个为本次修复引入），需要在合并前解决。

**建议**：
1. 立即修复 `key-manager.ts` 和 `types.ts` 的 TypeScript 错误（P0）
2. 重构 `react.ts` 的类型断言和 options 比较逻辑（P1）
3. 运行 `npx tsc --noEmit` 在 `data-publisher`、`packages/sdk`、`apps/web` 全量验证
4. 增加 CI 中的 TypeScript 编译检查，防止此类回归
