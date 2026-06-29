# FidesOrigin 数据架构层深度审计报告

**审计日期**: 2026-06-26
**审计范围**:
- `data-publisher/src/batch-collector.ts`
- `data-publisher/src/batch-scheduler.ts`
- `data-publisher/src/ofac-fetcher.ts`
- `data-publisher/src/opensanctions-collector.ts`
- `data-publisher/src/address-enricher.ts`
- `data-publisher/src/fatf-publisher.ts`
- `data-publisher/src/fatf-scheduler.ts`
- `data-publisher/src/fatf-collector.ts`
- `synced-addresses.json`

**TypeScript 编译状态**: ✅ 通过 (`tsc --noEmit` 无错误)

---

## 1. 增量更新逻辑

### 1.1 `fetchOfacDelta()` Delta JSON 格式处理

**状态**: ✅ 正确
- `parseFTMResponse()` 同时支持 JSON Array 和 JSON Lines 格式
- Delta URL 返回的格式与完整 FTM 一致，现有解析逻辑适用

### 1.2 `last_seen` 过滤覆盖范围

**问题**: ScamSniffer 数据源无 `last_seen` 字段
**严重程度**: 中
**影响**: 每次全量下载 2500+ 地址，但通过 `synced-addresses.json` 的本地状态过滤已知地址，实际只处理新增地址。
**修复**: 增强了 `fetchScamSnifferAddresses()` 的地址校验和去重逻辑，拒绝非法格式地址。

### 1.3 本地状态文件并发写入风险

**问题**: `saveState()` 使用非原子 `writeFileSync`，多进程同时读写会导致竞态条件、文件损坏、数据丢失
**严重程度**: 🔴 **严重**
**代码位置**: `batch-collector.ts` 原 `saveState()` 函数
**修复**:
- 引入 PID 文件锁 (`synced-addresses.json.lock`)
- 采用原子写入：先写 `.tmp.PID` → `renameSync` 覆盖目标文件
- 增加备份机制：写入前复制旧文件到 `.bak`
- 增加备份恢复逻辑：`loadState()` 在解析失败时尝试从 `.bak` 恢复

### 1.4 增量模式下的 batch 分组

**状态**: ✅ 正确
- `BATCH_MAX = 100`，循环切片逻辑正确
- 即使 delta 地址很少（如 5 个），也会正确组成 1 个 batch

---

## 2. 地址→国家关联

### 2.1 `buildEntityMap()` 反向引用逻辑

**状态**: ✅ 基本正确
- 使用 `properties` 中所有字段构建反向引用，涵盖 `holder`, `owner`, `ownershipAsset` 等
- `referents` 字段（实体别名/合并列表）未特殊处理，但该字段主要用于去重而非关系查找，不影响国家解析

### 2.2 `resolveOwnerCountry()` fallback 链

**问题**: `extractFirstString()` 无法正确处理 FTM 引用对象格式
**严重程度**: 🔴 **严重**
**根因**: OpenSanctions FTM 中引用对象格式为 `{ "id": "entity-xxx" }`，而代码只检查 `.value` 属性
**影响**: `holder` / `owner` 等直接引用解析为空，导致国家解析回退到反向查找或 UNKNOWN
**修复**: 更新 `extractFirstString()` 同时检查 `value.id` 和 `value.value`
```typescript
if (typeof value === 'object') {
  return (
    value.id?.toString()?.trim() ||
    value.value?.toString()?.trim() ||
    undefined
  );
}
```

### 2.3 `extractWalletAddress()` 地址校验

**问题**: 仅检查 `startsWith('0x') && length === 42`，未校验 hex 字符
**严重程度**: 中
**修复**: 使用 `normalizeAddress()` 工具函数，通过正则 `^0x[0-9a-f]{40}$` 严格校验

### 2.4 国家代码格式一致性

**状态**: ⚠️ 需要注意
- FTM 中的 `country` 可能是全称（"Iran"）或 ISO2（"IR"）
- `address-enricher.ts` 的 `pickPrimaryCountry()` 已处理常见名称映射
- 标签 `country:iran` 使用小写+下划线，与链上 bytes32 hash 兼容（`ethers.id()`）

### 2.5 `country` 标签 bytes32 截断问题

**问题**: `fatf-publisher.ts` 的 `stringToBytes32()` 直接 UTF-8 转 hex 后截断，可能切断多字节字符
**严重程度**: 中
**修复**: 
- 新建 `address-utils.ts`，提供 `stringToBytes32()` 工具
- 使用 `ethers.encodeBytes32String()` 处理短字符串（≤31 字节）
- 长字符串在 UTF-8 字节边界安全截断后再编码
- `fatf-publisher.ts` 和 `batch-collector.ts` 统一使用该工具

---

## 3. 数据一致性

### 3.1 部分成功的 batch tx 与状态文件更新

**问题**: 如果 batch tx 部分失败（nonce 冲突、revert 等），失败地址仍被写入 `synced-addresses.json`，**永远不会重试**
**严重程度**: 🔴 **严重**
**代码位置**: `runBatchSync()` 原逻辑：`ofacNew.forEach(e => ofacSynced.add(e.address))` 在 `publishBatches()` 之后无条件执行
**修复**:
- `publishBatches()` 现在返回 `succeededAddresses` 和 `failedAddresses` 列表
- `runBatchSync()` 仅将 **成功** 地址加入 `synced` 集合
- 失败地址单独存入 `state.sources[sourceId].failed` 数组
- 新增 `--retry-failed` / `-r` CLI 选项，用于手动重试失败地址

### 3.2 失败地址重试机制

**问题**: 原代码无重试机制，失败即永久丢弃
**严重程度**: 🔴 **严重**
**修复**:
- 状态文件新增 `failed` 字段记录每个数据源的失败地址
- `runBatchSync()` 默认跳过已失败地址（避免无限重试浪费 gas）
- 通过 `--retry-failed` 标志可显式重试
- 重试成功的地址从 `failed` 列表中移除

### 3.3 数据源地址格式校验

**问题**:
- `fetchScamSnifferAddresses()` 仅检查 `startsWith('0x') && length === 42`，不验证 hex 字符
- `opensanctions-collector.ts` 的 `extractCryptoFromFTM()` 和 `parseCryptoField()` 同样缺少严格校验
**严重程度**: 中
**修复**:
- 新建 `address-utils.ts`，提供 `isValidEthAddress()` 和 `normalizeAddress()`
- ScamSniffer、OpenSanctions FTM、OpenSanctions CSV 三处全部接入严格校验
- 非法地址被过滤并记录 debug 日志

---

## 4. FTM 解析鲁棒性

### 4.1 JSON Lines 格式处理

**状态**: ✅ 已支持
- `parseFTMResponse()` 检测 `"["` 开头后先尝试 JSON Array 解析
- 若失败则回退到逐行 JSON Lines 解析

### 4.2 超大文件流式处理

**问题**: 49MB 文件完整加载到内存（`responseType: 'text'` + `JSON.parse`）
**严重程度**: 低（当前规模可接受）
**备注**: 已添加 `JSON.parse` 失败后的增强回退逻辑：尝试从损坏的数组中提取单个对象。若数据持续增长，建议未来迁移到流式 JSON parser。

### 4.3 损坏行/无效 JSON 容错

**问题**: JSON Array 解析失败后回退到 JSON Lines，但如果文件以 `[` 开头且是 minified 数组，每行都不是有效 JSON，导致全部丢弃
**严重程度**: 中
**修复**: 增强 `parseFTMResponse()` 回退逻辑：
- 剥离外层 `[]` 括号
- 按 `},{` 模式拆分，尝试恢复单个对象
- 记录恢复成功的实体数量

### 4.4 `extractFirstString` null 安全

**问题**: `typeof null === 'object'` 为 true，原代码 `if (!value)` 已捕获，但语义不够清晰
**修复**: 显式检查 `value === null || value === undefined`

---

## 5. FATF 管道

### 5.1 FATF 国家代码映射

**状态**: ✅ 正确
- DPRK → KP
- Iran → IR
- Myanmar → MM
- 灰名单国家映射完整

### 5.2 国家风险 tier 到地址的乘数逻辑

**状态**: ✅ 逻辑合理
- Blacklist → CRITICAL (tier=4)
- Greylist → HIGH (tier=3)
- 默认 OFAC → MEDIUM (tier=2)
- **注意**: `batch-collector.ts` 中 OFAC 源注释说 "proxy reverts on tier=4 CRITICAL"，但 `fatf-publisher.ts` 中 CRITICAL (tier=4) 仍可被调用。若合约限制 tier<4，需确认 `fatf-publisher.ts` 是否需要同样限制。目前代码保持原行为。

### 5.3 FATF 更新频率

**状态**: ⚠️ 半可靠
- 使用硬编码列表（每年 3 次更新）
- `collectOnline()` 仅检查网页是否包含 "DPRK" 和 "Algeria"，**不能检测列表内容变化**
- 建议：未来接入 FATF RSS/API 或解析 HTML 中的实际列表

---

## 6. 新增文件

### `data-publisher/src/address-utils.ts`

集中式地址验证和 bytes32 编码工具：
- `isValidEthAddress(addr, strict?)` — 严格校验 0x + 40 hex
- `normalizeAddress(addr)` — 规范化并验证，返回小写地址或 undefined
- `normalizeAddresses(addrs)` — 批量规范化+去重
- `stringToBytes32(str)` — 安全 bytes32 编码（边界截断）

---

## 7. 修复总结

| # | 问题 | 严重程度 | 文件 | 修复方式 |
|---|------|---------|------|---------|
| 1 | 状态文件并发写入无锁 | 🔴 严重 | `batch-collector.ts` | PID 文件锁 + 原子 rename + 备份恢复 |
| 2 | 失败地址被错误标记为已同步 | 🔴 严重 | `batch-collector.ts` | 按 per-address 成功/失败追踪，仅保存成功地址 |
| 3 | 无失败重试机制 | 🔴 严重 | `batch-collector.ts` | 新增 `failed` 状态字段 + `--retry-failed` CLI 选项 |
| 4 | `extractFirstString` 不识别 FTM `{id}` 对象 | 🔴 严重 | `batch-collector.ts` | 同时检查 `.id` 和 `.value` |
| 5 | `tx.wait()` receipt 可能为 null | 中 | `batch-collector.ts` | 添加 `!receipt` 分支处理 |
| 6 | ScamSniffer 地址无严格校验 | 中 | `batch-collector.ts`, `opensanctions-collector.ts` | 接入 `normalizeAddress()` |
| 7 | bytes32 UTF-8 截断可能切断多字节字符 | 中 | `fatf-publisher.ts` | 使用 `ethers.encodeBytes32String` + 安全截断 |
| 8 | JSON Array 解析失败后无有效回退 | 中 | `batch-collector.ts` | 增强 fallback：剥离 `[]` 后按 `},{` 拆分恢复 |
| 9 | `publishBatches` 返回粒度不足 | 中 | `batch-collector.ts` | 返回 `succeededAddresses` / `failedAddresses` 列表 |
| 10 | ScamSniffer 响应非数组时崩溃 | 低 | `batch-collector.ts` | 添加 `Array.isArray` 检查和早期返回 |

---

## 8. 建议后续改进

1. **FATF 在线验证**: 当前 `collectOnline()` 仅做关键字存在性检查，建议解析实际 HTML 列表内容
2. **ScamSniffer 条件请求**: 支持 HTTP `If-None-Match` / `If-Modified-Since`，减少全量下载
3. **流式 FTM 解析**: 数据集超过 100MB 时，应使用流式 JSON parser（如 `stream-json`）
4. **合约 tier=4 限制**: 确认 `RiskRegistry` 是否接受 tier=4 (CRITICAL)，若不接受需统一降级
5. **监控告警**: 建议为 `failed` 地址数量增加 metrics 和 alert
