# DEPLOYED — 权威版本与部署状态声明

> [INFO-6/L-10 FIX] 本文件声明仓库中的**权威生产合约集**与各子系统的部署状态。
> 仓库历史上并存多套平行实现（6 个 RiskOracle 变体、3 套合规引擎、3 版
> RiskRegistry/PolicyEngine），曾因此发生过"对着旧版合约写集成"的真实事故
> （data-sync chainSyncer ABI 错配）。**新集成一律以下表为准**，未列出的
> 合约均为遗留参考实现（源码头部已标注 `DEPRECATED`）。

## 权威智能合约集（apps/contracts/contracts/）

| 组件 | 权威文件 | 说明 |
|---|---|---|
| 统一合规入口 | `FidesCompliance.sol` | 面向业务方的主合约（UUPS，升级时间锁 48h） |
| 合规引擎（Diamond） | `DiamondComplianceEngine.sol` + `facets/*` | Diamond 模式，升级走 `DiamondCutFacet`（48h 时间锁） |
| 合规引擎（标准） | `ComplianceEngine.sol` | 非 Diamond 部署的等价实现 |
| 风险档案 | `RiskRegistry.sol` | ORACLE_ROLE 写入，UUPS + 2 天升级时间锁 |
| Merkle 注册表 | `MerkleRiskRegistry.sol` | leaf 规范：`keccak256(keccak256(abi.encode(addr, score, uint8 tier)))` |
| 资金隔离 | `QuarantineVault.sol` | ERC20 托管（QUARANTINE_ROLE keeper 运营） |
| 治理时间锁 | `FidesOriginTimelock.sol` | 标准延迟 2 天 + 紧急路径 4h（H-1 修复后可用） |
| 跨链接收 | `FidesBridgeReceiver.sol` | 3/3 relayer 共识，目标为 MerkleRiskRegistry |
| 风险预言机 | `RiskOracle.sol`（+ Storage/Queue/Consensus） | Chainlink Functions 门面 |
| 演示代币 | `TestUSD.sol` / `examples/CompliantStableCoin.sol` | 仅测试网 |

**遗留/弃用（勿用于新集成）**：`RiskOracleLite`、`MinimalRiskOracle`、
`RiskRegistryV2`、`RiskRegistryReader`、`layer3/PolicyEngineV2`、
`layer3/RiskRegistryV3`（均带 `DEPRECATED` 头注释）。

## 链下数据链路（修复后闭环）

```
OFAC/OpenSanctions/MetaMask 名单
  → data-sync（collect → clean → Prisma 落库）
  → merkleBuilder（规范 leaf + OZ 兼容树，见 src/merkleBuilder.js）
  → chainSyncer → MerkleRiskRegistry.updateMerkleRootFromOracle(bytes32)  [ORACLE_ROLE]
  → 链上 verifyAddress(addr, score, uint8 tier, proof) 验证
```

## 子系统部署状态

| 子系统 | 部署方式 | 备注 |
|---|---|---|
| `public/`（营销站） | Vercel（deploy.yml）+ Cloudflare Worker 双通道 | 静态直出 |
| `apps/web`（Next.js） | Vercel | CSP nonce 中间件 |
| `apps/api`（v1 REST） | Vercel Serverless | 需配置 `RISK_SYNC_API_KEY`（读）/ `RULES_ADMIN_API_KEY`（写）/ `AUTH_REQUIRED` / `TRUST_PROXY`；规则存储需 Vercel KV |
| `backend`（FastAPI） | 独立部署（docker-compose / k8s） | 生产启动强制校验安全配置 |
| `data-sync` / `data-publisher` | k8s（见 k8s/） | 签名走 KMS/Vault；生产禁明文私钥 |

## 链上部署 — Sepolia（v3.1.0，2026-08-23）

审计修复后的全新部署（因存储布局变更不可原地升级，旧 v3.0.4 合约弃用）。
**全部 14 个合约已通过 Etherscan 源码验证**（2026-08-24，含 Diamond 及全部 facets）。
部署脚本：`apps/contracts/scripts/deploy-full.js`；部署记录：`apps/contracts/deployments/sepolia-latest.json`。

| 合约 | 地址 | 类型 |
|---|---|---|
| FidesCompliance | `0x2625eA99A0E7D419b8051C4f2B3cC0b5d78d79D5` | UUPS 代理 |
| DiamondComplianceEngine | `0xdF36A8b16F064308eeDE21A740FAc4e87b724F0E` | Diamond（6 facets） |
| RiskRegistry | `0x953f985f38f94d6159c0600d1f15D543895cE896` | UUPS 代理 |
| PolicyEngine | `0xCA12BB2daD2a6D429277823366D8C88a490EDDeA` | UUPS 代理 |
| QuarantineVault | `0x6803E163259B07F58111f56423aB0732858196Be` | 直部署 |
| MerkleRiskRegistry | `0x31A034efbe22eDc1a78ceb37F52BA869D869c33B` | 直部署（已推送 OFAC 真实 root，见下） |
| TestUSD | `0x34c76eE51f3A063365279f510dA9503dF809D374` | 直部署（演示） |
| CompliantStableCoin (fUSD) | `0x2245A8FCf6aca017327eA8950Ba510e9596595E9` | 直部署（演示） |
| FidesOriginTimelock | `0x04B2Fc88b57AE8d8E6cE26d93294E3511cFbb247` | 直部署（2026-08-25 补部署；proposers/executors/admin=部署者，主网移交多签） |

> 引擎采用 Diamond 架构：审计修复后标准 ComplianceEngine 实现超 EIP-170
> 代码上限（26.8KB > 24576B，旧版仅剩 235B 余量），Diamond 分片为权威替代。
> 旧 v3.0.4 合约（`0x1176...` / `0x50aA...` 等）仍在链上但已弃用，勿用于新集成。

### Merkle 风险名单状态（2026-08-24 已激活）

- **数据源**：美国财政部 OFAC SDN 官方名单（`treasury.gov/ofac/downloads/sdn.csv`，2026-08-07 版）
- **内容**：76 个 ETH 制裁地址，全部 score=100 / tier=4（CRITICAL）
- **当前 root**：`0x1a292437361d236f51dfa198609a2ec309d8173ed253c1e47ed22c193cab4404`
- **推送交易**：`0x90a0a04bb5771ad717e3b2f5f65941254fbeaa7039b2ed01b5ae66c2751f9980`（区块 11557471，经 `updateMerkleRootFromOracle`）
- **链上验证**：`verifyAddress(制裁地址, 100, 4, proof)` ✅ 通过；错误分数生成证明被拒 ✅
- **树快照**：`data-sync/cache/`（merkle-tree.json / ofac-eth-source.txt / merkle-root-latest.txt）
- **后续更新**：data-sync 管道每日跑 `daily-sync` 自动重推（受 `MIN_ORACLE_UPDATE_INTERVAL` 频率限制）

## 部署前检查清单

- [ ] 生产环境已设置 `RISK_SYNC_API_KEY` 与 `RULES_ADMIN_API_KEY`（不同值）
- [ ] `AUTH_REQUIRED` 未设置为 false
- [ ] Vercel KV 已配置（规则持久化），否则规则仅内存态
- [ ] `TRUST_PROXY` 仅在确有可信反向代理时开启
- [ ] Diamond 部署：`AdminFacet.initialize` 已执行且 `_admin` 非零
- [ ] 若使用钱包合规接口：无需再给引擎自授 OPERATOR_ROLE（H-3 已修复），但历史部署需确认
- [ ] data-sync 的同步地址配置指向 MerkleRiskRegistry（非遗留合约）
