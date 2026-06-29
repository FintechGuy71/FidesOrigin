# FidesOrigin Data Publisher

完全自建的链上数据推送服务，**零依赖 Chainlink Functions**，形成完全闭环的数据 → 处理 → 上链能力。

## 架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FidesOrigin Data Publisher                            │
│                                                                              │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐ │
│   │  Data       │   │  Data       │   │  Blockchain │   │   Monitor       │ │
│   │  Collector  │──▶│  Processor  │──▶│  Publisher  │──▶│   & Alerts      │ │
│   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────────┘ │
│         │                  │                 │                                │
│   OFAC SDN List      Deduplicate        Sign & Send                    /metrics
│   Chainalysis API    Score Merge        RiskRegistry                   /health
│   OpenSanctions      Tier Assignment    (on-chain)                          │
│   Etherscan Labels   Tag Normalization                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 核心能力

| 能力 | 实现方式 |
|------|----------|
| **数据拉取** | 多源并行：OFAC、Chainalysis、OpenSanctions、Etherscan |
| **数据处理** | 去重、加权评分、多源合并、标签标准化 |
| **链上推送** | Ethers.js 直连，调用 `RiskRegistry.updateRiskProfile()` |
| **密钥管理** | 支持明文私钥、AWS KMS、Azure Key Vault |
| **定时调度** | Cron 表达式，支持全量同步 + 增量同步 |
| **监控告警** | Prometheus 指标、健康检查、Webhook 告警 |
| **故障恢复** | 指数退避重试、gas 限制、熔断保护 |

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 RPC_URL、私钥、合约地址等
```

### 2. 安装依赖

```bash
npm install
```

### 3. 编译

```bash
npm run build
```

### 4. 运行

```bash
npm start
```

或开发模式：

```bash
npm run dev
```

### 5. Docker 部署

```bash
# 构建镜像
docker build -t fidesorigin/data-publisher .

# 运行
docker run -d --env-file .env -p 9090:9090 fidesorigin/data-publisher

# 或 Docker Compose
docker compose up -d

# 带监控
docker compose --profile monitoring up -d
```

## 权限配置

推送服务需要 `ORACLE_ROLE` 才能调用 `RiskRegistry.updateRiskProfile()`。

**部署后执行（仅一次）：**

```solidity
// 在 RiskRegistry 合约上执行
grantRole(ORACLE_ROLE, <PUBLISHER_ADDRESS>);
```

## 数据来源配置

| 源 | 默认 | 说明 |
|---|---|---|
| OFAC SDN | ✅ | 美国财政部制裁名单 |
| Chainalysis | ❌ | 需 API Key |
| OpenSanctions | ✅ | 全球制裁数据库 |
| Etherscan Labels | ❌ | 需 API Key |

## 监控端点

| 端点 | 说明 |
|---|---|
| `GET /health` | 健康检查 |
| `GET /metrics` | Prometheus 指标 |
| `GET /status` | 服务状态 |

## 与 Chainlink Functions 对比

| 维度 | Chainlink Functions | 自建 Publisher |
|---|---|---|
| 去中心化 | ✅ DON 共识 | ❌ 单点部署（可集群） |
| 可控性 | 受限于 CL 功能 | 完全自主 |
| 成本 | LINK + gas | 仅 gas |
| 延迟 | ~2-5 min | ~15-30s |
| 数据源 | 自定义 JS | 任意 Node.js 库 |
| 维护 | Chainlink 团队 | 自建运维 |

**取舍：** 牺牲去中心化换取完全可控、更低成本、更快响应。适合对产品节奏要求高的场景。
