# GLM-5.2 合约审查报告

> **审查人**: GLM-5.2 (独立审计)  
> **日期**: 2026-06-29  
> **项目**: FidesOrigin Demo — 智能合约层  
> **审查范围**: 15 个文件（11 合约 + 1 接口 + 1 测试 fixture + 2 示例合约）  
> **背景**: Kimi k2p7 多Agent集群已完成 3 轮审计+修复+交叉检验，本次为独立复审

---

## 审查范围

| # | 文件 | 类型 | 行数(约) |
|---|------|------|----------|
| 1 | `FidesCompliance.sol` | 主合规入口 | 430 |
| 2 | `ComplianceEngine.sol` | 核心合规引擎(UUPS) | 390 |
| 3 | `PolicyEngine.sol` | 策略引擎(UUPS) | 470 |
| 4 | `RiskRegistryV2.sol` | 风险注册表V2(UUPS) | 420 |
| 5 | `RiskRegistry.sol` | 风险注册表V1(UUPS) | 380 |
| 6 | `QuarantineVault.sol` | 隔离资金池 | 340 |
| 7 | `FidesOriginTimelock.sol` | 时间锁控制器 | 100 |
| 8 | `RiskOracle.sol` | Chainlink预言机 | 530 |
| 9 | `FidesBridgeReceiver.sol` | 跨链接收器(UUPS) | 170 |
| 10 | `MerkleRiskRegistry.sol` | Merkle风险注册表 | 310 |
| 11 | `examples/CompliantSmartWalletBase.sol` | 合规钱包基类 | 480 |
| 12 | `examples/CompliantSmartWallet.sol` | 签名钱包 | 130 |
| 13 | `examples/CompliantStableCoin.sol` | 合规稳定币 | 350 |
| 14 | `interfaces/IComplianceEngine.sol` | 合规引擎接口 | 110 |
| 15 | `test/shared/fixtures.js` | 部署测试夹具 | 240 |

---

## 逐文件分析

### 文件 1: FidesCompliance.sol (v1.3.1)

**行 1-50: 合约声明与常量**
- 继承 `AccessControl, Pausable, ReentrancyGuard`，非升级。合理。
- 常量定义清晰：`MAX_DEADLINE_DURATION=5min`、`SETTER_DELAY=48h` 等。

**行 50-120: 状态变量**
- 两步确认 `pending*` 变量 + `pendingSetTime` 映射。设计合理。

**行 120-180: 构造函数**
- ✅ 验证所有依赖地址非零且为合约（`code.length > 0`）。
- ✅ `_setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE)` → ADMIN 自管理。
- ✅ `renounceRole(DEFAULT_ADMIN_ROLE, msg.sender)` 移除后门。

**行 180-280: evaluateTransaction**
- ✅ Fail-Closed：所有异常路径返回 `(false, 0)`。
- ✅ 非 view 设计合理（下游引擎有状态更新）。

**行 280-360: checkAndExecuteTransaction**
- ✅ 强制 deadline 校验（H-02）。
- ✅ `nonReentrant` + `whenNotPaused`。
- ✅ H-01：阻塞/隔离路径不 revert，保证统计持久化。
- 🔴 **C-01 发现问题**: 调用 `complianceEngine.checkTransferWithDeadline(from, to, ...)` 时，ComplianceEngine 内部检查 `msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)`。此时 `msg.sender = FidesCompliance 合约地址`。**必须在部署时授予 FidesCompliance 在 ComplianceEngine 上的 OPERATOR_ROLE**，否则所有交易检查 revert `UnauthorizedCaller`。
- ✅ quarantineId 使用 `blockhash + msg.sender + nonce + gasleft` 增强唯一性。

**行 360-430: Admin 函数**
- ✅ 两步确认 + 48h 时间锁。
- ✅ 紧急模式有冷却期和最小持续时间。
- ✅ 阈值参数交叉验证（`min < max`）。

---

### 文件 2: ComplianceEngine.sol (v1.2.1)

**行 1-100: 初始化**
- ✅ `_disableInitializers()` + `reinitializer` 保护。
- ✅ L-15：先设角色 admin 关系再 renounce DEFAULT_ADMIN。
- ✅ `__gap = 50`。

**行 100-180: checkAddressCompliance**
- ✅ S-05 Fail-Closed：未知地址默认不合规。
- ⚠️ **GAS-01**: 每次调用写入 `checkHistory` + `totalChecks++`。在 `checkTransferWithDeadline` 中被调用两次（from + to），双倍状态写入。建议将统计更新移到调用方。

**行 180-300: checkTransferWithDeadline**
- 🔴 **C-01 关联**: `msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)` — FidesCompliance 作为中间人需要 OPERATOR_ROLE。
- ✅ deadline 校验 + MEV 保护。
- ✅ 短路返回（from 不合规直接 BLOCK）。
- ✅ C-02：日限额检查只读，仅 ALLOW 时更新状态。
- ✅ M-02：冷却期增加 `!= 0` 判断。
- ✅ H-1：quarantineId 使用递增 nonce。
- ⚠️ **L-01**: `lastTransferTime[from]` 仅 ALLOW 时更新。HOLD 期间不重置冷却。确认是否符合业务预期。

**行 300-390: 管理函数**
- ✅ `setIssuerPolicy` 输入校验完善。
- ✅ `batchCheckAddressCompliance` 限制 100。

---

### 文件 3: PolicyEngine.sol (v1.2.1)

**行 1-100: 升级机制**
- ✅ 双重升级保护：`proposeUpgrade` 时间锁 + `_authorizeUpgrade` 验证。
- ✅ H-06：动态 chainId 获取。

**行 100-180: 规则管理**
- ✅ 全面参数校验 + `ruleExists` 防覆盖。
- ✅ `MAX_RULES = 50`。

**行 180-260: evaluatePolicy**
- ✅ 地址感知短路 + O(n) 单次遍历。
- ✅ BLOCK 立即终止。

**行 260-340: evaluateTransfer**
- ✅ 双向制裁/Mixer/风险等级检查。
- ✅ H-03：日限额只读校验。
- ⚠️ **M-01**: `evaluateTransaction` 中 `riskScore = _tierToRiskScore(rawTier)` 使用 tier 推导分数（LOW→10, MEDIUM→50, HIGH→75, CRITICAL→100），而非 RiskRegistry 中的实际 riskScore。返回给调用者的 riskScore 是近似值。

**行 340-470: 版本管理**
- ✅ 环形缓冲逻辑正确。
- ⚠️ **L-02**: `__gap = 40`，PolicyEngine 有 20+ 状态变量，未来升级空间有限。

---

### 文件 4: RiskRegistryV2.sol (v2.3.1)

**行 1-180: 存储布局与升级**
- ✅ 与 v0.2.1 存储完全兼容。
- ✅ 位打包/解包逻辑正确。
- ✅ 分阶段 reinitializer。

**行 180-260: updateRiskProfile**
- ✅ 输入校验完善。
- ⚠️ **L-03**: 频率限制绕过条件——制裁状态变化时不检查 `MIN_UPDATE_INTERVAL`。设计意图合理（紧急制裁应即时），但需记录。

**行 260-330: batchUpdateRiskProfiles**
- ✅ H1 修复：每个地址正确应用标签。
- ⚠️ **L-04**: 批量更新不检查 `MIN_UPDATE_INTERVAL`，与单条更新行为不一致。

**行 330-420: emergencySanction**
- ✅ 位操作正确。
- ✅ `wasNew` 写入前捕获。
- ✅ H2/H3 修复。

**行 420-480: 标签管理**
- ✅ H4 修复：清理 entityAddresses 关联。
- ⚠️ **GAS-02**: `_updateTags` 对每个旧标签遍历 `entityAddresses`，O(n*m) 复杂度。

**行 480-530: View 函数**
- ✅ `getProfile` 完全兼容 V1 返回值。
- ⚠️ `_bytes32ToHexString` 工具函数在此合约中未被调用。

---

### 文件 5: RiskRegistry.sol (v1.2.2)

**行 1-150: 数据结构与初始化**
- ✅ struct 按字段大小降序排列。
- ✅ 使用自定义 `ReentrancyGuardUpgradeable`（H-03）。

**行 150-280: 核心函数**
- ✅ H-01：统一频率限制。
- ✅ H-02：清除旧标签设置新标签。
- ✅ C-01：显式清除 tags 存储槽。
- ✅ M-03：swap-and-pop 正确更新索引。

**行 280-380: View 函数**
- ⚠️ **M-02**: `getRiskTier` 对制裁地址返回 `HIGH` 而非 `CRITICAL`。与 V2 和枚举定义不一致。
- ✅ 升级时间锁机制完善。
- ✅ `__gap = 47`。

---

### 文件 6: QuarantineVault.sol (v1.2.1)

**行 1-150: 基础结构**
- ✅ 细粒度角色设计。
- ✅ nonce 保证 recordId 唯一性（H-3）。

**行 150-280: 核心函数**
- ✅ H-48：fee-on-transfer 支持。
- ✅ H-6：underflow 检查。
- ✅ C-4：冻结发 `FundsFrozen` 事件。
- ✅ C-1：批量释放内联逻辑避免 nonReentrant 自调用。
- ⚠️ **L-05**: 构造函数授予 msg.sender 所有角色但未 renounce DEFAULT_ADMIN_ROLE。

**行 280-340: 视图与管理**
- ✅ `withdrawETH` 使用 low-level call 但检查返回值。
- ✅ `receive()` 接收 ETH 并发出事件。

---

### 文件 7: FidesOriginTimelock.sol

**行 1-100: 完整审查**
- ⚠️ **M-04**: `getMinDelay()` override 在紧急模式下返回 4h。已 schedule 的操作可能提前执行。紧急操作员密钥需严格保护。
- ⚠️ **L-06**: `enableEmergencyMode`/`disableEmergencyMode` 无时间锁，可即时切换。
- ✅ 零地址检查。
- ✅ 紧急操作员映射管理。

---

### 文件 8: RiskOracle.sol (v1.2.1)

**行 1-200: 多预言机机制**
- ✅ C-1：防止同一预言机重复投票。
- ✅ H-2：强制 deadline + 闪电贷保护（`msg.sender != tx.origin`）。
- ✅ H-4：自动收敛 confirmations。
- ⚠️ **L-07**: `syncOwnerRoles` 上方有格式错误的注释块（未闭合的 `/**`），不影响编译但影响可读性。

**行 200-380: 回调处理**
- ⚠️ **M-05**: `fulfillRequest` 在暂停时设 `fulfilled=false`，但 Chainlink 不会重新调用同一 requestId。暂停期间的请求可能永久丢失。
- ⚠️ **L-08**: SANCTIONS_SYNC 队列满时静默丢弃地址，仅 `enqueueRiskUpdate` 内部有 QueueFull revert 保护，外层 if 避免了 revert。建议 emit 丢弃事件。
- ✅ `tryDecodeAddresses` 使用 try/catch 防止 abi.decode 失败。
- ⚠️ **GAS-03**: `processPendingQueue` 逐元素 shift，O(n)。

---

### 文件 9: FidesBridgeReceiver.sol

**行 1-170: 完整审查**
- ✅ nonce 防重放。
- ✅ D1-AUDIT1-017：拒绝未来时间戳（>1h 漂移）。
- ✅ D1-AUDIT1-019：验证 MerkleRegistry 接口。
- ⚠️ **L-09**: `lastSyncTime` 设为 `block.timestamp`（本地链），但 `timestamp` 参数来自源链。`StaleUpdate` 检查实际比较的是源链时间 vs 本地链时间。链间出块差异较大时可能误判。
- ✅ 环形缓冲区正确。
- ✅ `__gap = 48`。

---

### 文件 10: MerkleRiskRegistry.sol (v1.2.0)

**行 1-150: 核心结构**
- ✅ Leaf 使用双重 keccak256 防止第二原像攻击。
- ✅ 签名包含 chainId + contract address 防跨链/同链重放。
- ✅ H-1：环形缓冲区限制历史。
- ✅ H-3：批量大小上限。
- ✅ H-4：nonce 防重放替代 verifiedSignatures。

**行 150-310: 验证与管理**
- ⚠️ **L-10**: `_messageHash` 使用 `abi.encodePacked` 混合 string 和 bytes32。由于 VERSION 是常量，碰撞风险可忽略，但不属于最佳实践。
- ✅ `verifyAddress` 使用统一 Leaf 格式（C-1）。
- ✅ `pause()`/`unpause()` 使用 `whenNotPaused`/`whenPaused` 明确意图。

---

### 文件 11: CompliantSmartWalletBase.sol

**行 1-100: 初始化**
- ✅ 验证所有依赖地址为合约。
- ✅ 默认策略设置合理。

**行 100-200: receive() 与 ETH 隔离**
- ✅ CEI 模式：先记账再转账。
- ✅ 转账失败时回滚记账。

**行 200-300: execute / transferToken / callContract**
- ✅ CEI 模式贯穿所有转账函数。
- ✅ 失败时正确 refund。
- ⚠️ **M-06**: `transferToken` 使用 raw `token.call(abi.encodeWithSignature("transfer(...)..."))` 而非 `SafeERC20.safeTransfer`。合约 import 了 SafeERC20 但未使用。对非标准 ERC20（如 USDT）可能有兼容性问题。

**行 300-400: executeBatch**
- ✅ C-3：仅成功操作计入日限额。
- ✅ 批量 hook 失败时 revert。
- ⚠️ **M-07**: `_executeOperation` 先 `_recordSpending` 再检查 available balance，失败时 `_refundSpending`。顺序应为：先检查 → 再记录 → 再执行。

**行 400-480: fallback**
- ⚠️ **M-08**: fallback 将调用转发给 `msg.sender`。虽然限制了 `owner || whitelistedTargets`，但白名单中的恶意合约可借机通过钱包执行任意调用。需要强调白名单管理的重要性。
- ✅ 使用 `call` 而非 `delegatecall`（H-29 修复）。

---

### 文件 12: CompliantSmartWallet.sol

**行 1-130: 签名执行**
- ✅ EIP-191 签名标准。
- ✅ 包含 chainId + address(this) 防重放。
- ✅ 使用 `abi.encode`（M-01）。
- ✅ salt 替代 nonce（M-02）支持批量签名。
- ✅ signer 零地址校验（L 修复）。
- ⚠️ **M-09**: `executeWithSignature` 缺少 `_postComplianceCheck` 后置回调。`execute`（基类）通过 `compliantOp` modifier 处理前后钩子，但 `executeWithSignature` 手动调用了 `preExecutionHook` 却没有调用 `postExecutionHook`。
- ⚠️ **L-11**: `executeWithSignature` 没有 `nonReentrant` 修饰。虽然 `executedOps[opHash]=true` 在执行前设置防止重入同一 opHash，但通过不同 opHash 的重入理论可能。`_executeOperation` 是 internal 且不自带 nonReentrant。

---

### 文件 13: CompliantStableCoin.sol

**行 1-100: 构造与铸造**
- ✅ 合规引擎地址非零校验。
- ✅ 铸造检查接收方风险。

**行 100-200: _update override**
- ✅ 嵌入合规检查在 ERC20 核心转账中。
- ✅ H-17：每日限额更新。
- ✅ H-01：postTransferHook 包裹 try/catch 防 DoS。
- ⚠️ **M-10**: `simulateTransfer` 未检查 `dailySpent` 限额。模拟结果可能显示"通过"但实际转账因日限额失败。模拟与实际不一致。

**行 200-350: 管理函数**
- ✅ H-04：策略输入校验。
- ✅ M-04：批量 KYC 长度上限。
- ✅ C-01：burn 需 allowance。
- ✅ `_getRevertMsg` 健壮解析 revert 数据。

---

### 文件 14: IComplianceEngine.sol

**行 1-110: 接口定义**
- ⚠️ **M-11**: `IssuerPolicy.blockedTokens` 类型为 `bytes32[]`，但 ComplianceEngine 和 PolicyEngine 实现中均为 `address[]`。接口与实现类型不一致。如果通过接口 ABI 编码/解码 IssuerPolicy，将产生数据不兼容。

---

### 文件 15: fixtures.js

**行 1-240: 部署脚本**
- 🔴 **C-01 关联**: **FidesCompliance 未被授予 ComplianceEngine 的 OPERATOR_ROLE**。步骤 7c 仅授予 owner 和 operator，遗漏了 FidesCompliance 合约地址。这导致 FidesCompliance → ComplianceEngine 的所有调用 revert。
- ⚠️ **L-12**: 部署 QuarantineVault（步骤 8）在 CompliantStableCoin 之后，编号混乱。
- ⚠️ **L-13**: 大段注释掉的 policy 设置代码（步骤 8b）是死代码。
- ⚠️ **L-14**: `riskOracle` 使用随机 mockRouter 地址，任何实际调用 Chainlink Functions 的测试会失败。

---

## 问题汇总

| # | 严重程度 | 文件 | 行号/位置 | 问题 | 建议 |
|---|----------|------|-----------|------|------|
| C-01 | 🔴 CRITICAL | fixtures.js + ComplianceEngine.sol | fixtures L150-160 / CE L195 | **FidesCompliance 未获得 ComplianceEngine 的 OPERATOR_ROLE**，导致 `checkTransferWithDeadline` 中 `msg.sender != from` 时 revert | 在 fixtures.js 中添加 `await complianceEngine.grantRole(CE_OPERATOR_ROLE, await fidesCompliance.getAddress())` |
| M-01 | 🟡 MEDIUM | PolicyEngine.sol | L320-330 | `evaluateTransaction` 返回的 riskScore 由 tier 推导（LOW→10, MED→50...），非 RiskRegistry 实际分数 | 直接使用 `getProfile()` 返回的 riskScore |
| M-02 | 🟡 MEDIUM | RiskRegistry.sol | L365-370 | `getRiskTier` 对制裁地址返回 `HIGH` 而非 `CRITICAL` | 改为 `RiskTier.CRITICAL` |
| M-03 | 🟡 MEDIUM | QuarantineVault.sol | L165-180 | `_quarantineFunds` 先设 amount 再转账再修正，fee-on-transfer 场景下短暂存在不一致 | 可接受，但建议先 transfer 再 set amount |
| M-04 | 🟡 MEDIUM | FidesOriginTimelock.sol | L85-90 | 紧急模式动态缩短 `getMinDelay()`，已 schedule 的操作可能提前执行 | 考虑仅对新 schedule 的操作应用短延迟 |
| M-05 | 🟡 MEDIUM | RiskOracle.sol | L375-385 | 暂停时 `fulfillRequest` 设 `fulfilled=false`，但 Chainlink 不会重发回调 | 改为 `fulfilled=true` + 单独标记 `deferred=true` |
| M-06 | 🟡 MEDIUM | CompliantSmartWalletBase.sol | L215-230 | `transferToken` 使用 raw call 而非 SafeERC20 | 改用 `IERC20(token).safeTransfer(to, amount)` |
| M-07 | 🟡 MEDIUM | CompliantSmartWalletBase.sol | L350-370 | `_executeOperation` 先记录支出再检查余额 | 调整顺序：先检查 → 再记录 → 再执行 |
| M-08 | 🟡 MEDIUM | CompliantSmartWalletBase.sol | L450-480 | fallback 转发调用给 msg.sender，白名单合约可执行任意调用 | 严格管理白名单，或限制 fallback 只接受特定函数签名 |
| M-09 | 🟡 MEDIUM | CompliantSmartWallet.sol | L100-125 | `executeWithSignature` 缺少 postExecutionHook 后置回调 | 在 `_executeOperation(op)` 后添加 `_postComplianceCheck` |
| M-10 | 🟡 MEDIUM | CompliantStableCoin.sol | L280-300 | `simulateTransfer` 未检查 dailySpent，模拟结果可能不准确 | 添加日限额检查到模拟逻辑 |
| M-11 | 🟡 MEDIUM | IComplianceEngine.sol | L48 | `IssuerPolicy.blockedTokens` 类型为 `bytes32[]`，实现中为 `address[]` | 统一为 `address[]` |
| L-01 | 🔵 LOW | ComplianceEngine.sol | L282-290 | 冷却期 HOLD 时不更新 lastTransferTime，用户可能被持续 HOLD | 确认是否符合业务预期 |
| L-02 | 🔵 LOW | PolicyEngine.sol | L470 | `__gap = 40`，未来升级空间有限 | 考虑增加到 50 |
| L-03 | 🔵 LOW | RiskRegistryV2.sol | L200 | 制裁状态变化时绕过频率限制 | 设计意图，添加文档说明 |
| L-04 | 🔵 LOW | RiskRegistryV2.sol | L260 | 批量更新不检查 MIN_UPDATE_INTERVAL | 添加可选频率检查 |
| L-05 | 🔵 LOW | QuarantineVault.sol | L75 | 构造函数未 renounce DEFAULT_ADMIN_ROLE | 部署后 renounce |
| L-06 | 🔵 LOW | FidesOriginTimelock.sol | L50-70 | 紧急模式切换无时间锁 | 添加延迟或多签要求 |
| L-07 | 🔵 LOW | RiskOracle.sol | L105 | 注释块格式错误（未闭合） | 修复注释 |
| L-08 | 🔵 LOW | RiskOracle.sol | L410 | 队列满时静默丢弃制裁地址 | emit "QueueDropped" 事件 |
| L-09 | 🔵 LOW | FidesBridgeReceiver.sol | L115 | lastSyncTime 混用本地/源链时间 | 统一时间来源或添加容忍度 |
| L-10 | 🔵 LOW | MerkleRiskRegistry.sol | L60 | abi.encodePacked 混合 string | 使用 abi.encode 替代 |
| L-11 | 🔵 LOW | CompliantSmartWallet.sol | L105 | 缺少 nonReentrant 修饰 | 添加 nonReentrant |
| L-12 | 🔵 LOW | fixtures.js | L170 | 部署步骤编号混乱 | 重新编号 |
| L-13 | 🔵 LOW | fixtures.js | L190-230 | 大段注释死代码 | 清理或集成 |
| L-14 | 🔵 LOW | fixtures.js | L30 | 随机 mockRouter 地址 | 使用 mock 合约 |
| GAS-01 | ⚪ GAS | ComplianceEngine.sol | L120-160 | checkAddressCompliance 每次写入统计 | 移至调用方统一更新 |
| GAS-02 | ⚪ GAS | RiskRegistryV2.sol | L300-330 | _updateTags O(n*m) 复杂度 | 考虑优化策略 |
| GAS-03 | ⚪ GAS | RiskOracle.sol | L450-470 | processPendingQueue 逐元素 shift | 使用更高效数据结构 |

---

## 总体评估

### 修复质量评分: **A-**

Kimi k2p7 多Agent集群的 3 轮审计+修复整体质量很高：

**修复到位的方面：**
- ✅ 重入保护全面覆盖（nonReentrant / ReentrancyGuard）
- ✅ 两步确认 + 时间锁用于关键地址变更
- ✅ Fail-Closed 安全模式贯穿全系统
- ✅ DEFAULT_ADMIN_ROLE 后门移除
- ✅ UUPS 升级权限控制 + 时间锁
- ✅ 位打包存储布局有完整文档
- ✅ swap-and-pop 正确更新索引
- ✅ fee-on-transfer 支持
- ✅ quarantineId / recordId 唯一性保证
- ✅ 环形缓冲区限制数组增长
- ✅ 批量操作大小限制
- ✅ 输入校验全面（零地址、合约校验、参数范围）

### 遗漏问题

1. **1 个 CRITICAL**: FidesCompliance ↔ ComplianceEngine 集成缺少角色授予（部署配置问题，非代码 bug）
2. **11 个 MEDIUM**: 类型不一致、raw call 替代 SafeERC20、模拟与实际不匹配、紧急模式 timelock 缩短等
3. **14 个 LOW**: 注释格式、死代码、编号混乱等
4. **3 个 GAS**: 统计写入、标签清理、队列移除优化

### 部署就绪度

- **不可直接主网部署**：需先修复 C-01（在部署脚本/fixture 中授予 FidesCompliance OPERATOR_ROLE）
- **修复 C-01 后可测试网部署**
- M-06（SafeERC20）和 M-11（接口类型不一致）应在测试网部署前修复
- M-04（Timelock 紧急模式）需要安全评估确认
- 其余 M/L 级别问题可逐步修复

### 安全亮点

该合约体系现了高水平的安全工程实践：
- **纵深防御**: 多层访问控制（角色 + 时间锁 + 两步确认）
- **最小权限**: DEFAULT_ADMIN_ROLE 主动 renounce
- **Fail-Closed**: 未知状态默认拒绝
- **MEV 保护**: deadline + 闪电贷检测
- **升级安全**: UUPS + 时间锁 + proposal 机制
- **存储安全**: gap 预留 + 版本追踪

---

> **结论**: Kimi k2p7 集群的修复工作质量可靠，核心安全问题已修复。1 个 CRITICAL 集成问题和 11 个 MEDIUM 问题需要在部署前解决。建议优先修复 C-01、M-06、M-11，然后逐步处理其余问题。