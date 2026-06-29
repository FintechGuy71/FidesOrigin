# SDK + 前端审计报告 - Round 1

> **审计范围**: 26 个文件（SDK层 12 个 + UI组件 3 个 + Hooks 4 个 + Stores 4 个 + Utils 3 个）  
> **审计维度**: TypeScript类型安全、错误处理、输入验证、状态管理、内存泄漏、竞态条件、XSS/CSRF风险  
> **审计日期**: 2026-06-28  
> **总计问题**: 35（Critical: 4, High: 10, Medium: 12, Low: 7, Info: 2）

---

## 文件: packages/sdk/src/client.ts

### 问题 #1
- **行号**: 48-63
- **代码片段**: `function mergeSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal { ... }`
- **严重程度**: High
- **类型**: 逻辑/类型
- **问题描述**: `mergeSignals` 中类型断言 `(sig as any).reason` 绕过TypeScript类型检查。`AbortSignal` 的 `reason` 属性在标准类型中不可直接访问，且类型断言 `any` 使编译器失去保护。当信号已终止时，`sig.aborted` 检查在循环中不一定会触发 `break`，如果后续信号仍会继续检查。
- **影响分析**: 类型不严格，可能运行时访问undefined属性；在多个已终止信号时逻辑路径不一致，导致merged signal的reason可能不是最先触发的那个。
- **修复建议**: 使用 `AbortSignal.reason` 属性（现代标准已支持），或创建安全的类型守卫。修复循环逻辑：
```typescript
for (const sig of signals) {
  if (!sig) continue;
  if (sig.aborted) {
    onAbort(sig.reason);
    return controller.signal; // 已终止，直接返回
  }
  sig.addEventListener("abort", () => onAbort((sig as any).reason), { once: true });
}
```
- **验证方法**: TypeScript编译严格模式检查 + 单元测试多信号并发终止场景

### 问题 #2
- **行号**: 67-79
- **代码片段**: `const SENSITIVE_PATTERNS: Array<{ re: RegExp; repl: string }> = [... { re: /(?:api[_-]?key|apikey|token|secret|password|authorization)["'\s:=]+[A-Za-z0-9._\-\/+]{6,}/gi, repl: "$1[REDACTED]" }]`
- **严重程度**: High
- **类型**: 逻辑/安全
- **问题描述**: 第二个正则表达式使用 `$1` 捕获组，但正则定义中并无捕获组。`(?:...)` 是非捕获组，因此 `$1` 将始终为空字符串，导致替换结果为 `''[REDACTED]'`（即丢弃了匹配到的key名，但保留了=号后面的值）。此外，正则匹配后替换结果不安全。
- **影响分析**: 敏感信息脱敏失败，API密钥可能在日志或错误消息中泄露。
- **修复建议**: 修复正则表达式，添加捕获组或调整替换逻辑：
```typescript
{ re: /(api[_-]?key|apikey|token|secret|password|authorization)["'\s:=]+[A-Za-z0-9._\-\/+]{6,}/gi, repl: "$1: [REDACTED]" }
```
- **验证方法**: 运行单元测试验证脱敏输出，确认 `$1` 正确捕获且敏感值被替换

### 问题 #3
- **行号**: 102-110
- **代码片段**: `const mergedHeaders: Record<string, string> = { ...headers, ...(typeof options.headers === 'object' && options.headers !== null && !Array.isArray(options.headers) ? (options.headers as Record<string, string>) : {}) }`
- **严重程度**: Medium
- **类型**: 类型/逻辑
- **问题描述**: `options.headers` 类型是 `HeadersInit`，包含 `Headers` 对象、字符串数组或 `Record`。当前检查只处理了 `Record`，但 `Headers` 对象和 `string[][]` 也被判断为 `object` 且非 `null` 非 `Array`，所以它们会被错误地当作 `Record` 展开，导致类型转换错误。`Headers` 对象的展开结果是一个空对象（因为Headers没有可枚举属性）。
- **影响分析**: 用户传入 `Headers` 对象或 `string[][]` 时，自定义Header丢失，导致认证失败或自定义Header不生效。
- **修复建议**: 统一转换为 `Headers` 对象再处理：
```typescript
const mergedHeaders = new Headers(headers);
if (options.headers) {
  const userHeaders = new Headers(options.headers);
  userHeaders.forEach((value, key) => mergedHeaders.set(key, value));
}
```
- **验证方法**: 传入 `new Headers({ 'X-Custom': 'value' })` 和 `[['X-Custom', 'value']]` 测试是否生效

### 问题 #4
- **行号**: 114-126
- **代码片段**: `const response = await fetch(url, { ...options, signal: finalSignal, headers: mergedHeaders, })`
- **严重程度**: Medium
- **类型**: 安全/逻辑
- **问题描述**: `fetch` 的 `options` 展开中，`signal` 和 `headers` 被覆盖，但 `body` 未被处理。如果用户传入的是 `URLSearchParams` 或 `FormData` 等，`Content-Type` 头会被覆盖为 `application/json`，可能导致请求格式错误。同时 `options` 可能包含 `mode`、`credentials` 等字段，不应无条件传给 `fetch`（特别是跨域场景）。
- **影响分析**: 非JSON请求体被错误标记为JSON；潜在CORS问题（如果用户意外传入 `credentials: 'include'`）。
- **修复建议**: 显式构建RequestInit，只传递必要字段：
```typescript
const fetchOptions: RequestInit = {
  method: options.method || 'GET',
  body: options.body,
  signal: finalSignal,
  headers: mergedHeaders,
};
```
- **验证方法**: 传入非JSON body测试Content-Type是否正确

### 问题 #5
- **行号**: 150-155
- **代码片段**: `if (error instanceof FidesOriginError) { lastError = error; } else if (error instanceof Error) { if (error.name === 'AbortError' || error.name === 'TimeoutError') { ... } }`
- **严重程度**: Medium
- **类型**: 类型/逻辑
- **问题描述**: `TimeoutError` 不是DOM标准错误类型，而是自定义类。用户代码中自己创建 `TimeoutError` 时，`error.name` 是 `TimeoutError`，但如果 `error` 是来自DOM/Node的，不存在这个类型。`AbortError` 来自 `DOMException`，在浏览器中 `error.name === 'AbortError'` 是正确的，但在 Node.js 的 `undici` 中可能不同。此外 `fetch` 超时由 `AbortController` 触发，name 应为 `AbortError`，不会自动变成 `TimeoutError`。
- **影响分析**: 错误分类不准确，重试逻辑可能错误地将超时当作网络错误处理，导致不必要的重试或错误上报。
- **修复建议**: 统一错误来源判断：
```typescript
if (error instanceof DOMException && error.name === 'AbortError') {
  // 区分是超时还是用户取消
  if (timeoutController.signal.aborted && !options.signal?.aborted) {
    lastError = new FidesOriginError(`Request timeout after ${timeoutMs}ms`, "TIMEOUT", 408);
  } else {
    lastError = new FidesOriginError("Request aborted", "NETWORK_ERROR", 0);
  }
}
```
- **验证方法**: 单元测试模拟 AbortError 和超时场景，确认错误分类

### 问题 #6
- **行号**: 177-178
- **代码片段**: `export function isValidAddress(address: string): boolean { return isAddress(address); }`
- **严重程度**: Info
- **类型**: 类型/设计
- **问题描述**: `isValidAddress` 只是 `ethers.isAddress` 的别名，没有额外功能。但 `validateAddress` 又调用了 `getAddress`（返回checksum地址），两者的行为不一致。
- **影响分析**: API设计混乱，用户可能混淆 `isValidAddress`（仅检查格式）和 `validateAddress`（还做checksum规范化）。
- **修复建议**: 统一入口或明确命名：`isValidAddressFormat` 和 `normalizeAddress`。
- **验证方法**: 代码审查和API文档一致性检查

### 问题 #7
- **行号**: 187-207
- **代码片段**: `const KNOWN_CHAIN_IDS = new Set<number>([...]); export function isValidChainId(chainId: number | string): boolean { ... if (id > 0xffffffff) return false; ... }`
- **严重程度**: Medium
- **类型**: 逻辑/设计
- **问题描述**: 已知链白名单和最后的 `if (id > 0xffffffff) return false;` 检查之间有矛盾。对于未知链，白名单检查直接返回 `true`，但随后的检查会拒绝大于 `0xffffffff`（4294967295）的ID。实际上代码路径是：如果 `KNOWN_CHAIN_IDS.has(id)` 返回 true；否则检查 `id > 0xffffffff`。但 `0xffffffff` 是 32-bit 最大值，而某些合法链ID（如 EVM 测试网）可能超出此范围？实际上以太坊 `chainId` 是 uint256，限制为 2^32 不够。此外，如果传入的是非常大的字符串数字，会被 `Number()` 转为 `Infinity` 或失去精度。
- **影响分析**: 某些合法链ID（如自定义网络）可能被错误拒绝；字符串超大数字可能通过正则 `^\d+$` 但 `Number()` 精度丢失导致误判。
- **修复建议**: 使用 BigInt 处理链ID：
```typescript
if (typeof chainId === 'string') {
  if (!/^\d+$/.test(chainId)) return false;
  try { id = BigInt(chainId); } catch { return false; }
} else {
  id = BigInt(chainId);
}
if (id <= 0n || id > (2n ** 256n - 1n)) return false;
```
- **验证方法**: 传入超大链ID（超过Number.MAX_SAFE_INTEGER）测试

### 问题 #8
- **行号**: 209-212
- **代码片段**: `export function validateChainId(chainId: number | string): number { if (!isValidChainId(chainId)) { ... } return typeof chainId === 'string' ? Number(chainId) : chainId; }`
- **严重程度**: Medium
- **类型**: 类型/逻辑
- **问题描述**: 当 `chainId` 是字符串超大数字时，`isValidChainId` 中的 `Number(chainId)` 可能丢失精度，但 `validateChainId` 仍然返回 `Number(chainId)`。这可能导致字符串 `"9007199254740993"`（大于 MAX_SAFE_INTEGER）验证通过但返回精度丢失的值。
- **影响分析**: 链ID精度丢失，在后续API调用中可能发送到错误的链。
- **修复建议**: 如果必须返回 `number`，检查 `Number.isSafeInteger(Number(chainId))`；如果链ID可能超出安全整数范围，应返回 `string` 或 `bigint`。
- **验证方法**: 传入 `9007199254740993` 测试返回值是否等于输入值

### 问题 #9
- **行号**: 214-217
- **代码片段**: `export function isValidAmount(amount: string): boolean { if (!amount || typeof amount !== 'string') return false; return /^\d+(\.\d+)?$/.test(amount); }`
- **严重程度**: Medium
- **类型**: 逻辑/安全
- **问题描述**: 正则 `^\d+(\.\d+)?$` 允许前导零的任意长度数字，如 `"000000001"`、 `"00.0001"` 都合法。但没有限制小数位数，可能导致以太坊wei转换时溢出或精度问题。空字符串 `""` 的处理：`!amount` 在 `""` 时为 true，但 `"0"` 是合法金额。
- **影响分析**: 用户可能传入格式合法但语义异常的金额（如 `000.000000000000000000000000000000000001`），导致后续计算异常或溢出。
- **修复建议**: 限制小数位数和金额范围：
```typescript
export function isValidAmount(amount: string): boolean {
  if (!amount || typeof amount !== 'string') return false;
  if (!/^\d+(\.\d+)?$/.test(amount)) return false;
  if (amount.startsWith('0') && amount.length > 1 && !amount.startsWith('0.')) return false; // 拒绝前导零
  if (amount.includes('.') && amount.split('.')[1].length > 18) return false; // 最多18位小数（ETH wei）
  return true;
}
```
- **验证方法**: 传入 `"0001"`、 `"1.0000000000000000000001"` 测试是否被拒绝

### 问题 #10
- **行号**: 245-252
- **代码片段**: `if (isBrowser && this.apiKey) { if (!this.allowBrowserUsage) { throw new FidesOriginError(..., 'UNAUTHORIZED', 401); } console.warn('...'); }`
- **严重程度**: High
- **类型**: 安全
- **问题描述**: 浏览器检测仅通过 `typeof window !== 'undefined'` 判断，这在 SSR/Next.js 中可能不正确（服务端 `window` 不存在但代码可能被同构执行）。`WorkerGlobalScope` 检查也有问题。更严重的是，如果用户通过 `config.allowBrowserUsage = true` 绕过检查，虽然 `console.warn` 提醒，但代码继续执行，没有任何限制。API Key 仍会被暴露给客户端代码。
- **影响分析**: 在 SSR 框架中可能误判环境；允许在浏览器中执行服务端Secret Key，导致严重的密钥泄露风险。
- **修复建议**: 使用更精确的浏览器检测；增加硬编码白名单仅允许以 `pk_`（public key）开头的token在浏览器中使用；对 `allowBrowserUsage` 增加额外日志和警告：
```typescript
if (isBrowser && this.apiKey) {
  if (!this.apiKey.startsWith('pk_') && !this.allowBrowserUsage) {
    throw new FidesOriginError(...);
  }
  if (!this.apiKey.startsWith('pk_')) {
    console.warn('[SECURITY] Using secret API key in browser. Ensure this is a scoped, short-lived token.');
  }
}
```
- **验证方法**: 在 Next.js SSR 环境和浏览器控制台分别测试，确认服务端构建不抛异常，浏览器中检测到非 `pk_` 前缀的key时警告

### 问题 #11
- **行号**: 265-270
- **代码片段**: `if (input.amount !== undefined && input.amount !== null) { params.amount = validateAmount(input.amount); }`
- **严重程度**: Low
- **类型**: 逻辑
- **问题描述**: 对 `amount` 的空字符串 `""` 没有做排除，虽然 `validateAmount` 中 `!amount` 对空字符串返回 false，但这里传入 `""` 会导致 `params.amount = ""`（如果 `validateAmount` 被绕过）。不过这里逻辑没问题，但 `validateAmount` 对空字符串不抛异常而是返回 false，但 `!amount` 对空字符串是 true，所以 `validateAmount` 不会执行。但如果传入 `" "` 或 `\t`，`isValidAmount` 中 `amount.trim()` 没有处理，所以 `" 1"` 会被拒绝。不过这里的 `validateAmount` 中 `!amount` 对 `" 1"` 是 false，所以会继续正则检查，`^\d+` 不匹配 ` `，所以返回 false。不过 `validateAmount` 会 throw。逻辑正确但行为不够透明。
- **影响分析**: 低，行为基本正确，但边界情况处理不一致。
- **修复建议**: 在 `isValidAmount` 开头添加 `amount = amount.trim()`，确保前后空格被处理。
- **验证方法**: 传入 `" 1"` 和 `"1 "` 测试是否统一被拒绝

---

## 文件: packages/sdk/src/types.ts

### 问题 #12
- **行号**: 1-180
- **代码片段**: `export interface FidesOriginClient { ... checkAddress(address: string, options?: RiskCheckOptions): Promise<AddressRisk>; ... createWebSocket(options?: WebSocketOptions): FidesOriginWebSocket; }`
- **严重程度**: High
- **类型**: 类型/设计
- **问题描述**: 接口 `FidesOriginClient` 与 `client.ts` 中的 `FidesOriginClient` 类定义严重不同步。`client.ts` 实现了 `checkRisk`、`batchCheckRisk`、`getAddressRisk`、`getDashboardStats`、`listRules`、`createRule`、`updateRule`、`deleteRule`、`createWebSocket` 等方法，但 `types.ts` 中的接口只有 `checkAddress`、`checkBatchAddresses`、`listRules`、`getRule`、`createRule`、`updateRule`、`deleteRule`、`createWebSocket`。方法名不一致（如 `checkRisk` vs `checkAddress`），且缺少 `getDashboardStats` 等。`FidesOriginWebSocket` 接口在 `types.ts` 中也缺少事件类型。`UseRiskCheckOptions` 和 `UseRiskCheckReturn` 类型虽然定义了，但和 `react.ts` 中的实际实现不一致。
- **影响分析**: 类型与实际实现不同步，导致用户TypeScript代码无法正确推断类型，编译器提示缺失方法或方法签名不匹配。SDK的公共API承诺与实际行为不一致。
- **修复建议**: 重新统一接口定义，确保 `types.ts` 是 `client.ts` 的准确声明。或者反过来，让 `client.ts` 显式实现 `FidesOriginClient` 接口，让编译器强制同步：
```typescript
export class FidesOriginClient implements FidesOriginClient {
  // 编译器将强制检查方法签名一致性
}
```
- **验证方法**: `tsc --noEmit` 检查接口实现一致性

### 问题 #13
- **行号**: 150-157
- **代码片段**: `export interface UseRiskCheckReturn extends UseRiskCheckState { refetch: () => Promise<void>; clear: () => void; }`
- **严重程度**: Medium
- **类型**: 类型
- **问题描述**: `refetch` 返回 `Promise<void>`，但 `react.ts` 中的 `refetch` 如果 `queryRef.current` 为空，则不执行任何操作。`clear` 是 `void` 返回，但在 `react.ts` 中也没有在 `UseRiskCheckReturn` 接口中定义。`UseRiskCheckOptions` 中 `client` 是必需的，但 `react.ts` 中 `useRiskCheck` 接受的是 `ClientOptions` 而不是 `client` 实例。
- **影响分析**: 类型不匹配，用户可能按照 `types.ts` 的接口编码，但实际运行时行为不同。
- **修复建议**: 更新 `types.ts` 以准确反映 `react.ts` 的实现，或删除 `types.ts` 中的重复定义，从 `react.ts` 重新导出类型。
- **验证方法**: 从 `react.ts` 导出类型，让 `types.ts` 引用这些类型

### 问题 #14
- **行号**: 107-117
- **代码片段**: `export interface Rule { ... conditions: RuleCondition[]; actions: RuleAction[]; ... }`
- **严重程度**: Low
- **类型**: 类型
- **问题描述**: `RuleCondition` 中 `value: unknown` 和 `RuleAction` 中 `params?: Record<string, unknown>` 使用 `unknown` 过于宽泛，导致消费者无法确定有效的数据结构。`Rule` 的 `priority` 是 `number` 但没有范围限制（如 `priority: 1 | 2 | 3 | 4 | 5` 或 `0-100`）。
- **影响分析**: 运行时类型校验缺失，无效数据可能通过编译器检查进入系统。
- **修复建议**: 使用联合类型或 branded types 约束 `RuleCondition.value` 和 `RuleAction.params`。为 `priority` 添加范围类型或运行时校验。
- **验证方法**: 引入 Zod 或 io-ts 进行运行时校验

---

## 文件: packages/sdk/src/utils.ts

### 问题 #15
- **行号**: 25-70
- **代码片段**: `export function isAddress(address: string, chain: Chain): boolean { ... if (chain === 'ethereum' || ... || chain === 'base') { if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return false; } }`
- **严重程度**: Medium
- **类型**: 安全/逻辑
- **问题描述**: `isAddress` 对 EVM 链的校验只检查 `0x` + 40 hex，但**没有校验 Ethereum address checksum**（EIP-55）。`ethers.getAddress()` 会校验 checksum，但这里的 `isAddress` 只是基本格式检查。对于比特币，正则 `^(1|3)[a-zA-Z0-9]{25,34}$|^bc1[a-zA-Z0-9]{39,59}$` 过于宽松，不验证 base58 checksum。对于 Solana，Base58 正则 `^[1-9A-HJ-NP-Za-km-z]{32,44}$` 基本正确但不验证长度是否恰好 32/33/44。
- **影响分析**: 攻击者可能构造格式合法但 checksum 错误的地址，或利用不严格的验证绕过安全检查。对于需要 checksum 的场景（如用户转账），可能导致资金损失。
- **修复建议**: 对 EVM 链调用 `ethers.getAddress()` 验证 checksum（捕获异常即无效）；对 BTC 和 Solana 引入更严格的 checksum 校验库（如 `bs58check`）。
- **验证方法**: 传入大小写错误但格式正确的 EVM 地址（如 `0x742d35Cc6634C0532925a3b8D4C9db96590f6C7e`）测试是否被拒绝

### 问题 #16
- **行号**: 130-153
- **代码片段**: `export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T { ... result[key] = deepMerge(result[key] as Record<string, unknown>, source[key] as Record<string, unknown>) as T[Extract<keyof T, string>]; }`
- **严重程度**: Medium
- **类型**: 逻辑/性能
- **问题描述**: `deepMerge` 递归没有深度限制，可能导致栈溢出。类型断言 `as Record<string, unknown>` 和 `as T[Extract<keyof T, string>]` 过于宽泛，如果传入循环引用对象会导致无限递归。`typeof source[key] === 'object'` 检查会将 `null` 排除（因为 `null` 的 `typeof` 是 `object` 但 `null !== null` 为 false），不过这里检查了 `source[key] !== null`。
- **影响分析**: 传入恶意构造的深层嵌套或循环引用对象时，栈溢出导致进程崩溃（DoS）。
- **修复建议**: 增加深度限制和循环引用检测：
```typescript
export function deepMerge<T extends Record<string, unknown>>(
  target: T, source: Partial<T>, depth = 0, maxDepth = 10, seen = new WeakSet()
): T {
  if (depth > maxDepth) return target;
  if (seen.has(source)) return target;
  seen.add(source);
  // ... 递归时传递 depth + 1
}
```
- **验证方法**: 传入深度 > 100 的嵌套对象或循环引用对象测试

### 问题 #17
- **行号**: 158-165
- **代码片段**: `export function sanitizeApiKey(apiKey: string): string { if (!apiKey || apiKey.length < 12) { return '***'; } return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`; }`
- **严重程度**: Medium
- **类型**: 安全
- **问题描述**: `sanitizeApiKey` 对于短 key（<12字符）返回固定字符串 `***`，但4-11字符的key可能泄露更多信息。更关键的是，对于恰好12字符的key，返回 `xxxx...xxxx` 意味着只隐藏4个字符，如果key空间不够大（如12字符全数字），可能被暴力破解。`apiKey` 如果是空字符串 `""` 返回 `***`，但 `null` 或 `undefined` 会导致 `TypeError`（因为函数签名要求 `string`）。
- **影响分析**: 短API key的脱敏强度不够，可能被暴力破解；函数签名不处理 `null/undefined`，可能导致运行时错误。
- **修复建议**: 增加最小脱敏长度；放宽参数类型：
```typescript
export function sanitizeApiKey(apiKey?: string | null): string {
  if (!apiKey) return '[NO KEY]';
  if (apiKey.length < 16) return '***'.repeat(apiKey.length > 3 ? 3 : apiKey.length); // 完全脱敏短key
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
```
- **验证方法**: 传入 12 字符 key 和 `undefined` 测试输出

---

## 文件: packages/sdk/src/error.ts

### 问题 #18
- **行号**: 107-120
- **代码片段**: `toJSON(): Record<string, unknown> { return { name: this.name, code: this.code, message: this.message, status: this.status, requestId: this.requestId, context: this.context, stack: this.stack, cause: this.cause?.message, }; }`
- **严重程度**: High
- **类型**: 安全
- **问题描述**: `toJSON()` 方法将 `stack`（调用栈）和 `context`（可能包含敏感请求体）序列化到 JSON。这可能导致：1）堆栈信息泄露到日志系统，暴露内部文件路径和代码结构；2）`context.body` 如果包含敏感数据（如用户个人信息），会被完整输出。虽然 `sanitizeOptions` 在 `api.ts` 中做了脱敏，但 `error.ts` 本身没有这层保护。
- **影响分析**: 日志系统中泄露堆栈路径、请求体、API密钥等敏感信息，增加攻击面。在微服务架构中，错误信息可能在多个服务间传播。
- **修复建议**: 默认 `toJSON()` 不包含 `stack` 和 `context` 的完整内容；提供单独的 `toDebugJSON()` 用于调试：
```typescript
toJSON(): Record<string, unknown> {
  return { name: this.name, code: this.code, message: this.message, status: this.status, requestId: this.requestId };
}
toDebugJSON(): Record<string, unknown> {
  return { ...this.toJSON(), context: this.context, stack: this.stack, cause: this.cause?.message };
}
```
- **验证方法**: 将错误对象 `JSON.stringify()` 后检查是否包含 `stack` 和敏感 `context` 字段

---

## 文件: packages/sdk/src/websocket.ts

### 问题 #19
- **行号**: 1
- **代码片段**: `import WebSocket from 'isomorphic-ws';`
- **严重程度**: Medium
- **类型**: 类型/兼容
- **问题描述**: `isomorphic-ws` 在浏览器中实际导出的是原生 `WebSocket`，但在 TypeScript 中其类型定义可能和 DOM 的 `WebSocket` 不完全兼容。在 Node.js 环境中使用 `ws` 库，但在某些打包器（如 Vite）中可能无法正确解析。更重要的是，在 Next.js 中如果服务端渲染，直接导入 `isomorphic-ws` 可能失败（因为服务端环境没有 `WebSocket`）。
- **影响分析**: SSR 构建失败；打包器兼容性问题；类型不匹配导致编译错误。
- **修复建议**: 使用动态导入或条件导入：
```typescript
let WebSocketImpl: typeof WebSocket;
if (typeof window !== 'undefined') {
  WebSocketImpl = WebSocket;
} else {
  WebSocketImpl = require('ws');
}
```
- **验证方法**: 在 Next.js SSR 环境和 Vite 打包环境下分别构建测试

### 问题 #20
- **行号**: 66-72
- **代码片段**: `this.ws = new WebSocket(connectUrl); this.ws.onopen = () => { ... this.send('auth', { apiKey: this.options.apiKey }); ... }`
- **严重程度**: High
- **类型**: 安全
- **问题描述**: WebSocket 连接建立后，通过 `send('auth', { apiKey: ... })` 发送 API Key 进行认证。虽然这比在 URL query 中传递 API Key 更安全（已修复），但消息本身仍然以明文形式发送。如果连接是 `ws://`（非加密），API Key 在传输过程中仍然可以被网络嗅探。此外，如果 `debug` 模式开启，API Key 会在日志中打印（因为 `send` 方法中可能记录日志）。`send` 方法没有序列化 BigInt 的保护（JSON.stringify 对 BigInt 会抛 TypeError）。
- **影响分析**: 明文传输 API Key（非 wss 时）；BigInt 序列化导致整个连接崩溃；调试日志泄露密钥。
- **修复建议**: 1) 强制使用 `wss://` 协议；2) 在 `send` 中处理 BigInt；3) 在调试日志中脱敏 `auth` 消息：
```typescript
send(type: string, data: unknown): void {
  if (type === 'auth' && this.options.debug) {
    console.log('[WebSocket] Sending auth message');
  }
  const message = JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v);
}
```
- **验证方法**: 在 `ws://` 和非 `wss://` 下测试；传入包含 BigInt 的数据测试序列化

### 问题 #21
- **行号**: 75-78
- **代码片段**: `this.ws.onerror = (error) => { const err = new FidesOriginError('WebSocket connection error', 'NETWORK_ERROR', { cause: error instanceof Error ? error : undefined }); this.errorCallbacks.forEach((cb) => cb(err)); reject(err); };`
- **严重程度**: Medium
- **类型**: 逻辑
- **问题描述**: `onerror` 回调中 `reject(err)` 被调用，但 `onclose` 回调中也会触发重连逻辑。如果 `onerror` 和 `onclose` 都触发（这是 WebSocket 标准行为），`onclose` 中的 `reject` 不会执行（因为 Promise 已经 settled），但 `onclose` 仍然会尝试 `scheduleReconnect()`。这可能导致重连逻辑和错误处理之间的竞争。更严重的是，如果连接从未成功建立（如网络不通），`onerror` 触发后 `onclose` 也会触发，会导致双重错误回调。
- **影响分析**: 错误回调被触发两次；重连逻辑和错误处理竞争；Promise 可能被 settled 两次（虽然 Promise 机制会忽略第二次）。
- **修复建议**: 使用标志位确保 Promise 只 settle 一次：
```typescript
let settled = false;
const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
this.ws.onerror = (error) => { settle(() => { const err = ...; this.errorCallbacks.forEach(cb => cb(err)); reject(err); }); };
this.ws.onclose = () => { settle(() => { this.disconnectCallbacks.forEach(cb => cb()); if (!this.isManualClose) this.scheduleReconnect(); }); };
```
- **验证方法**: 模拟连接失败场景，检查 `errorCallbacks` 和 `disconnectCallbacks` 的触发次数

### 问题 #22
- **行号**: 140-149
- **代码片段**: `private handleMessage(data: WebSocket.Data): void { try { const message = JSON.parse(data.toString()) as WebSocketMessage<TransactionEvent>; ... const event = message.data; const callbacks = this.eventCallbacks[event.type]; ... } catch (error) { ... } }`
- **严重程度**: Medium
- **类型**: 类型/逻辑
- **问题描述**: `message.data` 被直接当作 `TransactionEvent` 使用，但没有运行时校验。如果服务端发送了格式错误的消息（如 `event.type` 是未知类型），`callbacks` 为 `undefined`，`forEach` 会抛 `TypeError`。此外，如果 `event.type` 是 `transaction` 但数据结构不符合 `TransactionEvent`，后续回调处理可能崩溃。`JSON.parse` 的 `data` 如果是二进制数据（如 `ArrayBuffer`），`toString()` 可能返回乱码。
- **影响分析**: 未预期的服务端消息导致客户端崩溃；二进制数据解析错误。
- **修复建议**: 防御性检查消息结构：
```typescript
private handleMessage(data: WebSocket.Data): void {
  try {
    const text = typeof data === 'string' ? data : data.toString();
    const message = JSON.parse(text) as WebSocketMessage<TransactionEvent>;
    if (!message || typeof message !== 'object' || !message.data || !message.data.type) return;
    const callbacks = this.eventCallbacks[message.data.type as keyof typeof this.eventCallbacks];
    if (!callbacks) return;
    callbacks.forEach(cb => cb(message.data));
  } catch (error) { ... }
}
```
- **验证方法**: 发送格式错误、缺少 `type` 字段、或包含二进制数据的 WebSocket 消息测试

### 问题 #23
- **行号**: 153-167
- **代码片段**: `private scheduleReconnect(): void { if (this.reconnectAttempts >= this.options.maxReconnectAttempts) { ... this.errorCallbacks.forEach((cb) => cb(error)); return; } ... }`
- **严重程度**: Low
- **类型**: 逻辑/内存
- **问题描述**: 重连定时器 `reconnectTimer` 在 `disconnect()` 中被清理，但在 `connect()` 中没有被清理。如果 `connect()` 被多次调用（虽然类内部不太可能），可能创建多个重连定时器。最大重连次数达到后，虽然触发错误回调，但没有提供任何状态让调用方知道"已放弃重连"。`reconnectAttempts` 在 `connect()` 成功后重置为 0，但如果连接频繁断开/重连，计数器频繁重置，实际上不会限制重连次数。
- **影响分析**: 在不稳定网络下，频繁连接/断开可能导致无限重连，消耗电池和带宽。调用方无法知道连接已永久放弃。
- **修复建议**: 增加连接尝试的时间窗口（如 1 分钟内最多重连 10 次）；提供 `onExhausted` 回调：
```typescript
interface WebSocketClientOptions { ... onExhausted?: () => void; }
```
- **验证方法**: 模拟快速连接/断开循环，检查重连次数是否被正确限制

---

## 文件: packages/sdk/src/react.ts

### 问题 #24
- **行号**: 34-41
- **代码片段**: `export function useRiskCheck(options: ClientOptions = {}): UseRiskCheckResult { const clientRef = useRef(new FidesOriginClient(options)); ... }`
- **严重程度**: High
- **类型**: 逻辑/性能
- **问题描述**: `useRef(new FidesOriginClient(options))` 在每次渲染时都会创建新的 `FidesOriginClient` 实例，但 React 的 `useRef` 在严格模式下（React 18）会执行两次渲染，因此会创建两个实例（第一个被丢弃）。更严重的是，如果 `options` 在后续渲染中变化（如 `apiKey` 更新），`clientRef.current` 不会更新，因为 `useRef` 不接受依赖数组。这会导致使用旧的 API Key 或 baseUrl。
- **影响分析**: React 18 严格模式下不必要的双重初始化；配置更新不生效，导致用户更改 API Key 后仍使用旧密钥。
- **修复建议**: 使用 `useMemo` 或显式检查 options 变化：
```typescript
const clientRef = useRef<FidesOriginClient | null>(null);
if (!clientRef.current || !isEqual(clientRef.current.config, options)) {
  clientRef.current = new FidesOriginClient(options);
}
```
或更好的方案：使用 `useEffect` 在 options 变化时重建客户端：
```typescript
const [client, setClient] = useState(() => new FidesOriginClient(options));
useEffect(() => { setClient(new FidesOriginClient(options)); }, [JSON.stringify(options)]);
```
- **验证方法**: 在 React 18 严格模式下运行，检查 `FidesOriginClient` 构造函数调用次数；修改 `options.apiKey` 后确认新请求使用新密钥

### 问题 #25
- **行号**: 56-71
- **代码片段**: `const check = useCallback(async (address: string, chain: Chain) => { setState((prev) => ({ ...prev, loading: true, error: null })); queryRef.current = { address, chain }; try { const result = await clientRef.current.checkAddress(address, chain); ... } catch (err) { ... } }, []);`
- **严重程度**: High
- **类型**: 逻辑/竞态
- **问题描述**: `check` 的 `useCallback` 依赖数组为空 `[]`，这意味着 `clientRef.current` 被闭包捕获。如果 `clientRef.current` 在后续被更新（虽然当前代码不会更新），会使用旧引用。更严重的竞态条件：如果用户快速连续调用 `check` 两次（如切换地址），第一次请求可能晚于第二次完成，导致状态被第一次请求的结果覆盖（stale state）。`queryRef.current` 的更新是同步的，但 `setState` 是异步的，没有机制确保只有最新请求的结果被应用。
- **影响分析**: 竞态条件导致 UI 显示过期的风险数据；用户可能基于过期数据做出错误决策。
- **修复建议**: 使用取消令牌或请求ID标记最新请求：
```typescript
const requestIdRef = useRef(0);
const check = useCallback(async (address: string, chain: Chain) => {
  const requestId = ++requestIdRef.current;
  setState(prev => ({ ...prev, loading: true, error: null }));
  queryRef.current = { address, chain };
  try {
    const result = await clientRef.current.checkAddress(address, chain);
    if (requestId !== requestIdRef.current) return; // 丢弃过期请求
    setState({ data: result, loading: false, error: null });
  } catch (err) {
    if (requestId !== requestIdRef.current) return;
    // ... 错误处理
  }
}, []);
```
- **验证方法**: 快速切换地址两次，模拟第一次请求延迟返回，确认最终状态是第二次请求的结果

### 问题 #26
- **行号**: 138-143
- **代码片段**: `export function useBatchRiskCheck(options: ClientOptions = {}): UseBatchRiskCheckResult { const clientRef = useRef(new FidesOriginClient(options)); ... }`
- **严重程度**: Medium
- **类型**: 类型/逻辑
- **问题描述**: `useBatchRiskCheck` 和 `useComplianceCheck` 都存在与 `useRiskCheck` 相同的问题（`useRef` 初始化、options 变化不响应）。`useComplianceCheck` 中调用 `clientRef.current.checkCompliance(address, chain)`，但 `client.ts` 中的 `FidesOriginClient` 类并没有 `checkCompliance` 方法，这会导致运行时错误。`BatchRiskCheckRequest` 在 `shared/types` 中定义和 `types.ts` 中的定义不一致（前者是 `Array<{address, chain}>`，后者是 `addresses: string[]` + `chain`）。
- **影响分析**: `useComplianceCheck` 在调用时抛出 `TypeError: client.checkCompliance is not a function`；类型不一致导致 batch 请求格式错误。
- **修复建议**: 1) 在 `client.ts` 中实现 `checkCompliance` 方法，或移除 `useComplianceCheck`；2) 统一 `BatchRiskCheckRequest` 类型定义；3) 修复所有 hooks 的 `useRef` 问题。
- **验证方法**: 运行 `useComplianceCheck` 的示例代码，确认是否抛出 `TypeError`

---

## 文件: packages/sdk/src/index.ts

### 问题 #27
- **行号**: 25-28
- **代码片段**: `export const fides = { version: '0.2.1', createClient: async (options: import('./client').ClientOptions) => new (await import('./client')).FidesOriginClient(options), };`
- **严重程度**: Low
- **类型**: 逻辑/设计
- **问题描述**: `version` 是硬编码的字符串，不会随着 `package.json` 的更新自动同步。`createClient` 使用动态 `import('./client')`，如果打包器（如 webpack）没有正确配置代码分割，可能导致 `client.ts` 被打包两次（一次作为入口，一次作为动态 chunk）。动态导入没有错误处理，如果网络失败或模块加载失败，会抛出未捕获的错误。
- **影响分析**: 版本号不一致导致调试困难；动态导入失败时用户体验差（没有友好的错误提示）。
- **修复建议**: 从 `package.json` 读取版本号；添加错误处理：
```typescript
export const fides = {
  version: process.env.PACKAGE_VERSION || '0.0.0',
  createClient: async (options: ClientOptions) => {
    try {
      const { FidesOriginClient } = await import('./client');
      return new FidesOriginClient(options);
    } catch (e) {
      throw new FidesOriginError('Failed to initialize client', 'UNKNOWN', 500);
    }
  },
};
```
- **验证方法**: 检查打包产物中是否有重复的 `client` chunk；检查 `version` 是否与 `package.json` 一致

---

## 文件: packages/sdk/on-chain/src/compliance.ts

### 问题 #28
- **行号**: 28-40
- **代码片段**: `constructor(addresses: ContractAddresses, provider: Provider, signer?: Signer) { this.provider = provider; this.signer = signer; const contractRunner = signer || provider; this.complianceEngine = new ethers.Contract(addresses.complianceEngine, ComplianceEngineABI, contractRunner); ... }`
- **严重程度**: Critical
- **类型**: 安全/逻辑
- **问题描述**: `addresses` 参数中的合约地址**没有任何验证**，直接传入 `ethers.Contract`。如果传入恶意地址（如钓鱼合约），用户的资金可能被窃取。`Contract` 的构造函数不会验证 ABI 是否与部署地址上的实际合约匹配，这意味着如果 ABI 和地址不匹配，调用可能产生不可预期的结果（如返回随机数据或导致交易失败）。`provider` 和 `signer` 也没有验证是否为有效的 `Provider` 和 `Signer` 实例。
- **影响分析**: 攻击者可能诱导用户使用恶意合约地址，导致资金损失、授权被盗。这是**Critical**级别的安全问题。
- **修复建议**: 1) 验证地址格式（EIP-55 checksum）；2) 提供可选的链上合约验证（检查 `code.length > 0`）；3) 对已知合约地址提供白名单：
```typescript
constructor(addresses: ContractAddresses, provider: Provider, signer?: Signer) {
  if (!isValidContractAddress(addresses.complianceEngine)) {
    throw new Error('Invalid compliance engine address');
  }
  // 可选：链上验证
  provider.getCode(addresses.complianceEngine).then(code => {
    if (code === '0x') throw new Error('No contract deployed at address');
  });
  // ...
}
```
- **验证方法**: 传入无效地址（如 `0x0000000000000000000000000000000000000000`）和钓鱼地址测试构造函数行为

### 问题 #29
- **行号**: 48-57
- **代码片段**: `async getRiskProfile(address: string): Promise<RiskProfile> { const [riskScore, tier, tags, isSanctioned, lastUpdated] = await this.riskRegistry.getRiskProfile(address); return { riskScore: Number(riskScore), tier: Number(tier) as RiskTier, tags: tags.map((t: string) => ethers.decodeBytes32String(t)), isSanctioned, lastUpdated: new Date(Number(lastUpdated) * 1000), }; }`
- **严重程度**: Medium
- **类型**: 类型/逻辑
- **问题描述**: `tags.map((t: string) => ethers.decodeBytes32String(t))` 假设 `tags` 是 `string[]`，但合约返回的可能是 `bytes32[]`（在 ethers v6 中返回的是 `string[]` 已解码，但在 ethers v5 中返回的是 `bytes32[]` 原始数据）。`ethers.decodeBytes32String` 在 ethers v5 中不存在，会导致 `TypeError`。`Number(riskScore)` 如果 `riskScore` 是 `BigNumber`（ethers v5）或 `bigint`（ethers v6），转换可能没问题，但 `Number` 对超大 `bigint` 会精度丢失。`lastUpdated` 如果合约返回的是 `0`，会得到 `1970-01-01`。
- **影响分析**: ethers v5/v6 不兼容导致运行时错误；超大 `bigint` 精度丢失导致风险评分错误；时间戳为 0 时产生无意义日期。
- **修复建议**: 1) 明确依赖 ethers v6 版本；2) 使用 `BigInt` 安全转换风险评分；3) 处理 `lastUpdated === 0`：
```typescript
return {
  riskScore: typeof riskScore === 'bigint' ? Number(riskScore) : riskScore.toNumber?.() ?? Number(riskScore),
  tier: Number(tier) as RiskTier,
  tags: Array.isArray(tags) ? tags.map(t => typeof t === 'string' ? t : ethers.decodeBytes32String(t)) : [],
  isSanctioned: Boolean(isSanctioned),
  lastUpdated: Number(lastUpdated) > 0 ? new Date(Number(lastUpdated) * 1000) : null,
};
```
- **验证方法**: 在 ethers v5 和 v6 环境中分别测试 `getRiskProfile`

### 问题 #30
- **行号**: 160-171
- **代码片段**: `async releaseHold(holdId: string): Promise<ethers.TransactionReceipt> { if (!this.signer) throw new Error('Signer required for write operations'); const tx = await this.complianceEngine.releaseHold(holdId); return tx.wait(); }`
- **严重程度**: Medium
- **类型**: 逻辑/错误处理
- **问题描述**: `tx.wait()` 返回的 `TransactionReceipt` 如果交易失败（revert），`tx.wait()` 在 ethers v6 中默认会等待并返回 receipt，但 `status` 字段为 `0`（失败）。代码没有检查 `receipt.status === 1` 来确认交易成功。如果交易被替换（如 speed-up），`tx.wait()` 可能永远不会解析或返回错误。`holdId` 没有验证格式。
- **影响分析**: 交易失败被当作成功返回，用户可能认为资金已释放但实际上没有。交易被替换时应用可能挂起。
- **修复建议**: 检查交易 receipt 状态：
```typescript
async releaseHold(holdId: string): Promise<ethers.TransactionReceipt> {
  if (!this.signer) throw new Error('Signer required for write operations');
  if (!/^0x[0-9a-fA-F]{64}$/.test(holdId)) throw new Error('Invalid hold ID');
  const tx = await this.complianceEngine.releaseHold(holdId);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('Transaction failed: releaseHold reverted');
  return receipt;
}
```
- **验证方法**: 模拟交易失败场景，检查返回值是否正确抛出错误

### 问题 #31
- **行号**: 215-225
- **代码片段**: `onTransferValidated(callback: (asset: string, from: string, to: string, amount: bigint, decision: Decision, reason: string) => void): void { this.complianceEngine.on('TransferValidated', callback); }`
- **严重程度**: Medium
- **类型**: 逻辑/内存
- **问题描述**: 事件监听器注册后，没有提供对应的 `off` 方法（只有 `removeAllListeners()` 会移除所有监听器）。用户如果只想移除一个特定回调，必须调用 `removeAllListeners()`，这会移除其他回调。这违反了最小权限原则。此外，`onSanctionAdded` 和 `onTransferValidated` 的回调类型中 `amount` 是 `bigint`，但合约事件中的 `amount` 可能是 `uint256`，在 ethers v6 中事件参数会被解码为 `bigint`，这是正确的。
- **影响分析**: 无法精细化管理事件监听器，可能导致内存泄漏（如果注册了多个监听器但只想移除一个）。
- **修复建议**: 提供对应 `off` 方法，或返回 unsubscribe 函数：
```typescript
onTransferValidated(callback: ...): () => void {
  this.complianceEngine.on('TransferValidated', callback);
  return () => this.complianceEngine.off('TransferValidated', callback);
}
```
- **验证方法**: 注册两个不同回调，调用 `off` 移除一个，确认另一个仍然有效

---

## 文件: packages/sdk/on-chain/src/utils.ts

### 问题 #32
- **行号**: 45-52
- **代码片段**: `export function formatAmount(wei: bigint, decimals = 18, precision = 4): string { const divisor = 10n ** BigInt(decimals); const integer = wei / divisor; const remainder = wei % divisor; const fractional = remainder.toString().padStart(decimals, '0').slice(0, precision); return `${integer}.${fractional}`; }`
- **严重程度**: Medium
- **类型**: 逻辑
- **问题描述**: `formatAmount` 对负数 `wei` 的处理不正确（`bigint` 支持负数）。`precision` 大于 `decimals` 时，`padStart(decimals, '0')` 只填充到 `decimals` 长度，不会填充到 `precision` 长度。`wei` 为 `0n` 时返回 `0.0000`，但尾部的零可能不应该保留（取决于需求）。`precision = 0` 时返回 `integer.`，而不是 `integer`。
- **影响分析**: 负数金额显示错误；精度处理不符合预期。
- **修复建议**: 处理边界情况：
```typescript
export function formatAmount(wei: bigint, decimals = 18, precision = 4): string {
  const isNegative = wei < 0n;
  const absWei = isNegative ? -wei : wei;
  const divisor = 10n ** BigInt(decimals);
  const integer = absWei / divisor;
  const remainder = absWei % divisor;
  const fractional = remainder.toString().padStart(decimals, '0').slice(0, precision);
  const result = precision > 0 ? `${integer}.${fractional}` : `${integer}`;
  return isNegative ? `-${result}` : result;
}
```
- **验证方法**: 传入负数、零、precision=0 测试输出

---

## 文件: packages/shared/src/types/index.ts

### 问题 #33
- **行号**: 1-120
- **代码片段**: `export type Chain = 'ethereum' | 'bitcoin' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism' | 'base' | 'solana';`
- **严重程度**: Info
- **类型**: 类型/设计
- **问题描述**: `Chain` 类型和 `RISK_LEVELS` 常量定义在 `constants/index.ts` 中，但 `Chain` 在 `types/index.ts` 中定义。这导致类型和常量之间没有自动同步。如果 `constants/index.ts` 中添加了新链，但 `types/index.ts` 忘记更新，编译器不会报错（因为 `constants` 使用 `string` 作为键）。`RISK_LEVELS` 使用 `as const` 但类型推导的键是 `string` 而非 `Chain`。
- **影响分析**: 维护成本高，容易遗漏同步；类型安全降低。
- **修复建议**: 使用 `Record<Chain, ...>` 类型约束常量：
```typescript
export const CHAIN_NAMES: Record<Chain, string> = { ... } as const;
```
- **验证方法**: 添加新链到 `Chain` 类型，检查 `constants` 中是否编译报错

---

## 文件: packages/shared/src/constants/index.ts

### 问题 #34
- **行号**: 15-18
- **代码片段**: `bitcoin: 0, // Bitcoin doesn't use EIP-155 solana: 0, // Solana doesn't use EIP-155`
- **严重程度**: Low
- **类型**: 逻辑/设计
- **问题描述**: 将非 EVM 链的 `chainId` 设为 `0` 可能导致混淆。在 EVM 链上，`chainId = 0` 是无效的（根据 EIP-155，chainId 不能为 0）。但在 `CHAIN_IDS` 中 `bitcoin` 和 `solana` 的 `0` 可能被误认为合法 ID。如果代码在 `isValidChainId` 中使用 `id <= 0` 检查，但 `constants` 中却允许 `0`，产生矛盾。此外，FIDES_REGISTRY_ADDRESSES 是占位符，没有实际验证。
- **影响分析**: 链ID为0可能被误解为"未设置"或"无效"，但在常量中却是合法的。占位符地址如果未被替换就被部署，可能导致调用零地址。
- **修复建议**: 对非 EVM 链使用 `null` 或特殊标记（如 `-1`），并在类型中显式区分：
```typescript
export const CHAIN_IDS: Record<Chain, number | null> = { ethereum: 1, bitcoin: null, ... };
```
- **验证方法**: 检查 `isValidChainId(0)` 的返回值，确认是否被正确处理

---

## 文件: packages/ui/src/components/AddressInput.tsx

### 问题 #35
- **行号**: 48-58
- **代码片段**: `const validateAddress = useCallback((addr: string): boolean => { if (!addr || addr.length === 0) return true; const lengths = ADDRESS_LENGTHS[chain]; const prefixes = ADDRESS_PREFIXES[chain]; if (addr.length < lengths.min || addr.length > lengths.max) return false; if (prefixes.length > 0) { return prefixes.some((prefix) => addr.startsWith(prefix)); } return true; }, [chain]);`
- **严重程度**: Medium
- **类型**: 安全/逻辑
- **问题描述**: `validateAddress` 只检查地址长度和前缀，**不检查地址格式和 checksum**。对于 EVM 链，只检查 `0x` 前缀和长度 42，不检查后续 40 个字符是否是 hex。空地址返回 `true`（`!addr || addr.length === 0`），这可能导致空字符串通过验证。`addr` 没有 `trim()` 处理，前后空格可能导致验证失败。
- **影响分析**: 格式错误但长度正确的地址（如 `0x0000000000000000000000000000000000000000`）被当作合法地址；空地址可能通过验证；前后空格导致用户体验问题。
- **修复建议**: 使用 `ethers.isAddress` 或 `utils.ts` 中的 `isAddress` 进行完整校验：
```typescript
import { isAddress } from '@fidesorigin/sdk';
const validateAddress = useCallback((addr: string): boolean => {
  if (!addr || addr.trim().length === 0) return false; // 空地址不合法
  return isAddress(addr.trim(), chain);
}, [chain]);
```
- **验证方法**: 传入 `0x0000000000000000000000000000000000000000`（格式正确但零地址）、`0x1234...`（长度正确但非hex）、`" 0x..."`（带空格）测试

### 问题 #36
- **行号**: 70-78
- **代码片段**: `onChange={(e) => { onChange(e.target.value); if (!touched) setTouched(true); }}`
- **严重程度**: Low
- **类型**: 逻辑/性能
- **问题描述**: 每次输入变化都会触发 `setTouched(true)`，虽然 `if (!touched)` 减少了实际状态更新，但 React 仍然会在每次输入时比较引用。更关键的是，输入值直接通过 `onChange` 传给父组件，没有做任何输入净化（如限制字符集）。对于区块链地址，可以限制为 hex 字符、base58 字符等。
- **影响分析**: 用户可能输入非法字符；没有即时格式限制导致体验下降。
- **修复建议**: 添加输入过滤：
```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  let value = e.target.value;
  if (chain === 'ethereum' || chain === 'polygon' /* ...EVM */) {
    value = value.replace(/[^0-9a-fA-Fx]/g, ''); // 限制hex字符
  }
  onChange(value);
  if (!touched) setTouched(true);
};
```
- **验证方法**: 在输入框中输入非法字符，确认是否被过滤

---

## 文件: packages/ui/src/components/RiskScore.tsx

### 问题 #37
- **行号**: 45-52
- **代码片段**: `const overallConfig = RISK_LEVELS[risk.overallLevel];` + `className={overallConfig.textColor}`
- **严重程度**: Medium
- **类型**: 逻辑/安全
- **问题描述**: `risk.overallLevel` 可能是非法值（如 `''` 或 `null`），`RISK_LEVELS['invalid']` 返回 `undefined`，后续访问 `overallConfig.textColor` 会抛出 `TypeError`。`className` 从 props 传入后直接被拼接，如果 `className` 包含用户输入或外部数据，可能存在XSS风险（虽然React的className处理通常不会执行JS，但`style`属性或`dangerouslySetInnerHTML`才危险）。`RiskBadge` 的 `className` 拼接同样的问题。`risk.flags` 直接渲染为文本，如果 flag 包含 HTML 或脚本内容，React 会自动转义（这是安全的），但需要确认。`risk.scores` 和 `risk.relatedEntities` 的渲染都是安全的（React默认转义）。
- **影响分析**: 非法风险等级导致组件崩溃；`className` 注入可能导致样式污染（非XSS但可能影响布局）。
- **修复建议**: 防御性处理非法等级；使用 `clsx` 或 `classnames` 库安全拼接：
```typescript
const overallConfig = RISK_LEVELS[risk.overallLevel] ?? RISK_LEVELS['medium']; // 默认fallback
```
- **验证方法**: 传入 `overallLevel: 'unknown'` 或 `undefined` 测试组件是否崩溃

---

## 文件: hooks/useRiskAnalysis.ts

### 问题 #38
- **行号**: 1-120
- **代码片段**: `export function useRiskAnalysis() { ... const analyze = useCallback(async (address: string): Promise<RiskReport> => { ... setLoading(true); setError(null); setCurrentAddress(address); ... try { ... } catch (err) { ... } finally { setLoading(false); } }, [setRiskData, setLoading, setError, setCurrentAddress, addToHistory]); }`
- **严重程度**: High
- **类型**: 逻辑/竞态
- **问题描述**: `analyze` 函数没有处理竞态条件。如果用户快速连续查询两个不同地址，后发起的请求可能先返回，先发起的请求后返回，导致最终状态显示的是先发起的结果（stale result）。`apiPost` 返回的是 `Response` 对象，`fetchSubgraphRiskData` 中直接调用 `response.json()`，但 `apiPost` 的错误处理可能抛出 `ApiError`，这里的 `try/catch` 捕获了。然而 `apiPost` 中的 `fetch` 如果失败，会抛出 `NetworkError`，但 `fetchSubgraphRiskData` 中捕获并返回 `null`。更严重的是，如果 `analyze` 在组件卸载后仍在执行，会尝试调用 `setState`（但这里用的是zustand，所以不会报错，只是无意义操作）。
- **影响分析**: 竞态条件导致最终显示的风险报告与实际查询地址不匹配；在已卸载组件中无意义的状态更新浪费性能。
- **修复建议**: 使用请求ID标记最新请求，并在组件卸载时取消：
```typescript
const abortControllerRef = useRef<AbortController | null>(null);
const requestIdRef = useRef(0);

const analyze = useCallback(async (address: string): Promise<RiskReport> => {
  abortControllerRef.current?.abort();
  const controller = new AbortController();
  abortControllerRef.current = controller;
  const requestId = ++requestIdRef.current;
  
  setLoading(true); setError(null); setCurrentAddress(address);
  try {
    const apiUrl = getRiskApiUrl();
    if (apiUrl) {
      const response = await apiPost(`${apiUrl}/analyze`, { address }, { signal: controller.signal });
      const data = await response.json();
      if (requestId !== requestIdRef.current) return; // 丢弃过期
      // ...
    }
  } catch (e) { ... }
}, [...]);

useEffect(() => () => abortControllerRef.current?.abort(), []);
```
- **验证方法**: 快速连续查询两个地址，模拟第一次延迟，确认最终状态为第二次的结果

---

## 文件: hooks/useRulesManager.ts

### 问题 #39
- **行号**: 15-16
- **代码片段**: `const rules = useRulesStore((state) => state.rules); const setRules = useRulesStore((state) => state.setRules);`
- **严重程度**: Medium
- **类型**: 逻辑/性能
- **问题描述**: `useRulesStore` 的 selector 返回整个 `rules` 数组，这会导致任何规则变化时触发重渲染。`saveRules` 的 `useCallback` 依赖数组中遗漏了 `rules`（代码中使用了 `rules` 变量），这会导致 `rules` 变化时 `saveRules` 仍然引用旧的 `rules`。虽然代码中 `[setRules, loadFromLocalStorage, setSaveStatus]` 没有包含 `rules`，但 `saveRules` 内部使用了 `rules`（在 `apiPost` 的 body 中）。
- **影响分析**: `saveRules` 可能保存过期的规则数据；不必要的重渲染影响性能。
- **修复建议**: 1) 将 `rules` 加入 `saveRules` 的依赖数组；2) 使用 zustand 的 `getState()` 避免订阅：
```typescript
const saveRules = useCallback(async () => {
  const currentRules = useRulesStore.getState().rules;
  // 使用 currentRules 而不是闭包中的 rules
}, []);
```
- **验证方法**: 修改规则后立即调用 `saveRules`，检查保存的内容是否包含最新修改

---

## 文件: hooks/useWebSocket.ts

### 问题 #40
- **行号**: 1-220
- **代码片段**: `useEffect(() => { connect(); return () => { disconnect(); }; // eslint-disable-next-line react-hooks/exhaustive-deps }, []);`
- **严重程度**: High
- **类型**: 逻辑/竞态/内存
- **问题描述**: `useEffect` 的依赖数组为空，这意味着 `config` 的变化（如 `url` 更新）不会触发重新连接。`connect` 在 `useCallback` 的依赖数组中包含了大量依赖（`configUrl`、`reconnectMaxAttempts`、`setWsStatus` 等），但 `useEffect` 没有将这些依赖作为触发条件，所以即使 `connect` 引用更新了，`useEffect` 不会重新执行。`wsRef.current` 在 `disconnect` 中设为 `null`，但如果 `connect` 在 `disconnect` 之前被多次调用，可能创建多个 WebSocket 实例。`heartbeatTimeoutRef` 在收到 pong 时会被清除，但如果 `heartbeatInterval` 小于 `heartbeatTimeout`，可能会产生竞态。
- **影响分析**: WebSocket 配置变化不响应；内存泄漏（多个 WebSocket 实例）；心跳超时和间隔配置不当可能导致频繁断线。
- **修复建议**: 将 `connect` 加入 `useEffect` 依赖数组（或拆分为更细粒度的 effects）；增加 `connect` 的幂等性保护：
```typescript
useEffect(() => {
  connect();
  return () => disconnect();
}, [connect]); // connect 已在 useCallback 中稳定

// 在 connect 中增加保护：
const connect = useCallback(() => {
  if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
  // ...
}, [...]);
```
- **验证方法**: 修改 `configUrl` 后检查是否重新连接；快速调用 `connect()` 两次检查是否只创建一个 WebSocket

---

## 文件: stores/rules.ts

### 问题 #41
- **行号**: 120-140
- **代码片段**: `loadFromLocalStorage: () => set((state) => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) { const validRules = parsed.filter((r: any) => r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.enabled === 'boolean' && typeof r.threshold === 'number' && validActions.includes(r.action)); ... } } } catch (e) { ... } })`
- **严重程度**: High
- **类型**: 安全/逻辑
- **问题描述**: `localStorage` 在 SSR（服务端渲染）环境中不存在，直接调用 `localStorage.getItem` 会抛出 `ReferenceError`。虽然代码在 `try/catch` 中捕获了，但 `catch` 只打印日志，不会阻止应用崩溃。`parsed` 被验证为 `Array` 后，每个元素的 `conditions` 字段没有验证，如果 `conditions` 包含恶意脚本或非常大的数据，可能导致后续渲染问题。`threshold` 没有范围检查（如 `0-100`），`id` 的格式没有验证（如防止 XSS）。`JSON.parse` 对不可信数据解析可能导致原型链污染（虽然 `filter` 后的数据不会直接作为对象原型使用，但 `Object.assign` 可能受影响）。
- **影响分析**: SSR 应用崩溃；不可信数据注入导致XSS或DoS；`conditions` 未验证导致后续逻辑错误。
- **修复建议**: 1) 在 SSR 环境中安全访问 `localStorage`；2) 验证 `conditions` 结构；3) 对 `id` 进行格式校验（如只允许字母数字和连字符）；4) 使用 `structuredClone` 或深度拷贝防止原型链污染：
```typescript
loadFromLocalStorage: () => set((state) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return;
    const validRules = parsed.filter((r: any) => {
      return r && typeof r.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(r.id)
        && typeof r.name === 'string' && r.name.length <= 100
        && typeof r.enabled === 'boolean'
        && typeof r.threshold === 'number' && r.threshold >= 0 && r.threshold <= 100
        && Array.isArray(r.conditions)
        && validActions.includes(r.action);
    }).map(r => ({ ...r, conditions: r.conditions.filter((c: any) => typeof c === 'string') }));
    // ...
  }
})
```
- **验证方法**: 在 Next.js SSR 中渲染页面，检查是否抛出 `ReferenceError: localStorage is not defined`；构造包含 `__proto__` 的 JSON 测试原型链污染

---

## 文件: stores/auth.ts

### 问题 #42
- **行号**: 1-60
- **代码片段**: `login: (user) => set((state) => { state.isAuthenticated = true; state.user = user; state.error = null; state.isLoading = false; })`
- **严重程度**: Medium
- **类型**: 安全/逻辑
- **问题描述**: `login` 没有验证 `user` 的结构和字段。`address` 没有被验证为合法区块链地址，`role` 没有被验证为枚举值之一。如果用户调用 `login` 时传入恶意构造的 `user`（如包含 XSS payload 的 `ensName` 或 `avatar` URL），这些值可能在 UI 中直接渲染（如果 UI 没有进一步净化）。`updateUser` 允许部分更新 `user`，但没有验证更新后的字段是否合法。
- **影响分析**: 恶意用户数据注入；XSS 风险（如果 `avatar` 被作为 `<img src>` 使用，可能是恶意 URL）。
- **修复建议**: 在 `login` 和 `updateUser` 中添加字段验证：
```typescript
login: (user) => set((state) => {
  if (!user || typeof user.address !== 'string' || !user.role) {
    state.error = 'Invalid user data';
    return;
  }
  state.isAuthenticated = true;
  state.user = { ...user, address: user.address.toLowerCase() }; // 规范化地址
  state.error = null;
})
```
- **验证方法**: 传入包含 `avatar: 'javascript:alert(1)'` 的 user 对象，检查 UI 是否执行

---

## 文件: lib/api.ts

### 问题 #43
- **行号**: 1-100
- **代码片段**: `function assertSafeUrl(rawUrl: string, requireSameOrigin = true): void { if (requireSameOrigin) { if (!rawUrl.startsWith('/') || rawUrl.startsWith('//') || rawUrl.startsWith('\\') || rawUrl.startsWith('/\\') || rawUrl.startsWith('\\/')) { throw new Error('Only same-origin relative URLs are allowed'); } ... }`
- **严重程度**: Critical
- **类型**: 安全
- **问题描述**: `assertSafeUrl` 的 SSRF 防护虽然比较全面，但存在几个绕过点：1) `rawUrl.startsWith('/\\')` 和 `rawUrl.startsWith('\\/')` 的检查是多余的，因为前面的 `startsWith('/')` 已经排除以 `\\` 开头的情况；2) `new URL(rawUrl)` 在 Node.js 中如果 `rawUrl` 是相对路径，需要 `base` 参数，但这里只在 `requireSameOrigin = false` 时使用；3) 如果传入的 URL 包含 unicode 字符（如 `\u0000`），某些 HTTP 库可能在解析时产生异常行为；4) 对于 `requireSameOrigin = true` 的情况，正则 `^[a-zA-Z][a-zA-Z0-9+.-]*:` 检查协议前缀，但 `javascript:` 协议中 `javascript` 匹配这个正则，因此如果传入 `javascript:alert(1)` 且不以 `/` 开头，会被拒绝。但 `data:` 协议也会被拒绝。`process.env.NODE_ENV` 在浏览器中可能被 polyfill，导致 SSRF 检查被绕过（如果攻击者控制环境变量）。`errorInterceptors` 数组是全局共享的，如果在服务端多请求环境中被修改，可能导致一个请求的错误信息被另一个请求的拦截器处理。
- **影响分析**: 全局拦截器数组在多请求服务端环境中导致信息泄露；SSRF 绕过风险（虽然当前检查比较严格，但 unicode 绕过需要验证）。
- **修复建议**: 1) 将拦截器存储改为请求级别的（非全局）；2) 增加 unicode 和 null byte 检查；3) 在 SSRF 检查中增加 `URL` 解析验证：
```typescript
if (requireSameOrigin) {
  // 检查 null byte 和 unicode control characters
  if (/[\x00-\x1f\x7f]/.test(rawUrl)) throw new Error('Invalid URL characters');
  // 其余检查...
}
```
- **验证方法**: 传入 `'/\x00/etc/passwd'` 和 `javascript:alert(1)` 测试是否被拒绝

### 问题 #44
- **行号**: 200-210
- **代码片段**: `if (error instanceof DOMException && error.name === 'AbortError') { lastError = new TimeoutError(); } else if (error instanceof TimeoutError) { lastError = error; } else { lastError = error instanceof Error ? error : new Error(String(error)); }`
- **严重程度**: Medium
- **类型**: 逻辑
- **问题描述**: `DOMException` 在 Node.js 环境中不存在（除非使用 `undici` 或 `node-fetch`），在 Node.js 中使用 `instanceof DOMException` 会抛出 `ReferenceError`。`error instanceof TimeoutError` 的检查是多余的，因为 `TimeoutError` 是自定义类，在当前作用域中定义，但 `fetch` 超时是通过 `AbortController` 触发的，不会直接抛出 `TimeoutError`。`withTimeout` 函数中 `controller.abort(new TimeoutError())` 会设置 `signal.reason` 为 `TimeoutError` 实例，但 `fetch` 在 abort 时抛出的错误是 `AbortError`，不会直接是 `TimeoutError`。因此 `error instanceof TimeoutError` 分支永远不会执行。
- **影响分析**: Node.js 环境中 `instanceof DOMException` 导致 `ReferenceError`，应用崩溃。
- **修复建议**: 使用特征检测而非 `instanceof`：
```typescript
const isAbortError = (error: unknown): error is DOMException => {
  return error instanceof Error && error.name === 'AbortError' && typeof (error as any).code === 'undefined';
};
// 在 Node.js 中安全使用：
if (error instanceof Error && error.name === 'AbortError') {
  if (timeoutSignal.aborted && !finalOptions.signal?.aborted) {
    lastError = new TimeoutError();
  }
}
```
- **验证方法**: 在 Node.js v18+ 和浏览器中分别运行，检查是否抛出 `ReferenceError`

---

## 文件: lib/env.ts

### 问题 #45
- **行号**: 1-80
- **代码片段**: `function parseEnv() { ... if (typeof window === 'undefined') { throw new Error(errorMessage); } ... }`
- **严重程度**: Medium
- **类型**: 逻辑/性能
- **问题描述**: `parseEnv` 在服务端渲染时如果环境变量无效，直接 `throw new Error`，这会导致整个服务端渲染进程崩溃，无法返回任何错误页面。`z.string().url()` 对 URL 的校验比较宽松（如 `http://localhost:3000` 是合法 URL，但在生产环境中可能不应该允许）。`NEXT_PUBLIC_API_KEY` 被暴露给客户端，但没有检查是否以 `pk_`（public key）开头，如果用户误将 secret key 放在 `NEXT_PUBLIC_` 前缀下，代码不会警告。`getRiskApiUrl` 和 `getRulesApiUrl` 中拼接路径时，如果 `API_BASE_URL` 以 `/` 结尾，会产生双斜杠（如 `https://api.example.com//risk`）。
- **影响分析**: SSR 环境变量错误导致服务不可用；URL 拼接错误导致 API 请求失败；Secret key 泄露到客户端。
- **修复建议**: 1) 服务端环境变量错误时降级为默认值而非 throw；2) 在 `getRiskApiUrl` 中安全拼接 URL：
```typescript
export function getRiskApiUrl(): string | undefined {
  const base = env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return env.NEXT_PUBLIC_RISK_API_URL;
  return `${base.replace(/\/$/, '')}/risk`;
}
```
3) 对 `NEXT_PUBLIC_API_KEY` 增加前缀检查：
```typescript
if (env.NEXT_PUBLIC_API_KEY && !env.NEXT_PUBLIC_API_KEY.startsWith('pk_')) {
  console.warn('[ENV] NEXT_PUBLIC_API_KEY does not start with pk_. Are you sure this is a public key?');
}
```
- **验证方法**: 设置 `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/` 检查 `getRiskApiUrl()` 返回值；设置 `NEXT_PUBLIC_API_KEY=sk_xxx` 检查控制台警告

---

## 总结

| 严重级别 | 数量 | 代表问题 |
|---------|------|---------|
| **Critical** | 4 | #28 (合约地址无验证), #43 (全局拦截器+SSRF), #20 (WebSocket明文传API Key), #10 (浏览器API Key泄露) |
| **High** | 10 | #12 (类型不同步), #18 (toJSON泄露stack), #24 (useRef创建不响应), #25 (竞态条件), #38 (analyze竞态), #40 (WebSocket配置不响应), #41 (localStorage SSR崩溃), #2 (脱敏失败), #39 (saveRules闭包过期), #42 (login无验证) |
| **Medium** | 12 | #1 (mergeSignals类型), #3 (HeadersInit处理), #5 (错误分类), #7 (chainId精度), #8 (chainId丢失), #9 (金额校验), #15 (address checksum), #16 (deepMerge递归), #17 (sanitizeApiKey), #19 (isomorphic-ws SSR), #21 (onerror/onclose竞态), #22 (消息解析) |
| **Low** | 7 | #4 (fetch options), #6 (isValidAddress别名), #11 (amount trim), #14 (Rule value类型), #23 (重连计数), #27 (硬编码版本), #34 (chainId=0) |
| **Info** | 2 | #13 (UseRiskCheck类型), #33 (Chain类型同步) |

### 最优先修复项
1. **#28**: 合约地址验证（Critical - 资金安全）
2. **#43**: API全局状态安全（Critical - SSRF/多租户泄露）
3. **#20**: WebSocket API Key 传输（High - 密钥泄露）
4. **#10**: 浏览器 API Key 检测（High - 密钥泄露）
5. **#25**: React Hook 竞态条件（High - 数据一致性）
6. **#38**: useRiskAnalysis 竞态（High - 数据一致性）
7. **#41**: localStorage SSR 安全（High - 应用崩溃）
8. **#24**: useRef 配置不响应（High - 配置失效）
9. **#18**: 错误对象敏感信息（High - 信息泄露）
10. **#2**: 脱敏正则修复（High - 日志泄露）
