# Changelog

All notable changes to the FidesOrigin project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-06

### Added
- **ComplianceEngine** - 核心合规引擎，实现四级决策体系（ALLOW / BLOCK / FLAG / HOLD）
- **RiskRegistry** - 链上风险数据库，支持地址风险档案、制裁名单、标签系统
- **PolicyEngine** - 策略评估引擎，支持发行方策略和钱包策略，含策略版本控制与一键回滚
- **RiskOracle** - Chainlink Functions 预言机集成，支持链下风险数据上链
- **IAssetCompliance + IWalletCompliance** - 双接口标准，资产发行方和智能钱包合规接口
- **CompliantStableCoin** - 合规稳定币示例实现，自动嵌入合规检查
- **CompliantSmartWallet** - 合规智能钱包示例实现，操作前自动风控
- **TestUSD** - 早期 Demo 合约，支持多标签风控（VIP/普通/灰名单/黑名单）
- **完整测试套件** - 10 个测试文件，224 个测试用例，覆盖核心决策路径、集成场景、紧急模式、策略回滚
- **TypeScript SDK** (`@fidesorigin/sdk`) - 支持 ESM/CJS/UMD 格式，零 Gas 模拟查询
- **The Graph Subgraph** - Sepolia 测试网事件索引，实时查询合规检查记录
- **多网络部署脚本** - 支持 Ethereum, Sepolia, Polygon, Mumbai, Arbitrum, Optimism, Base, BNB Chain
- **Etherscan 自动验证** - 部署后自动验证合约源码
- **TimelockController** - 48 小时标准升级延迟 + 4 小时紧急模式
- **架构文档** (`ARCHITECTURE.md`) - 系统架构设计、组件关系、数据流
- **集成指南** (`INTEGRATION_GUIDE.md`) - 稳定币/钱包/SDK 集成步骤
- **API 参考** (`API_REFERENCE.md`) - 合约 API 与 SDK 方法完整参考
- **部署指南** (`DEPLOYMENT.md`) - 测试网与主网部署步骤、升级流程、回滚方案

### Changed
- 将许可证从 MIT 更新为 BSL 1.1（Business Source License 1.1）
- 重构项目结构，采用模块化架构（Registry / Policy / Engine 三层分离）
- 升级 Solidity 版本至 ^0.8.20，使用 OpenZeppelin Contracts v5
- 部署脚本从单合约扩展为多合约多网络部署

### Fixed
- 修复 OFAC XML 数据解析，采用规范化解析 + Merkle Tree 标准实现
- 修复 RiskOracle 数据同步逻辑，添加三层速率限制（调用冷却期 + 日请求上限 + 批量上限）
- 修复 PolicyEngine 策略版本存储，实现自动快照 + 历史审计链
- 修复 The Graph Subgraph 事件索引，三数据源完整部署
- 修复部署脚本中版本号不一致问题（统一为 v1.0.0）
- 修复 SDK 入口文件命名，从 `FidesOriginSDK` 更正为 `FidesOriginClient`

### Security
- 实现基于 OpenZeppelin AccessControl 的细粒度权限管理（ADMIN / OPERATOR / ORACLE 角色分离）
- 添加 ComplianceEngine 紧急暂停模式（Circuit Breaker）
- 实现多签 + Timelock 升级机制，防止单点故障和恶意升级
- 合约通过完整测试覆盖，包括权限边界测试和异常路径测试

---

## [0.3.0] - 2025-03-31

### Added
- TimelockController 时间锁机制 + 多签管理
- TestUSD 多标签风控系统（VIP / 普通 / 灰名单 / 黑名单）
- 批量地址更新功能

## [0.1.0] - 2025-03-28

### Added
- ERC20 基础合约（TestUSD）
- 黑白名单基础功能
- Hardhat 开发环境配置
