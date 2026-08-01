# FidesOrigin 合约文档

> 自动生成于 2026-08-01
> 协议版本: FidesOrigin Protocol v2.6.1

---

## 合约概览

| 合约 | 版本 | 功能 | 部署状态 |
|------|------|------|----------|
| FidesCompliance | 1.4.0 | 主合规合约（UUPS可升级） | Sepolia ✅ |
| ComplianceEngine | 1.2.1 | 合规执行引擎 | Sepolia ✅ |
| PolicyEngine | 1.2.1 | 策略规则引擎 | Sepolia ✅ |
| RiskRegistry | 1.2.2 | 风险注册表V1 | Sepolia ✅ |
| RiskRegistryV2 | 2.3.1 | 风险注册表V2（升级后） | Sepolia ✅ |
| QuarantineVault | 1.2.1 | 隔离金库 | Sepolia ✅ |
| RiskOracle | 1.2.1 | 风险预言机 | Sepolia ✅ |
| RiskOracleConsensus | 1.2.1 | 预言机共识机制 | Sepolia ✅ |
| FidesOriginTimelock | 1.2.1 | 时间锁治理 | Sepolia ✅ |
| FidesBridgeReceiver | 1.2.1 | 跨链桥接收器 | 配置就绪 |
| MerkleRiskRegistry | 1.0.0 | Merkle树风险注册 | 配置就绪 |
| TestUSD | 3.0.0 | 测试稳定币 | Sepolia ✅ |

---

## Sepolia 部署地址

```json
{
  "FidesCompliance": "0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594",
  "CompliantStableCoin": "0xb47a6520740a54B375e6F3B22bC316B4b02bFbCF",
  "RiskRegistry": "0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc",
  "ComplianceEngine": "0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC",
  "PolicyEngine": "0x87089F67A61F9643796AE154663A6a9F21196b38"
}
```

---

## 核心架构

### 1. FidesCompliance (主入口)

```solidity
contract FidesCompliance is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    UUPSUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    string public constant VERSION = "1.4.0";
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant SETTER_DELAY = 48 hours;
}
```

**核心功能**:
- `checkCompliance(address, uint256)` — 单笔合规检查
- `checkBatchCompliance(address[], uint256[])` — 批量合规检查
- `isBlacklisted(address)` — 黑名单查询（Fail-Closed）
- `activateEmergencyMode()` — 紧急模式激活
- `upgradeTo(address)` — UUPS升级（需时间锁）

### 2. ComplianceEngine (执行引擎)

**职责**: 执行具体的合规规则检查

```solidity
function checkCompliance(
    address from, 
    address to, 
    uint256 amount
) external view returns (ComplianceStatus);
```

**返回状态**:
- `COMPLIANT` (0) — 通过
- `BLOCKED` (1) — 阻止
- `FLAGGED` (2) — 标记（需人工审核）
- `HELD` (3) — 资金暂存（QuarantineVault）

### 3. PolicyEngine (策略引擎)

**职责**: 管理动态策略规则

```solidity
struct PolicyRule {
    uint256 id;
    bytes32 ruleType;      // "TX_LIMIT", "DAILY_CAP", "SANCTIONS"
    uint256 threshold;
    bool active;
    uint256 effectiveFrom;
    uint256 effectiveTo;
}
```

### 4. RiskRegistryV2 (风险注册表)

**职责**: 存储和管理地址风险画像

```solidity
struct RiskProfile {
    uint8 riskTier;        // 0=UNKNOWN, 1=LOW, 2=MEDIUM, 3=HIGH, 4=BLACK
    uint8 riskScore;       // 0-100
    bytes32[] tags;
    uint256 lastUpdated;
    bool isSanctioned;
}
```

---

## 安全机制

### 角色权限体系

| 角色 | 权限 | 持有者建议 |
|------|------|------------|
| DEFAULT_ADMIN_ROLE | 超级管理员 | Timelock合约 |
| ADMIN_ROLE | 日常管理 | 多签钱包 |
| OPERATOR_ROLE | 操作员 | 自动化服务 |
| AUDITOR_ROLE | 审计员 | 合规团队 |

### 紧急机制

```solidity
// 紧急暂停（OPERATOR_ROLE）
function emergencyPause() external;

// 紧急模式激活（ADMIN_ROLE）
// 影响: 所有交易进入审核模式
function activateEmergencyMode() external;
```

### 时间锁保护

```solidity
// 关键操作需要48小时延迟
uint256 public constant SETTER_DELAY = 48 hours;

// 升级提议 → 48小时后 → 执行
function proposeUpgrade(address newImplementation) external;
function executeUpgrade() external; // 48小时后
```

---

## 测试覆盖

| 合约 | 测试文件 | 测试数 | 覆盖率 |
|------|----------|--------|--------|
| FidesCompliance | FidesCompliance.test.js | 15+ | >80% |
| FidesCompliance | FidesCompliance.extended.test.js | 30+ | >85% |
| ComplianceEngine | ComplianceEngine.test.js | 12+ | >80% |
| PolicyEngine | PolicyEngine.test.js + daily.test.js | 20+ | >85% |
| RiskRegistry | RiskRegistry.test.js | 15+ | >80% |
| RiskRegistryV2 | MerkleRiskRegistry.extended.test.js | 25+ | >85% |
| QuarantineVault | QuarantineVault.test.js | 35+ | >90% |
| RiskOracle | RiskOracle.test.js | 12+ | >80% |
| FidesOriginTimelock | FidesOriginTimelock.test.js | 10+ | >80% |
| Upgrade Path | upgrade-path.test.js | 8+ | >85% |
| Integration | integration.test.js | 10+ | >75% |

**总计: 391 tests passing**

---

## Gas 报告

| 操作 | 平均Gas | 说明 |
|------|---------|------|
| checkCompliance | ~45,000 | 单笔合规检查 |
| checkBatchCompliance (10笔) | ~120,000 | 批量检查 |
| addRiskProfile | ~65,000 | 添加风险画像 |
| updatePolicy | ~55,000 | 更新策略 |
| emergencyPause | ~30,000 | 紧急暂停 |
| activateEmergencyMode | ~47,000 | 紧急模式 |

---

## 升级路径

```
V1.0.0 (Initial)
  ↓
V1.1.0 (添加批量检查)
  ↓
V1.2.0 (添加Merkle验证)
  ↓
V1.3.0 (统计回滚修复)
  ↓
V1.4.0 (UUPS重构 + 安全加固)
  ↓
V2.0.0 (RiskRegistry V2 — 计划中)
```

---

## 审计历史

| 日期 | 审计方 | 发现问题 | 状态 |
|------|--------|----------|------|
| 2026-05-09 | Kimi Claw | 后端P0-P1问题 | ✅ 已修复 |
| 2026-06-14 | GLM-5.2 | 合约HIGH/CRITICAL | ✅ 已修复 |
| 2026-06-16 | Kimi Claw | 架构问题 | ✅ 已修复 |
| 2026-07-23 | Kimi Claw | 合约重审计 | ✅ 已修复 |
| 2026-08-01 | Kimi Claw | 全栈深度审计 | ✅ 已修复 |

---

## 集成指南

### 前端集成

```javascript
import { ethers } from 'ethers';

const FIDES_ABI = [
  "function checkCompliance(address, uint256) view returns (uint8)",
  "function isBlacklisted(address) view returns (bool)"
];

const fides = new ethers.Contract(
  '0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594',
  FIDES_ABI,
  provider
);

const status = await fides.checkCompliance(to, amount);
// status: 0=COMPLIANT, 1=BLOCKED, 2=FLAGGED, 3=HELD
```

### 合约集成

```solidity
import "@fidesorigin/contracts/interfaces/IFidesCompliance.sol";

contract MyToken is ERC20 {
    IFidesCompliance public fides;
    
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        require(fides.checkCompliance(to, amount) == 0, "Non-compliant transfer");
        super._beforeTokenTransfer(from, to, amount);
    }
}
```

---

*文档版本: 2026-08-01*
*协议版本: FidesOrigin v2.6.1*
*合约版本: 1.4.0 (FidesCompliance)*
