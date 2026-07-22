# FidesOrigin Roadmap

> 本文件记录已规划但尚未实现的架构决策和功能。
> 与 ARCHITECTURE.md 的区别：ARCHITECTURE.md 只描述"已实现的架构"，ROADMAP.md 记录"计划中的架构"。

---

## [I-02] Tempo Chain 支持

**状态**: Planned, not yet implemented  
**优先级**: Medium  
**描述**: 集成 Tempo (Payments-First L1) 作为额外的区块链层支持。

**待办**:
- [ ] 添加 Tempo RPC 配置到 `packages/config/src/chains.ts`
- [ ] 部署合约到 Tempo 测试网和主网
- [ ] 配置 Subgraph 索引 Tempo 链上事件
- [ ] 更新前端链选择器支持 Tempo

---

## [I-03] Gnosis Safe 多签治理

**状态**: Planned, not yet implemented in code  
**优先级**: High  
**描述**: 将合约所有权从单一 Owner 迁移到 Gnosis Safe 多签钱包（2/3 签名）。

**待办**:
- [ ] 部署 Gnosis Safe 合约
- [ ] 配置 `Owner` 角色指向 Safe 地址
- [ ] 更新部署脚本支持多签操作
- [ ] 编写多签交易执行文档

---

## 其他计划项

- [ ] 统一 apps/api/ 为纯代理层（当前部分端点仍有本地业务逻辑）
- [ ] 完整迁移 website/ 内容到 apps/web/public/
- [ ] 前端端到端测试 (Playwright/Cypress)
