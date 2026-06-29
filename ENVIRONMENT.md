# FidesOrigin 环境变量说明

> **版本**: v0.2.1  
> **最后更新**: 2026-06-15  
> **分类**: 开发配置 / 生产配置

---

## 目录

1. [快速参考](#快速参考)
2. [按模块分类](#按模块分类)
3. [安全等级](#安全等级)
4. [CI/CD 专用变量](#cicd-专用变量)
5. [本地开发配置](#本地开发配置)
6. [生产环境配置](#生产环境配置)
7. [多链配置](#多链配置)
8. [变量验证](#变量验证)

---

## 快速参考

### 最小必需变量（本地开发）

```bash
PRIVATE_KEY=0x...                    # 部署私钥
ETHEREUM_SEPOLIA_RPC=https://...      # Sepolia RPC
ETHERSCAN_API_KEY=...                 # Etherscan API Key
DATABASE_URL=postgresql://...       # 数据库连接
```

### 最小必需变量（生产环境）

```bash
# 所有开发变量 +
VERCEL_TOKEN=...                      # Vercel 部署
VERCEL_ORG_ID=...                     # Vercel 组织
VERCEL_PROJECT_ID=...                 # Vercel 项目
THEGRAPH_DEPLOY_KEY=...               # The Graph 部署
SLACK_WEBHOOK_URL=...                 # 通知（可选）
```

---

## 按模块分类

### 1. 区块链连接

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `ETHEREUM_MAINNET_RPC` | Ethereum 主网 RPC | - | `https://eth.llamarpc.com` |
| `ETHEREUM_SEPOLIA_RPC` | Sepolia 测试网 RPC | - | `https://rpc.sepolia.org` |
| `POLYGON_MAINNET_RPC` | Polygon 主网 RPC | - | `https://polygon-rpc.com` |
| `AMOY_RPC` | Polygon Amoy 测试网 | - | `https://rpc-amoy.polygon.technology` |
| `ARBITRUM_RPC` | Arbitrum One RPC | - | `https://arb1.arbitrum.io/rpc` |
| `OPTIMISM_RPC` | Optimism RPC | - | `https://mainnet.optimism.io` |
| `BASE_RPC` | Base RPC | - | `https://mainnet.base.org` |
| `BNB_MAINNET_RPC` | BNB Chain RPC | - | `https://bsc-dataseed.binance.org` |
| `BNB_TESTNET_RPC` | BNB 测试网 RPC | - | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| `HOLESKY_RPC` | Holesky 测试网 RPC | - | `https://ethereum-holesky.publicnode.com` |
| `TEMPO_MAINNET_RPC` | Tempo 主网 RPC | - | `https://rpc.tempo.xyz` |
| `TEMPO_TESTNET_RPC` | Tempo 测试网 RPC | - | `https://rpc.moderato.tempo.xyz` |

### 2. 区块浏览器 API Keys

| 变量 | 说明 | 获取地址 |
|------|------|----------|
| `ETHERSCAN_API_KEY` | Etherscan / Sepolia | [etherscan.io](https://etherscan.io/apis) |
| `POLYGONSCAN_API_KEY` | PolygonScan | [polygonscan.com](https://polygonscan.com/apis) |
| `BSCSCAN_API_KEY` | BscScan | [bscscan.com](https://bscscan.com/apis) |
| `ARBITRUM_API_KEY` | Arbiscan | [arbiscan.io](https://arbiscan.io/apis) |
| `OPTIMISM_API_KEY` | Optimistic Etherscan | [optimistic.etherscan.io](https://optimistic.etherscan.io/apis) |
| `BASESCAN_API_KEY` | BaseScan | [basescan.org](https://basescan.org/apis) |

**注意**: 免费 API Key 通常有速率限制（5 calls/sec），生产环境建议使用付费计划。

### 3. 部署配置

| 变量 | 说明 | 安全等级 |
|------|------|----------|
| `PRIVATE_KEY` | 部署钱包私钥 | 🔴 **极高** |
| `REPORT_GAS` | 是否生成 Gas 报告 | 🟢 低 |
| `COINMARKETCAP_API_KEY` | Gas 报告价格换算 | 🟡 中 |
| `ENABLE_FORKING` | 启用 Fork 测试 | 🟢 低 |

### 4. 前端配置（NEXT_PUBLIC_*）

> ⚠️ **注意**: 以 `NEXT_PUBLIC_` 开头的变量会暴露到浏览器端，**不要包含敏感信息**。

| 变量 | 说明 | 示例 |
|------|------|------|
| `NEXT_PUBLIC_API_BASE_URL` | API 基础路径 | `/api` |
| `NEXT_PUBLIC_SUBGRAPH_URL` | The Graph 查询 URL | `https://api.studio.thegraph.com/query/...` |
| `NEXT_PUBLIC_CHAIN_ID` | 目标链 ID | `11155111` (Sepolia) |
| `NEXT_PUBLIC_RPC_URL` | 公开 RPC URL | `https://rpc.sepolia.org` |
| `NEXT_PUBLIC_APP_VERSION` | 应用版本 | `0.2.1` |
| `NEXT_PUBLIC_BUILD_TIME` | 构建时间 | `2024-01-01T00:00:00Z` |
| `NEXT_PUBLIC_API_KEY` | 前端 API Key | - |

### 5. 后端配置

| 变量 | 说明 | 安全等级 |
|------|------|----------|
| `DATABASE_URL` | Prisma 数据库连接 | 🔴 **极高** |
| `RISK_SYNC_API_KEY` | 风险同步 API 认证 | 🔴 **极高** |
| `CHAINLINK_FUNCTIONS_ROUTER` | Chainlink Functions 路由地址 | 🟡 中 |
| `CHAINLINK_DON_ID` | Chainlink DON ID | 🟡 中 |

### 6. 外部数据源

| 变量 | 说明 | 获取地址 |
|------|------|----------|
| `CHAINALYSIS_API_KEY` | Chainalysis 风险数据 | [chainalysis.com](https://www.chainalysis.com/) |
| `OFAC_SDN_URL` | OFAC 制裁名单 URL | `https://www.treasury.gov/ofac/downloads/sdn.xml` |

### 7. CI/CD 配置

| 变量 | 说明 | 使用场景 |
|------|------|----------|
| `VERCEL_TOKEN` | Vercel 访问令牌 | 前端自动部署 |
| `VERCEL_ORG_ID` | Vercel 组织 ID | 前端自动部署 |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID | 前端自动部署 |
| `THEGRAPH_DEPLOY_KEY` | The Graph Studio 部署密钥 | 子图自动部署 |
| `SLACK_WEBHOOK_URL` | Slack 通知 Webhook | 部署状态通知 |

---

## 安全等级

| 等级 | 图标 | 说明 | 存储建议 |
|------|------|------|----------|
| **极高** | 🔴 | 私钥、数据库密码 | AWS KMS / Azure Key Vault / GitHub Secrets |
| **高** | 🟠 | API Keys、访问令牌 | GitHub Secrets / 环境变量（不提交） |
| **中** | 🟡 | 服务地址、配置 | 环境变量 |
| **低** | 🟢 | 公开配置、开关 | 代码 / 环境变量 |

---

## CI/CD 专用变量

### GitHub Secrets 配置

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中配置：

```
Repository secrets:
  ├── PRIVATE_KEY              (加密)
  ├── ETHERSCAN_API_KEY
  ├── POLYGONSCAN_API_KEY
  ├── BSCSCAN_API_KEY
  ├── ARBITRUM_API_KEY
  ├── OPTIMISM_API_KEY
  ├── BASESCAN_API_KEY
  ├── VERCEL_TOKEN
  ├── VERCEL_ORG_ID
  ├── VERCEL_PROJECT_ID
  ├── THEGRAPH_DEPLOY_KEY
  ├── NEXT_PUBLIC_SUBGRAPH_URL
  ├── SLACK_WEBHOOK_URL        (可选)
  └── DATABASE_URL             (可选)
```

### Vercel 环境变量

在 Vercel Dashboard **Project Settings → Environment Variables** 中配置：

```
Production:
  ├── NEXT_PUBLIC_SUBGRAPH_URL
  ├── NEXT_PUBLIC_CHAIN_ID
  ├── NEXT_PUBLIC_RPC_URL
  └── NEXT_PUBLIC_API_BASE_URL

Preview:
  ├── NEXT_PUBLIC_SUBGRAPH_URL   (测试网)
  ├── NEXT_PUBLIC_CHAIN_ID         (11155111)
  └── NEXT_PUBLIC_RPC_URL        (Sepolia)
```

---

## 本地开发配置

### 最小配置

```bash
# .env.local (不提交到 Git)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ETHEREUM_SEPOLIA_RPC=https://rpc.sepolia.org
ETHERSCAN_API_KEY=your_key_here
DATABASE_URL=postgresql://localhost:5432/fidesorigin
```

### 完整配置

```bash
# 复制示例文件
cp .env.example .env.local

# 编辑填入所有值
# 使用测试网优先，不要直接使用主网配置
```

---

## 生产环境配置

### 安全要求

1. **私钥管理**
   - 使用硬件钱包（Ledger/Trezor）
   - 或使用 AWS KMS / Azure Key Vault
   - 绝对不要存储在 `.env` 文件中

2. **API Key 轮换**
   - 每 90 天轮换一次
   - 使用最小权限原则
   - 监控 API 调用量

3. **数据库安全**
   - 使用 IAM 数据库认证
   - 启用 SSL/TLS 连接
   - 限制 IP 白名单

4. **RPC 节点**
   - 使用专用节点（Infura/Alchemy/QuickNode）
   - 不要依赖公共 RPC
   - 配置备用节点

### 生产环境变量模板

```bash
# .env.production (仅用于生产部署)
# 此文件不应提交到 Git

# === 区块链 ===
ETHEREUM_MAINNET_RPC=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
POLYGON_MAINNET_RPC=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
ARBITRUM_RPC=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# === 安全 ===
# 私钥通过 CI/CD 注入，不存储在文件中
# PRIVATE_KEY=${{ secrets.PRIVATE_KEY }}

# === 前端 ===
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/.../fidesorigin-mainnet/...
```

---

## 多链配置

### 支持的链

| 链 | Chain ID | 主网 | 测试网 |
|----|----------|------|--------|
| Ethereum | 1 | ✅ | Sepolia (11155111) |
| Polygon | 137 | ✅ | Amoy (80002) |
| Arbitrum | 42161 | ✅ | Sepolia (421614) |
| Optimism | 10 | ✅ | Sepolia (11155420) |
| Base | 8453 | ✅ | Sepolia (84532) |
| BNB Chain | 56 | ✅ | Testnet (97) |
| Tempo | - | ✅ | Moderato |

### 多链部署变量

```bash
# 每个链需要独立的 RPC 和 API Key
# 合约地址按链分别存储

# Ethereum
ETHEREUM_MAINNET_RPC=...
ETHERSCAN_API_KEY=...

# Polygon
POLYGON_MAINNET_RPC=...
POLYGONSCAN_API_KEY=...

# 合约地址
MAINNET_RISKREGISTRY_ADDRESS=0x...
POLYGON_RISKREGISTRY_ADDRESS=0x...
ARBITRUM_RISKREGISTRY_ADDRESS=0x...
```

---

## 变量验证

### 自动验证脚本

```bash
# 验证所有必需变量是否设置
npx tsx scripts/validate-env.ts

# 验证特定环境
npx tsx scripts/validate-env.ts --env production
```

### 手动验证清单

部署前检查：

- [ ] `PRIVATE_KEY` 已设置且不是占位符
- [ ] 目标网络的 `RPC` 已设置且可访问
- [ ] 对应的 `API_KEY` 已设置且有效
- [ ] `DATABASE_URL` 格式正确且可连接
- [ ] `NEXT_PUBLIC_*` 变量不包含敏感信息
- [ ] `.env` 文件在 `.gitignore` 中
- [ ] GitHub Secrets 已配置

---

## 相关文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构
- [README.md](./README.md) - 项目总览
