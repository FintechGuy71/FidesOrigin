# GLM-5.2 独立审计报告 — SDK + 前端 + 数据管道

**审计员**: GLM-5.2 (独立审计，非 Kimi 集群)  
**日期**: 2026-06-29  
**范围**: 30 个文件 (SDK × 8, 前端 × 8, 数据管道 × 14)  
**方法**: 逐行精读，关注安全性 / 类型安全 / 运行时安全 / 正确性 / 一致性

---

## 审计摘要

| 严重级别 | 数量 | 关键领域 |
|----------|------|----------|
| 🔴 Critical | 5 | 类型不匹配、缺失模块、组件 prop 类型错误 |
| 🟠 High | 8 | SSRF 阻断合法请求、KMS 签名器缺陷、竞态条件 |
| 🟡 Medium | 9 | 校验不足、配置漂移、接口不同步 |
| 🟢 Low | 7 | 代码质量、命名、文档 |
| **总计** | **29** | |

---

## 🔴 Critical 发现

### C-01: `react.ts` → `client.ts` — Chain 类型与 chainId 不兼容

**文件**: `packages/sdk/src/react.ts:89`, `packages/sdk/src/client.ts:170`  
**严重**: Critical — 运行时必定失败

```typescript
// react.ts line 89
const result = await clientRef.current!.checkRisk({ address, chainId: chain });
//                                                                ^^^^^^^^^^
// chain 是 Chain 类型 ('ethereum' | 'polygon' | ...)
// 但 checkRisk 期望 chainId: number | string (数字或数字字符串)
```

`checkRisk()` 调用 `validateChainId(input.chainId)`，后者用 `/^\d+$/.test(chainId)` 校验。传入 `'ethereum'` 会直接抛出 `INVALID_CHAIN_ID` 错误。

**影响**: React Hook `useRiskCheck` 在实际调用时 100% 失败。  
**同样受影响**: `useComplianceCheck` 也有相同问题 (line 215)。  
**修复方案**: 
- 方案A: 在 `react.ts` 中添加 Chain → chainId 映射表
- 方案B: 在 `client.ts` 中支持 Chain 字符串名称（需修改 `validateChainId`）

---

### C-02: `client.test.ts` — 测试用例使用 `chainId: 'ethereum'`，与校验逻辑矛盾

**文件**: `packages/sdk/src/client.test.ts:34,43,57,63`

```typescript
// 测试使用 chainId: 'ethereum'
await client.checkRisk({ address: '0x742d...', chainId: 'ethereum' });
```

但 `validateChainId` 只接受纯数字字符串。这些测试在当前代码下应该全部失败，说明要么测试未运行，要么 `validateChainId` 的逻辑在某个版本中被修改但测试未同步更新。

**影响**: 测试给出虚假信心 — 实际 chainId 校验比测试覆盖的更严格。  
**修复**: 测试应使用 `chainId: 1` 或 `chainId: '1'`。

---

### C-03: `collector.ts` — 导入不存在的模块 `./collectors-extended`

**文件**: `data-publisher/src/collector.ts:5`

```typescript
import { fetchElliptic, fetchTRMLabs, fetchCSV, fetchJSON } from './collectors-extended';
```

该模块在项目中不存在（已通过 `find` 确认）。当 `elliptic`、`trm-labs`、`csv-import` 或未知数据源被启用时，Node.js 将在运行时抛出 `MODULE_NOT_FOUND`。

**影响**: 启用任何非内置数据源将导致整个 collector 崩溃。  
**修复**: 创建 `collectors-extended.ts` 文件，或在 `collectFromSource` 中移除对不存在模块的引用。

---

### C-04: `RiskScore.tsx` — 组件接收 `AddressRisk` 类型但访问 `RiskCheckResult` 字段

**文件**: `packages/ui/src/components/RiskScore.tsx:36-45`

```tsx
// Props 声明
risk: AddressRisk;

// 但实际访问的字段在 AddressRisk 上不存在：
risk.overallLevel    // ❌ AddressRisk 没有 overallLevel（在 RiskCheckResult 上）
risk.overallScore    // ❌ 同上
risk.scores          // ❌ AddressRisk.risk 是单个 RiskScore 对象，不是数组
risk.flags           // ❌ 类型是 RiskFlag[]，但被当作 string[] 使用 (flag.replace)
risk.relatedEntities // ❌ AddressRisk 没有 relatedEntities（在 RiskCheckResult 上）
risk.transactionStats // ❌ AddressRisk 有 stats（不是 transactionStats）
```

**影响**: 组件渲染时所有数据字段将为 `undefined`，导致 UI 显示异常（分数 0、等级 medium、无标签）。  
**修复**: 修改 props 类型为 `RiskCheckResult`，或在组件中做字段映射。

---

### C-05: `key-manager.ts` — AWS KMS `signTransaction` 使用 `Transaction.from(tx).unsignedHash`

**文件**: `data-publisher/src/key-manager.ts:148`

```typescript
const txBytes = ethers.Transaction.from(tx).unsignedHash;
```

当 `tx` 是一个不完整的交易对象（如缺少 `to`、`nonce` 等必需字段）时，`Transaction.from()` 会抛出异常。ethers v6 的 `Transaction.from()` 要求传入一个完整的 `TransactionLike` 对象。

此外，该方法构造的签名格式可能不正确 — ethers v6 的签名格式需要 `serialized` 而非拼接 r+s+v 字符串。

**影响**: AWS KMS 签名器在生产环境中无法正确签名交易。  
**修复**: 使用 `kms-key-manager.ts` 中的 `KMSAbstractSigner` 实现（该实现更完善），或修复 `signTransaction` 的签名序列化逻辑。

---

## 🟠 High 发现

### H-01: `lib/api.ts` — SSRF 防护阻断合法的 Subgraph API 请求

**文件**: `lib/api.ts:53-70`, `hooks/useRiskAnalysis.ts:107`

```typescript
// api.ts - assertSafeUrl 默认 requireSameOrigin=true
export async function apiFetch(url: string, options: RequestInit = {}, ...) {
  assertSafeUrl(url, true);  // 只允许 / 开头的相对路径
  // ...
}

// useRiskAnalysis.ts - 调用绝对 URL
const url = getSubgraphUrl();
const response = await apiPost(url, { query, variables });  // ❌ 将被 SSRF 拦截
```

`apiPost` 内部调用 `apiFetch`，默认 `requireSameOrigin=true`。但 `useRiskAnalysis.ts` 和 `fetchSubgraphRiskData` 传入的是绝对 URL（Subgraph endpoint），会被 `assertSafeUrl` 拦截。

**影响**: 所有 Subgraph 查询在运行时失败，静默回退到 demo 模式。  
**修复**: `apiPost` 应接受 `ssrfOptions` 参数，或在 `apiFetch` 中对已知安全的绝对 URL 放行。

---

### H-02: `react.ts` — `useBatchRiskCheck` 缺少 stale response 保护

**文件**: `packages/sdk/src/react.ts:198-230`

`useRiskCheck` 有 `requestIdRef` 机制丢弃过期响应，但 `useBatchRiskCheck` 和 `useComplianceCheck` 都没有。快速连续调用 `check()` 时，旧请求的响应可能覆盖新请求的结果。

**影响**: 批量查询场景下出现数据竞争，展示错误的查询结果。  
**修复**: 在 `useBatchRiskCheck` 和 `useComplianceCheck` 中添加 `requestIdRef` 模式。

---

### H-03: `websocket.ts` — `connect()` Promise 可能永久挂起

**文件**: `packages/sdk/src/websocket.ts:127-163`

```typescript
connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    // onopen → resolve
    // onerror → reject
    // onclose → (no resolve/reject — schedules reconnect)
  });
}
```

如果 WebSocket 连接既不触发 `onopen` 也不触发 `onerror`（某些代理/防火墙场景），Promise 将永久挂起。此外，如果 `onopen` 先触发但 `onerror` 随后触发（或反过来），resolve 和 reject 都会被调用（虽然第二个无效但可能导致逻辑混乱）。

**修复**: 添加连接超时（如 10s），超时后 reject 并关闭连接。

---

### H-04: `batch-collector.ts` — `validTags` 过滤逻辑索引错位

**文件**: `data-publisher/src/batch-collector.ts:434-437`

```typescript
const validTags = batch.tags.slice(i, end)
  .filter((_t, idx) => validIndices.includes(idx))
  .map(tagArr => tagArr.map(t => ethers.encodeBytes32String(t)));
```

`validIndices` 是相对于 `batchAddrs`（即 `batch.addresses.slice(i, end)`）的索引。`batch.tags.slice(i, end)` 也是相对于原数组的切片。但 `filter` 中的 `idx` 是切片内的索引 — **如果 validIndices 包含的索引是相对于切片前的完整数组**，则过滤结果错误。

经验证：`validIndices` 确实是相对于 `batchAddrs`（即切片后），所以 `idx` 对齐正确。但代码可读性差，且 `validTags` 的长度可能与 `validAddrs` 不一致（如果 tags 数组结构与 addresses 不同步），**将导致合约调用参数长度不匹配而 revert**。

**修复**: 重构为 `validIndices.map(idx => batch.tags[i + idx])` 以提高清晰度和正确性。

---

### H-05: `chainSyncer.js` — Azure / GCP KMS 签名器未实现但允许初始化

**文件**: `data-sync/src/chainSyncer.js:162-169`

```javascript
async _initAzure() {
  throw new Error('Azure Key Vault 签名尚未实现。请使用 AWS KMS 或本地模式。');
}
async _initGCP() {
  throw new Error('GCP KMS 签名尚未实现。请使用 AWS KMS 或本地模式。');
}
```

环境变量检测会接受 Azure/GCP 配置，但在 `init()` 时才抛出错误。这意味着部署配置错误只会在运行时暴露。

**修复**: 在 `init()` 的环境变量检测阶段就拒绝未实现的 KMS 类型。

---

### H-06: `collector.ts` — OFAC SDN 下载 `maxRedirects: 0` 可能导致数据拉取失败

**文件**: `data-publisher/src/collector.ts:66`

```typescript
const response = await axios.get(config.endpoint, {
  maxRedirects: 0, // Prevent SSRF
  // ...
});
```

OFAC SDN list 的官方 URL (`https://www.treasury.gov/ofac/downloads/sdn.xml`) 在实际使用中可能有 HTTP → HTTPS 重定向。`maxRedirects: 0` 会将其视为错误。

**修复**: 使用 `maxRedirects: 5` 但在重定向前校验目标 URL 是否在白名单中，而非完全禁止重定向。

---

### H-07: `useWebSocket.ts` — `connect` 在 `useEffect` 依赖数组中导致无限重连

**文件**: `hooks/useWebSocket.ts:222-227`

```typescript
useEffect(() => {
  connect();
  return () => {
    disconnect();
  };
}, [connect]); // connect 是 useCallback，依赖众多
```

`connect` 是一个 `useCallback`，其依赖包括 `configUrl`、`setWsStatus`、`setWsError`、`addAlert` 等 Zustand selector 返回的函数。如果 Zustand selector 返回的函数引用在每次渲染时变化（取决于 Zustand 版本和配置），将导致无限重连循环。

**修复**: 使用 ref 存储 `connect`，在 `useEffect` 中调用 ref，依赖数组设为 `[]`。

---

### H-08: 双重 `createKeyManager` 实现造成混淆

**文件**: `data-publisher/src/key-manager.ts` vs `data-publisher/src/kms-key-manager.ts`

两个文件都导出 `createKeyManager`，签名和行为不同：
- `key-manager.ts`: 支持 AWS KMS / Azure / Plain（4 种优先级）
- `kms-key-manager.ts`: 支持 AWS KMS / Vault / Azure(legacy) / Plain（4 种优先级，但 Plain 在生产环境拒绝）

`batch-collector.ts` 导入 `./key-manager`，`index.ts` 不直接导入任何一个。生产环境应使用 `kms-key-manager.ts`（更严格的安全策略），但 batch-collector 使用的是旧版。

**修复**: 统一为一个实现，废弃 `key-manager.ts`。将 `batch-collector.ts` 的导入改为 `./kms-key-manager`。

---

## 🟡 Medium 发现

### M-01: `client.ts` — `config.timeout` 默认值与 `types.ts` 不一致

**文件**: `packages/sdk/src/client.ts:140`, `packages/sdk/src/types.ts:32`

```typescript
// client.ts constructor
this.timeoutMs = config.timeoutMs ?? 15000;

// types.ts FidesOriginConfig
timeout?: number; // default: 30000 (comment)
```

但 `config` getter 返回 `timeout: this.timeoutMs`，与 `FidesOriginConfig.timeout` 字段名不匹配（构造器使用 `timeoutMs`，类型定义使用 `timeout`）。且测试中断言 `c.config.timeout` 为 `30000`，但实际默认值是 `15000`。

**修复**: 统一默认值和字段名。

---

### M-02: `rules.ts` — `loadFromLocalStorage` 校验不完整

**文件**: `stores/rules.ts:111-126`

校验只检查 `id`、`name`、`enabled`、`threshold`、`action` 的类型，但不检查：
- `conditions` 是否为数组
- `threshold` 是否在合理范围（0-100）
- `createdAt` / `updatedAt` 是否存在

恶意或损坏的 localStorage 数据可能导致后续逻辑异常。

**修复**: 添加 `conditions` 数组校验和 `threshold` 范围校验。

---

### M-03: `auth.ts` — `login` 校验缺少 `id` 字段检查

**文件**: `stores/auth.ts:38-44`

```typescript
login: (user) =>
  set((state) => {
    if (!user || typeof user !== 'object' || typeof user.address !== 'string' || !user.role) {
      state.error = 'Invalid user data';
      return;
    }
    // ❌ 没有校验 user.id
```

`User` 接口要求 `id: string`，但 `login` 不校验 `id` 是否存在或为字符串。

---

### M-04: `processor.ts` — 地址校验只检查格式，不检查 checksum

**文件**: `data-publisher/src/processor.ts:72-77`

```typescript
const address = item.address.toLowerCase().trim();
if (!address.match(/^0x[0-9a-f]{40}$/)) {
```

这是合理的（链上数据通常用小写），但不检查零地址 `0x0000...0000`，可能导致无效数据被处理。

**修复**: 添加零地址检查。

---

### M-05: `logger.ts` — `deepRedact` 对嵌套数组的深拷贝不完整

**文件**: `data-publisher/src/logger.ts:24-41`

```typescript
function deepRedact(obj: any, seen = new WeakSet()): any {
  // ...
  if (Array.isArray(obj)) {
    return obj.map(item => deepRedact(item, seen));
  }
  const redacted = { ...obj };
  // ...
}
```

`deepRedact` 使用浅展开 `{ ...obj }` 复制对象，但对于嵌套在对象中的数组（非顶层数组），`redacted[key] = deepRedact(redacted[key], seen)` 会递归处理。然而 `seen` 是一个 `WeakSet`，对同一个数组的递归引用不会被正确追踪（数组通过 `map` 创建新对象，但原始嵌套对象引用可能被遗漏）。

**影响**: 在极端嵌套场景下，敏感信息可能未被完全脱敏。低风险但值得关注。

---

### M-06: `kms-key-manager.ts` — `KMSAbstractSigner.connect()` 不更新 `signFn` 闭包

**文件**: `data-publisher/src/kms-key-manager.ts:34-40`

```typescript
connect(provider: JsonRpcProvider): KMSAbstractSigner {
  return new KMSAbstractSigner(
    this.kmsClient, this.address, provider, this.chainId, this.signFn
  );
}
```

`signFn` 闭包捕获了原始的 `cachedClient`，在 `connect()` 后新 signer 仍使用旧 client。如果 provider 变更意味着网络环境变更（如切换到不同链），签名可能路由到错误的 KMS key。

**修复**: `connect()` 应接受新的 chainId 参数，或从 provider 推断。

---

### M-07: `config.ts` — `instanceId` 使用 `Date.now()` 导致每次重启生成新 ID

**文件**: `data-publisher/src/config.ts:113`

```typescript
instanceId: getEnv('INSTANCE_ID', `instance-${Date.now()}`),
```

每次进程重启都会创建一个新的 instanceId，集群协调器会认为这是一个新实例。旧实例的心跳记录不会被清理（直到 TTL 过期），可能导致短时间内出现"幽灵实例"。

**修复**: 使用 hostname + PID 或持久化 UUID。

---

### M-08: `scheduler.ts` — `jobs` Map 无限增长（内存泄漏）

**文件**: `data-publisher/src/scheduler.ts:122-170`

`this.jobs.set(jobId, job)` 使用 `type-${Date.now()}` 作为 key，每次 sync 都新增一条记录，从不清理。长期运行的进程会累积大量历史 job 记录。

**修复**: 限制 Map 大小（如保留最近 100 条），或定期清理。

---

### M-09: `index.ts` — 导出不存在的 `formatAddress` / `normalizeAddress` 等函数签名不匹配

**文件**: `packages/sdk/src/index.ts:12-20`

`index.ts` 从 `./utils` 导出 `formatAddress` 和 `normalizeAddress`，但 `utils.ts` 中 `normalizeAddress(address, chain)` 需要两个参数，而 `client.ts` 中 `validateAddress(address)` 只接受一个参数（使用 ethers 的 `getAddress`）。两套不同语义的地址校验函数并存。

---

## 🟢 Low 发现

### L-01: `types.ts` — `FidesOriginClient` 接口未被子类 `implements`

`types.ts` 定义了 `FidesOriginClient` 接口，但 `client.ts` 中的 `FidesOriginClient` 类没有 `implements FidesOriginClient`，导致接口与实现之间没有编译期约束。

---

### L-02: `AddressInput.tsx` — `onChange` 每次按键都 `trim()`

```tsx
onChange={(e) => {
  onChange(e.target.value.trim());
```

用户在粘贴地址后尝试在前面添加空格时会被静默移除。虽然对地址输入来说这是合理行为，但应在 `onBlur` 时 trim 而非每次按键。

---

### L-03: `RiskBadge.tsx` — 使用 `config.label` 但 `RISK_LEVELS` 可能使用 `name` 字段

依赖 `@fidesorigin/shared` 的 `RISK_LEVELS` 常量结构。如果 `RISK_LEVELS[level]` 的属性名是 `name` 而非 `label`，显示将为 `undefined`。

---

### L-04: `healthCheck.js` — `/metrics` 端点设置 `Access-Control-Allow-Origin: *`

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

暴露内部监控指标给任意来源。虽然不包含敏感数据，但泄露系统架构信息（内存、同步频率等）。

**修复**: 在生产环境限制 CORS origin。

---

### L-05: `batch-collector.ts` — CLI 帮助信息路径错误

```
npx ts-node batch-collector.ts --incremental
```

实际文件路径为 `src/batch-collector.ts`，帮助文本中的路径会产生误导。

---

### L-06: `client.ts` — `KNOWN_CHAIN_IDS` 白名单未包含部分常见链

缺少 `43114`(Avalanche) 在 mainnet 列表中... 等等，它包含了。但缺少 `250`(Fantom)、`25`(Cronos)、`33139`(Apex) 等。虽然不影响功能（未知链仍被允许），但缺少完整的白名单影响可观测性。

---

### L-07: `validators.js` — `validateUrl` 允许 `http:` 协议

```javascript
if (!['https:', 'http:'].includes(parsed.protocol))
```

对于安全敏感的区块链数据同步系统，应强制 `https:` 协议。允许 `http:` 可能在非加密网络中被中间人攻击。

---

## 架构级观察

### 1. 双密钥管理器问题
项目存在两套并行的密钥管理实现（`key-manager.ts` 和 `kms-key-manager.ts`），职责重叠但策略不同。`kms-key-manager.ts` 更严格（生产环境拒绝明文密钥），应成为唯一实现。

### 2. 类型系统碎片化
`AddressRisk`、`RiskCheckResult`、`RiskReport`（前端 store）三个类型表达几乎相同的概念但字段名不同（`risk.score` vs `overallScore` vs `score`）。这导致前端组件需要大量映射逻辑，增加了 bug 风险。

### 3. 数据管道的幂等性问题
`batch-collector.ts` 的 `synced-addresses.json` 状态文件管理是单进程安全的（文件锁），但 `scheduler.ts` 的分布式锁（Redis）与之独立运行。如果两个 scheduler 实例同时运行（cluster 模式），只有 Redis 锁保护，状态文件的原子写入不再提供额外保护。

### 4. 错误处理策略不一致
- SDK 层：`FidesOriginError` 统一错误类
- 前端 API 层：`ApiError` / `NetworkError` / `TimeoutError` 三个类
- 数据管道：原生 `Error` + `logger.error`
- data-sync (JS)：`ValidationError` 自定义类

缺乏统一的错误码映射，跨层调试困难。

---

## 修复优先级建议

| 优先级 | 编号 | 修复内容 | 预计工时 |
|--------|------|----------|----------|
| P0 | C-01 | react.ts Chain→chainId 映射 | 1h |
| P0 | C-03 | 创建 collectors-extended.ts | 2h |
| P0 | C-04 | RiskScore.tsx 类型修复 | 1h |
| P0 | C-05 | 移除旧版 key-manager.ts KMS 签名 | 2h |
| P1 | H-01 | api.ts SSRF 策略调整 | 2h |
| P1 | H-02 | 批量 hook stale response 保护 | 1h |
| P1 | H-03 | WebSocket connect 超时 | 30min |
| P1 | H-07 | useWebSocket reconnect 循环修复 | 1h |
| P1 | H-08 | 统一 createKeyManager | 2h |
| P2 | C-02 | 测试修复 | 30min |
| P2 | M-01~M-09 | 各项 Medium 修复 | 各 30min |
| P3 | L-01~L-07 | Low 修复 | 各 15min |

---

## 总结

FidesOrigin SDK 的安全基础扎实（SSRF 防护、密钥脱敏、浏览器密钥检测、生产环境明文密钥拒绝），但存在**类型系统碎片化**和**双实现冲突**两大系统性问题。最紧急的问题是 `react.ts` 中 Chain/chainId 类型不匹配（C-01）和 `RiskScore.tsx` 的 prop 类型错误（C-04），这两个问题会导致核心用户流程在运行时直接失败。

数据管道部分整体质量较高，特别是 `batch-collector.ts` 的原子状态管理和 `kms-key-manager.ts` 的严格安全策略。但 `collector.ts` 对不存在模块的导入（C-03）需要立即修复。

前端 Hook 层存在 stale response 保护不一致的问题（H-02），以及 WebSocket 重连循环风险（H-07），建议优先处理。

---

*审计完成。以上发现基于 2026-06-29 的代码快照。*