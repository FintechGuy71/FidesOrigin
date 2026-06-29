# FidesOrigin 开发者集成指南

**版本**: v0.5.0  
**最后更新**: 2026-05-09  
**目标读者**: 智能合约开发者、DApp 开发者、稳定币/RWA 项目方

---

## 快速开始（5 分钟接入）

### 1. 环境准备

```bash
# 克隆仓库
git clone https://github.com/FintechGuy71/FidesOrigin.git
cd FidesOrigin

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 Sepolia 私钥（测试用）
```

### 2. 编译合约

```bash
npx hardhat compile
```

### 3. 运行测试

```bash
npx hardhat test
# 预期输出: 139 tests passing
```

---

## 集成方式

### 方式 A：资产发行方（稳定币 / RWA Token）

你的 ERC20 合约继承自动合规检查：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IAssetCompliance.sol";

contract MyStableCoin is ERC20 {
    IAssetCompliance public compliance;
    
    constructor(
        string memory name,
        string memory symbol,
        address _compliance
    ) ERC20(name, symbol) {
        compliance = IAssetCompliance(_compliance);
    }
    
    function _update(address from, address to, uint256 amount) internal override {
        // 自动合规检查：每一笔转账自动评估
        if (from != address(0) && to != address(0)) {
            compliance.preTransferHook(from, to, amount);
        }
        super._update(from, to, amount);
    }
}
```

### 方式 B：钱包运营方（托管 / MPC）

在交易执行前插入合规检查：

```solidity
import "./interfaces/IWalletCompliance.sol";

function executeTransfer(address to, uint256 amount) external {
    IWalletCompliance.Operation memory op = IWalletCompliance.Operation({
        target: to,
        value: amount,
        data: "",
        operationType: 0 // transfer
    });
    
    // 1. 预执行合规检查
    complianceEngine.preExecutionHook(msg.sender, op);
    
    // 2. 执行操作
    (bool success, ) = to.call{value: amount}("");
    require(success, "Transfer failed");
    
    // 3. 记录执行结果
    complianceEngine.postExecutionHook(msg.sender, op, success);
}
```

### 方式 C：前端 DApp（JavaScript/TypeScript）

```typescript
import { ethers } from 'ethers';

// Sepolia 测试网配置
const CONFIG = {
  network: 'sepolia',
  chainId: 11155111,
  rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  contracts: {
    RiskRegistry: '0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3',
    PolicyEngine: '0xF8f89120f5628aE3De747f55e7d00D79633002c4',
    ComplianceEngine: '0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa',
    CompliantStableCoin: '0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A',
  },
  subgraph: 'https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.1'
};

// 连接合约
const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
const compliance = new ethers.Contract(
  CONFIG.contracts.ComplianceEngine,
  ['function preTransferHook(address,address,uint256)', 'function emergencyMode() view returns (bool)'],
  provider
);

// 检查地址风险
async function checkRisk(address: string) {
  const registry = new ethers.Contract(
    CONFIG.contracts.RiskRegistry,
    ['function riskProfiles(address) view returns (uint256,uint8,bytes32[],bool)'],
    provider
  );
  const profile = await registry.riskProfiles(address);
  return {
    riskScore: profile[0],
    tier: ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'][profile[1]],
    isSanctioned: profile[3]
  };
}

// The Graph 实时查询
async function querySubgraph(query: string) {
  const response = await fetch(CONFIG.subgraph, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return (await response.json()).data;
}
```

---

## 合约 ABI 速查

### RiskRegistry

```javascript
[
  'function getRiskProfile(address) view returns (uint256, uint8, bytes32[], bool)',
  'function setRiskProfile(address, uint256, uint8, bytes32[])',
  'function isSanctioned(address) view returns (bool)',
  'function addTag(address, bytes32, string)',
  'function removeTag(address, bytes32)',
  'event RiskProfileUpdated(address indexed, uint8, uint8, bool)',
  'event AddressTagged(address indexed, uint8, string, address indexed)'
]
```

### PolicyEngine

```javascript
[
  'function setIssuerPolicy(address, uint256, uint256, bool, bool, bool, bool)',
  'function getIssuerPolicyVersion(address) view returns (uint256)',
  'function getIssuerPolicyHistorySummary(address) view returns (uint256,uint256,uint256,bool,bool,bool,bool,uint256)',
  'function rollbackToVersion(address, uint256)',
  'event IssuerPolicySet(address indexed, (uint256,uint256,bool,bool,bool,bool,uint256))'
]
```

### ComplianceEngine

```javascript
[
  'function preTransferHook(address, address, uint256)',
  'function freezeFunds(address, uint256)',
  'function releaseFunds(address, uint256)',
  'function emergencyMode() view returns (bool)',
  'function toggleEmergencyMode()',
  'function setSupportedToken(address, bool)',
  'event FundsFrozen(address indexed, uint256)',
  'event FundsReleased(address indexed, uint256)',
  'event EmergencyModeToggled(bool)'
]
```

---

## The Graph Subgraph 查询示例

### 查询协议统计

```graphql
query {
  protocolStats(id: "stats") {
    totalComplianceChecks
    totalBlocked
    totalFlagged
    totalHeld
    totalSanctioned
    totalFundsHeld
    lastUpdated
  }
}
```

### 查询地址风险档案

```graphql
query {
  riskProfiles(
    first: 50,
    where: { isSanctioned: true },
    orderBy: lastUpdated,
    orderDirection: desc
  ) {
    id
    riskScore
    tier
    isSanctioned
    lastUpdated
  }
}
```

### 查询最近合规检查

```graphql
query {
  complianceChecks(
    first: 20,
    orderBy: timestamp,
    orderDirection: desc
  ) {
    id
    operator
    from
    to
    amount
    decision
    reason
    timestamp
  }
}
```

### 查询策略版本历史

```graphql
query {
  policies(
    first: 10,
    orderBy: updatedAt,
    orderDirection: desc
  ) {
    id
    issuer
    version
    maxTxAmount
    dailyLimit
    allowMediumRisk
    allowHighRisk
    blockMixer
    updatedAt
  }
}
```

---

## 部署地址

### Sepolia 测试网

| 合约 | 地址 |
|------|------|
| RiskRegistry | `0xdA4D86D812b4AdF3e0023a6D4b1FF20139abD3b3` |
| PolicyEngine | `0xF8f89120f5628aE3De747f55e7d00D79633002c4` |
| ComplianceEngine | `0xd978f3246c56d7E3c3fF326e9fDe539f91F39ACa` |
| CompliantStableCoin | `0x5028Dc7DA99bf461ed60a226c7CEf0bf7f77BF9A` |
| CompliantSmartWallet | `0xC0F142DcC67a186C16e8c244b041A1c938891F0D` |

### 查询端点

- **The Graph Subgraph**: `https://api.studio.thegraph.com/query/1749664/fidesorigin-sepolia/v0.0.1`
- **RPC**: `https://ethereum-sepolia-rpc.publicnode.com`
- **Chain ID**: 11155111

---

## 策略配置指南

### 发行方策略参数

```solidity
struct Policy {
    uint256 maxTxAmount;      // 单笔最大金额（6位小数）
    uint256 dailyLimit;       // 日累计限额
    bool allowMediumRisk;     // 是否允许中风险地址
    bool allowHighRisk;       // 是否允许高风险地址
    bool blockMixer;          // 是否拦截混币器
    bool requireKYC;          // 是否要求 KYC
    uint256 updatedAt;        // 更新时间戳
}
```

### 设置策略示例

```typescript
const policy = {
  maxTxAmount: ethers.parseUnits('1000000', 6),  // 100万 USDC
  dailyLimit: ethers.parseUnits('5000000', 6),    // 500万 USDC/天
  allowMediumRisk: true,
  allowHighRisk: false,
  blockMixer: true,
  requireKYC: true
};

const tx = await policyEngine.setIssuerPolicy(
  issuerAddress,
  policy.maxTxAmount,
  policy.dailyLimit,
  policy.allowMediumRisk,
  policy.allowHighRisk,
  policy.blockMixer,
  policy.requireKYC
);
await tx.wait();
```

### 版本回滚

```typescript
// 回滚到第 3 个版本
const tx = await policyEngine.rollbackToVersion(issuerAddress, 3);
await tx.wait();
// 策略立即恢复到版本 3 的状态
```

---

## 常见错误处理

| 错误 | 原因 | 解决 |
|------|------|------|
| `ComplianceCheckFailed` | 地址风险等级超过策略允许范围 | 检查地址风险档案，调整策略参数 |
| `UpdateCooldownActive` | RiskOracle 冷却期中 | 等待冷却期结束（默认 5 分钟） |
| `SourceNotActive` | 数据源未激活 | 联系管理员激活数据源 |
| `InsufficientSignatures` | 多签未达到门槛 | 等待更多签名者确认 |
| `EmergencyModeActive` | 紧急模式已激活 | 联系管理员解除紧急模式 |

---

## 资源链接

- **GitHub**: https://github.com/FintechGuy71/FidesOrigin
- **官网**: https://fidesorigin.com
- **白皮书**: `WHITEPAPER-v0.5.0.md`
- **评估报告**: `EVALUATION-REPORT-2026-05-09.md`
- **Demo 后台**: https://fidesorigin.com/admin

---

**需要支持？** 联系: contact@fidesorigin.com
