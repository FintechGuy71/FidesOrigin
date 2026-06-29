# FidesOrigin - API 参考

## 合约地址 (主网)

| 合约 | 地址 | 版本 |
|------|------|------|
| ComplianceEngine | `TBD` | v1.0 |
| RiskRegistry | `TBD` | v1.0 |
| PolicyEngine | `TBD` | v1.0 |
| RiskOracle | `TBD` | v1.0 |

## 合约地址 (Sepolia 测试网)

| 合约 | 地址 | 版本 |
|------|------|------|
| RiskRegistry | `0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3` | v1.0 |
| PolicyEngine | `0xF8f89120f5628aE3De747f55e7d00D79633002c4` | v1.0 |
| ComplianceEngine | `0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa` | v1.0 |

---

## 认证方式

### 合约层访问控制

所有写操作均通过 OpenZeppelin `AccessControl` 进行权限管理。角色定义如下：

| 角色 | bytes32 值 | 权限范围 |
|------|-----------|----------|
| `DEFAULT_ADMIN_ROLE` | `0x00` | 角色管理、紧急暂停、合约升级提案 |
| `ADMIN_ROLE` | `keccak256("ADMIN_ROLE")` | 冻结/解冻资金、紧急制裁、策略配置 |
| `OPERATOR_ROLE` | `keccak256("OPERATOR_ROLE")` | 标签管理、合约注册、Oracle 调用、批量更新 |
| `ORACLE_ROLE` | `keccak256("ORACLE_ROLE")` | 风险档案更新、批量风险更新 |

### SDK 认证

```typescript
import { FidesOriginClient } from '@fidesorigin/sdk';

// 只读模式（无需签名器）
const client = new FidesOriginClient({
  addresses: contractAddresses,
  provider: jsonRpcProvider
});

// 写操作模式（需要签名器）
const client = new FidesOriginClient({
  addresses: contractAddresses,
  provider: jsonRpcProvider,
  signer: walletSigner  // 必须持有相应角色
});
```

> ⚠️ **安全警告**：生产环境中签名器私钥应使用硬件钱包或 KMS 管理，禁止将私钥硬编码在代码中。

---

## 速率限制

### 链上调用限制

| 操作 | 限制 | 说明 |
|------|------|------|
| RiskOracle 日请求上限 | 1,000 次/天 | 通过 Chainlink Functions 的每日请求配额控制 |
| RiskOracle 调用冷却期 | 5 分钟 | 同一地址两次风险更新请求的最小间隔 |
| RiskOracle 批量上限 | 100 地址/批 | `batchUpdateRiskProfiles` 单次最大地址数 |
| RiskRegistry 批量更新 | 100 地址/批 | 防止 gas limit 溢出 |
| PolicyEngine 策略变更 | 受 Timelock 48h 延迟约束 | 非紧急策略变更需等待时间锁 |

### SDK 调用建议

| 场景 | 建议速率 | 说明 |
|------|----------|------|
| `validateTransfer` (模拟查询) | 无限制 | 纯 view 调用，零 Gas，可直接调用 |
| `getRiskProfile` | 无限制 | 纯 view 调用 |
| `checkAddress` (SDK API) | 100 次/分钟 | 如对接后端 API，需遵循服务端限流 |
| WebSocket 连接 | 1 连接/客户端 | 每个客户端保持单一长连接 |

### 错误码说明

#### Solidity 自定义错误 (Custom Errors)

| 错误码 | 合约 | 触发条件 | 处理建议 |
|--------|------|----------|----------|
| `TransferBlocked(string reason)` | ComplianceEngine | 转账被 BLOCK 决策拦截 | 检查 `reason` 字段，提示用户转账被拒绝 |
| `TransferFlagged(string reason)` | ComplianceEngine | 转账被 FLAG 决策标记 | 记录日志，通知运营团队审核 |
| `InsufficientFundsForHold()` | ComplianceEngine | HOLD 时账户余额不足 | 检查账户余额是否大于转账金额 |
| `UnauthorizedCaller()` | RiskRegistry | 调用者缺少 ORACLE_ROLE | 确认调用地址已被授予 ORACLE_ROLE |
| `InvalidBatchLength()` | RiskRegistry | 批量更新数组长度不匹配 | 确保 `accounts`/`scores`/`tiers`/`isSanctioned` 数组长度一致 |
| `AddressAlreadySanctioned()` | RiskRegistry | 重复制裁已制裁地址 | 先调用 `isSanctioned` 检查状态 |
| `AddressNotSanctioned()` | RiskRegistry | 解除制裁时地址不在制裁名单 | 先确认地址制裁状态 |
| `PolicyNotFound(address issuer)` | PolicyEngine | 查询未配置策略的发行方 | 确认发行方已调用 `setIssuerPolicy` |
| `CooldownActive(address account)` | PolicyEngine | 冷却期内重复操作 | 等待 `cooldownPeriod` 秒后再试 |
| `DailyLimitExceeded(address account, uint256 limit)` | PolicyEngine | 日累计金额超过限额 | 提示用户已达日限额，次日重试 |
| `MixerAddressBlocked(address mixer)` | PolicyEngine | 转账涉及已知混币器 | 拒绝交易，提示用户地址被标记为混币器 |
| `OracleRequestCooldown()` | RiskOracle | 调用间隔小于 5 分钟 | 等待冷却期结束 |
| `DailyRequestLimitReached()` | RiskOracle | 当日请求超过 1,000 次 | 次日重试或联系团队提升配额 |
| `EmergencyModeActive()` | ComplianceEngine | 紧急模式下禁止常规操作 | 等待管理员关闭紧急模式 |
| `UpgradeTimelockNotElapsed()` | TimelockController | 升级提案等待期不足 48h | 等待时间锁到期后执行 |
| `InvalidAddress()` | 多个合约 | 传入零地址 (address(0)) | 检查地址参数有效性 |

#### SDK 错误码

| 错误码 | HTTP 状态 | 说明 | 处理建议 |
|--------|----------|------|----------|
| `FidesOriginError.NetworkError` | — | RPC 连接失败 | 检查网络配置，切换备用 RPC |
| `FidesOriginError.ContractNotFound` | — | 合约地址未部署或错误 | 核对 `addresses` 配置与网络 |
| `FidesOriginError.InsufficientRole` | — | 签名器缺少所需角色 | 确认签名地址已被授权 |
| `FidesOriginError.RateLimited` | 429 | 后端 API 限流 | 降低请求频率，实现指数退避重试 |
| `FidesOriginError.InvalidParameter` | 400 | 参数格式错误 | 检查地址格式、金额是否为 BigNumber |
| `FidesOriginError.WebSocketDisconnected` | — | WebSocket 连接断开 | 实现自动重连机制 |

#### 决策码 (Decision Enum)

| 数值 | 枚举 | 含义 | 链上行为 |
|------|------|------|----------|
| 0 | `ALLOW` | 允许 | 交易正常执行 |
| 1 | `BLOCK` | 拦截 | 交易 revert，资金不转移 |
| 2 | `FLAG` | 标记 | 交易允许执行，但记录标记事件 |
| 3 | `HOLD` | 冻结 | 资金转入合约冻结，等待人工审核 |

#### 风险等级 (RiskTier Enum)

| 数值 | 枚举 | 含义 |
|------|------|------|
| 0 | `UNKNOWN` | 未知（未评估） |
| 1 | `LOW` | 低风险 |
| 2 | `MEDIUM` | 中风险 |
| 3 | `HIGH` | 高风险 |

---

## ComplianceEngine API

### View Functions

#### `validateTransfer(address from, address to, uint256 amount, address assetContract) → (Decision, string)`
模拟评估一笔转账的合规性。无 Gas 消耗。

**参数**:
- `from`: 发送方地址
- `to`: 接收方地址
- `amount`: 转账金额 (wei/最小单位)
- `assetContract`: 资产合约地址

**返回**:
- `Decision`: 0=ALLOW, 1=BLOCK, 2=FLAG, 3=HOLD
- `reason`: 决策原因描述

#### `preTransferHook(address from, address to, uint256 amount)`
转账前钩子。如果决策为 BLOCK，交易会 revert。

#### `getAddressRisk(address account) → RiskProfile`
获取地址完整风险档案。

#### `getRiskTier(address account) → RiskTier`
获取地址风险等级 (0=UNKNOWN, 1=LOW, 2=MEDIUM, 3=HIGH)。

#### `isSanctioned(address account) → bool`
快速检查地址是否在制裁名单。

### Write Functions

#### `holdFunds(address account, address asset, uint256 amount, string reason)`
冻结指定账户的资产。仅 ADMIN_ROLE 可调用。

#### `releaseHold(address account, address asset)`
解除冻结。仅 ADMIN_ROLE 可调用。

---

## RiskRegistry API

### Write Functions

#### `updateRiskProfile(address account, uint8 riskScore, RiskTier tier, bytes32[] tags, bool sanctionedStatus)`
更新单个地址风险档案。仅 ORACLE_ROLE 可调用。

#### `batchUpdateRiskProfiles(address[] accounts, uint8[] riskScores, RiskTier[] tiers, bool[] isSanctionedList)`
批量更新，最多 100 个地址。仅 ORACLE_ROLE 可调用。

#### `emergencySanction(address[] accounts, string reason)`
紧急添加制裁。仅 ADMIN_ROLE 可调用。

#### `removeSanction(address account)`
移除制裁。仅 ADMIN_ROLE 可调用。

#### `addTag(address account, bytes32 tag)` / `removeTag(address account, bytes32 tag)`
添加/移除实体标签。仅 OPERATOR_ROLE 可调用。

#### `registerContract(address contractAddr, bytes32 contractType, bool verified, uint8 riskScore)`
注册合约风险信息。仅 OPERATOR_ROLE 可调用。

### View Functions

#### `getRiskProfile(address) → RiskProfile`
#### `getRiskTier(address) → RiskTier`
#### `getRiskScore(address) → uint8`
#### `isSanctioned(address) → bool`
#### `hasTag(address, bytes32) → bool`
#### `getTags(address) → bytes32[]`
#### `getContractRisk(address) → (bool, uint8, bytes32)`

---

## PolicyEngine API

### Write Functions

#### `setIssuerPolicy(address issuer, IssuerPolicy policy)`
设置资产发行方策略。仅 ADMIN_ROLE。

**IssuerPolicy 结构**:
```solidity
struct IssuerPolicy {
    uint256 maxTxAmount;        // 单笔最大金额
    uint256 dailyLimit;         // 日限额
    bool allowMediumRisk;       // 是否允许中风险
    bool allowHighRisk;         // 是否允许高风险
    bool blockMixer;            // 是否阻止混币器
    bool requireDestinationKYC; // 是否要求收款方KYC
    uint256 cooldownPeriod;     // 冷却期(秒)
}
```

#### `setWalletPolicy(address wallet, WalletPolicy policy)`
设置钱包策略。仅 ADMIN_ROLE。

#### `addMixer(address mixer)` / `removeMixer(address mixer)`
添加/移除已知混币器地址。

### View Functions

#### `evaluateTransfer(address from, address to, uint256 amount, address operator) → (Decision, string)`
评估转账 (被 ComplianceEngine 内部调用)。

#### `evaluateOperation(address walletOwner, Operation op, address wallet) → (Decision, string)`
评估钱包操作。

#### `analyzeOperationRisk(Operation op) → (uint8 riskScore, RiskTier tier, string riskFactors)`
分析操作风险特征。

---

## RiskOracle API

### Write Functions

#### `requestRiskUpdate(string source, bytes encryptedSecretsUrls, uint8 donHostedSecretsSlotID, uint64 donHostedSecretsVersion, string[] args) → bytes32 requestId`
发起 Chainlink Functions 风险数据请求。仅 OPERATOR_ROLE。

#### `updateRiskProfile(address account, uint256 score, uint8 tier, bytes32[] tags, bool isSanctioned)`
直接更新风险档案 (无需 Chainlink)。仅 OPERATOR_ROLE。

#### `batchUpdateRiskProfiles(address[] accounts, uint256[] scores, uint8[] tiers, bool[] isSanctioned)`
批量直接更新。

#### `queueRiskUpdate(address account, uint256 score, uint8 tier, bool isSanctioned)`
将更新加入队列。

#### `executeQueuedUpdates()`
执行队列中的批量更新。

### View Functions

#### `getRequestInfo(bytes32 requestId) → RequestInfo`
#### `getAllRequestIds() → bytes32[]`
#### `getPendingQueueLength() → uint256`
#### `isRequestFulfilled(bytes32 requestId) → bool`

---

## SDK API

### `FidesOriginClient`

#### Constructor
```typescript
new FidesOriginClient({
  addresses: ContractAddresses,
  provider: Provider,
  signer?: Signer
})
```

#### Methods

| 方法 | 签名 | 说明 |
|------|------|------|
| `getRiskProfile` | `(address) => Promise<RiskProfile>` | 获取风险档案 |
| `isSanctioned` | `(address) => Promise<boolean>` | 是否制裁 |
| `getRiskTier` | `(address) => Promise<RiskTier>` | 风险等级 |
| `getRiskScore` | `(address) => Promise<number>` | 风险评分 |
| `hasTag` | `(address, tag) => Promise<boolean>` | 是否有标签 |
| `validateTransfer` | `(from, to, amount, asset) => Promise<TransferValidationResult>` | 模拟转账 |
| `wouldTransferSucceed` | `(from, to, amount, asset) => Promise<boolean>` | 快速判断 |
| `simulateOperation` | `(owner, op, wallet) => Promise<OperationSimulationResult>` | 模拟操作 |
| `getIssuerPolicy` | `(issuer) => Promise<IssuerPolicy>` | 获取策略 |
| `getDailySpent` | `(account, asset) => Promise<bigint>` | 日累计金额 |
| `getContractRisk` | `(addr) => Promise<{verified, riskScore, contractType}>` | 合约风险 |
| `getStableCoinContract` | `(address) => Contract` | 获取稳定币实例 |
| `simulateStableCoinTransfer` | `(coin, from, to, amount) => Promise<...>` | 模拟稳定币转账 |
| `getWalletContract` | `(address) => Contract` | 获取钱包实例 |

---

## 事件参考

### ComplianceEngine
- `TransferValidated(asset, from, to, amount, decision, reason)`
- `TransferRecorded(asset, from, to, amount, success)`
- `FundsHeld(account, asset, amount, reason)`
- `FundsReleased(account, asset, amount)`

### RiskRegistry
- `RiskProfileUpdated(account, riskScore, tier, isSanctioned)`
- `SanctionAdded(account, reason)`
- `SanctionRemoved(account)`
- `AddressTagged(account, tag)`
- `ContractRegistered(contractAddr, contractType, verified)`

### PolicyEngine
- `PolicyEvaluated(operator, from, to, amount, decision, reason)`
- `IssuerPolicySet(issuer, policy)`

### RiskOracle
- `RiskUpdateRequested(requestId, requestType, requester, source)`
- `RiskUpdateFulfilled(requestId, success, processedAt)`
- `RiskProfileUpdated(requestId, account, score, tier, isSanctioned)`
