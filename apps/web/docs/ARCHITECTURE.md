# FidesOrigin - 架构设计文档

## 系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      Client / DApp Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   StableCoin │  │ SmartWallet  │  │   Compliance SDK    │ │
│  │  (cUSD, etc) │  │   (MPC/AA)   │  │  (TypeScript/Web)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘ │
└─────────┼─────────────────┼─────────────────────┼────────────┘
          │                 │                     │
          └─────────────────┼─────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              FidesOrigin Protocol Core Layer                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              ComplianceEngine (Single Entry)              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐ │ │
│  │  │RiskRegistry │  │PolicyEngine │  │   RiskOracle    │ │ │
│  │  │ (数据层)     │  │ (规则层)     │  │  (预言机层)      │ │ │
│  │  └─────────────┘  └─────────────┘  └────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. ComplianceEngine - 统一合规入口
- **职责**: 所有合规查询的单一入口点
- **接口**: 同时实现 `IAssetCompliance` + `IWalletCompliance`
- **决策输出**: ALLOW / BLOCK / FLAG / HOLD 四级体系
- **集成方式**: 在转账/操作前调用 `preTransferHook` / `preExecutionHook`

### 2. RiskRegistry - 链上风险数据库
- **职责**: 存储地址风险档案、制裁名单、实体标签、合约风险
- **角色控制**: ORACLE_ROLE 更新风险数据, ADMIN_ROLE 紧急制裁
- **数据模型**:
  ```
  RiskProfile = {
    riskScore: 0-100,
    tier: UNKNOWN | LOW | MEDIUM | HIGH,
    tags: ["exchange", "whale", "mixer"],
    isSanctioned: bool,
    lastUpdated: timestamp
  }
  ```

### 3. PolicyEngine - 策略评估引擎
- **职责**: 根据 RiskRegistry 数据和自定义策略评估交易/操作
- **策略类型**:
  - IssuerPolicy: 资产发行方策略 (稳定币/RWA)
  - WalletPolicy: 钱包策略 (MPC/AA/托管)
- **评估维度**:
  1. 制裁名单检查 (最高优先级)
  2. 金额限额检查
  3. 日累计限额
  4. 风险等级匹配
  5. 混币器检测
  6. 合约风险检查

### 4. RiskOracle - 链下数据桥接
- **职责**: 从链下数据源获取风险数据并同步到 RiskRegistry
- **技术栈**: Chainlink Functions (Serverless Oracle)
- **数据源**:
  - OFAC/UN/EU 制裁名单
  - Chainalysis 风险评分
  - TRM Labs 交易监控
  - 自定义数据源
- **双模式**:
  - 自动模式: Chainlink Functions 定期同步
  - 手动模式: 运营团队直接调用 `updateRiskProfile`

## 集成架构

### 资产发行方集成 (稳定币/RWA)
```solidity
// 重写 ERC20._update 嵌入合规钩子
function _update(address from, address to, uint256 amount) internal override {
    if (from != address(0) && to != address(0) && complianceEnabled) {
        _checkCompliance(from, to, amount);
    }
    super._update(from, to, amount);
}
```

### 钱包集成 (MPC/AA)
```solidity
// 每笔操作前调用合规引擎
modifier compliantOp(IWalletCompliance.Operation calldata op) {
    if (complianceEnabled) {
        complianceEngine.preExecutionHook(owner, op);
    }
    _;
}
```

## 安全模型

### 权限矩阵
| 操作 | 需要角色 |
|------|---------|
| 更新风险档案 | ORACLE_ROLE |
| 紧急制裁 | ADMIN_ROLE |
| 修改策略 | ADMIN_ROLE |
| 冻结资金 | ADMIN_ROLE |
| 记录转账 | COMPLIANCE_ENGINE_ROLE |
| 暂停合约 | ADMIN_ROLE |

### 暂停机制
- ComplianceEngine 支持 Pausable (OpenZeppelin)
- RiskRegistry 支持 Pausable
- 暂停期间所有合规检查停止,但不影响已冻结资金

### 升级路径
- **当前**: 不可升级 (透明合约)
- **建议**: v2 采用 UUPS 代理模式,允许策略和规则迭代

## Gas 优化策略

1. **RiskRegistry 批量更新**: `batchUpdateRiskProfiles` 支持一次更新 100 个地址
2. **PolicyEngine 日限额**: 用 `block.timestamp / 1 days` 作为日 key,避免日期计算
3. ** ComplianceEngine 快速路径**: 未来版本增加 `quickCheck` 仅查缓存风险等级

## 多链部署

| 网络 | 适用场景 | 备注 |
|------|---------|------|
| Ethereum | 机构级部署 | Gas 高,安全性最高 |
| Polygon | 零售级稳定币 | 低 Gas,适合高频转账 |
| Arbitrum/Optimism/Base | DeFi 集成 | L2 低 Gas,EVM 兼容 |
| BNB Chain | 新兴市场 | 亚洲用户友好 |
| Sepolia/Goerli | 测试验证 | 预生产环境 |

## 数据流

```
链下数据源 (OFAC/Chainalysis/TRM)
    │
    ▼
┌─────────────────┐
│  RiskOracle     │  ← Chainlink Functions 触发
│  (Chainlink)    │
└────────┬────────┘
         │ 更新风险档案
         ▼
┌─────────────────┐     ┌─────────────────┐
│  RiskRegistry   │────→│  PolicyEngine   │
│  (链上数据库)    │     │  (规则引擎)      │
└─────────────────┘     └────────┬────────┘
                                   │ 评估决策
                                   ▼
                          ┌─────────────────┐
                          │ ComplianceEngine │ ← 统一入口
                          │  (合规引擎)      │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌─────────┐   ┌─────────┐   ┌─────────┐
              │StableCoin│   │Wallet   │   │  SDK    │
              │  cUSD    │   │  MPC    │   │  TS/JS  │
              └─────────┘   └─────────┘   └─────────┘
```
