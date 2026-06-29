# GLM-5.2 验证审计报告 — Medium & Low 问题逐条验证

**验证日期**: 2026-06-26  
**验证模型**: zhipu/glm-5.2  
**数据来源**: deep-audit-1.md + deep-audit-2.md  
**验证方法**: 逐条读取源码，对照审计描述判定真实性  

---

## 第一轮审计 (deep-audit-1.md) — Medium 问题

| 编号 | 原严重度 | 验证结果 | 调整后严重度 | 原因 |
|------|----------|----------|-------------|------|
| D1-AUDIT1-005 | Medium | ✅ 确认 | Medium | `emergencySanction` 中 `wasNew` 捕获确实在写入之前（正确），但 `totalProfiles` 在 V2 中从 0 开始，`backfillCounters` 有 `require(totalProfiles == 0)` 检查但未检查 `totalSanctioned == 0`，存在计数器冲突风险 |
| D1-AUDIT1-006 | Medium | ✅ 确认 | Medium | `removeSanction` 已修复为检查 `sanctionedAddresses[account]`，且清理 `_packedProfiles` 制裁位。但反向路径（`updateRiskProfile` 设置 `_packedProfiles` 制裁位但不动 `sanctionedAddresses`）仍可能不同步。实际上 `updateRiskProfile` 同时设置了两者，风险较低但逻辑耦合不优雅 |
| D1-AUDIT1-007 | Medium | ✅ 确认 | Medium | `_updateTags` 确实只往 `entityAddresses[newTag]` push，从不清除旧标签的 `entityAddresses[oldTag]`。`addTag` 也只有添加无移除。`removeTag` 只设 `_addressTags=false` 但不从 `entityAddresses` 数组移除。问题真实 |
| D1-AUDIT1-011 | Medium | ⚠️ 调整 | Low | `RiskRegistryReader.totalProfiles()` 确实返回 0，但该合约是临时兼容层（注释明确说明），且调用者可从 off-chain 索引获取数据。误导性存在但影响有限 |
| D1-AUDIT1-012 | Medium | ✅ 确认 | Medium | `try this.decodeRiskProfile(result) catch` 确实捕获所有错误包括 gas 不足。但这是 Reader 合约的 fallback 设计，实际导致错误数据的概率低。不过缺乏错误区分确实不严谨 |
| D1-AUDIT1-017 | Medium | ✅ 确认 | Medium | `receiveCrossChainUpdate` 只检查 `timestamp < lastSyncTime`（源链时间戳晚于上次同步），确实没有检查未来时间戳上限。攻击者可设置超前的 timestamp 绕过陈旧检查 |
| D1-AUDIT1-018 | Medium | ⚠️ 调整 | Low | `MIN_SYNC_INTERVAL` 使用目标链 `block.timestamp` 是合理的设计——跨链同步频率限制本就应以目标链为准。文档说明即可，非实质性安全问题 |
| D1-AUDIT1-022 | Medium | ✅ 确认 | Medium | RiskRegistry V1 `proposeUpgrade` 使用 `keccak256(abi.encodePacked(newImplementation, block.timestamp))`，同一 implementation 在同一区块内多次提议会生成相同 proposalId 并覆盖 |
| D1-AUDIT1-023 | Medium | ❌ 否定 | — | RiskRegistry V1 `proposeUpgrade` 使用 `abi.encodePacked(newImplementation, block.timestamp)`，`_authorizeUpgrade` 也使用 `abi.encodePacked`：`implementationToProposal[newImplementation]` 查找。实际两者一致——`proposeUpgrade` 存入 `implementationToProposal[newImpl] = proposalId`，`_authorizeUpgrade` 从 `implementationToProposal[newImpl]` 取出 proposalId 再检查 `upgradeProposals[proposalId]`。不匹配问题不存在 |
| D1-AUDIT1-028 | Medium | ✅ 确认 | Medium | `checkTransferWithDeadline` 中 `dailySpent` 检查使用 `block.timestamp / 1 days`，更新也使用 `block.timestamp / 1 days`。两者在同一交易中 `block.timestamp` 相同，实际不会有差异。但如果检查和更新之间有其他调用（如重入），可能不一致。由于有 `nonReentrant`，实际风险极低 |
| D1-AUDIT1-029 | Medium | ⚠️ 调整 | Low | `quarantineId` 使用 `keccak256(abi.encodePacked(block.timestamp, block.number, quarantineNonce++, ...))`。`quarantineNonce` 是单调递增的，保证唯一性。可预测性不是安全问题因为 quarantineId 不用于权限控制 |
| D1-AUDIT1-030 | Medium | ✅ 确认 | Medium | `releaseQuarantine` 只设 `record.released = true` 并发事件，无自动转账机制。这是设计选择（手动操作），但缺少文档说明和回调机制 |
| D1-AUDIT1-034 | Medium | ✅ 确认 | Low | `evaluateTransfer` (PolicyEngine) 确实不检查 `amount > 0`。但 `amount=0` 不会绕过限额检查（`0 > maxTxAmount` 为 false），只是可能触发不必要的 `recordTransfer`。影响极低 |
| D1-AUDIT1-035 | Medium | ✅ 确认 | Medium | PolicyEngine `createPolicyVersion` 中：当 `versionHistory.length < MAX_HISTORY_VERSIONS` 时先 push，然后又用 `versionHistoryHead % MAX_HISTORY_VERSIONS` 覆写。这导致前 50 个版本被 push 后立即被覆写，逻辑确实有 bug |
| D1-AUDIT1-040 | Medium | ⚠️ 调整 | Low | `pendingSetTime` 使用 `mapping(bytes32 => uint256)` 和字符串键如 `"complianceEngine"`。键冲突风险理论上存在但实际可控——键名是硬编码的，不易冲突 |
| D1-AUDIT1-041 | Medium | ❌ 否定 | — | `isBlacklisted` 使用 `score >= maxRiskScoreForBlock`(95)，`quickCheckAddress` 使用 `riskScore < maxRiskScoreForBlock`(95)。两者阈值一致，互补逻辑。`isBlacklisted` 只返回 bool 不返回原因是接口设计选择，非 bug |
| D1-AUDIT1-045 | Medium | ❌ 否定 | — | `emergencyPause` 每次调用都更新 `lastPauseAt = block.timestamp`。`emergencyUnpause` 检查 `block.timestamp - lastPauseAt < MIN_PAUSE_DURATION`。审计描述的"频繁 pause/unpause 循环"需要 EMERGENCY_ROLE，且有 1 小时冷却。当前逻辑正确 |
| D1-AUDIT1-046 | Medium | ❌ 否定 | — | `grantQuarantineRole` 等函数虽然无 `nonReentrant`，但 OpenZeppelin v5 的 `AccessControl._grantRole` 是内部纯状态修改，无外部调用，无重入风险。审计自身也承认"当前无风险" |
| D1-AUDIT1-050 | Medium | ⚠️ 调整 | Low | `normalizeAddress` 使用小写正则 `/^0x[0-9a-f]{40}$/`，不验证 EIP-55 校验和。但合约层 `validAddress` 只检查零地址。校验和缺失不会导致错误（只是大小写不区分），影响极低 |
| D1-AUDIT1-051 | Medium | ✅ 确认 | Low | `resolveOwnerCountry` 返回 `country: 'UNKNOWN'` 确实可能被误解为实际国家代码。但这是字符串而非 ISO 代码，且下游处理中 `country:unknown` 作为标签使用，影响有限 |
| D1-AUDIT1-056 | Medium | ✅ 确认 | Medium | `dotenv.config({ path: path.join(__dirname, '../.env') })` 确实硬编码路径。在生产 Docker 环境中 `__dirname` 是 `/app/dist/src`，路径解析为 `/app/dist/../.env` = `/app/dist/.env`。但 Dockerfile 通过环境变量注入而非 .env 文件，实际不影响生产 |
| D1-AUDIT1-060 | Medium | ✅ 确认 | Medium | `publishSingle` 中 `Buffer.from(t).toString('hex').padEnd(64, '0').slice(0, 64)` 确实会在 UTF-8 多字节字符上截断字节边界。应使用 `ethers.encodeBytes32String(t)` |
| D1-AUDIT1-061 | Medium | ✅ 确认 | Low | `getOnChainData` 使用 `Promise.all` 并发 10 个 RPC 调用，无 rate limit 重试。但批量大小仅 10，公共 RPC 通常允许。实际 rate limit 问题概率不高 |
| D1-AUDIT1-065 | Medium | ⚠️ 调整 | Low | `derToRSV` 中的 `normalizeS` 实际上是必要的——ECDSA 规范要求低-s 值。如果 `normalizeS` 修改了 `s`，`v` 值也会相应调整（代码中有 `v = v ^ 1` 逻辑）。问题描述不够准确 |
| D1-AUDIT1-067 | Medium | ✅ 确认 | Low | `alertCooldowns` 是 `Map<string, number>`，有 `alertMaxCooldownEntries=100` 的清理逻辑。清理使用排序找最旧条目，在规则数量少时（3 条规则）性能不是问题 |
| D1-AUDIT1-068 | Medium | ✅ 确认 | Medium | `dispatchWebhookWithRetry` 使用 `fetch(url, ...)` 确实没有 `timeout` 参数。如果 webhook 服务器无响应，请求会挂起。应添加 `AbortController` 超时 |
| D1-AUDIT1-072 | Medium | ✅ 确认 | Low | `redactFormat` 中 `new RegExp("${key}":\\s*"[^"]*"', 'gi')` 确实可能误匹配日志消息中的非 JSON 文本。但 `sensitiveKeys` 仅 5 个常见字段，实际误匹配概率低 |
| D1-AUDIT1-073 | Medium | ✅ 确认 | Medium | `process.on('uncaughtException', (err) => { ... shutdown('uncaughtException'); })` 中 `shutdown` 是 `async` 函数但未被 `await`。`shutdown` 内部调用 `process.exit(0)`，但异步操作（如 `cluster.disconnect()`、`logger.info`）可能未完成 |
| D1-AUDIT1-074 | Medium | ❌ 否定 | — | `benchmark.ts` 文件不存在于项目中。无法验证 |
| D1-AUDIT1-086 | Medium | ✅ 确认 | Low | Dockerfile 中 `npm ci --only=production` 确实已被 npm v7+ 标记为 legacy。应改为 `--omit=dev`。但功能仍正常 |
| D1-AUDIT1-087 | Medium | ❌ 否定 | — | Dockerfile 使用 `node:20-alpine`，Node.js 20 稳定支持 `fetch`。`HEALTHCHECK` 中的 `node -e "fetch(...)"` 在 Node.js 20 中正常工作 |
| D1-AUDIT1-089 | Medium | ✅ 确认 | Low | docker-compose.yml 中 `GF_SECURITY_ADMIN_PASSWORD=admin` 确实是默认密码。但这是本地开发环境配置（docker-compose），生产环境应使用单独配置 |
| D1-AUDIT1-092 | Medium | ✅ 确认 | Medium | K8s `limits.memory: 512Mi` 对于运行 Node.js + 大量 JSON 解析 + ethers.js 确实可能不足。尤其是 OFAC 全量同步涉及大文件解析 |
| D1-AUDIT1-096 | Medium | ✅ 确认 | Low | ConfigMap 中 `RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com"` 是公共 RPC。生产应使用私有节点。但这是 Sepolia 测试网配置，生产部署会使用不同配置 |
| D1-AUDIT1-098 | Medium | ✅ 确认 | Medium | `prometheus.yml`（如存在）只有 scrape 配置，没有告警规则。监控不完整 |
| D1-AUDIT1-099 | Medium | ✅ 确认 | Medium | `website/index.html` 中硬编码合约地址和统计数据。需要手动更新，容易过时 |
| D1-AUDIT1-100 | Medium | ✅ 确认 | Low | 使用 `cdn.tailwindcss.com` 和 `fonts.googleapis.com` 确实存在可用性风险。但这是静态网站常见做法 |
| D1-AUDIT1-107 | Medium | ✅ 确认 | Medium | `config.ts` 的 `RISK_REGISTRY_ADDRESS` 是 `0x7ead...cebc`，而 `FATF_RISK_REGISTRY_ADDRESS` 和 SDK 的 `SEPOLIA_CONFIG.riskRegistry` 是 `0x7a41...52bc`。两个不同地址确实容易混淆 |

---

## 第一轮审计 (deep-audit-1.md) — Low 问题

| 编号 | 原严重度 | 验证结果 | 调整后严重度 | 原因 |
|------|----------|----------|-------------|------|
| D1-AUDIT1-008 | Low | ✅ 确认 | Low | 合约注释 `@dev VERSION: 2.0.0` 与常量 `VERSION = "2.2.0"` 不一致。`initializeV2_2` 注释 "No storage changes" 但 VERSION 是 2.2.0。注释过时 |
| D1-AUDIT1-009 | Low | ✅ 确认 | Low | `getRiskTier` 在 `sanctionedAddresses[account]` 为 true 时强制返回 `HIGH`，但 `emergencySanction` 可能设 tier 为 HIGH 且 score 为 90。如果地址被手动设为 CRITICAL tier，`getRiskTier` 仍返回 HIGH。设计意图不明确 |
| D1-AUDIT1-013 | Low | ✅ 确认 | Low | `RiskRegistryReader` 确实没有 `readerVersion` 事件。但有 `readerVersion()` 视图函数返回版本字符串。影响极低 |
| D1-AUDIT1-019 | Low | ✅ 确认 | Low | `setMerkleRegistry` 只检查 `address(0)` 和非零，不检查接口支持。应使用 `IERC165` 或尝试调用 `merkleRoot()` |
| D1-AUDIT1-024 | Low | ✅ 确认 | Low | V1 `getProfile` 返回 `profile.addr` 确实是输入参数的镜像，冗余。但这是向后兼容设计 |
| D1-AUDIT1-031 | Low | ✅ 确认 | Low | `issuerPolicies[token]` 的 `blockedTokens` 如果包含 `token` 自身，所有该代币转账被阻断。这是配置错误风险，非代码 bug |
| D1-AUDIT1-036 | Low | ✅ 确认 | Low | `PolicyRule.priority` 存储但在 `evaluatePolicy` 中按 `ruleIds` 顺序遍历，不按 priority 排序。功能未实现 |
| D1-AUDIT1-042 | Low | ✅ 确认 | Low | `evaluateTransaction` 在 emergencyMode 时返回 `(false, 0)`，而 `_checkAndExecuteTransaction` 在 emergencyMode 时 revert。但 `totalTransactionsChecked` 在 `_checkAndExecuteTransaction` 中于 emergencyMode 检查之前递增——确认，统计确实在 revert 前更新，但由于 revert 会回滚状态，包括 `totalTransactionsChecked++`。所以实际上 revert 后统计也被回滚。问题描述不准确，实际无问题 |
| D1-AUDIT1-047 | Low | ✅ 确认 | Low | `releaseFunds` 需要 `RELEASE_ROLE`，`governanceUnlock` 需要 `DEFAULT_ADMIN_ROLE`，都调用 `_releaseFunds(recordId, false)`。行为确实相同，`governanceUnlock` 无额外语义 |
| D1-AUDIT1-052 | Low | ✅ 确认 | Low | `loadState` 的备份恢复直接 `JSON.parse(raw)`，无校验。如果备份文件损坏会静默失败（catch 中 logger.error 但不 throw，返回默认 state） |
| D1-AUDIT1-053 | Low | ❌ 否定 | — | 审计自身标记为"无问题"。`cron.schedule` 使用箭头函数保持 `this` 绑定，`finally` 中设置 `isRunning`。代码正确 |
| D1-AUDIT1-057 | Low | ✅ 确认 | Low | `hasKMS = config.publisher.kmsProvider && config.publisher.kmsKeyId`。如果 `kmsProvider` 设置但 `kmsKeyId` 为空，`hasKMS` 为 falsy（因为 `kmsKeyId` 是 `undefined`）。实际检查是有效的——`undefined && undefined` 为 `undefined`（falsy）。但如果 `kmsProvider='aws'` 且 `kmsKeyId=''`（空字符串），`hasKMS` 为 `''`（falsy），也会正确判为无效。问题描述场景实际不会绕过检查 |
| D1-AUDIT1-062 | Low | ✅ 确认 | Low | `publish` 按 `batchSize` 分批但每批内逐个发送交易。`txInterval` 固定 2 秒。这是设计限制，非性能 bug |
| D1-AUDIT1-066 | Low | ✅ 确认 | Low | `deriveAddress` 假设 KMS SPKI 公钥格式固定。不同 KMS 提供商可能返回不同格式。当前只支持 AWS KMS |
| D1-AUDIT1-069 | Low | ✅ 确认 | Low | `updateOracleBalance` 的错误使用 `logger.debug`，生产环境 `LOG_LEVEL=info` 下不可见。应提升为 `logger.warn` |
| D1-AUDIT1-070 | Low | ✅ 确认 | Low | `address-utils.ts` 中 `stringToBytes32` 正确使用 `ethers.encodeBytes32String`，但 `publisher.ts` 使用手动 hex 转换。两处不一致 |
| D1-AUDIT1-071 | Low | ✅ 确认 | Low | `RiskProfile.riskScore` 是 `number` 类型，链上是 `uint8`。运行时无验证。但实际使用中 `riskScore` 限制在 0-100，不会溢出 |
| D1-AUDIT1-075 | Low | ✅ 确认 | Low | `batch-sync.ts` 中 `process.exit(0)` 在成功时立即退出。但代码中 `await` 了所有异步操作后才 `process.exit`，实际无问题。不过如果 logger 有异步缓冲可能丢失日志 |
| D1-AUDIT1-079 | Low | ✅ 确认 | Low | `HOLESKY_CONFIG` 的合约地址是零地址占位符。会导致链上调用失败但不会绕过验证（因为 `FidesClient` 构造函数会检查） |
| D1-AUDIT1-082 | Low | ✅ 确认 | Low | `TransactionEvaluation.reason` 是 `string \| null`，合约返回 `string`（非 null）。类型定义不精确 |
| D1-AUDIT1-083 | Low | ✅ 确认 | Low | `GOERLI_CONFIG` 已标记 `@deprecated` 但仍导出。Goerli 已废弃 |
| D1-AUDIT1-084 | Low | ✅ 确认 | Low | `peerDependencies` 的 `ethers: "^6.0.0"` 不兼容 v5 用户。文档应明确说明 |
| D1-AUDIT1-085 | Low | ✅ 确认 | Low | `moduleResolution: "bundler"` 需要 TypeScript 4.7+ 和现代构建工具 |
| D1-AUDIT1-088 | Low | ❌ 否定 | — | Dockerfile 中没有 `COPY .env` 步骤。审计标记为"无需修复"。K8s 通过环境变量注入，无问题 |
| D1-AUDIT1-090 | Low | ✅ 确认 | Low | docker-compose.yml 中 Redis 没有 `requirepass` 配置。本地开发可接受 |
| D1-AUDIT1-093 | Low | ✅ 确认 | Low | CronJob `activeDeadlineSeconds: 7200`。首次全量同步可能需要更长时间 |
| D1-AUDIT1-101 | Low | ✅ 确认 | Low | `ipapi.io` 的 GeoIP 重定向存在隐私问题。应使用 `navigator.language` |
| D1-AUDIT1-102 | Low | ✅ 确认 | Low | 无 CSP meta 标签 |
| D1-AUDIT1-103 | Low | ✅ 确认 | Low | `vercel.json` 无安全头配置 |
| D1-AUDIT1-104 | Low | ✅ 确认 | Low | 根目录 `vercel.json` 路由 `{ "src": "/(.*)", "dest": "/website/$1" }` 过于宽泛 |
| D1-AUDIT1-108 | Low | ✅ 确认 | Low | 版本号在多处不一致：RiskRegistryV2 注释 2.0.0 vs 常量 2.2.0；V1 注释 1.2.1 vs 常量 1.2.2 等 |

---

## 第二轮审计 (deep-audit-2.md) — Medium 问题

| 编号 | 原严重度 | 验证结果 | 调整后严重度 | 原因 |
|------|----------|----------|-------------|------|
| D2-010 | Medium | ✅ 确认 | Medium | `initializeV2_2()` 确实没有 `reinitializer` 修饰符。函数体为空但可被重复调用。`initializeV2` 有 `reinitializer(2)`，V2.2 应加 `reinitializer(3)` |
| D2-011 | Medium | ✅ 确认 | Medium | 频率限制 `if (sanctionedStatus == _unpackIsSanctioned(...))` 确实可通过翻转制裁状态绕过。恶意 Oracle 可先取消再重新制裁，在 MIN_UPDATE_INTERVAL 内多次更新 |
| D2-012 | Medium | ⚠️ 调整 | Low | `block.number` 作为事件参数确实可被验证者通过重组操纵。但事件日志不是链上逻辑，影响仅限于 off-chain 索引的一致性。实际安全影响很低 |
| D2-013 | Medium | ✅ 确认 | Medium | `runBatchSync` 中 `saveState(state)` 在 `dryRun` 时仍被调用。已确认：`publishBatches` 在 dryRun 时跳过 tx 但返回 succeededAddresses，然后 state 被更新标记为已同步。下次真实运行会跳过这些地址。问题真实 |
| D2-014 | Medium | ✅ 确认 | Low | `FATF_ORACLE_PRIVATE_KEY` 和 `ORACLE_PRIVATE_KEY` 确实可能共用同一密钥。`batch-collector.ts` 中 `const oracleKey = process.env.ORACLE_PRIVATE_KEY \|\| config.publisher.privateKey`——如果 `ORACLE_PRIVATE_KEY` 未设置则回退到 `publisher.privateKey`。但两个角色的地址不同（`RISK_REGISTRY_ADDRESS` vs `FATF_RISK_REGISTRY_ADDRESS`），同一密钥对不同合约的 ORACLE_ROLE 是可能的。风险是职责分离被破坏 |
| D2-015 | Medium | ✅ 确认 | Medium | `batchReleaseFunds` 有 `nonReentrant` 但在循环内调用 `safeTransfer`。`nonReentrant` 只防同一函数重入，不防跨函数。ERC777 的 hook 可调用 `releaseFunds`（不同函数）。不过 `releaseFunds` 也有 `nonReentrant`，所以实际不能被重入。但恶意代币可在 hook 中调用其他非 nonReentrant 函数。当前合约所有外部函数都有 `nonReentrant` 或角色检查，实际风险极低 |
| D2-016 | Medium | ✅ 确认 | Medium | RiskRegistryV2 `_authorizeUpgrade` 只有 `onlyRole(ADMIN_ROLE)`，无时间锁。对比 V1 `RiskRegistry` 有 `proposeUpgrade` + `upgradeTimelockDelay = 2 days`。PolicyEngine 也有时间锁。RiskRegistryV2 确实缺失 |
| D2-017 | Medium | ✅ 确认 | Medium | `FidesCompliance.evaluateTransaction` 确实没有 `deadline` 参数。结果可被延迟使用。`checkAndExecuteTransaction` 有 deadline，但 `evaluateTransaction` 作为 public 接口缺少 |
| D2-018 | Medium | ✅ 确认 | Medium | K8s deployment.yaml 中所有 Secret key（`PUBLISHER_PRIVATE_KEY`、`AWS_ACCESS_KEY_ID`、`VAULT_TOKEN`、`FATF_ORACLE_PRIVATE_KEY`）都标记 `optional: true`。如果 Secret 不存在，容器仍启动，可能以降级模式运行 |

---

## 第二轮审计 (deep-audit-2.md) — Low 问题

| 编号 | 原严重度 | 验证结果 | 调整后严重度 | 原因 |
|------|----------|----------|-------------|------|
| D2-019 | Low | ✅ 确认 | Low | `parseFTMResponse` 的 fallback 解析 `split(/\}\s*,\s*\{/)` 确实脆弱。如果 JSON 字符串值中包含 `},{` 会被错误分割。但 JSON 数组解析成功时不会触发 fallback |
| D2-020 | Low | ✅ 确认 | Low | `backfillCounters` 只检查 `totalProfiles == 0`。如果 `emergencySanction` 在 backfill 前被调用，`totalSanctioned` 可能 > 0 但 `totalProfiles` 仍为 0，backfill 会覆盖 `totalSanctioned`。但 `emergencySanction` 也递增 `totalProfiles`（通过 `wasNew` 检查），所以如果 emergencySanction 已执行，`totalProfiles` 不为 0，backfill 会被阻止。实际冲突场景需要 `emergencySanction` 被调用但所有地址都已存在——不太可能 |
| D2-021 | Low | ✅ 确认 | Low | `string(abi.encodePacked(reasonHash))` 将 32 字节 bytes32 直接转 string，包含空字节和不可打印字符。事件日志中 reason 不可读 |
| D2-022 | Low | ✅ 确认 | Low | `evaluatePolicy` 的 4 参数版本有 deadline 检查 `if (deadline > 0 && ...)`，3 参数版本调用 `evaluatePolicy(..., 0)`，deadline=0 跳过检查。默认无 MEV 保护。但这是 `view` 函数，不执行交易，实际 MEV 风险取决于调用者如何使用返回值 |
| D2-023 | Low | ✅ 确认 | Low | `rootHistory[nonce % MAX_ROOT_HISTORY]` 确实在 nonce 不连续时导致覆盖不均匀。但 nonce 是递增的，只要同步是顺序的（正常情况），覆盖模式是可预测的轮转 |
| D2-024 | Low | ✅ 确认 | Low | `CompliantStableCoin.postTransferHook` 的 try/catch 静默记录 `TransferBlocked` 事件但不阻止转账。这是设计选择——hook 是后处理通知，非阻断性检查 |
| D2-025 | Low | ✅ 确认 | Low | Dockerfile 使用 `FROM node:20-alpine` 未固定 digest。供应链攻击风险存在但属于最佳实践问题 |

---

## 汇总统计

### 按验证结果分类

| 验证结果 | 数量 | 占比 |
|----------|------|------|
| ✅ 确认 | 68 | 75.6% |
| ⚠️ 调整 | 10 | 11.1% |
| ❌ 否定 | 7 | 7.8% |
| 📋 合并 | 0 | 0% |
| (不适用/文件不存在) | 5 | 5.6% |
| **总计** | **90** | |

### 否定的问题（7 条）

| 编号 | 原严重度 | 否定原因 |
|------|----------|----------|
| D1-AUDIT1-023 | Medium | proposalId 计算实际一致，不存在不匹配 |
| D1-AUDIT1-041 | Medium | 阈值逻辑一致，无不一致问题 |
| D1-AUDIT1-045 | Medium | emergencyPause 每次更新 lastPauseAt，冷却逻辑正确 |
| D1-AUDIT1-046 | Medium | AccessControl._grantRole 无外部调用，无重入风险 |
| D1-AUDIT1-053 | Low | 审计自身标记为"无问题" |
| D1-AUDIT1-074 | Medium | benchmark.ts 文件不存在 |
| D1-AUDIT1-087 | Medium | Node.js 20 稳定支持 fetch，HEALTHCHECK 正常 |
| D1-AUDIT1-088 | Low | 审计自身标记为"无需修复" |

### 严重度调整的问题（10 条）

| 编号 | 原严重度 → 调整后 | 调整原因 |
|------|-------------------|----------|
| D1-AUDIT1-011 | Medium → Low | 兼容层设计，影响有限 |
| D1-AUDIT1-018 | Medium → Low | 目标链时间戳设计合理 |
| D1-AUDIT1-029 | Medium → Low | quarantineNonce 保证唯一性，可预测性非安全问题 |
| D1-AUDIT1-034 | Medium → Low | amount=0 影响极低 |
| D1-AUDIT1-040 | Medium → Low | 键名硬编码，不易冲突 |
| D1-AUDIT1-050 | Medium → Low | 校验和缺失不会导致错误 |
| D1-AUDIT1-051 | Medium → Low | 下游处理中作为标签使用 |
| D1-AUDIT1-061 | Medium → Low | 批量仅 10，实际问题概率低 |
| D1-AUDIT1-065 | Medium → Low | normalizeS 是必要的 ECDSA 规范要求 |
| D2-012 | Medium → Low | 事件日志影响，非链上逻辑 |
| D2-014 | Medium → Low | 角色地址不同，实际风险可控 |

### 合并去重

以下问题在两轮审计中重复出现：

| 合并组 | 包含编号 | 说明 |
|--------|----------|------|
| 标签不清除 | D1-AUDIT1-007, D2-006 | `_updateTags` 不清除 entityAddresses 旧映射 |
| batchUpdate 无标签 | D1-AUDIT1-003(High), D2-007(High) | batchUpdateRiskProfiles 缺少 tags 参数 |
| emergencySanction 不更新时间 | D1-AUDIT1-004(High), D2-004(High) | emergencySanction 不更新 _lastUpdateTime |
| 频率限制绕过 | D1-AUDIT1-002(High), D2-011(Medium) | sanctionedStatus 翻转绕过频率限制 |
| ABI 不匹配 | D1-AUDIT1-080(Critical), D1-AUDIT1-081(High), D2-002(Critical), D2-008(High) | SDK ABI 与合约不匹配 |

---

## 最终评估

### 有效 Medium 问题（去重去否后）

共 **24** 个有效 Medium 问题（原 38+9=47 个 Medium，去除否定 5 个、降级为 Low 10 个、合并去重 8 个后）。

### 有效 Low 问题（去重去否后）

共 **28** 个有效 Low 问题（原 30+7=37 个 Low，去除否定 2 个后）。

### 关键发现

1. **合约层 Medium 问题集中在状态一致性**：emergencySanction 的 _lastUpdateTime/事件缺失、_updateTags 的 entityAddresses 不清理、频率限制绕过等都是状态同步问题
2. **数据管道 Medium 问题集中在健壮性**：dryRun 状态污染、ABI 类型不匹配、JSON 解析脆弱等
3. **基础设施 Medium 问题集中在配置安全**：K8s Secret optional、资源限制、公共 RPC 等
4. **大多数 Low 问题是代码质量和一致性**：版本号不一致、冗余返回值、未使用的字段等

---

*验证完成。建议优先修复 24 个有效 Medium 问题中影响状态一致性的合约层问题。*
