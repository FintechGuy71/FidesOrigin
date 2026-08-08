# FidesOrigin 数据管道安全审计报告

**审计日期**: 2026-06-30  
**审计范围**: data-publisher (TypeScript) + data-sync (JavaScript) 全部源码  
**审计人**: AI Security Auditor  

---

## 总评等级

| 维度 | 评级 | 说明 |
|------|------|------|
| 整体安全性 | **B+ (良好)** | 已修复大量已知问题，但仍有中低风险残留 |
| 数据源完整性 | **A- (优秀)** | OFAC 多源容错，FATF 硬编码+在线验证 |
| 错误处理 | **A- (优秀)** | 完整的 DLQ + 重试 + 告警体系 |
| 并发安全 | **B (良好)** | Nonce 管理有锁保护，但存在边缘情况 |
| 密钥管理 | **A (优秀)** | 多 KMS 后端，生产强制 KMS，日志脱敏完善 |
| 链上同步 | **B+ (良好)** | Gas 管理有硬上限，Merkle 更新有超时保护 |
| 数据一致性 | **B+ (良好)** | Merkle 树构建正确，但缺少链上回滚保护 |
| 定时调度 | **A- (优秀)** | 幂等保护完善，isSyncing 标志+分布式锁 |
| 监控告警 | **A (优秀)** | 多渠道告警，Prometheus 指标，健康检查 |
| 性能 | **B (良好)** | 大文件流式处理，但部分位置存在 O(n²) 风险 |
| 外部依赖 | **B+ (良好)** | SSRF 防护完善，但部分适配器缺少超时 |

---

## 问题统计

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Medium | 9 |
| Low | 12 |
| Info | 8 |
| **Total** | **33** |

---

## 详细问题列表

### HIGH 级别问题

---

#### H-001: `publisher.ts` — Nonce 管理缺失，交易可能因 stale nonce 失败

- **文件**: `data-publisher/src/publisher.ts`
- **行号**: L135 (publishSingle 方法)
- **描述**: `BlockchainPublisher` 在 `initialize()` 中获取了 nonce (`this.nonce`)，但在 `publishSingle()` 中从未使用或更新它。每笔交易依赖 ethers.js 默认的 `getTransactionCount`，在快速连续发送时，RPC 节点的 pending pool 可能尚未反映前一笔交易，导致 nonce 冲突。
- **影响**: 当 `txInterval` 较短(< 2s) 或网络延迟较高时，交易可能因 "nonce too low" 或 "nonce too high" 而失败，导致部分风险配置未能上链。
- **修复建议**: 
  1. 使用 `ethers.NonceManager` 包装 signer: `const managedSigner = new ethers.NonceManager(signer);`
  2. 或自行维护递增 nonce + 锁，确保串行发送。

---

#### H-002: `batch-collector.ts` — 状态文件锁非原子性，跨进程竞态

- **文件**: `data-publisher/src/batch-collector.ts`
- **行号**: L131-150 (`acquireLock` / `saveState`)
- **描述**: 文件锁使用 `writeFileSync(LOCK_FILE, pid, { flag: 'wx' })` 实现互斥。虽然 `wx` flag 本身是原子的，但 `existsSync` 检查 + `unlinkSync` 清理之间的窗口存在 TOCTOU 竞态。两个进程可能同时看到锁不存在并同时创建。
- **影响**: 多实例部署时可能导致同时写入状态文件，造成 `synced-addresses.json` 损坏，丢失已同步地址记录，导致重复上链发布。
- **修复建议**: 
  1. 使用 `proper-lockfile` 库提供真正的文件锁。
  2. 或在 K8s 环境中使用 Redis 分布式锁（ClusterCoordinator 已有实现），移除文件锁逻辑。

---

#### H-003: `ofacSimpleAdapter.js` — 正则提取地址方式可能产生大量误报

- **文件**: `data-sync/src/adapters/ofacSimpleAdapter.js`
- **行号**: L56-72 (`extractCryptoAddresses`)
- **描述**: 使用全局正则 `/0x[a-fA-F0-9]{40}/g` 从非结构化文本(`sdnlist.txt`)中提取以太坊地址。这种方法会匹配任何 40 位十六进制字符串，包括非地址内容（如哈希值、文档 ID）。同样，BTC 正则 `/[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g` 极易误匹配普通文本。
- **影响**: 大量误报地址会被写入数据库并可能上链，污染风险注册表的数据质量。合约 gas 成本也会因无效地址增加。
- **修复建议**: 
  1. 改用 `ofacAdapter.js` 的 SAX 流式 XML 解析器，它从结构化的 `<idList><id><idType>Digital Currency Address - ETH</idType>` 提取地址，精度更高。
  2. 弃用 `ofacSimpleAdapter.js`，或仅作为最后降级手段并在结果上添加 "low_confidence" 标签。

---

#### H-004: `blockchainService.js` — `_sendBatchWithGasLimit` 中 `riskScores` 传入 `uint256[]` 但合约期望 `uint8`

- **文件**: `data-sync/src/services/blockchainService.js`
- **行号**: L330-345
- **描述**: `_sendBatchWithGasLimit` 构建 `riskScores` 数组时使用 JavaScript number (如 `100`, `50`, `0`)。ethers.js v6 在编码 `uint256[]` 时会将其当作 BigInt 编码。然而合约 ABI 定义中类型为 `uint256[]`，如果合约实际期望的是 `uint8`（如 RiskTier 枚举），则 `riskScore: 100` 在 `uint8` 下是合法的，但在 `uint256` 编码下会额外消耗 gas。
- **影响**: 如果合约实际使用 `uint8[]` 但 ABI 声明 `uint256[]`，所有非零值交易将 revert。即使 ABI 正确，gas 消耗也显著高于必要值。
- **修复建议**: 
  1. 确认合约 ABI 中 `riskScores` 的确切类型。
  2. 如果合约使用 `uint8`，更新 ABI 定义和传参。
  3. 添加合约调用前 `estimateGas` 的详细错误日志。

---

### MEDIUM 级别问题

---

#### M-001: `collector.ts` — OpenSanctions API 分页限制 1000，可能遗漏地址

- **文件**: `data-publisher/src/collector.ts`
- **行号**: L192 (`fetchOpenSanctions`)
- **描述**: 请求 `entities/?schema=Person&limit=1000` 只获取前 1000 个实体。OpenSanctions 的 OFAC SDN 数据集有数千条记录，其中包含加密地址的实体可能超过 1000 条。
- **影响**: 可能遗漏受制裁地址，导致合规风险。
- **修复建议**: 实现分页循环，使用 `offset` 或游标直到获取所有结果。

---

#### M-002: `cluster-coordinator.ts` — Redis 分布式锁缺少自动续期

- **文件**: `data-publisher/src/cluster-coordinator.ts`
- **行号**: L60-80 (`acquireLock`)
- **描述**: 锁通过 `SET NX PX ttl` 获取，但没有自动续期（lock extension）机制。如果同步作业执行时间超过 `lockTtl`（默认 60s），锁会被自动释放，另一个实例可能开始执行相同任务。
- **影响**: 长时间运行的 OFAC 同步可能被另一个实例重复执行，导致重复交易和 gas 浪费。
- **修复建议**: 在作业执行期间启动 watchdog 定时器，每 `lockTtl/3` 时间续期一次锁。

---

#### M-003: `fatf-publisher.ts` — 使用明文 `new Wallet(privateKey)` 创建签名器

- **文件**: `data-publisher/src/fatf-publisher.ts`
- **行号**: L62-66
- **描述**: `FATFPublisher` 直接用 `new Wallet(privateKey, provider)` 创建钱包，绕过了 `kms-key-manager.ts` 的安全检查。虽然在生产环境配置中 `config.ts` 会阻止明文私钥，但 `FATFPublisher` 可以独立实例化（例如在测试或手动调用中），不受此保护。
- **影响**: FATF Oracle 私钥可能在非生产环境中以明文形式使用，存在泄露风险。
- **修复建议**: `FATFPublisher` 应使用 `createKeyManager()` 工厂函数，与其他组件保持一致。

---

#### M-004: `key-manager.ts` (旧版) — 使用全零 dummy 私钥创建 Wallet

- **文件**: `data-publisher/src/key-manager.ts`
- **行号**: L75, L139 (`AWSKMSKeyManager.getSigner`)
- **描述**: 旧版 `key-manager.ts` 的 `AWSKMSKeyManager` 创建了一个 dummy Wallet (`'0x' + '00'.repeat(32)`) 并重写其方法。虽然新版 `kms-key-manager.ts` 已修复此问题（使用 `KMSAbstractSigner extends AbstractSigner`），但旧版文件仍然存在且可被导入。
- **影响**: 如果代码路径意外使用了旧版 `createKeyManager`，全零私钥可能被用于签名（虽然理论上无法签名成功，但行为未定义）。
- **修复建议**: 删除 `key-manager.ts` 文件，或将所有导出重定向到 `kms-key-manager.ts`。

---

#### M-005: `chainSyncer.js` — `syncMerkleRootToChain` 仅等待 2 个确认，可能发生链重组

- **文件**: `data-sync/src/chainSyncer.js`
- **行号**: L347 (`tx.wait(2)`)
- **描述**: Merkle root 更新交易仅等待 2 个区块确认。在生产网络（尤其是 Layer 2 或低安全性链）上，2 个确认可能不足以防止链重组。
- **影响**: 链重组可能导致 Merkle root 在一条链上被确认但在规范链上被回滚，数据一致性被破坏。
- **修复建议**: 
  1. 主网使用至少 3-6 个确认。
  2. 通过环境变量 `MIN_CONFIRMATIONS` 使其可配置。
  3. 已有 5 分钟超时保护（L348-351），这是好的。

---

#### M-006: `scheduler.js` (data-sync) — OFAC XML 解析逻辑与 OFAC 适配器不一致

- **文件**: `data-sync/src/scheduler.js`
- **行号**: L102-130 (`parseOFACXml`)
- **描述**: `scheduler.js` 的 `parseOFACXml` 通过 `sdnType.includes('Digital Currency')` 筛选 SDN 条目，然后从 `addressList.address.address` 字段提取加密地址。然而 OFAC SDN XML 实际将加密地址存储在 `idList/id` 节点中（`idType = "Digital Currency Address - ETH"`），而非 `addressList`。`addressList` 存储的是物理地址（城市、国家等）。
- **影响**: 此解析器可能完全无法提取到任何加密地址，导致 data-sync 管线的 OFAC 数据为空。
- **修复建议**: 修改解析逻辑，从 `idList/id/idType` + `idList/id/idNumber` 提取加密地址，与 `collector.ts` 和 `ofac-fetcher.ts` 的逻辑保持一致。

---

#### M-007: `openSourceAdapter.js` — 硬编码将零地址标记为 riskScore: 100

- **文件**: `data-sync/src/adapters/openSourceAdapter.js`
- **行号**: L162-173 (`fetchCustomAddresses`)
- **描述**: 将 `0x0000000000000000000000000000000000000000`（零地址）标记为 `riskScore: 100`，标签为 "burn_address"。虽然 `processor.ts` 已过滤零地址（L163），但 data-sync 管线中的 `databaseService.js` 没有类似过滤。
- **影响**: 零地址可能被写入数据库并上链，浪费 gas 且在合规数据中产生噪音。
- **修复建议**: 在 `databaseService.js` 的 `assertAddress` 方法中添加零地址检查。

---

#### M-008: `collectors-extended.ts` — TRM Labs API 发送空地址数组

- **文件**: `data-publisher/src/collectors-extended.ts`
- **行号**: L40-42 (`fetchTRMLabs`)
- **描述**: `fetchTRMLabs` 向 API 发送 `addresses: []`（空数组），这意味着它实际上不会筛查任何地址。这是一个未完成的占位实现。
- **影响**: 如果 TRM Labs 数据源被启用，它将返回空结果但不会报错，用户可能误以为该源正常工作。
- **修复建议**: 
  1. 要么完成实现（需要先获取待筛查的地址列表）。
  2. 要么在启用时抛出 `NotImplementedError`，避免静默成功。

---

#### M-009: `monitor.ts` — express 服务器缺少 body 限制和 CORS 配置

- **文件**: `data-publisher/src/monitor.ts`
- **行号**: L91-94 (`setupRoutes`)
- **描述**: Monitor 服务器使用 `express()` 但未设置 `express.json()` body parser 限制，也没有配置 CORS 策略。虽然目前只暴露 GET 端点，但如果未来添加 POST 端点，缺少 body 限制可能导致 DoS。
- **影响**: 低风险（当前只有 GET），但属于安全最佳实践缺失。
- **修复建议**: 添加 `app.use(express.json({ limit: '1mb' }))` 和适当的 CORS 中间件。

---

### LOW 级别问题

---

#### L-001: `config.ts` — Redis URL 在日志中仅部分脱敏

- **文件**: `data-publisher/src/config.ts` / `cluster-coordinator.ts`
- **行号**: cluster-coordinator.ts L41
- **描述**: Redis URL 中的密码通过 `replace(/:\/\/.*@/, '://***@')` 脱敏，但此正则对于不含密码的 URL（如 `redis://localhost:6379`）不会做任何替换。另外，如果密码中包含特殊字符，正则可能不匹配。
- **影响**: 低风险，Redis 密码可能在日志中泄露。
- **修复建议**: 使用 `new URL(redisUrl)` 解析，仅在日志中输出 `host:port`。

---

#### L-002: `publisher.ts` — `getOnChainData` 批量查询无并发限制

- **文件**: `data-publisher/src/publisher.ts`
- **行号**: L118-140
- **描述**: `getOnChainData` 以 10 个地址为一批，使用 `Promise.all` 并发查询。但如果有数千个地址，会创建数百个并发批次，可能触发 RPC 速率限制。
- **影响**: RPC 请求可能被限流或超时。
- **修复建议**: 使用 `p-limit` 或手动实现的并发池，限制最大并发 RPC 调用数。

---

#### L-003: `batch-collector.ts` — 状态文件无大小限制，可能无限增长

- **文件**: `data-publisher/src/batch-collector.ts`
- **行号**: `saveState` / `loadState`
- **描述**: `synced-addresses.json` 存储所有已同步地址的数组。随着 OFAC 和 ScamSniffer 地址累积（可达数万条），文件可能增长到数十 MB，导致读写性能下降。
- **影响**: 状态文件加载/保存变慢，影响同步速度。
- **修复建议**: 
  1. 使用 Set 替代 Array 提高查找性能。
  2. 定期清理已从源中移除的旧地址。
  3. 考虑使用 LevelDB 或 SQLite 存储状态。

---

#### L-004: `ofac-fetcher.ts` — ZIP 文件解压未实现

- **文件**: `data-publisher/src/ofac-fetcher.ts`
- **行号**: L85-98
- **描述**: OFAC 的 fallback URL (`SDN_XML.ZIP`) 返回 ZIP 压缩文件，但代码仅检测到 ZIP 后就放弃了：`"decompression not supported in this path"`。
- **影响**: 如果主 URL 不可用，fallback 将无法使用，OFAC 数据完全获取失败。
- **修复建议**: 使用 `zlib.unzip()` 或 `adm-zip` 库解压响应。

---

#### L-005: `merkleBuilder.js` — 单叶子节点直接作为 root，未做 domain separation

- **文件**: `data-sync/src/merkleBuilder.js`
- **行号**: L27-29
- **描述**: 当只有一个地址时，其 keccak256 哈希直接作为 Merkle root。没有使用 domain separator 或前缀来区分叶子哈希和内部节点哈希，这在某些证明系统中存在第二原像攻击风险（CVE-2012-2452 类似）。
- **影响**: 攻击者可能构造一个假地址使其哈希等于某个内部节点，从而伪造 Merkle 证明。
- **修复建议**: 
  1. 叶子节点添加 `0x00` 前缀，内部节点添加 `0x01` 前缀。
  2. 或者使用 OpenZeppelin 的 `MerkleProof` 库的标准实现。

---

#### L-006: `chainalysisAdapter.js` — 硬编码地址列表可能过时

- **文件**: `data-sync/src/adapters/chainalysisAdapter.js`
- **行号**: L18-24
- **描述**: `knownSanctionedAddresses` 是硬编码的地址列表。这些地址可能随时间变化（新制裁/解除制裁），但代码没有自动更新机制。
- **影响**: 可能遗漏新制裁地址或保留已解除制裁的地址。
- **修复建议**: 标记为 "last_verified" 日期，并定期与官方源核对。

---

#### L-007: `address-enricher.ts` — FATF 国家匹配依赖手动维护的 ISO2 映射

- **文件**: `data-publisher/src/address-enricher.ts`
- **行号**: L119-165 (`COUNTRY_NAME_TO_ISO2`)
- **描述**: 国家名称到 ISO2 代码的映射是硬编码的，且不完整（例如缺少一些 FATF 监控国家）。如果 OFAC 数据使用了映射表中不存在的国家名称变体，FATF 交叉匹配将失败。
- **修复建议**: 使用完整的 ISO 3166 库（如 `i18n-iso-countries`）。

---

#### L-008: `fatf-collector.ts` — 硬编码的 FATF 列表更新滞后风险

- **文件**: `data-publisher/src/fatf-collector.ts`
- **行号**: L25-70
- **描述**: FATF 黑名单和灰名单是硬编码的。FATF 每年 3 次更新（2月/6月/10月），硬编码列表可能在实际 FATF 更新后数周才能通过代码更新生效。
- **影响**: 新增的 FATF 监控国家在代码更新前不会被交叉匹配。
- **修复建议**: `collectOnline()` 方法已尝试在线验证，但仅检查 "DPRK" 和 "Algeria" 是否出现。建议增强在线验证，解析完整国家列表。

---

#### L-009: `scheduler.js` (data-sync) — `syncAxios` 设置 `maxRedirects: 0`，OFAC 源的 302 重定向将失败

- **文件**: `data-sync/src/scheduler.js`
- **行号**: L32 (`syncAxios`)
- **描述**: `syncAxios` 创建时设置了 `maxRedirects: 0`，但 OFAC SDN 的主 URL (`https://www.treasury.gov/ofac/downloads/sdn.xml`) 已知会返回 302 重定向。这会导致 data-sync 管线中的 OFAC 获取直接失败。
- **影响**: data-sync 管线可能完全无法获取 OFAC 数据。
- **修复建议**: 将 `maxRedirects` 改为 5，或至少为 OFAC 源使用单独的 axios 实例。

---

#### L-010: `backup.js` — 增量备份将全量数据加载到内存

- **文件**: `data-sync/src/backup.js`
- **行号**: L217-226 (`createBackup` INCREMENTAL)
- **描述**: 增量备份路径使用 `prisma.findMany` 一次性加载所有变更记录到内存，然后 `JSON.stringify` 整个数组。如果增量数据量大，可能导致内存峰值。
- **影响**: 在大规模数据变更时可能导致 OOM。
- **修复建议**: 增量备份也应使用流式写入（与全量备份一致）。

---

#### L-011: `databaseService.js` — Serializable 隔离级别可能导致数据库死锁

- **文件**: `data-sync/src/services/databaseService.js`
- **行号**: L89 (`$transaction` with `Serializable`)
- **描述**: 使用 `Serializable` 隔离级别虽然消除了 TOCTOU 竞态，但也显著增加了死锁和序列化失败的概率，尤其是在高并发写入场景下。
- **影响**: 可能出现 Prisma 事务失败错误，需要重试。
- **修复建议**: 考虑使用 `RepeatableRead` + 唯一约束来防止竞态，性能更好。添加事务重试逻辑。

---

#### L-012: `index.js` (data-publisher) — unhandledRejection 时直接 `process.exit(1)` 

- **文件**: `data-publisher/src/index.ts`
- **行号**: L85-88
- **描述**: `unhandledRejection` 处理器直接调用 `process.exit(1)`，没有先执行优雅关闭（停止 scheduler、monitor 等）。
- **影响**: 可能留下未清理的资源（打开的文件句柄、网络连接）。
- **修复建议**: 调用已有的 `shutdown('unhandledRejection')` 函数，与 SIGTERM 处理保持一致。

---

### INFO 级别问题

---

#### I-001: `logger.ts` — 脱敏逻辑对 stack trace 中的密钥不生效

- **文件**: `data-publisher/src/logger.ts`
- **行号**: L25-27
- **描述**: `deepRedact` 将 Error 的 stack 替换为 `'[STACK REDACTED]'`，这对安全有利但也阻碍了调试。data-sync 的 logger.js 更精细，保留了 stack 但脱敏密钥模式。
- **建议**: 统一两套代码库的 stack 处理策略。

---

#### I-002: `config.ts` — `require('os').hostname()` 在模块顶层执行

- **文件**: `data-publisher/src/config.ts`
- **行号**: L113
- **描述**: `require('os').hostname()` 在模块加载时立即执行，无法在测试中 mock。此外，如果容器主机名在运行期间变化（罕见但可能），实例 ID 不会更新。
- **建议**: 延迟求值或通过函数获取。

---

#### I-003: `address-utils.ts` — `stringToBytes32` 截断非 ASCII 字符串可能丢失数据

- **文件**: `data-publisher/src/address-utils.ts`
- **行号**: L43-50
- **描述**: 当字符串超过 31 字节时，直接截断 Buffer。对于多字节 UTF-8 字符（如中文实体名），截断可能发生在字符中间，产生无效 UTF-8。
- **建议**: 使用 `TextEncoder.encodeInto` 安全截断到有效的 UTF-8 边界。

---

#### I-004: `processors.ts` — 合并源数据时使用 confidence 作为权重

- **文件**: `data-publisher/src/processor.ts`
- **行号**: L77-82
- **描述**: 加权平均使用 `confidence` 作为权重。但 confidence 代表的是数据源的"自信程度"，不一定等于"可靠性"。一个有 bug 的数据源可能 confidence=0.99 但数据全错。
- **建议**: 使用 `DataSourceConfig.weight` 作为权重，而非 confidence。

---

#### I-005: `fatf-scheduler.ts` — 初始化时在 dryRun 模式下运行完整管线

- **文件**: `data-publisher/src/index.ts`
- **行号**: L48-53
- **描述**: 当 `config.fatf.dryRun` 为 true 时，启动时立即运行一次完整 FATF 管线。虽然不会发送交易，但仍会从 OpenSanctions 下载 ~49MB 的 FTM JSON，可能延迟服务启动。
- **建议**: 在启动时延迟 FATF 管线执行（如 60 秒后），让核心服务先就绪。

---

#### I-006: `healthCheck.js` — CORS 在开发环境允许所有源

- **文件**: `data-sync/src/utils/healthCheck.js`
- **行号**: L52
- **描述**: 开发环境设置 `Access-Control-Allow-Origin: *`，生产环境限制为 `localhost:3000`。但健康检查端点通常不需要 CORS。
- **建议**: 完全移除 CORS 头，除非有明确的前端消费方。

---

#### I-007: `dlq.js` — `upsert` 使用空 `where` 对象会导致 Prisma 错误

- **文件**: `data-sync/src/services/dlq.js`
- **行号**: L49-56
- **描述**: `prisma.syncFailure.upsert({ where: {} })` 传递了空的 where 对象，Prisma 会抛出错误。代码已经在 catch 中 fallback 到 `findFirst + create/update`，所以功能上没有 bug，但这是代码异味。
- **建议**: 直接使用 `findFirst + create/update` 模式，移除无效的 upsert 调用。

---

#### I-008: `kms-key-manager.ts` — VaultKeyManager 的 `Buffer.fill(0)` 无法清除字符串

- **文件**: `data-publisher/src/kms-key-manager.ts`
- **行号**: L224-227
- **描述**: 代码尝试用 `Buffer.from(privateKey).fill(0)` 清除内存中的私钥，但 `Buffer.from(string)` 创建的是字符串的 **副本**，原始字符串仍然存在于 V8 堆中直到 GC 回收。代码注释已承认此限制。
- **建议**: 如代码注释所述，迁移到 Vault Transit Engine 以实现真正的 HSM 级安全。

---

## 架构亮点（做得好的地方）

1. **多层级 KMS 支持**: AWS KMS / Azure Key Vault / HashiCorp Vault 三后端，生产环境强制 KMS，开发环境允许明文密钥。
2. **完善的日志脱敏**: 精确的 snake_case 敏感字段匹配 + 密钥模式正则扫描，覆盖消息字符串和元数据双重脱敏。
3. **SSRF 防护**: `collector.ts` 和 `ofacAdapter.js` 都实现了 URL 验证、私有 IP 拦截、DNS 解析验证的多层防护。
4. **完整的 DLQ 体系**: data-sync 有完整的死信队列 — 记录失败 → 指数退避重试 → 永久失败告警 → 手动重处理接口。
5. **审计日志哈希链**: data-sync 的 logger.js 实现了 SHA-256 哈希链，可检测审计日志篡改。
6. **Gas 硬上限**: `blockchainService.js` 设置了 `maxGasLimit`、`maxFeePerGas`、`maxPriorityFeePerGas` 三重硬上限。
7. **优雅关闭**: 两套管线都有完善的 SIGTERM/SIGINT 处理，等待当前批次完成、保存重试队列、关闭连接。
8. **Nonce 管理**: data-sync 使用 Promise 链锁 + double-checked locking 实现并发安全的 nonce 管理。

---

## 优先修复建议

| 优先级 | 问题 | 预计工时 |
|--------|------|----------|
| P0 | M-006: scheduler.js OFAC 解析逻辑错误 | 2h |
| P1 | H-001: publisher.ts nonce 管理 | 1h |
| P1 | H-003: ofacSimpleAdapter 正则误报 | 1h |
| P1 | M-003: FATFPublisher 绕过 KMS | 2h |
| P2 | H-002: batch-collector 文件锁竞态 | 2h |
| P2 | M-002: Redis 锁缺少续期 | 2h |
| P2 | M-005: Merkle root 确认数不足 | 0.5h |
| P3 | M-001: OpenSanctions 分页 | 1h |
| P3 | M-004: 移除旧版 key-manager.ts | 0.5h |
| P3 | M-009: Monitor body 限制 | 0.5h |

---

*报告结束*
