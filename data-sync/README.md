# FidesOrigin 风险数据同步系统

## 概述

整合制裁名单数据接入 + Chainlink Functions 自动化的完整解决方案。

## 模块组成

```
data-sync/
├── sanctions-sync.js           # 制裁名单数据抓取与标准化
├── chainlink-automation.js     # Chainlink Functions 自动化
├── scripts/daily-sync.js       # 每日同步主管道（GitHub Actions 日更，见下方）
└── chainlink/

> 注：旧主控 risk-sync-master.js 已删除（引用了不存在的方法，属废弃编排器）；
> 现役管道为 scripts/daily-sync.js + .github/workflows/daily-sanctions-sync.yml。
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
# 获取数据 + 同步到链上（现役管道）
node scripts/daily-sync.js          # 完整同步（写链）
node scripts/daily-sync.js --dry-run  # 只拉取+建树，不写链
```

> 境外网络需代理时：`HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 node scripts/daily-sync.js --dry-run`

### 4b. 管道行为说明（来源注册表 / 校验 / 增量写入）

管道由 `src/provenance.js` 的 **SOURCE_REGISTRY** 驱动，主流程遍历注册表抓取 → 逐条校验 → 合并 →
增量写链 → 写库。**新增数据源只需在注册表加一项**（id/method/category/authority/expectMin/
sourceTags/mergeIntoChain），无需改主流程。

| 阶段 | 行为 |
|---|---|
| 采集 | 每源独立抓取；单源异常不阻断其余源 |
| 校验 | 逐条校验：地址格式、score 值域、来源标识（受控词表）、`fetchedAt` 时间戳、tier 与 score 一致性、标签可编码性与数量上限。**不合格条目不入库**，计入 `cache/provenance/provenance-<源>.json` 的 `rejected` |
| 一致性比对 | 与上一轮 `accepted` 基线比对：产出低于 `expectMin`、或骤降 ≥50% 时告警（防源故障被误判为大面积下架） |
| 分级 | 链上 tier `30/50/80/95`（`src/riskGrading.js` RISK_TIERS，进 Merkle leaf、被 PolicyEngine 阻断逻辑消费）。展示 level 已于 2026-10-02 **对齐链上**（50/80/95，无 UNKNOWN 共 4 档，链上 UNKNOWN+LOW 并入展示 LOW），单一事实源在 `packages/shared` RISK_THRESHOLDS，后端两引擎与前端均已对齐。对齐后同一 score 两端同档（scam 75 → 链上 MEDIUM / 展示 MEDIUM）。⚠️ 改展示阈值需同步 `packages/shared` + `backend/app/services/risk_engine*.py` + `apps/web` 硬编码 + 本文件 `SHARED_RISK_THRESHOLDS` 四处 |
| 写链 | **增量**：先读链上现状做 diff，只写状态不一致的地址；无变化则零交易（幂等）。批次失败指数退避重试（`CHAIN_RETRY_ATTEMPTS` 默认 3） |
| 写库 | 制裁名单 + 下架清零一批；风险源（scam）**单独一批、不写链** |

标签三端同源：`tagsForEntry()` 是唯一实现，链上 bytes32[] / 本地 JSON / 后端库 jsonb 用同一份
确定性结果（排序 + 去重 + 限量 ≤10）。

### 4c. 关键日志与验证方式

**跑批日志中应关注这几行**（GitHub Actions → Daily Sanctions Sync → Run daily sync）：

```text
🔏 ofac: 124 validated / 124 fetched (rejected 0, dup 0, warn 0)     ← 逐源校验结果
🔏 scamSniffer: 2530 validated / 2530 fetched (rejected 0, dup 0, warn 0)
📊 Total unique: 139                                                  ← 制裁名单合并去重后
🔎 Reading on-chain state for 139 addresses...
📊 Diff: 0 to write, 139 already in sync, 0 read errors               ← 增量：幂等则 0 to write
✅ All addresses already in sync — no chain write needed (idempotent)
✅ Root unchanged, skip                                               ← Merkle 根未变，跳过写链
⛓️ Chain write: 0 written, 139 already in sync                        ← 汇总
🌲 Merkle Root: 0xab5b151ddc70fe9debbdf55bbd65531192dafa7b68c92ac1a428c83d9b128ed0
```

判读要点：

- `rejected` 非 0 → 有数据被校验拦下，查 `cache/provenance/*.json` 的 `rejectedSamples`
- 首次回填 tags 后，`Diff` 应长期为 `0 to write`；若每日都非 0，说明有字段抖动
- 退出码：写链批次重试耗尽 / Merkle 推送失败 / 下架失败 → `exit 1`，workflow 显示 failure

**四端一致性抽查**（制裁地址应为 100/CRITICAL、tags 三源；scam 地址应为 75/**MEDIUM**、tags 含 `scam` 不含 `sanctioned`、链上 `sanctioned=false`）。

> ⚠️ **scam 展示档位已从 HIGH 降为 MEDIUM**（2026-10-02 展示阈值对齐链上：75 落在链上 MEDIUM 档 50-79，故展示同为 MEDIUM）。
> 这是「展示对齐链上、不升合约」决策的直接后果：链上阻断行为**未变**（scam 本就不写链、PolicyEngine 阻断线在 80），仅 UI/后端的展示档位随之调整。
> 后端 API 端点需**重新部署**后返回值才从 `HIGH` 变为 `MEDIUM`（部署前仍是旧值 HIGH）。

下面用的是真实在役地址，可直接复制执行：

```bash
# ① 链上（getRiskProfile；0xbaf1e57f = keccak("getRiskProfile(address)")[:4]）
curl -s -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x953f985f38f94d6159c0600d1f15D543895cE896","data":"0xbaf1e57f000000000000000000000000252a8bd2319d8a555b872990601221b3a2053bce"},"latest"]}' https://ethereum-sepolia-rpc.publicnode.com
# 期望 result 前 64 位含 ...64（=100 分）、次段 ...04（=tier 4 CRITICAL）

# ② 后端端点（制裁地址）
curl -s 'https://fidesorigin-api.vercel.app/v1/public/risk-check?address=0x252a8bd2319d8a555b872990601221b3a2053bce&chainId=11155111'
# 期望 risk_score:100, risk_level:"CRITICAL", tags:["OFAC_SDN_ADVANCED","OPEN_SANCTIONS","sanctioned"]

# ② 后端端点（scam 地址 —— 独立通道，不应被当制裁）
curl -s 'https://fidesorigin-api.vercel.app/v1/public/risk-check?address=0x101ce0cedd142f199c9ef61739ae59b6611a0fc0&chainId=11155111'
# 期望 risk_score:75, risk_level:"MEDIUM", tags:["SCAM_SNIFFER","scam"]（不含 sanctioned）
#   （后端重新部署前旧值为 "HIGH"，部署后为 "MEDIUM"）

# ③ subgraph（必须用 version/latest：固定版本号会随重新部署失效并返回 Not found）
curl -s -X POST -H 'Content-Type: application/json' --data '{"query":"{ riskProfile(id:\"0x252a8bd2319d8a555b872990601221b3a2053bce\"){riskScore tier isSanctioned tags} _meta{block{number} hasIndexingErrors} }"}' https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/version/latest
# 期望 tags 为可读字符串（非 0x… 十六进制），hasIndexingErrors:false

# ④ scam 地址不应写链（sanctioned=false）
curl -s -X POST -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x953f985f38f94d6159c0600d1f15D543895cE896","data":"0xdf592f7d000000000000000000000000101ce0cedd142f199c9ef61739ae59b6611a0fc0"},"latest"]}' https://ethereum-sepolia-rpc.publicnode.com
# 期望 result 全 0（false）
```

**CI 缓存**：`data-sync/cache/` 不入 git，workflow 用 `actions/cache` 滚动持久化
（`sanctions-cache-<run_id>` + `restore-keys: sanctions-cache-`），否则静态快照后备、
跨轮次比对、主源故障后备三项机制在生产会静默失效。注意 `permissions.actions: write`
不可省 —— 缺它时 save 步骤**不报错**只打印一次 warning，缓存静默不落盘。

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
# 现役：GitHub Actions 每日 03:47 UTC 自动执行（.github/workflows/daily-sanctions-sync.yml）
# 无需自建 cron/PM2；手动触发：Actions → Daily Sanctions Sync → Run workflow
# 以下为历史参考（本地 cron 写法，已不推荐）：
# 0 2 * * * cd /path/to/repo && node data-sync/scripts/daily-sync.js >> /var/log/fidesorigin-sync.log 2>&1

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
    script: './data-sync/scripts/daily-sync.js',
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
