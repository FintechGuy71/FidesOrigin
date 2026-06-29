# FidesOrigin 风险数据同步系统

## 概述

整合制裁名单数据接入 + Chainlink Functions 自动化的完整解决方案。

## 模块组成

```
data-sync/
├── sanctions-sync.js           # 制裁名单数据抓取与标准化
├── chainlink-automation.js     # Chainlink Functions 自动化
├── risk-sync-master.js         # 主控模块
└── chainlink/
    └── risk-functions-source.js # Chainlink Functions 源代码
```

## 功能特性

### 1. 制裁名单数据接入

支持数据源：
- **OFAC (美国财政部)** - SDN List + 加密货币地址清单
- **UN (联合国)** - Consolidated Sanctions List
- **HMT (英国财政部)** - UK Sanctions List
- **EU (欧盟)** - Financial Sanctions

数据标准化输出：
```javascript
{
  uid: "OFAC-12345",
  source: "OFAC",
  entityName: "...",
  entityType: "INDIVIDUAL|ENTITY",
  cryptoAddresses: {
    ethereum: ["0x..."],
    bitcoin: ["..."],
    tron: ["..."]
  },
  riskLevel: "CRITICAL",
  listType: "SDN"
}
```

### 2. Chainlink Functions 自动化

支持请求类型：
- **制裁名单同步** - 验证链上制裁名单完整性
- **风险评分** - 基于链上行为的动态评分
- **批量更新** - 高效的多地址更新

## 快速开始

### 1. 安装依赖

```bash
cd data-sync
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的配置
```

`.env` 示例：
```bash
# 区块链连接
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=0x...

# 合约地址
RISK_ORACLE_ADDRESS=0x...

# Chainlink
CHAINLINK_SUBSCRIPTION_ID=123
CHAINLINK_DON_ID=fun-ethereum-sepolia-1

# API Keys (可选)
ETHERSCAN_API_KEY=...
CHAINALYSIS_API_KEY=...
```

### 3. 测试数据抓取

```bash
# 仅获取制裁名单数据（不发送到链上）
node sanctions-sync.js
```

### 4. 执行完整同步

```bash
# 获取数据 + 同步到链上
node risk-sync-master.js --full
```

### 5. 触发 Chainlink Functions

```bash
# 保存 Functions 源代码到文件
node chainlink-automation.js --save-source

# 请求制裁名单验证
node chainlink-automation.js --sanctions

# 请求风险评分
node chainlink-automation.js --scoring 0xAddress1 0xAddress2 ...

# 检查请求状态
node chainlink-automation.js --check [requestId]
```

## 定时任务配置

### 使用 cron

```bash
# 每天凌晨2点执行完整同步
0 2 * * * cd /path/to/fidesorigin-demo && node data-sync/risk-sync-master.js --full >> /var/log/fidesorigin-sync.log 2>&1

# 每4小时检查一次待处理的 Chainlink 请求
0 */4 * * * cd /path/to/fidesorigin-demo && node data-sync/chainlink-automation.js --check >> /var/log/fidesorigin-check.log 2>&1
```

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 创建配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'fidesorigin-sync',
    script: './data-sync/risk-sync-master.js',
    args: '--full',
    cron_restart: '0 2 * * *',
    autorestart: false,
    log_file: './logs/sync.log',
    error_file: './logs/sync-error.log',
    out_file: './logs/sync-out.log'
  }]
}
EOF

# 启动
pm2 start ecosystem.config.js
```

## 架构说明

### 数据流

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   OFAC/UN/HMT   │     │   Chainlink     │     │   FidesOrigin   │
│   Data Sources  │────>│   Functions     │────>│   Smart Contract│
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   sanctions-sync.js    chainlink-automation.js   RiskOracle.sol
```

### 关键流程

1. **每日同步**
   ```
   sanctions-sync.js → 获取最新制裁名单
        ↓
   提取以太坊地址
        ↓
   chainlink-automation.js → 同步到链上
        ↓
   触发 Chainlink Functions 验证
   ```

2. **风险评分**
   ```
   用户地址列表
        ↓
   Chainlink Functions → 链下分析
        ↓
   RiskOracle → 更新 RiskRegistry
   ```

## API 参考

### SanctionsDataManager

```javascript
const { SanctionsDataManager } = require('./sanctions-sync');

const manager = new SanctionsDataManager();
await manager.init();

// 获取所有数据
const result = await manager.fetchAll();

// 获取以太坊制裁地址
const ethList = await manager.getEthereumSanctionsList();
```

### ChainlinkFunctionsAutomation

```javascript
const { ChainlinkFunctionsAutomation } = require('./chainlink-automation');

const automation = new ChainlinkFunctionsAutomation(config);

// 请求制裁名单更新
await automation.requestSanctionsUpdate();

// 批量更新风险评分
await automation.requestBatchRiskUpdate(addresses);

// 直接更新（不通过 Chainlink）
await automation.directRiskUpdate(address, score, tier, tags, isSanctioned);

// 检查请求状态
await automation.checkRequestStatus(requestId);
```

## 监控与日志

### 日志位置

```
cache/
├── sanctions-cache.json       # 制裁名单缓存
├── chainlink-requests.json    # 请求历史
└── reports/
    └── sync-report-YYYY-MM-DD.json  # 每日同步报告
```

### 关键指标

- **制裁名单覆盖率** - 每日新增/变更的制裁地址数
- **链上同步成功率** - 批量更新的成功率
- **Chainlink Functions 响应时间** - 请求到完成的平均时间

## 故障排查

### 常见问题

**Q: 制裁名单获取失败**
```bash
# 检查网络连接
curl -I https://www.treasury.gov/ofac/downloads/sdn.csv

# 使用备用数据源
# 代码会自动切换到 GitHub 镜像
```

**Q: 链上同步失败**
```bash
# 检查 RPC 连接
node -e "require('ethers').getDefaultProvider('sepolia').getBlockNumber().then(console.log)"

# 检查合约地址是否正确
echo $RISK_ORACLE_ADDRESS
```

**Q: Chainlink Functions 请求超时**
```bash
# 检查 subscription 余额
# https://functions.chain.link/

# 检查 gas 限制设置
```

## 安全注意事项

1. **私钥保护** - 永远不要将私钥提交到 git
2. **API Key 轮换** - 定期更换 Etherscan/Chainalysis API Key
3. **访问控制** - 确保 ORACLE_ROLE 只授予可信地址
4. **Rate Limiting** - 遵守数据源和 RPC 的速率限制

## 许可证

MIT - 参见主项目 LICENSE
