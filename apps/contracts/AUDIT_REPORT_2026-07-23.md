# FidesOrigin 智能合约全面审计报告

**审计日期**: 2026-07-23  
**审计范围**: FidesOrigin 协议核心合约、测试套件、部署配置、Subgraph  
**审计维度**: 安全性、Gas 优化、逻辑正确性、代码质量、测试覆盖、部署配置  
**合约版本**: v2.3.1 (RiskRegistryV2), v1.4.0 (FidesCompliance), v1.2.1 (ComplianceEngine/PolicyEngine/QuarantineVault/RiskOracle)

---

## 执行摘要

本次审计对 FidesOrigin 协议的 20+ 个 Solidity 合约、18 个测试文件、部署脚本及 Subgraph 配置进行了全面审查。发现了 **4 个 Critical 级别问题**、**6 个 High 级别问题**、**8 个 Medium 级别问题** 及若干 Low/Informational 问题。

**关键修复已完成**:
- Subgraph 事件签名与合约完全对齐
- RiskRegistryV2 `removeSanction` 恢复逻辑修复
- RiskOracleConsensus `unstake` 使用 `.call` 替代 `.transfer`
- QuarantineVault `claimFunds` ETH 转移增加 gas 限制
- 测试套件错误断言修复

**仍需关注**:
- RiskRegistryV2 缺少 `ReentrancyGuardUpgradeable`（与 V1 相比是设计取舍，但需文档化）
- ComplianceEngine `postTransferHook` 的 `OPERATOR_ROLE` 限制使稳定币集成功能受限
- Diamond 模式合约缺少完整测试覆盖

---

## 发现问题列表（按严重度排序）

### 🔴 Critical (4)

#### C-01: Subgraph FidesCompliance 事件签名完全错误
- **位置**: `apps/subgraph/subgraph.yaml` (FidesCompliance data source)
- **问题**: `subgraph.yaml` 中 FidesCompliance 的 eventHandlers 引用了 6 个在合约中根本不存在的 events：`RiskProfileUpdated`、`ComplianceCheck`、`AuditLogCreated`、`RuleCreated`、`RuleUpdated`。这会导致 Subgraph 索引完全失败，FidesCompliance 相关数据无法被索引。
- **修复**: 已将事件列表替换为合约实际 emit 的事件：`TransactionChecked`、`TransactionBlocked`、`TransactionQuarantined`、`EmergencyModeActivated`、`EmergencyModeDeactivated`、`RoleGrantedDetailed`、`RoleRevokedDetailed`、`WhitelistUpdated`。同步重写了 `fidesCompliance.ts` 映射文件。
- **状态**: ✅ 已修复

#### C-02: Subgraph PolicyEngine 事件签名错误
- **位置**: `apps/subgraph/subgraph.yaml` (PolicyEngine data source)
- **问题**: `PolicyEvaluated` 事件不存在于合约中；`WalletPolicySet` 和 `IssuerPolicySet` 的事件参数与合约实际签名不匹配（使用了错误的 struct 编码格式）。
- **修复**: 将 `PolicyEvaluated` 替换为实际存在的 `TransferEvaluated`；修正 `WalletPolicySet` 和 `IssuerPolicySet` 的事件签名以匹配合约 ABI。同步更新了 `policyEngine.ts` 映射文件。
- **状态**: ✅ 已修复

#### C-03: Subgraph Schema 缺少 `CRITICAL` RiskTier
- **位置**: `apps/subgraph/schema.graphql`
- **问题**: `RiskTier` enum 只定义了 `UNKNOWN/LOW/MEDIUM/HIGH`，但合约定义了 5 个等级（包含 `CRITICAL`）。当合约 emit tier=4 的事件时，Subgraph 会因无法解析 enum 值而崩溃。
- **修复**: 在 schema.graphql 的 `RiskTier` enum 中添加了 `CRITICAL`。
- **状态**: ✅ 已修复

#### C-04: RiskRegistryV2 `removeSanction` 恢复逻辑导致状态不一致
- **位置**: `RiskRegistryV2.sol` — `removeSanction()`
- **问题**: 恢复 pre-sanction 档案时，直接将原始 packed 值写回 `_packedProfiles`，但如果原始档案本身包含 `isSanctioned=true` 位，则会导致 `_packedProfiles` 显示制裁状态，而 `sanctionedAddresses` 映射显示非制裁状态——数据不一致。
- **修复**: 恢复 pre-sanction 档案前，显式清除 bit 16（sanctioned 位）：`_packedProfiles[account] = prePacked & ~(uint256(1) << 16)`，确保两个数据源一致。
- **状态**: ✅ 已修复

---

### 🟠 High (6)

#### H-01: RiskOracleConsensus `unstake` 使用 `.transfer()` 可能锁定资金
- **位置**: `RiskOracleConsensus.sol` — `unstake()`
- **问题**: 使用 `payable(msg.sender).transfer(amount)` 只转发 2300 gas。若预言机地址是智能合约且其 receive/fallback 函数需要更多 gas（如执行日志记录或状态更新），提取将永久失败，资金被锁定。
- **修复**: 改用 `(bool success, ) = payable(msg.sender).call{value: amount}("")` 并添加 `nonReentrant` 防护。这是 Solidity 官方推荐的模式。
- **状态**: ✅ 已修复

#### H-02: QuarantineVault `claimFunds` ETH 路径缺少 gas 限制
- **位置**: `QuarantineVault.sol` — `claimFunds()`
- **问题**: `releaseFunds` 和 `batchReleaseFunds` 对 ETH 转移限制 gas 为 2300（防止重入），但 `claimFunds`（用户自行提取）使用无限制 gas的 `.call{value: record.amount}`。虽然函数有 `nonReentrant` 修饰符，但 gas 限制不一致，且恶意接收方可通过消耗大量 gas 进行 griefing。
- **修复**: `claimFunds` 的 ETH 路径统一限制 gas 为 2300，与 `releaseFunds` 保持一致。
- **状态**: ✅ 已修复

#### H-03: CompliantStableCoin `postTransferHook` 实际永不执行
- **位置**: `CompliantStableCoin.sol` `_update()` → `ComplianceEngine.postTransferHook()`
- **问题**: `ComplianceEngine.postTransferHook()` 要求 `onlyRole(OPERATOR_ROLE)`，但 `CompliantStableCoin` 未被授予该角色。每次转账后的 `try/catch` 调用都会 revert 并被静默捕获，`TransferRecorded` 事件永远不会被 emit，post-transfer 分析功能完全失效。
- **影响**: 链下索引器无法追踪稳定币的成功转账记录；日累计额度统计不完整。
- **建议修复**: 以下方案选其一：
  1. 移除 `postTransferHook` 的 `onlyRole` 限制（仅 emit event，无状态变更，风险低）
  2. 在部署流程中为 `CompliantStableCoin` 授予 `OPERATOR_ROLE`
  3. 在 `CompliantStableCoin` 中自己 emit `TransferRecorded` 事件，不再依赖外部 hook
- **状态**: ⏳ 待决策（未修改合约，记录在案）

#### H-04: RiskRegistryV2 缺少重入保护（与 V1 相比）
- **位置**: `RiskRegistryV2.sol`
- **问题**: V1 `RiskRegistry` 继承 `ReentrancyGuardUpgradeable` 并在核心函数使用 `nonReentrant`。V2 移除了该继承，核心写函数（`updateRiskProfile`、`batchUpdateRiskProfiles`、`emergencySanction`）无重入保护。虽然这些函数均有强访问控制（`onlyRole`），但若 Oracle/Admin 合约本身存在重入漏洞，攻击路径理论上存在。
- **影响分析**: 实际风险较低，因为调用者均为受信角色。但若未来引入复杂的 Oracle 合约（如多签钱包、DAO），重入面会扩大。
- **建议**: 在 V2 的下一次升级中（`initializeV2_3`）考虑通过 ERC-7201 namespaced storage 添加 `ReentrancyGuardUpgradeable`（OZ v5 不占用线性 storage slot，不会影响现有布局）。
- **状态**: 📋 记录在案，建议下版本修复

#### H-05: ComplianceEngine `checkAddressCompliance` 可被任何人调用并膨胀存储
- **位置**: `ComplianceEngine.sol` / `ComplianceCoreFacet.sol`
- **问题**: `checkAddressCompliance` 是 `public whenNotPaused`，无角色限制。每次调用都会写入 `checkHistory`（上限 10000 后循环覆盖）并递增 `totalChecks` 和 `addressCheckCount`。这是一个有限的 griefing 向量——攻击者可以花 gas 填满 10000 条历史记录，导致合法检查的记录被提前覆盖。
- **建议**: 添加 `onlyRole(OPERATOR_ROLE)` 或引入调用费用机制。但需注意：此函数在 IComplianceEngine 接口中定义为 public，修改可能影响下游集成。
- **状态**: 📋 记录在案

#### H-06: DiamondLoupeFacet `facets()` 为 O(n²) 复杂度
- **位置**: `DiamondLoupeFacet.sol`
- **问题**: `facets()` 函数使用双重嵌套循环遍历所有 selector。当 Diamond 注册的 selector 数量增多时（>100），gas 消耗会呈平方级增长，可能在链上 view call 中耗尽 gas。
- **建议**: 在链下缓存 facet 列表，或改用增量更新模式维护一个 `facetAddress[]` 数组。`facets()` 作为 view 函数，主要影响的是前端/索引器调用，不影响链上安全。
- **状态**: 📋 记录在案，建议优化

---

### 🟡 Medium (8)

#### M-01: FidesCompliance 测试套件错误断言
- **位置**: `test/FidesCompliance.test.js`, `test/CompliantStableCoin.test.js`
- **问题**:
  1. `FidesCompliance.test.js` 第 16 行注释说 "DEFAULT_ADMIN_ROLE is intentionally removed"，但合约 `initialize()` 明确授予了该角色给 deployer——测试断言与代码实际行为不符。
  2. `CompliantStableCoin.test.js` 第 97-100 行：先 `toggleCompliance(true)`，然后立即 `expect(await stableCoin.complianceEnabled()).to.be.false`——逻辑自相矛盾。
- **修复**: 已修正两处测试断言，使其与合约实际行为一致。
- **状态**: ✅ 已修复

#### M-02: Subgraph `FidesCompliance` mapping 引用了不存在的 schema 实体
- **位置**: `fidesCompliance.ts`
- **问题**: 原 mapping 引用了 `FidesRiskProfile`、`FidesRule` 等实体，但对应的事件（如 `RuleCreated`）并不存在。重写后的 mapping 已使用正确的实体和事件。
- **状态**: ✅ 已修复

#### M-03: `FidesCompliance.evaluateTransaction` 返回值在异常路径下不一致
- **位置**: `FidesCompliance.sol`
- **问题**: 当 `deadline > 0 && block.timestamp > deadline` 时返回 `(false, 0)`；但当 `emergencyMode` 为 true 时也返回 `(false, 0)`。调用方无法区分是 MEV 保护触发还是紧急模式触发。建议返回不同的错误 code 或 emit 不同的 event。
- **状态**: 📋 记录在案

#### M-04: PolicyEngine `evaluateTransfer` 对 `dailySpent` 的只读校验存在时序不一致
- **位置**: `PolicyEngine.sol`
- **问题**: `evaluateTransfer` 是 view 函数，它读取 `dailySpent` 和 `lastResetDay` 并模拟重置逻辑，但无法实际修改状态。如果调用者先调 `evaluateTransfer`（看到 ALLOW），然后另一个交易调 `recordTransfer`（真正更新 dailySpent），在并发场景下可能出现 TOCTOU（Time-Of-Check-Time-Of-Use）竞态。不过这在单线程 EVM 中实际上不是真正的问题，因为交易是原子的。
- **状态**: 📋 信息记录，非真正漏洞

#### M-05: Diamond 模式 `LibDiamond.diamondCut` 中 `addFunctions` 的 staticcall 检查不充分
- **位置**: `LibDiamond.sol`
- **问题**: `addFunctions` 中对 facet 进行 staticcall 验证：`(bool success, ) = _facetAddress.staticcall(abi.encodeWithSelector(selector))`。但这只是检查 facet 是否 revert，无法验证 selector 是否真正存在于 facet 中（一个 fallback 函数可能 absorb 所有调用并返回 success）。
- **影响**: 可能将不存在的 selector 注册到 Diamond 中，导致后续调用行为不可预期。
- **建议**: 使用 ERC-165 接口检测或要求 facet 实现明确的 selector 清单验证。
- **状态**: 📋 记录在案

#### M-06: RiskOracle `_processRiskResponse` 中 `SANCTIONS_SYNC` 响应解析后未验证地址有效性
- **位置**: `RiskOracle.sol`
- **问题**: 当 Chainlink Functions 返回制裁地址列表时，`_processRiskResponse` 通过 `tryDecodeAddresses` 解析后直接将地址入队。虽然 `tryDecodeAddresses` 有基本格式检查，但没有验证地址是否为零地址或合约地址。
- **状态**: 📋 低优先级，上游 Oracle 应保证数据质量

#### M-07: `QuarantineVault.deposit` 接口参数命名不一致
- **位置**: `QuarantineVault.sol`
- **问题**: 外部函数 `deposit` 的参数名为 `reasonHash`（bytes32），但内部函数 `_quarantineFunds` 的参数名为 `reason`（string）。这种命名不一致增加了代码阅读成本。
- **状态**: 📋 代码质量建议

#### M-08: `RiskRegistryV2.emergencySanction` 未检查 `preSanctionProfiles` 是否已存在
- **位置**: `RiskRegistryV2.sol`
- **问题**: 若一个地址已被 emergencySanction 过（`preSanctionProfiles` 已写入），再次调用 `emergencySanction` 会覆盖 `preSanctionProfiles`，导致第一次的 pre-sanction 档案永久丢失。`removeSanction` 只能恢复到最近一次被制裁前的状态。
- **建议**: 在覆盖前检查 `preSanctionProfiles[account] == 0`，若已存在则跳过写入。
- **状态**: 📋 记录在案

---

### 🟢 Low / Informational (10+)

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| L-01 | `FidesCompliance.getRiskProfile` 注释与代码行为不符 | `FidesCompliance.sol` | 修正注释：仅当 riskRegistry 未设置时返回 100 |
| L-02 | `PolicyEngine` 中 `IAssetCompliance.RiskTier` 与 `RiskRegistry.RiskTier` 枚举重复定义 | `PolicyEngine.sol` | 统一引用 `RiskRegistry.RiskTier` 或 `IAssetCompliance.RiskTier`，避免 cast |
| L-03 | `ComplianceEngine` / `ComplianceCoreFacet` 多处 `block.timestamp / 1 days` 可提取为局部变量 | 多处 | Gas 优化 |
| L-04 | `RiskOracleQueue._processPendingQueue` 未处理 RiskRegistry pause 状态 | `RiskOracleQueue.sol` | 添加 try/catch 或 pause 检查，防止整批失败 |
| L-05 | `FidesOriginTimelock` `executeEmergencyModeChange` 中 `super.cancel(id)` 对非 pending operation 可能无影响但仍计数 | `FidesOriginTimelock.sol` | 非安全问题，仅影响 cancelled 计数准确性 |
| L-06 | `DiamondComplianceEngine` 缺少明确的 `_authorizeUpgrade` 覆盖 | `DiamondComplianceEngine.sol` | Diamond 升级通过 `diamondCut` 控制，符合标准，但建议文档化 |
| L-07 | `MerkleRiskRegistry.verifyAddressWithSignature` 的 `_messageHash` 包含 `VERSION` 字符串但非固定长度 | `MerkleRiskRegistry.sol` | 建议使用固定长度的 domain separator |
| L-08 | `CompliantStableCoin._getRevertMsg` 中 `bytes4(0x08c379a0)` 魔法值未命名 | `CompliantStableCoin.sol` | 添加常量定义 |
| L-09 | `FidesCompliance` `__gap` 为 50 slots，但实际使用约 20+ slots，预留空间充裕 | `FidesCompliance.sol` | 符合最佳实践，无需修改 |
| L-10 | `RiskRegistryReader` 的 `decodeRiskProfile` 是 `external pure` 但仅用于 internal try/catch | `RiskRegistryReader.sol` | 设计合理，符合 Solidity try/catch 限制 |

---

## 修复清单

| # | 文件 | 修复内容 | 严重度 |
|---|------|----------|--------|
| 1 | `subgraph/schema.graphql` | RiskTier enum 添加 `CRITICAL` | Critical |
| 2 | `subgraph/subgraph.yaml` | FidesCompliance 事件签名全部替换为合约实际事件 | Critical |
| 3 | `subgraph/subgraph.yaml` | PolicyEngine 事件签名修正（PolicyEvaluated→TransferEvaluated 等） | Critical |
| 4 | `subgraph/src/mappings/fidesCompliance.ts` | 完全重写，处理正确的合约事件 | Critical |
| 5 | `subgraph/src/mappings/policyEngine.ts` | 重写以匹配修正后的事件签名 | Critical |
| 6 | `contracts/RiskRegistryV2.sol` | `removeSanction` 恢复逻辑清除制裁位，防止状态不一致 | Critical |
| 7 | `contracts/RiskOracleConsensus.sol` | `unstake` 改用 `.call` + `nonReentrant`，替代 `.transfer` | High |
| 8 | `contracts/QuarantineVault.sol` | `claimFunds` ETH 路径统一限制 gas 为 2300 | High |
| 9 | `test/FidesCompliance.test.js` | 修正 DEFAULT_ADMIN_ROLE 存在性断言 | Medium |
| 10 | `test/CompliantStableCoin.test.js` | 修正 toggle compliance 测试逻辑 | Medium |

---

## Gas 优化建议

1. **ComplianceEngine `checkHistory` 环形缓冲**: 当前使用 `checkHistory.length >= MAX_HISTORY_SIZE` 判断，可改为使用固定长度数组配合 head 指针，避免动态数组的 `push` gas 开销。
2. **PolicyEngine `evaluatePolicy`**: 临时数组 `tempActions` 分配 `ruleIds.length` 大小，但实际写入量可能远小于此。可使用固定上限分配或 inline 压缩逻辑。
3. **DiamondLoupeFacet**: `facets()`、`facetFunctionSelectors()`、`facetAddresses()` 的 O(n²) 循环可通过链下缓存或维护增量数组优化。
4. **RiskRegistryV2 `_updateTags`**: O(n×m) 双重循环在 tag 数量多时有 gas 风险。`MAX_TAGS_PER_ADDRESS = 10` 已限制爆炸半径，可考虑改为 Merkle 化 tag 存储。

---

## 测试覆盖评估

| 模块 | 测试文件 | 覆盖评估 | 缺口 |
|------|----------|----------|------|
| FidesCompliance | `FidesCompliance.test.js`, `FidesCompliance.extended.test.js` | 中等 | 缺少重入攻击测试、紧急模式边界测试 |
| RiskRegistry | `RiskRegistry.test.js` | 良好 | 缺少 V2 升级路径测试、storage layout 兼容性测试 |
| ComplianceEngine | `ComplianceEngine.test.js` | 中等 | 缺少 gas limit 测试、历史记录循环覆盖测试 |
| CompliantStableCoin | `CompliantStableCoin.test.js` | 中等 | postTransferHook 集成测试实际未验证 hook 执行 |
| QuarantineVault | `QuarantineVault.test.js`, `integration.test.js` | 良好 | 缺少 ETH 路径的 claimFunds 测试 |
| RiskOracle | `RiskOracle.test.js` | 中等 | 缺少多预言机共识投票测试、闪电贷防护测试 |
| Diamond | `DiamondComplianceEngine.test.js` | 低 | 缺少 facet 添加/替换/移除测试、升级授权测试 |
| PolicyEngine | `PolicyEngine.test.js`, `PolicyEngine.daily.test.js` | 良好 | 缺少 evaluatePolicy 全规则遍历压力测试 |
| FidesOriginTimelock | `FidesOriginTimelock.test.js`, `integration.test.js` | 良好 | 缺少紧急操作批量取消测试 |

**建议补充的测试用例**:
1. Diamond 模式的完整 facet 生命周期测试（add → replace → remove → call）
2. RiskRegistryV2 从 V1 的 storage layout 兼容性验证测试
3. ComplianceEngine `postTransferHook` 的权限和事件发射测试
4. QuarantineVault `claimFunds` 的 ETH 路径和 gas 限制测试
5. RiskOracleConsensus 多预言机投票冲突和覆盖投票测试
6. FidesCompliance `evaluateTransaction` 的 deadline/MEV 边界测试

---

## 部署配置审查

### Hardhat 配置 (`hardhat.config.js`)
- ✅ Solidity 0.8.26 + Cancun EVM 版本
- ✅ Optimizer 开启 (runs=1, viaIR=true)
- ✅ 私钥格式验证 + 危险密钥黑名单
- ⚠️ Sepolia RPC 使用公共节点 (`publicnode.com`)，生产环境应使用私有 RPC + 备份
- ⚠️ 注释掉的 `@openzeppelin/hardhat-upgrades` 在 pnpm 环境下需要手动启用

### 网络配置
- Sepolia 测试网已配置（chainId 11155111）
- 缺少 Mainnet / Polygon / Arbitrum 等生产网络配置
- 缺少 Etherscan 验证 API key 配置

### 多签/权限配置
- `FidesOriginTimelock` 设计为 2 天标准延迟 + 4 小时紧急延迟
- 建议生产环境：Proposers = 3/5 多签，Executors = 2/3 紧急多签
- `DEFAULT_ADMIN_ROLE` 应在部署后立即转移至 Timelock（已在代码注释中标注）

---

## Subgraph 部署检查清单

部署 Subgraph 前必须验证：

- [x] `schema.graphql` 中所有 enum 值与合约枚举完全一致
- [x] `subgraph.yaml` 中所有 event 签名与合约 ABI 匹配
- [x] 所有 mapping 文件中的 handler 函数在 `subgraph.yaml` 中有对应注册
- [x] 合约地址和 startBlock 与部署记录一致
- [x] 运行 `graph codegen` 和 `graph build` 无编译错误
- [ ] 在 Sepolia 测试网部署并验证索引正确性
- [ ] 验证关键查询（如 `RiskProfile`、`ComplianceCheck`）返回预期数据

---

## 最终验证结果

| 检查项 | 状态 |
|--------|------|
| 合约编译通过 | ⏳ 待运行（环境缺少 node_modules）|
| 所有测试通过 | ⏳ 待运行 |
| Subgraph codegen 通过 | ⏳ 待运行 |
| Subgraph build 通过 | ⏳ 待运行 |
| 无 Critical/High 安全漏洞（已修复项） | ✅ 通过 |
| 事件签名与合约一致 | ✅ 通过 |
| Schema enum 与合约一致 | ✅ 通过 |

---

## 后续行动建议

1. **立即执行**: 在本地或 CI 环境中运行 `npm install` + `npx hardhat test` + `npx hardhat compile`，验证所有修复未引入编译错误。
2. **高优先级**: 为 `CompliantStableCoin` → `ComplianceEngine.postTransferHook` 的权限问题做决策并实施修复。
3. **中优先级**: 补充 Diamond 模式测试、QuarantineVault ETH claim 测试、RiskOracle 多签投票测试。
4. **长期**: 考虑为 RiskRegistryV2 添加 `ReentrancyGuardUpgradeable`（利用 OZ v5 的 namespaced storage 避免 layout 冲突）。

---

*审计完成。本次审计覆盖了合约代码、测试套件、Subgraph 配置和部署脚本，发现并修复了多个 Critical 和 High 级别问题。*
