# FidesOrigin 系统架构文档

> **版本**: v2.4.1  
> **最后更新**: 2026-06-29  
> **架构风格**: 模块化、多链、事件驱动

---

## 目录

1. [架构概览](#架构概览)
2. [核心组件](#核心组件)
3. [数据流](#数据流)
4. [技术栈](#技术栈)
5. [模块详解](#模块详解)
6. [安全架构](#安全架构)
7. [部署架构](#部署架构)
8. [扩展性设计](#扩展性设计)

---

## 架构概览

FidesOrigin 是一个可编程的链上合规协议，采用模块化架构设计，支持多链部署和灵活的风险管理策略。

### 架构原则

1. **模块化**: 每个核心功能独立合约，可单独升级
2. **可组合**: 合约之间通过标准接口交互
3. **多链**: 支持 Ethereum、Polygon、L2 等多条链
4. **事件驱动**: 所有状态变更通过事件通知子图
5. **安全优先**: 多重权限控制、紧急暂停、审计日志

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Web dApp  │  │  Mobile SDK │  │  API Client │  │  Third-party dApps  │  │
│  │  (Next.js)  │  │   (React)   │  │   (REST)    │  │    (Ethers.js)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────┼────────────────────┼─────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              服务层                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Subgraph   │  │  Risk Sync  │  │   Web API   │  │    Event Indexer    │  │
│  │   (Graph)   │  │   Service   │  │  (Node.js)  │  │    (The Graph)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────┼────────────────────┼─────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            区块链层 (多链)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Ethereum   │  │  Polygon    │  │    L2s      │  │     [I-02] Tempo    │  │
│  │  (Mainnet)    │  │  (Mainnet)  │  │ (Arb/Op/Base)│  │   (Payments L1)     │
│   — Planned, not    │
│   yet implemented    │  │
│  │               │  │             │  │              │  │                     │  │
│  │ ┌─────────┐  │  │ ┌─────────┐  │  │ ┌─────────┐  │  │  ┌─────────┐        │  │
│  │ │RiskReg  │  │  │ │RiskReg  │  │  │ │RiskReg  │  │  │  │RiskReg  │        │  │
│  │ │PolicyEng│  │  │ │PolicyEng│  │  │ │PolicyEng│  │  │  │PolicyEng│        │  │
│  │ │CompEng  │  │  │ │CompEng  │  │  │ │CompEng  │  │  │  │CompEng  │        │  │
│  │ │FidesComp│  │  │ │FidesComp│  │  │ │FidesComp│  │  │  │FidesComp│        │  │
│  │ └─────────┘  │  │ └─────────┘  │  │ └─────────┘  │  │  └─────────┘        │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. 智能合约层

| 合约 | 职责 | 可升级 |
|------|------|--------|
| `RiskRegistry` | 地址风险评估、制裁名单管理 | ✅ UUPS |
| `PolicyEngine` | 发行方/钱包策略配置 | ✅ UUPS |
| `ComplianceEngine` | 交易合规检查、资金冻结 | ✅ UUPS |
| `FidesCompliance` | Fides 专用合规规则 | ✅ UUPS |
| `CompliantStablecoin` | 合规稳定币实现 | ✅ UUPS |
| `CompliantSmartWallet` | 合规智能钱包 | ✅ UUPS |
| `QuarantineVault` | 隔离资金保管 | ✅ UUPS |

### 2. 服务层

| 服务 | 技术 | 职责 |
|------|------|------|
| **Subgraph** | The Graph / GraphQL | 事件索引、数据查询 |
| **Risk Sync** | Node.js / Prisma | 外部风险数据同步 |
| **Web API** | Next.js API Routes | 前端数据接口 |
| **Event Indexer** | The Graph | 链上事件实时索引 |

### 3. 前端层

| 应用 | 技术 | 职责 |
|------|------|------|
| **Web dApp** | Next.js 14 + React | 用户界面、钱包交互 |
| **SDK** | TypeScript / Ethers.js | 第三方集成 |
| **Admin** | React + Tailwind | 管理员面板 |

---

## 数据流

### 1. 交易合规检查流程

```
用户发起交易
    │
    ▼
┌─────────────────┐
│ CompliantToken  │ ──▶ 检查 transfer 是否合规
│   .transfer()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ComplianceEngine │ ──▶ 调用 RiskRegistry 查询风险等级
│  .checkTransfer() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RiskRegistry   │ ──▶ 返回风险评分
│  .getRiskProfile()│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 通过      拒绝
    │         │
    ▼         ▼
 执行转账   触发隔离
    │         │
    ▼         ▼
  发事件    发事件
```

### 2. 风险数据同步流程

```
外部数据源
(Chainalysis / OFAC)
    │
    ▼
┌─────────────────┐
│  Risk Sync API  │ ──▶ 获取最新制裁名单
│   (Node.js)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RiskRegistry   │ ──▶ 更新链上风险数据
│  .addSanction() │
└────────┬────────┘
         │
         ▼
    ┌────┴────┐
    ▼         ▼
  发事件    子图索引
```

### 3. 事件索引流程

```
链上事件
    │
    ▼
┌─────────────────┐
│  The Graph      │ ──▶ 监听合约事件
│  (Subgraph)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Graph Node     │ ──▶ 处理事件、更新实体
│  (Indexing)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GraphQL API    │ ──▶ 提供查询接口
│  (Query Layer)  │
└────────┬────────┘
         │
         ▼
    Web dApp / SDK
```

---

## 技术栈

### 智能合约

| 技术 | 版本 | 用途 |
|------|------|------|
| Solidity | ^0.8.20 | 合约开发 |
| Hardhat | ^2.22 | 开发框架 |
| OpenZeppelin | ^5.0 | 安全合约库 |
| Ethers.js | ^6.0 | 合约交互 |
| Slither | latest | 静态分析 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 14 | React 框架 |
| React | ^18 | UI 库 |
| TypeScript | ^5.0 | 类型系统 |
| Tailwind CSS | ^3.4 | 样式 |
| Ethers.js | ^6.0 | 区块链交互 |
| wagmi/viem | ^2.0 | React hooks |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20 | 运行时 |
| Prisma | ^5.0 | ORM |
| PostgreSQL | 15+ | 数据库 |
| Redis | 7+ | 缓存 |

### 基础设施

| 技术 | 用途 |
|------|------|
| Vercel | 前端托管 |
| The Graph | 子图索引 |
| GitHub Actions | CI/CD |
| Docker | 容器化 |

---

## 模块详解

### 1. RiskRegistry

```solidity
// 核心功能
- setRiskProfile(address, uint8 riskLevel, uint8 tier)
- addSanction(address, string reason)
- removeSanction(address)
- getRiskProfile(address) → (uint8, uint8, bool)
- isSanctioned(address) → bool
```

**事件**:
- `RiskProfileUpdated(address, uint8, uint8, bool)`
- `SanctionAdded(address, string)`
- `SanctionRemoved(address)`

### 2. PolicyEngine

```solidity
// 核心功能
- setIssuerPolicy(address, IssuerPolicy)
- setWalletPolicy(address, WalletPolicy)
- evaluatePolicy(address, address, uint256) → (bool, uint8, string)
```

**事件**:
- `IssuerPolicySet(address, IssuerPolicy)`
- `WalletPolicySet(address, WalletPolicy)`
- `PolicyEvaluated(address, address, address, uint256, uint8, string)`

### 3. ComplianceEngine

```solidity
// 核心功能
- checkTransfer(address, address, uint256) → (bool, uint8, string)
- holdFunds(bytes32, address, uint256)
- releaseFunds(bytes32, address)
- activateEmergencyMode()
- deactivateEmergencyMode()
```

**事件**:
- `ComplianceCheck(address, address, address, uint256, uint8, string)`
- `FundsHeld(bytes32, address, address, uint256)`
- `FundsReleased(bytes32, address, uint256)`
- `EmergencyModeActivated(address)`
- `EmergencyModeDeactivated(address)`

### 4. FidesCompliance

Fides 专用合规模块，扩展基础合规功能：

```solidity
// 核心功能
- createRule(bytes32, string, uint8)
- updateRule(bytes32, uint8)
- evaluateFidesRule(address, address, uint256) → bool
- createAuditLog(uint8, address, bytes32)
```

### 5. CompliantSmartWallet

智能合约钱包，内置合规检查：

```solidity
// 核心功能
- executeOperation(bytes32, uint8, address, uint256)
- executeBatch(Operation[])
- freezeBalance(address, string)
- releaseBalance(address)
- autoQuarantine(address, uint256, string)
```

---

## 安全架构

### 1. 权限控制

```
┌─────────────────┐
│   Owner (Multi-sig)  │
│   2/3 Gnosis Safe    │  ← [I-03] Planned, not yet implemented in code
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Admin  │ │ Upgrader│
│ Role   │ │ Role    │
└───┬────┘ └────┬───┘
    │           │
    ▼           ▼
┌─────────────────┐
│  Contract Functions  │
│  - pause()          │
│  - upgradeTo()      │
│  - setRiskProfile() │
│  - emergencyStop()  │
└─────────────────┘
```

### 2. 紧急机制

| 机制 | 触发条件 | 操作 |
|------|----------|------|
| **Pause** | 管理员调用 | 暂停所有转账 |
| **Emergency Mode** | 严重风险事件 | 冻结所有资金 |
| **Quarantine** | 高风险交易 | 隔离资金到 Vault |
| **Upgrade** | 漏洞修复 | 代理合约升级 |

### 3. 审计与日志

所有关键操作记录：
- 交易哈希
- 操作类型
- 操作者地址
- 时间戳
- 结果状态

---

## 部署架构

### 1. 多链部署

```
                    ┌─────────────┐
                    │  Deployment  │
                    │   Manager    │
                    │  (GitHub CI) │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ Ethereum│      │ Polygon │      │  L2s    │
   │ Sepolia │      │  Amoy   │      │ Testnet │
   │ (Test)  │      │ (Test)  │      │ (Test)  │
   └────┬────┘      └────┬────┘      └────┬────┘
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ Ethereum│      │ Polygon │      │  L2s    │
   │ Mainnet │      │ Mainnet │      │ Mainnet │
   │ (Prod)  │      │ (Prod)  │      │ (Prod)  │
   └─────────┘      └─────────┘      └─────────┘
```

### 2. CI/CD 流水线

```
Developer Push
      │
      ▼
┌─────────────┐
│   CI Test   │ ──▶ Lint / Test / Build / Security
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Merge     │ ──▶ Code Review Required
│   to Main   │
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
┌─────┐ ┌─────┐
│ Web │ │Sub  │
│Deploy│ │Graph│
│Vercel│ │Studio│
└─────┘ └─────┘
```

---

## 扩展性设计

### 1. 合约升级

使用 OpenZeppelin UUPS 代理模式：

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Proxy     │────▶│  Implementation │  │  New Implementation │
│  (ERC1967)  │     │   (V1)        │     │   (V2)        │
│             │     │               │     │               │
│  - delegate │     │  - Logic      │     │  - New Logic  │
│  - storage  │     │  - Storage    │     │  - Storage    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 2. 新链支持

添加新链的步骤：

1. 在 `hardhat.config.ts` 中添加网络配置
2. 在 `.env.example` 中添加 RPC 和 API Key
3. 在 `scripts/deploy-contracts.ts` 中添加 NetworkConfig
4. 在 `subgraph/subgraph.yaml` 中添加数据源
5. 更新 CI/CD 工作流

### 3. 新合规规则

添加新合规规则的步骤：

1. 在 `FidesCompliance` 中定义新规则类型
2. 实现规则评估逻辑
3. 添加事件定义
4. 更新子图映射
5. 更新前端 UI

---

## 相关文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [ENVIRONMENT.md](./ENVIRONMENT.md) - 环境变量说明
- [README.md](./README.md) - 项目总览
- [WHITEPAPER-v0.5.0.md](./WHITEPAPER-v0.5.0.md) - 协议白皮书
