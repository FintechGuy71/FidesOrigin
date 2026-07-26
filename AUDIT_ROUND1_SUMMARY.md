# FidesOrigin 三轮深度审计 — Round 1 汇总报告

**审计时间**: 2026-07-26
**审计方式**: 5路并行深度审计（Backend/Contracts/Frontend/DevOps/Subgraph+SDK）

## 统计

| 模块 | Critical | High | Medium | Low | Info | 总计 |
|------|----------|------|--------|-----|------|------|
| Backend | 5 | 5 | 5 | 3 | — | 18 |
| Contracts | 3 | 8 | 4 | 5 | 3 | 23 |
| Frontend | 2 | 5 | 11 | 9 | 8 | 35 |
| DevOps | 3 | 7 | 7 | 7 | 4 | 28 |
| Subgraph/SDK | 5 | 12 | 14 | 15 | 8 | 54 |
| **总计** | **18** | **37** | **41** | **39** | **23** | **158** |

## Critical 问题详细列表

### Backend (5)
1. JWT Secret Key 依赖 Settings 单例，模块导入时验证而非启动时
2. Refresh Token JTI 明文存储在 Redis
3. Admin Password Hash 全局缓存无 TTL/失效机制
4. Login 端点无账户锁定保护
5. APIKey 模型 `key` 列 SHA-256 无盐哈希

### Contracts (3)
1. C-01: Diamond Pattern Storage Collision — BaseFacet 继承 OZ 状态合约
2. C-02: RiskRegistryV2 位打包静默截断（block.timestamp > uint64.max）
3. C-03: DiamondComplianceEngine fallback 未验证 msg.value 转发（降级为 High）

### Frontend (2)
1. SEC-001: 静态 HTML 硬编码 CSP nonce（零安全价值）
2. SEC-003: admin.js 中 40+ 处 innerHTML 使用，XSS 风险

### DevOps (3)
1. 部署产物（含完整存储布局）提交在 Git 中
2. data-publisher 硬编码生产合约地址作为 fallback
3. K8s secret 模板与 deployment 不匹配

### Subgraph/SDK (5)
1. subgraph.yaml 声明 `FidesRiskProfile` 但 schema.graphql 不存在
2. `handleTransactionChecked` ID 碰撞（同 tx 多事件覆盖）
3. `WalletPolicySet` 事件签名与 handler 需求不匹配
4. `totalHeld` 重复计数（直接+间接各加一次）
5. `riskScore` uint256→I32 静默溢出

## 修复状态
- [ ] Round 1 修复中
- [ ] Round 2 验证审计
- [ ] Round 3 终验部署
