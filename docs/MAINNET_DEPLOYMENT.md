# FidesOrigin Mainnet 部署清单

> 最后更新：2026-06-30
> 当前版本：v2.6.0
> 审计评级：A-

## 部署前准备

### 1. 多签钱包配置

**TimelockController 配置：**

| 角色 | 要求 | 当前状态 |
|------|------|----------|
| Proposers | 3/5 多签 | ⬜ 待配置 |
| Executors | 2/3 紧急多签 | ⬜ 待配置 |
| Admin | 部署后 renounce | ⬜ 待配置 |

**推荐多签工具：**
- Safe (Gnosis Safe) — 推荐
- OpenZeppelin Defender
- 自建多签合约

### 2. 环境变量

```bash
# 部署私钥（通过 KMS 管理）
KMS_PROVIDER=aws
KMS_KEY_ID=arn:aws:kms:us-east-1:XXXXXX:key/XXXXXX
AWS_REGION=us-east-1

# RPC
ALCHEMY_API_KEY=xxx
ETHERSCAN_API_KEY=xxx

# API
RISK_SYNC_API_KEY=xxx
REDIS_URL=redis://localhost:6379

# 数据同步
OFAC_CRON="0 0 * * *"
CHAINALYSIS_CRON="0 */6 * * *"
```

### 3. 角色分配矩阵

| 角色 | 地址 | 权限 |
|------|------|------|
| DEFAULT_ADMIN_ROLE | TimelockController | 所有角色管理 |
| COMPLIANCE_ENGINE_ROLE | FidesCompliance | 合规检查 |
| ORACLE_ROLE | RiskOracle | 风险数据更新 |
| OPERATOR_ROLE | 运营多签 | 日常操作 |
| AUDITOR_ROLE | 审计多签 | 只读审计 |
| EMERGENCY_ROLE | 紧急多签 | 紧急暂停/恢复 |

---

## 部署步骤

### 第一步：部署核心合约

```bash
cd apps/contracts
npx hardhat run scripts/deploy-full.js --network mainnet
```

部署顺序：
1. RiskRegistry (UUPS Proxy)
2. PolicyEngine (UUPS Proxy)
3. ComplianceEngine (UUPS Proxy)
4. RiskOracle (直接部署)
5. QuarantineVault (直接部署)
6. FidesCompliance (直接部署)

### 第二步：配置角色

```bash
npx hardhat run scripts/grant-role.js --network mainnet
```

### 第三步：验证合约

```bash
npx hardhat verify --network mainnet <contract-address>
```

### 第四步：更新配置

- [ ] 更新 `apps/subgraph/networks.json` mainnet 地址
- [ ] 更新 `apps/subgraph/subgraph.yaml` mainnet startBlock
- [ ] 部署 Subgraph

### 第五步：后端部署

- [ ] 部署 API 到 Vercel / K8s
- [ ] 配置 Redis
- [ ] 配置 KMS
- [ ] 部署数据同步服务

---

## 部署后检查

### 合约检查
- [ ] 所有合约在 Etherscan 上已验证
- [ ] TimelockController 已配置多签
- [ ] 部署者已 renounce DEFAULT_ADMIN_ROLE
- [ ] 紧急暂停功能测试通过

### 后端检查
- [ ] API 所有 endpoint 响应正常
- [ ] KMS 签名功能正常
- [ ] 数据同步正常运行
- [ ] Redis 限流生效

### 监控检查
- [ ] Forta Agent 正常运行
- [ ] Prometheus 抓取正常
- [ ] Alertmanager 告警正常

---

## 回滚方案

如果发现严重问题：

1. 通过 TimelockController 提交升级提案
2. 等待最小延迟（48小时）
3. 执行升级或暂停合约
4. 紧急情况下使用 EMERGENCY_ROLE 立即暂停

---

## 联系方式

- 项目仓库：https://github.com/FintechGuy71/FidesOrigin
- 域名：https://fidesorigin.com
- 邮箱：contact@fidesorigin.com
