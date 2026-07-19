# FidesOrigin 多签钱包设置指南

> **P0-4: 生产环境多签（Gnosis Safe 3/5）**
>
> 本文档说明如何设置 Gnosis Safe 3/5 多签钱包，并将 FidesOrigin 合约的所有管理权限从 deployer 转移到多签钱包。

---

## 目录

1. [概述](#概述)
2. [前置条件](#前置条件)
3. [步骤 1：创建 Safe 多签钱包](#步骤-1创建-safe-多签钱包)
4. [步骤 2：转移合约所有权](#步骤-2转移合约所有权)
5. [步骤 3：验证 Safe 操作权限](#步骤-3验证-safe-操作权限)
6. [日常操作流程](#日常操作流程)
7. [紧急操作流程](#紧急操作流程)
8. [故障排除](#故障排除)

---

## 概述

### 安全模型

```
┌─────────────────────────────────────────────────────────────┐
│                    FidesOrigin 协议架构                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐      ┌──────────────┐                   │
│   │  Safe 3/5    │──────│  Timelock    │                   │
│   │  多签钱包     │      │  48小时延迟   │                   │
│   └──────────────┘      └──────────────┘                   │
│          │                       │                          │
│          └───────────┬───────────┘                          │
│                      ▼                                      │
│   ┌──────────────────────────────────────────────┐        │
│   │  RiskRegistry  │ PolicyEngine │ ComplianceEngine │      │
│   │  (UUPS Proxy)  │ (UUPS Proxy) │ (UUPS Proxy)     │      │
│   └──────────────────────────────────────────────┘        │
│                                                             │
│   权限：ADMIN_ROLE / DEFAULT_ADMIN_ROLE                     │
│   操作：暂停、升级、角色管理                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 多签配置

- **Owner 数量**: 5
- **签名阈值**: 3/5（需要 3 个签名才能执行交易）
- **延迟**: 48 小时（通过 TimelockController）
- **紧急模式**: 4 小时延迟（仅用于关键安全修复）

### Owner 职责建议

| # | 角色 | 职责 |
|---|------|------|
| 1 | 技术负责人 | 合约升级审核、技术决策 |
| 2 | 安全负责人 | 安全响应、紧急操作 |
| 3 | 运营负责人 | 日常运营、角色管理 |
| 4 | 法务/合规 | 合规策略审核 |
| 5 | 备份/冷钱包 | 离线备份、灾难恢复 |

---

## 前置条件

1. **Sepolia ETH**: 每个 owner 地址至少需要有少量 Sepolia ETH 用于 Gas
2. **环境变量**:
   ```bash
   export ADMIN_PRIVATE_KEY="0x..."          # deployer 私钥
   export SAFE_OWNERS="0xA,0xB,0xC,0xD,0xE"  # 5 个 owner 地址
   ```
3. **Node.js 环境**:
   ```bash
   cd apps/contracts
   npm install
   ```

---

## 步骤 1：创建 Safe 多签钱包

### 1.1 执行部署脚本

```bash
cd apps/contracts

# 设置环境变量
export ADMIN_PRIVATE_KEY="0x..."
export SAFE_OWNERS="0xOwner1,0xOwner2,0xOwner3,0xOwner4,0xOwner5"

# 部署 Safe
npx hardhat run scripts/deploy-gnosis-safe.js --network sepolia
```

### 1.2 部署输出示例

```
═══════════════════════════════════════════════════════════════
  FidesOrigin — Gnosis Safe 3/5 Multisig Deployment
═══════════════════════════════════════════════════════════════
Network: sepolia (chainId=11155111)
Deployer: 0x5F6Ae278e7a62E64F9F467a91B693f372b84a374

━━━ Safe Configuration ━━━
  Threshold: 3/5
  Owner 1: 0xOwner1...
  Owner 2: 0xOwner2...
  ...

━━━ Safe Contracts ━━━
  Singleton:        0x29fcb43b46531bca003ddc8fcb67ffe91900c762
  ProxyFactory:     0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec23
  FallbackHandler:  0xfd0732Dc9E303f09fCEf3a0648e6da93ee8886E3

━━━ Creating Safe Multisig Wallet ━━━
  Predicted Safe Address: 0xSafeAddress...
  Factory tx: 0x...
  ✅ Safe created! Block: 11305940

━━━ Verifying Safe Configuration ━━━
  Threshold: 3/5
  Nonce:     0
  Owners:
    1. 0xOwner1...
    2. 0xOwner2...
    ...
```

### 1.3 验证 Safe 地址

部署记录保存在：
- `apps/contracts/deployments/gnosis-safe-sepolia-latest.json`

---

## 步骤 2：转移合约所有权

### 2.1 先执行 Dry Run（验证）

```bash
# 验证转移计划，不发送实际交易
export SAFE_ADDRESS="0xSafeAddress..."
DRY_RUN=true npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia
```

### 2.2 执行实际转移

```bash
# ⚠️ 警告：此操作不可逆！确认 Dry Run 输出正确后再执行
DRY_RUN=false npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia
```

### 2.3 转移内容

脚本会转移以下合约的所有权：

| 合约 | 地址类型 | 转移的角色 |
|------|---------|-----------|
| RiskRegistry | UUPS Proxy | ADMIN_ROLE, DEFAULT_ADMIN_ROLE |
| PolicyEngine | UUPS Proxy | ADMIN_ROLE, DEFAULT_ADMIN_ROLE |
| ComplianceEngine | UUPS Proxy | ADMIN_ROLE, DEFAULT_ADMIN_ROLE |
| FidesCompliance | Direct Deploy | ADMIN_ROLE |
| QuarantineVault | Direct Deploy | ADMIN_ROLE |
| CompliantStableCoin | Direct Deploy | ADMIN_ROLE |

### 2.4 转移记录

所有权转移记录保存在：
- `apps/contracts/deployments/ownership-transfer-sepolia-{timestamp}.json`

---

## 步骤 3：验证 Safe 操作权限

### 3.1 运行验证脚本

```bash
# 单 owner 测试模式（验证 Safe 配置）
TEST_MODE=single npx hardhat run scripts/test-safe-operations.js --network sepolia

# 完整多签测试（生产环境验证）
SAFE_ADDRESS=0xSafeAddress... npx hardhat run scripts/test-safe-operations.js --network sepolia
```

### 3.2 验证输出示例

```
═══════════════════════════════════════════════════════════════
  FidesOrigin — Safe Multisig Operation Tests
═══════════════════════════════════════════════════════════════

━━━ Test 1: Safe Admin Role Verification ━━━
  ✅ RiskRegistry: Safe has ADMIN_ROLE
  ✅ PolicyEngine: Safe has ADMIN_ROLE
  ✅ ComplianceEngine: Safe has ADMIN_ROLE
  Total: 3/3 contracts have Safe as admin

━━━ Test 2: Safe Pause/Unpause Operations ━━━
  ✅ Safe has ADMIN_ROLE on ComplianceEngine
  ℹ️  Actual pause/unpause requires Safe multisig execution

━━━ Test 3: Safe Role Management ━━━
  ✅ Safe has ADMIN_ROLE on RiskRegistry
  ✅ Safe can grant/revoke ORACLE_ROLE, COMPLIANCE_ENGINE_ROLE, etc.

━━━ Test 4: Safe Upgrade Proposal (Timelock) ━━━
  Upgrade timelock delay: 172800 seconds (2 days)
  ✅ Safe can propose upgrades through Timelock
  ⏱️  Upgrade delay: 48 hours

━━━ Test 5: Deployer Privilege Revocation ━━━
  ✅ RiskRegistry: Deployer revoked
  ✅ PolicyEngine: Deployer revoked
  ✅ ComplianceEngine: Deployer revoked
  ✅ Deployer revoked from all 3 contracts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Safe Admin Role Verification: PASSED
  ✅ Safe Pause/Unpause: PASSED
  ✅ Safe Role Management: PASSED
  ✅ Safe Upgrade Proposal (Timelock): PASSED
  ✅ Deployer Privilege Revocation: PASSED

  Total:  5
  Passed: 5
  Failed: 0

✅ All Safe operation tests passed!
```

---

## 日常操作流程

### 暂停合约

**场景**: 发现潜在安全问题时暂停合约

**流程**:
1. 技术负责人 + 安全负责人 + 运营负责人（共 3 人）在 Safe 上签名
2. 调用 `ComplianceEngine.pause()` 或 `RiskRegistry.pause()`
3. 交易立即执行（无需 Timelock 延迟，因为是常规管理操作）

### 添加 Oracle

**场景**: 接入新的风险数据提供商

**流程**:
1. 在 Safe 上创建交易：`RiskRegistry.grantRole(ORACLE_ROLE, newOracleAddress)`
2. 3/5 owner 签名
3. 交易执行，新 Oracle 获得权限

### 策略更新

**场景**: 更新合规策略规则

**流程**:
1. 在 Safe 上创建交易：`PolicyEngine.updateRule(...)`
2. 3/5 owner 签名
3. 交易执行

---

## 紧急操作流程

### 紧急模式

**场景**: 发现严重安全漏洞，需要快速响应

**流程**:
1. 紧急操作员（安全团队多签）发起 `proposeEnableEmergencyMode()`
2. 等待 4 小时（EMERGENCY_DELAY）
3. 执行 `executeEmergencyModeChange()`
4. 所有 pending operations 被取消
5. 新的紧急操作可使用 4 小时延迟

### 紧急暂停

如果 Safe 本身不可用，FidesOriginTimelock 合约中的紧急操作员可以直接执行紧急操作。

---

## 故障排除

### Safe 交易失败

**问题**: Safe 交易执行失败

**排查步骤**:
1. 确认 Safe 有足够的 ETH 支付 Gas
2. 确认所有 owner 地址正确
3. 检查目标合约的 `hasRole` 状态
4. 查看交易回滚原因

### 权限未完全转移

**问题**: 某些合约的 ADMIN_ROLE 仍在 deployer 手中

**解决方案**:
```bash
# 单独转移特定合约
SAFE_ADDRESS=0x... npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia
```

### 恢复 deployer 权限（仅限测试网）

**警告**: 生产环境绝不应恢复单签权限

```javascript
// 需要 Safe 多签执行
// Safe 交易: grantRole(ADMIN_ROLE, deployerAddress)
```

### 添加/移除 Safe Owner

**流程**:
1. 在 Safe UI (https://app.safe.global) 中发起 "Add Owner" 或 "Remove Owner"
2. 3/5 owner 签名
3. 交易执行

---

## 安全清单

### 生产环境上线前检查

- [ ] 5 个 owner 地址已确认正确
- [ ] 3/5 阈值已设置
- [ ] 所有合约的 ADMIN_ROLE 已转移到 Safe
- [ ] deployer 已从所有合约撤销权限
- [ ] Timelock 48 小时延迟已激活
- [ ] 紧急操作员已配置
- [ ] test-safe-operations.js 全部通过
- [ ] 已进行一次完整的 Safe 多签流程演练

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `scripts/deploy-gnosis-safe.js` | 部署 Safe 多签钱包 |
| `scripts/transfer-ownership-to-safe.js` | 转移合约所有权 |
| `scripts/test-safe-operations.js` | 验证 Safe 操作权限 |
| `contracts/FidesOriginTimelock.sol` | 时间锁控制器 |
| `deployments/gnosis-safe-sepolia-latest.json` | Safe 部署记录 |
| `deployments/ownership-transfer-sepolia-*.json` | 所有权转移记录 |

---

*最后更新: 2026-07-19*
