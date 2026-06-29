# FidesOrigin Subgraph Sepolia 部署备忘

## 状态
- **方案**: 方案A（Sepolia 验证 → 主网上线）
- **当前阶段**: 等合约部署到 Sepolia
- **Subgraph 本地状态**: ✅ codegen + build 通过

---

## 前置条件（你做完后告诉我）

### 1. 合约部署到 Sepolia

```bash
cd /root/.openclaw/workspace/fidesorigin-demo

# 配置 Sepolia RPC
export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
export PRIVATE_KEY=your_deployer_private_key

# 执行完整部署
npx hardhat run scripts/deploy-full.js --network sepolia
```

**部署后你会得到**：
```
RiskRegistry:     0x...
PolicyEngine:     0x...
ComplianceEngine: 0x...
RiskOracle:       0x...
CompliantStableCoin: 0x...
```

### 2. 记录部署地址

把地址发给我，或者记录到 `deployments/sepolia-latest.json`

---

## 我收到地址后会执行

### Step 1: 更新 subgraph.yaml

替换 6 处地址 + 3 处网络：
```yaml
network: sepolia
source:
  address: "0xYOUR_SEPOLIA_RISK_REGISTRY_ADDRESS"
  startBlock: 12345678   # 部署时的 block number
```

### Step 2: 重新编译

```bash
cd subgraph
npx graph codegen
npx graph build
```

### Step 3: 部署到 The Graph Studio

需要你提供：
- **The Graph Studio 账号** → https://thegraph.com/studio/ （用钱包登录）
- **Subgraph Name** → 建议 `fidesorigin-sepolia`
- **Deploy Key** → 在 Studio 里创建 Subgraph 后生成

```bash
npx graph auth --studio <DEPLOY_KEY>
npx graph deploy --studio fidesorigin-sepolia
```

### Step 4: 验证

部署后 5-10 分钟，The Graph 开始索引。验证：

```graphql
# Playground 查询示例
query {
  protocolStats(id: "stats") {
    totalComplianceChecks
    totalBlocked
    totalSanctioned
  }
}
```

### Step 5: 主网重复

Sepolia 验证通过后，一模一样的流程上 Mainnet / Base：
1. 合约部署到目标网络
2. 更新 subgraph.yaml（网络 + 地址 + startBlock）
3. `npx graph deploy --studio fidesorigin`

---

## 你现在需要做的

| # | 动作 | 说明 |
|---|------|------|
| 1 | 注册 The Graph Studio | https://thegraph.com/studio/，用 MetaMask 登录 |
| 2 | 创建 Subgraph | 点击 "Create a Subgraph"，名称 `fidesorigin-sepolia` |
| 3 | 获取 Deploy Key | Studio 页面会显示 deploy command，复制 `<KEY>` 部分 |
| 4 | 部署合约到 Sepolia | 执行上面的 deploy-full.js |
| 5 | 把地址 + Deploy Key 发给我 | 我来完成后续所有步骤 |

---

## 预计时间

| 步骤 | 时间 |
|------|------|
| 合约部署 Sepolia | 5-10 分钟（gas 费 ~0.01 ETH） |
| Subgraph 更新 + 编译 | 2 分钟 |
| Studio 部署 | 1 分钟 |
| 索引同步（初始） | 5-10 分钟 |
| **总计** | **~20 分钟** |

---

## 费用

| 项目 | 成本 |
|------|------|
| Sepolia 部署 gas | 免费（Sepolia ETH 从 faucet 领） |
| The Graph Studio | 免费（测试阶段） |
| 主网部署后查询 | 按量付费，用 GRT 代币 |

---

## 部署后查询地址

```
https://api.studio.thegraph.com/query/<studio_id>/fidesorigin-sepolia/v0.0.1
```

部署完成后我会把具体 URL 给你。

---

**等你消息。地址 + Deploy Key 一发，20 分钟内搞定。**
