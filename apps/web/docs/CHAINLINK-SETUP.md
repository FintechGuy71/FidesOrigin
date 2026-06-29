# Chainlink Functions 配置指南

**状态**: 待配置 ⚠️  
**目标**: 将 RiskOracle 接入链下风险数据源（Chainalysis / OFAC / TRM Labs）

---

## 概述

RiskOracle 合约已经部署到 Sepolia，但尚未配置 Chainlink Functions Router。配置完成后，RiskOracle 可以：

1. 调用链下 API（Chainalysis / OFAC / 自定义数据源）
2. 获取实时风险评分
3. 将结果写入链上 RiskRegistry

---

## 配置步骤

### Step 1: Chainlink Functions 账户准备

1. 访问 https://functions.chain.link/
2. 连接 MetaMask（Sepolia 网络）
3. 获取 Subscription ID（用于支付 Functions 调用费用）
4. 记录以下信息：
   - **Subscription ID**: `YOUR_SUBSCRIPTION_ID`
   - **Router 地址** (Sepolia): `0xb83E47C2bC239A929056E82F1b6FD5e702C1960D`
   - **Don ID**: `fun-ethereum-sepolia-1`

### Step 2: 配置 .env

```bash
# .env 中添加
CHAINLINK_ROUTER=0xb83E47C2bC239A929056E82F1b6FD5e702C1960D
CHAINLINK_DON_ID=fun-ethereum-sepolia-1
CHAINLINK_SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID
CHAINLINK_ENCRYPTED_SECRETS_URL=  # 如需 API Key 加密存储
```

### Step 3: 准备 Functions Source Code

创建 `scripts/chainlink/source.js`:

```javascript
// Chainlink Functions Source Code
// 查询 Chainalysis API 获取地址风险评分

const CHAINALYSIS_API_URL = "https://api.chainalysis.com/api/v1/kyt/";
const API_KEY = secrets.apiKey;  // 通过加密 secrets 传入

async function main(address) {
  // 1. 调用 Chainalysis API
  const response = await fetch(`${CHAINALYSIS_API_URL}users/${address}/transfers/received`, {
    headers: { "Authorization": API_KEY }
  });
  
  const data = await response.json();
  
  // 2. 计算风险评分
  let riskScore = 0;
  let isSanctioned = false;
  
  if (data.transfers) {
    for (const transfer of data.transfers) {
      if (transfer.sanctions) {
        isSanctioned = true;
        riskScore = 100;
        break;
      }
      riskScore = Math.max(riskScore, transfer.riskScore || 0);
    }
  }
  
  // 3. 返回 ABI-encoded 结果
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bool", "uint256"],
    [riskScore, isSanctioned, Math.floor(Date.now() / 1000)]
  );
}

// 执行
main(args[0]);  // args[0] = 要查询的地址
```

### Step 4: 部署并配置 RiskOracle

```javascript
// scripts/configure-risk-oracle.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const RiskOracle = await ethers.getContractFactory("RiskOracle");
  const riskOracle = await RiskOracle.attach("0x...RiskOracle地址");
  
  // 1. 设置 Chainlink Router
  await riskOracle.setRouter(process.env.CHAINLINK_ROUTER);
  
  // 2. 设置 Don ID
  await riskOracle.setDonId(process.env.CHAINLINK_DON_ID);
  
  // 3. 设置 Subscription ID
  await riskOracle.setSubscriptionId(process.env.CHAINLINK_SUBSCRIPTION_ID);
  
  // 4. 注册数据源
  await riskOracle.addDataSource(
    ethers.keccak256(ethers.toUtf8Bytes("chainalysis")),
    "Chainalysis KYT",
    true
  );
  
  // 5. 设置回调目标（RiskRegistry）
  await riskOracle.setCallbackTarget("0x...RiskRegistry地址");
  
  console.log("RiskOracle configured successfully");
}

main().catch(console.error);
```

### Step 5: 测试 Functions 调用

```bash
npx hardhat run scripts/configure-risk-oracle.js --network sepolia
```

预期输出：
- 提交 Chainlink Functions 请求
- 等待 DON 节点执行（约 1-3 分钟）
- 链上回调更新 RiskRegistry

---

## 数据源配置

| 数据源 | API | 用途 | 成本 |
|--------|-----|------|------|
| **Chainalysis KYT** | REST API | 制裁筛查、风险评分 | 企业订阅 |
| **OFAC SDN** | XML/CSV | 制裁名单 | 免费 |
| **TRM Labs** | REST API | 交易监控 | 企业订阅 |
| **Etherscan** | REST API | 地址标签 | 免费 tier |
| **自定义** | 任意 | 内部黑名单 | 自定义 |

---

## 成本估算（Sepolia）

| 操作 | Gas Cost | Sepolia ETH 成本 |
|------|----------|-----------------|
| Functions 请求提交 | ~150K gas | ~0.00015 ETH |
| DON 执行费用 | 0.0001 ETH | 固定 |
| 链上回调写入 | ~80K gas | ~0.00008 ETH |
| **总计/次** | | **~0.00025 ETH** |

主网成本约为 Sepolia 的 10-20 倍，需预留 LINK 或 ETH 作为 Functions 费用。

---

## 安全考虑

1. **API Key 加密**: 使用 Chainlink Secrets 加密存储，不在链上暴露
2. **请求冷却期**: 已内建 5 分钟冷却期，防止滥用
3. **日请求上限**: 已设置每日 1000 次上限
4. **失败回退**: Functions 失败时不会阻塞主合约

---

## 下一步

- [ ] 注册 Chainlink Functions Subscription
- [ ] 获取 Sepolia LINK（从 faucet.chain.link）
- [ ] 执行配置脚本
- [ ] 测试端到端调用

**需要帮助？** https://docs.chain.link/chainlink-functions
