# FidesOrigin 合约层诊断报告

> 生成时间: 2026-06-26
> 项目路径: `/root/.openclaw/workspace/fidesorigin-demo/apps/contracts/`
> 分析范围: RiskRegistry Proxy + Implementation

---

## 1. 执行摘要

当前部署在 Sepolia 上的 RiskRegistry Proxy (`0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc`) 存在 **4 个关键问题**：

| 优先级 | 问题 | 状态 | 修复方案 |
|--------|------|------|----------|
| P0 | CRITICAL tier (tier=4) revert | 🔴 已确认根因 | 部署 V2 Implementation |
| P0 | View 函数批量 revert | 🔴 已确认根因 | 部署 V2 Implementation |
| P1 | Gas 优化空间 | 🟡 可优化 | 文档 + 合约优化 |
| P2 | 多链部署架构缺失 | 🟡 待设计 | 编写设计文档 |

---

## 2. Subtask 1: CRITICAL Tier Revert 诊断

### 2.1 根因分析

**结论: 部署的 Implementation (v0.2.1) 使用 4 值枚举，不支持 CRITICAL (tier=4)**

```solidity
// IAssetCompliance.sol —  deployed version
enum RiskTier {
    UNKNOWN,    // 0
    LOW,        // 1
    MEDIUM,     // 2
    HIGH        // 3  ← 只有 4 个值，没有 CRITICAL
}
```

Deployed `RiskRegistry` 的 `updateRiskProfile` 函数签名：
```solidity
function updateRiskProfile(
    address account,
    uint8 riskScore,
    IAssetCompliance.RiskTier tier,  // ← 只能接受 0-3
    bytes32[] calldata tags,
    bool sanctionedStatus
) external;
```

当传入 `tier = 4` (CRITICAL) 时，Solidity 在 ABI decode 阶段就会 **revert**，因为 enum 值 4 超出了定义范围。错误类型为 `Panic(0x21)` — enum conversion error。

### 2.2 存储层分析

Deployed implementation 使用 bit-packed 存储：
```
_packedProfiles[address] => uint256
位布局: [0-7] riskScore, [8-15] tier, [16] isSanctioned, [17-80] lastUpdated
```

**重要发现: 存储层本身支持 8-bit tier (0-255)，tier=4 在存储上完全合法。** 问题 purely 是函数参数类型限制。

### 2.3 当前源码 (v1.2.1) 状态

仓库当前 `RiskRegistry.sol` 已重写为 struct-based 架构，包含 `CRITICAL = 4`：
```solidity
enum RiskTier { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }
```

**但是**: 当前源码的存储布局与 deployed version 完全不兼容：

| 存储槽 | Deployed v0.2.1 | Current Source v1.2.1 |
|--------|----------------|----------------------|
| 0 | `_packedProfiles` (uint256) | `riskProfiles` (struct mapping) |
| 1 | `_lastUpdateTime` | `highRiskAddresses` |
| 2 | `_profileTags` | `sanctionedAddresses` |
| 3 | `sanctionedAddresses` | `highRiskIndex` |
| ... | ... | ... |

**直接升级会导致所有已有数据损坏。**

### 2.4 修复方案

**推荐方案: 部署 `RiskRegistryV2.sol`**
- 保持 deployed version 的存储布局完全兼容
- 将 `updateRiskProfile` 参数从 `IAssetCompliance.RiskTier` 改为 `uint8 tier`
- 添加 `require(tier <= 4, "Invalid tier")` 校验
- 添加 `totalProfiles` 计数器和新 view 函数

**替代方案: 数据迁移**
- 部署全新 struct-based RiskRegistry
- 编写 migration 合约读取旧数据、写入新 storage
- 更新所有依赖合约的地址
- 成本高，需要协调所有下游合约

---

## 3. Subtask 4: View 函数 Revert 诊断

### 3.1 问题现象

当前 proxy 上以下 view 函数 revert：
- `isSanctioned(address)`
- `totalProfiles()`
- `riskProfiles(address)`

### 3.2 根因分析

**Deployed Implementation 的 ABI vs 调用方 ABI 不匹配：**

| 函数 | Deployed v0.2.1 | 当前调用 ABI |
|------|----------------|-------------|
| `isSanctioned(address)` | ✅ 存在 | 期望调用 |
| `totalProfiles()` | ❌ **不存在** | 期望调用 → revert |
| `riskProfiles(address)` | ❌ **不存在** (有 `_packedProfiles` 但 private) | 期望调用 → revert |

**`isSanctioned()` 在 deployed 版本中存在，如果也 revert，可能原因：**
1. Proxy 初始化异常（`sanctionedAddresses` mapping 的 slot 数据被污染）
2. 调用方使用了错误的函数 selector（ABI 不匹配导致 selector collision）
3. 调用的不是正确的 proxy 地址

### 3.3 Proxy Delegatecall 机制检查

Deployed proxy 是标准 UUPS Proxy (ERC1967)。Delegatecall 机制本身没有问题：
- Proxy: `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc`
- Implementation: `0x73F97E9e33b9eb952B8Ec7e0722523bAef555A59`
- UUPS 升级授权: `_authorizeUpgrade` 仅限 `ADMIN_ROLE`

**结论: revert 不是 proxy 机制问题，而是 Implementation ABI 不匹配 + 部分函数缺失。**

### 3.4 修复方案

1. **短期 workaround**: 部署 `RiskRegistryReader.sol` 只读 wrapper，通过 `staticcall` 调用 deployed proxy 的已有函数，并提供兼容 ABI。
2. **长期修复**: 部署 `RiskRegistryV2.sol` 作为新的 implementation，保持存储兼容的同时添加所有缺失函数。

---

## 4. 存储兼容性矩阵

| 组件 | Deployed v0.2.1 | Current Source v1.2.1 | RiskRegistryV2 (Proposed) |
|------|----------------|----------------------|---------------------------|
| `_packedProfiles` | Slot 0 | ❌ 不存在 | Slot 0 (保留) |
| `_lastUpdateTime` | Slot 1 | ❌ 不存在 | Slot 1 (保留) |
| `_profileTags` | Slot 2 | ❌ 不存在 | Slot 2 (保留) |
| `sanctionedAddresses` | Slot 3 | 不同位置 | Slot 3 (保留) |
| `_addressTags` | Slot 4 | ❌ 不存在 | Slot 4 (保留) |
| `_addressTagList` | Slot 5 | ❌ 不存在 | Slot 5 (保留) |
| `contractRegistry` | Slot 6 | ❌ 不存在 | Slot 6 (保留) |
| `entityAddresses` | Slot 7 | ❌ 不存在 | Slot 7 (保留) |
| `totalProfiles` | ❌ 不存在 | ✅ 存在 | Slot 8 (新增) |
| `__gap` | ❌ 不存在 | 50 slots | 42 slots (调整) |

---

## 5. 建议行动项

1. **立即**: 部署 `RiskRegistryV2.sol` 并执行 UUPS 升级
2. **立即**: 部署 `RiskRegistryReader.sol` 作为只读 fallback
3. **本周**: 执行 tier=4 的回归测试
4. **下周**: 实施 gas 优化 (参见 `docs/gas-optimization.md`)
5. **本月**: 规划多链部署 (参见 `docs/multi-chain-deployment.md`)

---

## 6. 附录: 已部署合约地址 (Sepolia)

```json
{
  "RiskRegistry": {
    "proxy": "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
    "implementation": "0x73F97E9e33b9eb952B8Ec7e0722523bAef555A59",
    "version": "v0.2.1"
  },
  "PolicyEngine": {
    "proxy": "0x87089F67A61F9643796AE154663A6a9F21196b38",
    "implementation": "0xFD89795Bb954C175267e7d78d9492Ce22200dBA7"
  },
  "ComplianceEngine": {
    "proxy": "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
    "implementation": "0x84838e8c9721e7f9475Bb379c6aF4b11240e9807"
  }
}
```
