# FidesOrigin Subgraph 部署指南

## 当前部署状态

| 网络 | 状态 | 说明 |
|------|------|------|
| Sepolia | ✅ 已配置 | 5 个合约地址已填入，startBlock 已设置 |
| Mainnet | ⏳ 占位符 | 等待合约主网部署后更新地址 |

## Sepolia 合约地址

| 合约 | 地址 | Start Block |
|------|------|-------------|
| RiskRegistry | `0x7a41abE5B170085fDe9d4e0a3BaD47A70bAC52bc` | 7,650,000 |
| ComplianceEngine | `0x50aAaf70b50fB26e588e0d296A4c042943FfB0AC` | 7,650,000 |
| PolicyEngine | `0x87089F67A61F9643796AE154663A6a9F21196b38` | 7,650,000 |
| FidesCompliance | `0x945392d7Aabbf8dc4116711bD6c8dD6EF2098594` | 7,800,000 |
| CompliantStableCoin | `0xb47a6520740a54B375e6F3B22bC316B4b02bFbCF` | 7,800,000 |

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
