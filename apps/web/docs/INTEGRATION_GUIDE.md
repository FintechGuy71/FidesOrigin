# FidesOrigin - 集成指南

## 快速开始

### 1. 稳定币发行方集成

```solidity
import "@fidesorigin/contracts/interfaces/IAssetCompliance.sol";

contract MyStableCoin is ERC20 {
    IAssetCompliance public complianceEngine;
    
    constructor(address _complianceEngine) {
        complianceEngine = IAssetCompliance(_complianceEngine);
    }
    
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            complianceEngine.preTransferHook(from, to, amount);
        }
        super._update(from, to, amount);
    }
}
```

### 2. 钱包运营方集成

```solidity
import "@fidesorigin/contracts/interfaces/IWalletCompliance.sol";

contract MyWallet {
    IWalletCompliance public complianceEngine;
    
    modifier compliant(IWalletCompliance.Operation calldata op) {
        complianceEngine.preExecutionHook(msg.sender, op);
        _;
    }
    
    function execute(IWalletCompliance.Operation calldata op) external compliant(op) {
        // ... 执行逻辑
    }
}
```

### 3. TypeScript SDK 集成

```typescript
import { FidesOriginSDK, Decision } from '@fidesorigin/sdk';
import { ethers } from 'ethers';

// 初始化
const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/...');
const sdk = new FidesOriginSDK(
  {
    complianceEngine: '0x...',
    riskRegistry: '0x...',
    policyEngine: '0x...',
    riskOracle: '0x...',
  },
  provider
);

// 查询地址风险
const profile = await sdk.getRiskProfile(userAddress);
console.log(`Risk Score: ${profile.riskScore}, Tier: ${profile.tier}`);

// 模拟转账
const result = await sdk.validateTransfer(from, to, amount, assetAddress);
if (result.decision === Decision.BLOCK) {
  console.error('Blocked:', result.reason);
}
```

## 部署后配置

### Step 1: 配置 RiskRegistry 角色
```javascript
await riskRegistry.grantRole(
  await riskRegistry.ORACLE_ROLE(), 
  riskOracleAddress
);
```

### Step 2: 配置 PolicyEngine 角色
```javascript
await policyEngine.grantRole(
  await policyEngine.COMPLIANCE_ENGINE_ROLE(), 
  complianceEngineAddress
);
```

### Step 3: 设置发行方策略
```javascript
await policyEngine.setIssuerPolicy(stableCoinAddress, {
  maxTxAmount: ethers.parseUnits('1000000', 6),
  dailyLimit: ethers.parseUnits('5000000', 6),
  allowMediumRisk: false,
  allowHighRisk: false,
  blockMixer: true,
  requireDestinationKYC: false,
  cooldownPeriod: 0,
});
```

### Step 4: 预设风险地址
```javascript
await riskOracle.batchUpdateRiskProfiles(
  [sanctionedAddress1, sanctionedAddress2],
  [100, 100],        // risk score
  [3, 3],            // HIGH tier
  [true, true]       // sanctioned
);
```

## 事件监听

```typescript
// 监听合规拦截
complianceEngine.on('TransferValidated', (asset, from, to, amount, decision, reason) => {
  if (decision === Decision.BLOCK) {
    alertOpsTeam({ asset, from, to, amount, reason });
  }
});

// 监听制裁更新
riskRegistry.on('SanctionAdded', (account, reason) => {
  updateLocalCache(account, 'sanctioned');
});
```

## 测试网试用

Sepolia 测试网已部署合约:
```
ComplianceEngine:  [待部署]
RiskRegistry:      [待部署]
PolicyEngine:      [待部署]
```

获取测试币:
```
1. Sepolia ETH: https://sepoliafaucet.com
2. 通过 FidesOrigin 水龙头获取 TestUSD
```

## 常见问题

**Q: 合规检查增加多少 Gas?**
A: 单次 `validateTransfer` 约 15k-25k Gas。建议对高频小额场景启用 "快速路径" (仅查制裁名单, ~5k Gas)。

**Q: 如何更新制裁名单?**
A: 通过 RiskOracle 的 `batchUpdateRiskProfiles` 或 `emergencySanction` (紧急模式)。

**Q: 支持哪些链?**
A: Ethereum, Polygon, Arbitrum, Optimism, Base, BNB Chain。所有 EVM 兼容链均可部署。

**Q: 能否完全绕过合规?**
A: 不能。合规检查嵌入在 `_update` 和 `execute` 的核心路径中。只有合约 owner 能临时 `toggleCompliance(false)`。
