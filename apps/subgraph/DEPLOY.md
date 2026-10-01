# FidesOrigin Subgraph 部署指南

## 当前部署状态

| 网络 | 状态 | 版本 | 查询端点 | 说明 |
|------|------|------|----------|------|
| Sepolia | ✅ 已部署并同步 | latest | `https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/version/latest` | 2026-10-01 核验：block 11821625，`hasIndexingErrors:false`，riskProfiles 已索引 142 条 |
| Mainnet | ⏳ 占位符 | — | — | 等待合约主网部署后更新 |

> ⚠️ **端点必须用 `version/latest`**：固定版本号（`v0.0.5`、`v0.2.0`）在 Studio 每次
> 重新部署后都会失效并返回 `{"message":"Not found"}`（2026-10-01 实测两者均已 404）。
> `version/latest` 始终指向当前活跃 deployment，与 `apps/web` 前端默认值一致。

## Sepolia 合约地址

> 权威来源：`apps/subgraph/subgraph.yaml` + `networks.json`（本表 2026-10-01 依其校正，
> 原表 startBlock 7,650,000 / FidesCompliance 地址均已过期，且缺 QuarantineVault）。

| 合约 | 地址 | Start Block |
|------|------|-------------|
| RiskRegistry | `0x953f985f38f94d6159c0600d1f15D543895cE896` | 11,550,000 |
| ComplianceEngine | `0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E` | 11,550,000 |
| PolicyEngine | `0xCA12BB2daD2a6D429277823366D8C88a490EDDeA` | 11,550,000 |
| FidesCompliance | `0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5` | 11,550,000 |
| CompliantStableCoin | `0x2245A8FCf6aca017327eA8950Ba510e9596595E9` | 11,550,000 |
| QuarantineVault | `0xa5Db586Fd93F49582405803eaB99C147267EfCbE` | 11,730,000 |

## 实体映射状态

| 实体 | 事件源 | 状态 |
|------|--------|------|
| `PolicyEvaluation` | PolicyEngine.PolicyEvaluated | ✅ 已持久化 |
| `WalletPolicy` | PolicyEngine.WalletPolicySet | ✅ 已持久化 |
| `DailyStats.uniqueAddresses` | ComplianceEngine.ComplianceCheck | ✅ 已实现（通过 DailyStatsAddress 去重计数） |
| `RiskProfile` / `RiskProfileUpdate` | RiskRegistry | ✅ 已映射 |
| `ComplianceCheck` / `HoldRecord` / `OperationLog` | ComplianceEngine | ✅ 已映射 |
| `FidesRiskProfile` / `FidesComplianceCheck` / `FidesTransactionBlocked` / `FidesAuditLog` / `FidesRule` | FidesCompliance | ✅ 已映射 |
| `TokenTransfer` / `TokenTransferBlocked` / `KYCStatus` / `TokenPolicy` | CompliantStableCoin | ✅ 已映射 |

## 主网部署 Checklist

1. [ ] 部署全部 5 个合约到 Ethereum Mainnet
2. [ ] 记录每个合约的部署地址和部署区块号
3. [ ] 更新 `networks.json` 中 `mainnet` 部分的地址和 startBlock
4. [ ] 在 `subgraph.yaml` 中新增 mainnet 数据源（或复制 sepolia 配置并修改 network 和 address）
5. [ ] 运行 `graph codegen && graph build`
6. [ ] 创建/更新 Subgraph Studio 项目
7. [ ] 部署到 The Graph Network: `graph deploy --studio <subgraph-name>`
8. [ ] 等待同步完成，验证查询端点数据

## 常用命令

```bash
# 生成代码
graph codegen

# 构建
graph build

# 本地测试部署（需要 Graph Node）
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 fidesorigin/fidesorigin

# 部署到 Subgraph Studio
graph deploy --studio fidesorigin
```

## 注意事项

- **startBlock**: 设置为合约部署区块号，可加快同步速度
- **主网地址**: 当前 `networks.json` 中 mainnet 地址为 `0x0000...0000` 占位符，部署后必须替换
- **FidesCompliance 地址**: 注意大小写混合（EIP-55 校验），复制时保持原样
- **ABI 文件**: 确保 `./abis/` 目录下的 JSON 与部署合约版本一致

---
*Generated: 2026-06-30*
*Network: Sepolia (active) / Mainnet (pending)*
