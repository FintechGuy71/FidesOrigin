# FidesOrigin Safe Owner 配置模板

> **状态**: 待确认  
> **截止**: 主网部署前 7 天 (T-7d)  
> **目标**: 5 个 owner 地址确认，3/5 多签阈值

---

## 架构

```
┌──────────────┐      ┌──────────────┐
│  Safe 3/5    │──────│  Timelock    │
│  多签钱包     │      │  48小时延迟   │
└──────────────┘      └──────────────┘
```

## Owner 角色分配

| # | 角色 | 职责 | 地址 | 确认 |
|---|------|------|------|------|
| 1 | **技术负责人** | 合约升级审核、技术决策 | `0x________________` | ⬜ |
| 2 | **安全负责人** | 安全响应、紧急操作 | `0x________________` | ⬜ |
| 3 | **运营负责人** | 日常运营、角色管理 | `0x________________` | ⬜ |
| 4 | **法务/合规** | 合规策略审核 | `0x________________` | ⬜ |
| 5 | **备份/冷钱包** | 离线备份、灾难恢复 | `0x________________` | ⬜ |

**阈值**: 3/5（需要 3 个签名才能执行交易）

---

## 部署要求

1. 每个 owner 地址必须持有少量 Sepolia ETH（测试网演练）和 Mainnet ETH（生产）
2. 至少 2 个地址为冷钱包/硬件钱包
3. 禁止全部 5 个地址由同一人控制
4. 紧急操作员地址需单独确认（可设为 Safe 自身地址或指定安全团队地址）

---

## 配置命令（确认地址后执行）

```bash
cd apps/contracts

# 设置环境变量
export ADMIN_PRIVATE_KEY="0x..."          # deployer 私钥
export SAFE_OWNERS="0xOwner1,0xOwner2,0xOwner3,0xOwner4,0xOwner5"

# 1. 部署 Safe
npx hardhat run scripts/deploy-gnosis-safe.js --network sepolia

# 2. Dry Run 验证转移
export SAFE_ADDRESS="0xSafeAddress..."
DRY_RUN=true npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia

# 3. 执行转移
DRY_RUN=false npx hardhat run scripts/transfer-ownership-to-safe.js --network sepolia

# 4. 验证
TEST_MODE=single npx hardhat run scripts/test-safe-operations.js --network sepolia
```

---

## 主网部署时

将 `--network sepolia` 替换为 `--network mainnet`，并确保：
- 5 个 owner 地址均为 Mainnet 地址
- 每个地址持有足够 ETH 支付 Gas
- Safe 部署后记录地址到 `deployments/gnosis-safe-mainnet-latest.json`
