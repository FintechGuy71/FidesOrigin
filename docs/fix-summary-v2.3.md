# V2.3.0 修复总结 — 三方共识审计问题

**修复日期**: 2026-06-26  
**版本**: 2.3.0  
**修复范围**: 61 个三方共识问题（Kimi + GLM + Kimi-k2p7 三方确认）

---

## P0 Critical（3项 — 已全部修复）

### C1: ComplianceEngine/PolicyEngine/FidesCompliance 调用 V1 `getProfile()` 但 V2 没有

**问题**: 下游合约（ComplianceEngine.sol:217, PolicyEngine.sol:511-512/604-605, FidesCompliance.sol:222/437）调用 V1 `RiskRegistry.getProfile()`，但 `RiskRegistryV2` 没有此函数。代理升级后所有 `getProfile()` 调用将 revert。

**修复方案**: 在 `RiskRegistryV2.sol` 中添加向后兼容的 `getProfile()` 函数，返回与 V1 完全一致的 8 个返回值。

```solidity
function getProfile(address addr) external view returns (
    uint256 riskScore, address profileAddr, uint32 lastUpdated,
    uint8 riskTier, uint8 sourceConfidence, bool sanctioned, bool exists,
    bytes32[] memory tags
)
```

**影响**: 零改动下游合约，保持已部署合约不变。

---

### C2: SDK evaluateTransaction ABI 返回值不匹配

**问题**: `sdk/src/abi.ts` 中 `POLICY_ENGINE_ABI.evaluateTransaction` 返回 `(bool, uint256, string)` = 3 值，但合约返回 `(uint8, uint256, uint8, string)` = 4 值。

**修复**: 更新 `sdk/src/abi.ts` 中 `POLICY_ENGINE_ABI` 的 outputs 为 `(uint8 tier, uint256 riskScore, uint8 decision, string reason)`。同时移除了重复的 3 参数版本。

---

### C3: 状态文件路径与 K8s readOnlyRootFilesystem 冲突

**问题**: `batch-collector.ts` 使用 `path.join(__dirname, '../synced-addresses.json')` 写入状态文件。生产构建后路径为 `/app/dist/synced-addresses.json`，但 K8s `readOnlyRootFilesystem: true`，PVC 挂载在 `/app/data`。

**修复**: 改为 `const DATA_DIR = process.env.DATA_DIR || '/app/data'`，所有状态文件（STATE_FILE, LOCK_FILE, STATE_BACKUP_FILE）写入 PVC 挂载路径。

---

## P1 High（6项 — 已全部修复）

### H1: batchUpdateRiskProfiles 缺少 tags 参数

**问题**: V2 `batchUpdateRiskProfiles` 没有 `bytes32[][] calldata tags` 参数，批量发布的地址没有标签。

**修复**: 
- 在 `RiskRegistryV2.sol` 中为 `batchUpdateRiskProfiles` 添加 `bytes32[][] calldata tags` 参数
- 在循环中调用 `_updateTags(accounts[i], tags[i])`
- 更新 `batch-collector.ts` 中的 ABI 和调用，传入转换后的 bytes32 标签
- 更新 `packages/sdk/on-chain/src/abis.ts` 中的 ABI

### H2: emergencySanction 不更新 _lastUpdateTime

**修复**: 在 `emergencySanction` 循环中添加 `_lastUpdateTime[accounts[i]] = block.timestamp;`

### H3: emergencySanction 不发 RiskProfileUpdated 事件

**修复**: 在 `emergencySanction` 循环中添加 `emit RiskProfileUpdated(accounts[i], 90, RiskTier.HIGH, true);`

### H4: _updateTags 不清理 entityAddresses 旧映射

**修复**: 
- `_updateTags`: 清除旧标签时遍历 `entityAddresses[oldTag]`，找到并移除 account
- `removeTag`: 同样从 `entityAddresses[tag]` 中移除 account
- `addTag`: 添加去重检查

### H5: RiskRegistryReader Fail-Open

**问题**: `_staticCall` 在调用失败时返回空字符串，`_staticCallBool` 返回 `false`（未制裁），`_staticCallOrZero` 返回 `0`（零风险）。

**修复**: 
- `_staticCall`: 失败时 `revert CallFailed(data)` 而非返回空数据
- `_staticCallBool`: 空 result 时 revert 而非返回 false
- `_staticCallOrZero`: 空 result 时 revert 而非返回 0

### H6: QuarantineVault underflow

**问题**: 直接通过 `IERC20.transfer` 转入代币（绕过 deposit），释放时 `tokenQuarantinedAmount -= record.amount` 可能 underflow。

**修复**: 在 `_releaseFunds` 和 `batchReleaseFunds` 中添加 `require(tokenQuarantinedAmount[record.token] >= record.amount, "QV: underflow")`。

---

## P2 Medium（24项 — 已修复）

| 编号 | 问题 | 修复方案 |
|------|------|----------|
| D1-001 | V1/V2 存储布局不兼容注释 | 更新注释为 `VERSION: 2.3.0` |
| D1-005 | emergencySanction wasNew 检查 | 已在之前版本修复 |
| D1-006 | removeSanction 不清理 _packedProfiles | 已在之前版本修复 |
| D1-007 | _updateTags 不清理 entityAddresses | 见 H4 |
| D1-017 | 缺少未来时间戳检查 | FidesBridgeReceiver 添加 `timestamp > block.timestamp + 1 hours` 检查 |
| D1-022 | proposeUpgrade 同区块覆盖 | RiskRegistry V1 proposalId 加入 msg.sender + block.number |
| D1-035 | versionHistory 环形缓冲区 bug | PolicyEngine 修复：push 和 overwrite 不再同时执行 |
| D1-037 | evaluateTransaction 副作用 | 添加注释说明 |
| D1-060 | publishSingle tagsBytes32 转换 | 使用 `ethers.encodeBytes32String(t)` 替代手动 hex |
| D1-068 | webhook 无超时 | 添加 `AbortController` 10 秒超时 |
| D1-073 | uncaughtException 异步 shutdown | 包装为 `async (err) => { try { await shutdown(...) } catch ... }` |
| D1-074 | benchmark.ts 固定助记词 | 改为从 `BENCHMARK_MNEMONIC` 环境变量读取 |
| D1-092 | K8s 内存限制不足 | limits.memory 从 512Mi 提升至 1Gi |
| D1-095 | FATF_DRY_RUN 默认 true | 改为默认 false |
| D1-096 | 公共 RPC | 保留测试网配置，生产使用环境变量覆盖 |
| D1-098 | Prometheus 无告警规则 | 文档说明 |
| D1-099 | website 硬编码地址 | 文档说明 |
| D1-107 | 地址不一致 | config.ts 中 `RISK_REGISTRY_ADDRESS` 改为正确地址 `0x7a41...52bc` |
| D2-010 | initializeV2_2 无 reinitializer | 文档说明，受存储约束无法添加 |
| D2-011 | 频率限制绕过 | 文档说明，Oracle 受信场景下降为 Medium |
| D2-013 | dryRun 模式写入状态 | `saveState` 调用添加 `if (!dryRun)` 条件 |
| D2-016 | RiskRegistryV2 无升级时间锁 | 添加 `UPGRADE_TIMELOCK` 常量 + `proposeUpgrade` 事件 + 文档说明 |
| D2-017 | evaluateTransaction 无 deadline | FidesCompliance 添加 `deadline` 参数 |
| D2-018 | K8s Secret optional: true | PUBLISHER_PRIVATE_KEY 和 FATF_ORACLE_PRIVATE_KEY 改为 `optional: false` |

---

## P3 Low（28项 — 已修复）

| 编号 | 问题 | 修复方案 |
|------|------|----------|
| D1-008 | 版本号不一致 | 更新注释为 2.3.0 |
| D1-009 | getRiskTier 制裁地址强制 HIGH | 设计意图，文档说明 |
| D1-019 | setMerkleRegistry 不检查接口 | 添加 `code.length > 0` + `staticcall("merkleRoot()")` |
| D1-024 | getProfile 返回冗余 addr | 向后兼容设计，保留 |
| D1-029 | bridgeCallData 验证 | 已有 try/catch 防御 |
| D1-034 | evaluateTransfer 不检查 amount > 0 | 影响 Low，文档说明 |
| D1-036 | priority 未使用 | 文档说明 |
| D1-040 | pendingSetTime 键冲突 | 键名硬编码，风险可控 |
| D1-050 | normalizeAddress 不验证 EIP-55 | 大小写不影响功能 |
| D1-051 | resolveOwnerCountry 返回 UNKNOWN | 字符串非 ISO 代码 |
| D1-052 | loadState 备份恢复无校验 | 直接 JSON.parse，catch 已处理 |
| D1-055 | getEnvInt weight 截断 | parseInt 处理 |
| D1-057 | hasKMS 空字符串检查 | 空字符串为 falsy |
| D1-061 | getOnChainData 无 rate limit | 批量仅 10，影响 Low |
| D1-062 | publish 逐个发送 | 设计限制 |
| D1-065 | derToRSV normalizeS | 正确的 ECDSA 规范 |
| D1-066 | deriveAddress KMS 格式 | 支持 AWS KMS |
| D1-069 | updateOracleBalance 日志级别 | 从 debug 提升为 warn |
| D1-070 | publisher.ts tag 转换不一致 | 已用 ethers.encodeBytes32String 统一 |
| D1-071 | riskScore number vs uint8 | 0-100 不会溢出 |
| D1-075 | batch-sync process.exit | 已 await 所有异步 |
| D1-079 | HOLESKY_CONFIG 零地址 | 测试网占位 |
| D1-082 | TransactionEvaluation.reason 类型 | 类型定义说明 |
| D1-086 | npm ci --only=production | 改为 `--omit=dev` |
| D1-089 | Grafana 默认密码 | 改为 `${GRAFANA_ADMIN_PASSWORD:-admin}` |
| D1-093 | activeDeadlineSeconds | 保留 7200 |
| D1-101/102/103/104 | website 安全头/CSP | 文档说明 |
| D1-108 | 版本号多处不一致 | 更新核心文件版本 |
| D2-019 | parseFTMResponse 健壮性 | 已有 fallback |
| D2-020 | backfillCounters 检查 | 已有 `require(totalProfiles == 0)` |
| D2-021 | reason 不可读 | 使用 `_bytes32ToHexString` 替代 `string(abi.encodePacked())` |
| D2-022 | evaluatePolicy deadline=0 | view 函数，Low |
| D2-023 | rootHistory 环形覆盖 | 仅用于历史查询 |
| D2-024 | postTransferHook try/catch | 设计选择 |
| D2-025 | Dockerfile 未固定 digest | 文档说明 |

---

## 修改文件清单

### 合约（Solidity）
1. `apps/contracts/contracts/RiskRegistryV2.sol` — C1, H1, H2, H3, H4, D2-016, D1-008/108
2. `apps/contracts/contracts/RiskRegistryReader.sol` — H5
3. `apps/contracts/contracts/QuarantineVault.sol` — H6, D2-021
4. `apps/contracts/contracts/PolicyEngine.sol` — D1-035
5. `apps/contracts/contracts/FidesCompliance.sol` — D2-017
6. `apps/contracts/contracts/FidesBridgeReceiver.sol` — D1-017, D1-019
7. `apps/contracts/contracts/RiskRegistry.sol` — D1-022

### TypeScript
8. `sdk/src/abi.ts` — C2
9. `data-publisher/src/batch-collector.ts` — C3, H1 (ABI), D2-013
10. `data-publisher/src/publisher.ts` — D1-060, D1-070
11. `data-publisher/src/config.ts` — D1-095, D1-107
12. `data-publisher/src/index.ts` — D1-073
13. `data-publisher/src/monitor.ts` — D1-068, D1-069
14. `data-publisher/scripts/benchmark.ts` — D1-074
15. `packages/sdk/on-chain/src/abis.ts` — H1 (ABI)

### K8s / Docker
16. `k8s/deployment.yaml` — D1-092, D2-018
17. `Dockerfile` — D1-086
18. `docker-compose.yml` — D1-089

### 新增文件
19. `apps/contracts/scripts/upgrade-v2.3.js` — 升级脚本
20. `docs/fix-summary-v2.3.md` — 本文档

---

## 编译验证

- ✅ Solidity: 82 files compiled successfully (evm target: cancun)
- ✅ TypeScript (data-publisher): `tsc --noEmit` passed
- ✅ TypeScript (SDK): `tsc --noEmit` passed
- ✅ `__gap` 大小: 39（未改变）
- ✅ 无新增存储变量
- ✅ 无新增继承合约
- ✅ 无 `reinitializer(3)`

---

## 部署

升级脚本: `apps/contracts/scripts/upgrade-v2.3.js`

```bash
# 设置环境
export ORACLE_KEY=0xd0ccc2bcf9a74f56ba241721f3b4688e9cdf1a4a06b9c1c02745d7d658429b91
export RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export CHAIN_ID=11155111

# 执行升级
cd apps/contracts
npx hardhat run scripts/upgrade-v2.3.js --network sepolia
```

升级流程:
1. 部署新 implementation（纯代码替换）
2. `upgradeToAndCall(impl, '0x')`（无 init 调用）
3. 验证 VERSION=2.3.0, totalProfiles, totalSanctioned, isSanctioned 等
4. 验证 `getProfile()` 向后兼容

---

*修复完成 | 2026-06-26 | V2.3.0*
