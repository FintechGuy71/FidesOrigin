# FidesOrigin 主网前检查清单

> **协议**: FidesOrigin — 链上可编程合规协议  
> **版本**: v3.0.4 (R2 修复后)  
> **目标网络**: Ethereum Mainnet (chainId=1)  
> **当前状态**: Sepolia 已部署，准备主网  
> **最后更新**: 2026-08-09

---

## 安全架构概览

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
│   ┌──────────────┐  ┌──────────────────┐  ┌──────────┐    │
│   │FidesCompliance│  │CompliantStableCoin│  │Quarantine│    │
│   │ (Direct)      │  │ (Direct)          │  │Vault     │    │
│   └──────────────┘  └──────────────────┘  └──────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 合约审计

| # | 检查项 | 负责人 | 截止时间 | 验证方式 | 状态 |
|---|--------|--------|----------|----------|------|
| 1.1 | **外部专业审计（R2 修复后版本）** | 技术负责人 | T-14d | 审计报告编号 + 漏洞修复对照表 | ⬜ |
| 1.2 | **审计修复验证** | 技术负责人 | T-10d | 逐条修复回执 + 复测报告 | ⬜ |
| 1.3 | **回归测试通过** | QA/开发 | T-7d | CI 全部绿灯 + 测试覆盖率 >90% | ⬜ |
| 1.4 | **已修复漏洞清单确认** | 安全负责人 | T-10d | 对照 audit-history/ 目录逐项确认 | ⬜ |

### 已知修复项 (R2 版本)

| 漏洞ID | 严重程度 | 修复状态 | 验证文件 |
|--------|----------|----------|----------|
| H-03 | 高危 | ✅ 已修复 | `FidesOriginTimelock.sol: executeEmergencyModeChange()` 添加 `onlyRole(EXECUTOR_ROLE)` |
| M-07 | 中危 | ✅ 已修复 | `FidesOriginTimelock.sol` 紧急模式切换添加 EMERGENCY_DELAY 时间锁 |
| G-01 | 一般 | ✅ 已修复 | `packages/config/deployments.json` 统一注册表 |

### 审计前准备

- [ ] 确认审计范围包含所有合约（Proxy + Implementation）
- [ ] 确认审计版本为 **R2 修复后** 的代码
- [ ] 准备部署脚本和升级流程文档供审计员参考
- [ ] 确认 `deployments.json` 中 `sepolia` 地址与链上代码一致（`scripts/verify-deployments.mjs`）

---

## 2. 多签设置

| # | 检查项 | 负责人 | 截止时间 | 验证方式 | 状态 |
|---|--------|--------|----------|----------|------|
| 2.1 | **5 个 owner 地址确认** | 全体 | T-7d | 线下确认书 + 冷钱包验证 | ⬜ |
| 2.2 | **3/5 阈值设置** | 技术负责人 | T-7d | Safe UI 截图 + `getThreshold()` 链上读取 | ⬜ |
| 2.3 | **Gnosis Safe 部署** | 技术负责人 | T-7d | `deploy-gnosis-safe.js` 输出 + 链上验证 | ⬜ |
| 2.4 | **Timelock 48h 延迟配置** | 技术负责人 | T-5d | `getMinDelay() == 172800` 链上读取 | ⬜ |
| 2.5 | **紧急操作员配置** | 安全负责人 | T-5d | `isEmergencyOperator()` 链上验证 | ⬜ |
| 2.6 | **Timelock Admin renounce** | 技术负责人 | T-3d | `hasRole(DEFAULT_ADMIN_ROLE, deployer) == false` | ⬜ |

### 2.1 Owner 配置建议

| # | 角色 | 建议持有人 | 职责 |
|---|------|-----------|------|
| 1 | 技术负责人 | 卫斯理 | 合约升级审核、技术决策 |
| 2 | 安全负责人 | TBD | 安全响应、紧急操作 |
| 3 | 运营负责人 | TBD | 日常运营、角色管理 |
| 4 | 法务/合规 | TBD | 合规策略审核 |
| 5 | 备份/冷钱包 | TBD | 离线备份、灾难恢复 |

> ⚠️ **关键**: 生产环境 5 个地址 **必须** 为冷钱包/硬件钱包，禁止使用热钱包或共享私钥。

### 2.2 部署命令

```bash
cd apps/contracts

# 1. 设置环境变量
export ADMIN_PRIVATE_KEY="0x..."          # deployer 私钥（主网）
export SAFE_OWNERS="0xA,0xB,0xC,0xD,0xE"  # 5 个 owner 地址（排序后）

# 2. 部署 Safe（主网）
npx hardhat run scripts/deploy-gnosis-safe.js --network mainnet

# 3. 记录 Safe 地址
export SAFE_ADDRESS="0xSafeAddress..."
```

### 2.3 相关文件

| 文件 | 用途 |
|------|------|
| `scripts/deploy-gnosis-safe.js` | 部署 Safe 多签钱包（支持 Mainnet chainId=1） |
| `apps/contracts/contracts/FidesOriginTimelock.sol` | 时间锁控制器（48h 延迟） |
| `deployments/gnosis-safe-mainnet-latest.json` | Safe 部署记录（待生成） |

---

## 3. 权限移交

| # | 检查项 | 负责人 | 截止时间 | 验证方式 | 状态 |
|---|--------|--------|----------|----------|------|
| 3.1 | **ADMIN_ROLE 转移到 Safe** | 技术负责人 | T-5d | `hasRole(ADMIN_ROLE, Safe) == true` 链上读取 | ⬜ |
| 3.2 | **DEFAULT_ADMIN_ROLE 转移到 Safe** | 技术负责人 | T-5d | `hasRole(DEFAULT_ADMIN_ROLE, Safe) == true` | ⬜ |
| 3.3 | **deployer 权限撤销** | 技术负责人 | T-5d | `hasRole(ADMIN_ROLE, deployer) == false` | ⬜ |
| 3.4 | **验证 test-safe-operations.js 全部通过** | 技术负责人 | T-3d | 脚本输出 5/5 PASSED | ⬜ |
| 3.5 | **Sepolia 完整演练** | 全体 | T-7d | 完整流程跑通（Safe 创建 → 转移 → 测试） | ⬜ |

### 3.1 移交步骤

```bash
# Step 1: Dry Run（验证转移计划，不发送实际交易）
export SAFE_ADDRESS="0xSafeAddress..."
DRY_RUN=true npx hardhat run scripts/transfer-ownership-to-safe.js --network mainnet

# Step 2: 确认 Dry Run 输出正确后，执行实际转移
DRY_RUN=false npx hardhat run scripts/transfer-ownership-to-safe.js --network mainnet

# Step 3: 运行验证脚本
SAFE_ADDRESS="0xSafeAddress..." npx hardhat run scripts/test-safe-operations.js --network mainnet
```

### 3.2 需转移权限的合约清单

| 合约 | 地址类型 | 转移的角色 | 当前状态 (Sepolia) |
|------|---------|-----------|-------------------|
| RiskRegistry | UUPS Proxy | ADMIN_ROLE, DEFAULT_ADMIN_ROLE | ⚠️ 升级被 Timelock 阻塞 |
| PolicyEngine | UUPS Proxy | ADMIN_ROLE, DEFAULT_ADMIN_ROLE | ⚠️ 升级被 Timelock 阻塞 |
| ComplianceEngine | UUPS Proxy | ADMIN_ROLE, DEFAULT_ADMIN_ROLE | ✅ 已升级 v3.0.4 |
| FidesCompliance | Direct Deploy | ADMIN_ROLE | ✅ 已部署 |
| QuarantineVault | Direct Deploy | ADMIN_ROLE | ✅ 已部署 |
| CompliantStableCoin | Direct Deploy | ADMIN_ROLE | ✅ 已部署 |

> ⚠️ **Sepolia 已知问题**: RiskRegistry 和 PolicyEngine 的升级交易被 Timelock 阻塞（见 `sepolia-latest.json` notes）。主网部署前需确认此问题已修复，或首次部署时即使用 Timelock 流程。

### 3.3 验证脚本测试项

| 测试项 | 说明 | 脚本 |
|--------|------|------|
| Test 1: Safe Admin Role Verification | 验证 Safe 拥有所有合约的 ADMIN_ROLE | `test-safe-operations.js` |
| Test 2: Safe Pause/Unpause Operations | 验证 Safe 可暂停/恢复合约 | `test-safe-operations.js` |
| Test 3: Safe Role Management | 验证 Safe 可管理角色（grant/revoke） | `test-safe-operations.js` |
| Test 4: Safe Upgrade Proposal (Timelock) | 验证 Safe 可通过 Timelock 发起升级 | `test-safe-operations.js` |
| Test 5: Deployer Privilege Revocation | 验证 deployer 已失去所有权限 | `test-safe-operations.js` |

### 3.4 相关文件

| 文件 | 用途 |
|------|------|
| `scripts/transfer-ownership-to-safe.js` | 转移合约所有权到 Safe |
| `scripts/test-safe-operations.js` | 验证 Safe 操作权限（5 项测试） |
| `deployments/ownership-transfer-mainnet-*.json` | 所有权转移记录（待生成） |

---

## 4. 监控与运维

| # | 检查项 | 负责人 | 截止时间 | 验证方式 | 状态 |
|---|--------|--------|----------|----------|------|
| 4.1 | **Prometheus 监控接入** | 运维/DevOps | T-3d | Grafana 面板可查看 | ⬜ |
| 4.2 | **deferredCount 告警规则** | 运维/DevOps | T-3d | 模拟告警触发测试通过 | ⬜ |
| 4.3 | **运行状况检查端点** | 运维/DevOps | T-3d | `/health` 返回 200 | ⬜ |
| 4.4 | **链上事件监控** | 运维/DevOps | T-3d | Timelock / Safe 交易实时告警 | ⬜ |
| 4.5 | **Gas 费预算** | 财务/技术 | T-7d | Safe 钱包 ETH 余额 > 0.5 ETH | ⬜ |

### 4.1 关键监控指标

| 指标 | 来源 | 告警阈值 |
|------|------|----------|
| `deferredCount` | ComplianceEngine | > 10（1小时内） |
| `paused` | RiskRegistry/PolicyEngine/ComplianceEngine | 状态变化即告警 |
| `emergencyMode` | FidesOriginTimelock | 状态变化即告警 |
| `pendingOperations` | FidesOriginTimelock | 队列长度 > 5 |
| Safe 交易 | Gnosis Safe API | 任何非预期交易 |

### 4.2 运行状况检查端点

```
GET /health
{
  "status": "healthy",
  "contracts": {
    "RiskRegistry": "0x...",
    "PolicyEngine": "0x...",
    "ComplianceEngine": "0x..."
  },
  "safe": {
    "address": "0x...",
    "threshold": "3/5"
  },
  "timelock": {
    "delay": 172800,
    "emergencyMode": false
  }
}
```

---

## 5. 文档与沟通

| # | 检查项 | 负责人 | 截止时间 | 验证方式 | 状态 |
|---|--------|--------|----------|----------|------|
| 5.1 | **部署文档更新** | 技术负责人 | T-3d | `MULTISIG_SETUP.md` 更新为主网版本 | ⬜ |
| 5.2 | **操作手册（暂停/升级/紧急响应）** | 安全负责人 | T-3d | 文档评审通过 | ⬜ |
| 5.3 | **团队培训** | 技术负责人 | T-1d | 全员签署确认书 | ⬜ |
| 5.4 | **应急预案演练** | 安全负责人 | T-1d | 模拟紧急暂停流程跑通 | ⬜ |
| 5.5 | **社区公告准备** | 运营负责人 | T-0d | 主网上线公告草稿 | ⬜ |

### 5.1 操作手册必须包含

| 场景 | 操作流程 | 预计耗时 |
|------|----------|----------|
| 日常暂停 | Safe 3/5 签名 → 调用 `pause()` | 10-30 分钟 |
| 策略更新 | Safe 3/5 签名 → 调用 `updateRule()` | 10-30 分钟 |
| 合约升级 | Safe 3/5 签名 → Timelock schedule → 48h 等待 → execute | ~48.5 小时 |
| 紧急模式 | 紧急操作员 propose → 4h 等待 → execute | ~4 小时 |
| 紧急暂停（Safe 不可用） | 紧急操作员直接调用 Timelock 紧急函数 | 即时 |

### 5.2 相关文件

| 文件 | 用途 |
|------|------|
| `apps/contracts/scripts/MULTISIG_SETUP.md` | 多签设置完整指南 |
| `docs/audit-history/CONTRACT_DEPLOYMENT_STATUS.md` | 部署历史与审计记录 |
| `packages/config/deployments.json` | 合约地址唯一注册表 |

---

## 6. 主网部署顺序

```
Day 1:  审计最终确认 + 5 owner 地址锁定
        └─> 启动外部审计（如尚未完成）

Day 3:  部署 Gnosis Safe 3/5（mainnet）
        ├─> scripts/deploy-gnosis-safe.js --network mainnet
        └─> 保存 Safe 地址，分发 owner

Day 5:  部署 Timelock（mainnet）
        ├─> 配置 Proposers = Safe
        ├─> 配置 Executors = Safe + 紧急多签
        └─> Admin renounce

Day 7:  部署核心合约（mainnet）
        ├─> RiskRegistry (UUPS Proxy)
        ├─> PolicyEngine (UUPS Proxy)
        ├─> ComplianceEngine (UUPS Proxy)
        ├─> FidesCompliance (Direct)
        ├─> QuarantineVault (Direct)
        └─> CompliantStableCoin (Direct)

Day 8:  权限移交
        ├─> DRY_RUN=true transfer-ownership-to-safe.js
        ├─> DRY_RUN=false transfer-ownership-to-safe.js
        └─> test-safe-operations.js（5/5 PASSED）

Day 10: 监控接入 + 运行状况检查
        ├─> Prometheus/Grafana
        ├─> 告警规则配置
        └─> /health 端点验证

Day 12: 团队培训 + 应急演练
        └─> 全员确认书签署

Day 14: 主网上线 🚀
        ├─> 社区公告
        ├─> 实时监控
        └─> 24h 值班响应
```

---

## 7. 当前状态快照 (Sepolia)

### 7.1 合约地址

| 合约 | Sepolia 地址 | Mainnet 状态 |
|------|-------------|-------------|
| RiskRegistry Proxy | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | ⬜ 待部署 |
| PolicyEngine Proxy | `0x87089F67A61F9643796AE154663A6a9F21196b38` | ⬜ 待部署 |
| ComplianceEngine Proxy | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` | ⬜ 待部署 |
| FidesCompliance | `0x05497600618071C34CB3Fdb8A9E159e9589DEC79` | ⬜ 待部署 |
| CompliantStableCoin | `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` | ⬜ 待部署 |
| QuarantineVault | `0xF5593e26b2560b9fc71de729EA2D86F979dfd76b` | ⬜ 待部署 |
| Gnosis Safe | `gnosis-safe-sepolia-latest.json` | ⬜ 待部署 |
| FidesOriginTimelock | 嵌入 Proxy | ⬜ 待部署 |

### 7.2 已知问题

| 问题 | 影响 | 状态 |
|------|------|------|
| RiskRegistry 升级被 Timelock 阻塞 | Sepolia 上无法直接升级 | ⚠️ 需用 schedule/execute 流程 |
| PolicyEngine 升级被 Timelock 阻塞 | Sepolia 上无法直接升级 | ⚠️ 需用 schedule/execute 流程 |
| `deployments.json` 无 mainnet 条目 | 主网地址未注册 | ⬜ 待部署后更新 |

### 7.3 部署记录文件

| 文件 | 状态 |
|------|------|
| `deployments/sepolia-latest.json` | ✅ 存在 (v3.0.4) |
| `deployments/gnosis-safe-sepolia-latest.json` | ✅ 存在 |
| `deployments/gnosis-safe-mainnet-latest.json` | ⬜ 不存在（待生成） |
| `deployments/ownership-transfer-sepolia-*.json` | ✅ 存在 |
| `deployments/ownership-transfer-mainnet-*.json` | ⬜ 不存在（待生成） |

---

## 8. 附录

### 8.1 关键角色哈希

```javascript
DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000"
ADMIN_ROLE         = keccak256("ADMIN_ROLE")
ORACLE_ROLE        = keccak256("ORACLE_ROLE")
OPERATOR_ROLE      = keccak256("OPERATOR_ROLE")
COMPLIANCE_ENGINE_ROLE = keccak256("COMPLIANCE_ENGINE_ROLE")
RULE_MANAGER_ROLE  = keccak256("RULE_MANAGER_ROLE")
```

### 8.2 Gnosis Safe Mainnet 常量

```javascript
// scripts/deploy-gnosis-safe.js 中已配置
const SAFE_ADDRESSES = {
    1: { // Mainnet
        singleton:       "0x41675C099F32341bf84BFc5382aF534df5C7461a",
        proxyFactory:    "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec23",
        fallbackHandler: "0xfd0732Dc9E303f09fCEf3a0648e6da93ee8886E3",
        multiSend:       "0x38869bf66a61cF6bDB9B8028a8F5afB2bD1f6D2d",
        multiSendCallOnly: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
        signMessageLib:  "0xd53cd0aB83D845Ac265BE939c57F53AD838012c9",
        createCall:      "0x9b35Af71d77eaf8d7e40252370304687390A1A52",
    }
};
```

### 8.3 Timelock 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `MIN_DELAY` | 172800 秒 | 48 小时 |
| `EMERGENCY_DELAY` | 14400 秒 | 4 小时 |
| `getMinDelay()` | 172800 | 标准操作延迟 |
| `getEmergencyDelay()` | 14400 | 紧急操作延迟 |

### 8.4 紧急联系方式

| 角色 | 联系人 | 联系方式 |
|------|--------|----------|
| 技术负责人 | 卫斯理 | TBD |
| 安全负责人 | TBD | TBD |
| 紧急响应群 | - | TBD |

---

*本文档由 FidesOrigin 主网前检查流程自动生成。  
如 checklist 中任意一项未完成，**禁止**执行主网部署。*
