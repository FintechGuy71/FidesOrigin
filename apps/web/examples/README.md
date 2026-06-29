# FidesOrigin 智能合约交互示例

本目录包含 FidesOrigin 智能合约的交互示例代码，支持 Sepolia 和 Mumbai 测试网。

## 环境准备

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填入你的配置：

```bash
cp ../.env.example .env
```

编辑 `.env` 文件，填入以下必需变量：

```bash
# 私钥（必需）
PRIVATE_KEY=0x...

# Sepolia RPC
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Mumbai RPC
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY

# API Keys（用于合约验证）
ETHERSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
```

## Python 示例

### Sepolia 测试网

```bash
python interact_sepolia.py
```

### Mumbai 测试网

```bash
python interact_mumbai.py
```

## JavaScript 示例

### 安装依赖

```bash
npm install ethers dotenv
```

### Sepolia 测试网

```bash
node interact_sepolia.js
```

### Mumbai 测试网

```bash
node interact_mumbai.js
```

## 功能说明

### TestUSD 代币操作

- `getTUSDBalance(address)` - 查询 TUSD 余额
- `transferTUSD(to, amount)` - 转账 TUSD
- `approveTUSD(spender, amount)` - 授权额度
- `getAllowance(owner, spender)` - 查询授权额度
- `faucet()` - 获取测试代币（1000 TUSD）
- `getLimitInfo(address)` - 查询用户限额信息

### FidesCompliance 合规操作

- `getComplianceStats()` - 获取合约统计信息
- `getRiskProfile(address)` - 查询风险画像
- `isBlacklisted(address)` - 检查是否在黑名单
- `isWhitelisted(address)` - 检查是否在白名单
- `evaluateTransaction(from, to, amount)` - 评估交易合规性
- `getCurrentChainConfig()` - 获取当前链配置

### 管理功能（需要 OPERATOR_ROLE）

- `updateRiskProfile(address, level, score, tags, reasonHash)` - 更新风险画像
- `tagAddress(address, level, reason)` - 给地址打标签（TestUSD）
- `untagAddress(address)` - 移除地址标签（TestUSD）

## 风险等级说明

### FidesCompliance RiskLevel

- `0`: UNKNOWN - 未分类
- `1`: WHITELIST - 白名单（低风险）
- `2`: LOW - 低风险
- `3`: MEDIUM - 中风险
- `4`: HIGH - 高风险
- `5`: BLACKLIST - 黑名单（禁止）

### TestUSD RiskLevel

- `0`: UNKNOWN - 未分类
- `1`: VIP - VIP用户（更高限额）
- `2`: NORMAL - 普通用户
- `3`: GREY - 灰名单（限制交易）
- `4`: BLACK - 黑名单（禁止交易）

## 获取测试币

### Sepolia ETH

- [Sepolia Faucet](https://sepoliafaucet.com)
- [Alchemy Faucet](https://sepoliafaucet.com)

### Mumbai MATIC

- [Polygon Faucet](https://faucet.polygon.technology/)

## 浏览器链接

- Sepolia: https://sepolia.etherscan.io
- Mumbai: https://mumbai.polygonscan.com
