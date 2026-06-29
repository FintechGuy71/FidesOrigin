# FidesOrigin v0.4.0 - Compliance Protocol

链上执行级可编程合规协议 - 为稳定币发行方和智能钱包运营方提供统一的风控基础设施。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用集成层                                 │
│   ┌─────────────────────┐    ┌─────────────────────┐            │
│   │   资产发行方          │    │   钱包运营方          │            │
│   │  • CompliantStableCoin│    │  • CompliantSmartWallet│           │
│   │  • RWA Tokens         │    │  • MPC Wallets        │            │
│   └─────────────────────┘    └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FidesOrigin Protocol                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ComplianceEngine│  │  RiskRegistry   │  │  PolicyEngine   │ │
│  │  (核心引擎)      │  │  (风险数据中心)  │  │  (策略引擎)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   RiskOracle    │  │   (Chainlink)   │                      │
│  │ (链下数据上链)   │  │   Functions     │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 添加私钥和Chainlink配置
```

### 3. 编译合约

```bash
npx hardhat compile
```

### 4. 运行测试

```bash
npx hardhat test
```

### 5. 部署合约

```bash
npx hardhat run scripts/deploy-full.js --network sepolia
```

## 集成方式

### 资产发行方集成 (稳定币/RWA)

```solidity
import "./interfaces/IAssetCompliance.sol";

contract MyStableCoin is ERC20 {
    IAssetCompliance public compliance;
    
    function _update(address from, address to, uint256 amount) internal override {
        // 自动合规检查
        if (from != address(0) && to != address(0)) {
            compliance.preTransferHook(from, to, amount);
        }
        super._update(from, to, amount);
    }
}
```

### 钱包运营方集成

```solidity
import "./interfaces/IWalletCompliance.sol";

function execute(Operation calldata op) external onlyOwner {
    // 自动合规检查
    complianceEngine.preExecutionHook(owner, op);
    
    // 执行操作
    (bool success, ) = op.target.call{value: op.value}(op.data);
    require(success);
    
    // 记录
    complianceEngine.postExecutionHook(owner, op, success);
}
```

### JavaScript SDK

```javascript
const { FidesOriginSDK } = require('./sdk/fides-origin-sdk');

const sdk = new FidesOriginSDK(provider, {
    complianceEngine: '0x...',
    riskRegistry: '0x...',
    policyEngine: '0x...'
}).connect(signer);

// 检查转账合规性
const result = await sdk.validateTransfer(from, to, amount, asset);
if (!result.allowed) {
    console.log('Blocked:', result.reason);
}

// 获取地址风险信息
const risk = await sdk.getAddressRisk(address);
console.log('Risk Score:', risk.riskScore);
console.log('Tier:', risk.tier);
```

## 核心合约

| 合约 | 功能 | 地址 |
|------|------|------|
| `ComplianceEngine` | 核心合规引擎，统一接口 | TBD |
| `RiskRegistry` | 风险数据注册中心 | TBD |
| `PolicyEngine` | 策略引擎，评估规则 | TBD |
| `RiskOracle` | Chainlink Functions预言机 | TBD |
| `CompliantStableCoin` | Demo稳定币 | TBD |
| `CompliantSmartWallet` | Demo智能钱包 | TBD |

## 决策类型

- `ALLOW` (0) - 放行
- `BLOCK` (1) - 阻止 (revert transaction)
- `FLAG` (2) - 标记 (记录可疑但放行)
- `HOLD` (3) - 冻结 (资金转入托管)

## 风险等级

- `UNKNOWN` (0) - 未知
- `LOW` (1) - 低风险/VIP
- `MEDIUM` (2) - 中风险/灰名单
- `HIGH` (3) - 高风险/黑名单

## 开发路线

- ✅ Phase 4: 核心架构 (ComplianceEngine + RiskRegistry + PolicyEngine)
- ✅ Phase 5: Risk Oracle (Chainlink Functions)
- ✅ Phase 6: Demo DApps (StableCoin + SmartWallet)
- ⏳ Phase 7: 高级策略引擎 (规则DSL + 多维度评分)
- ⏳ Phase 8: 开发者工具 (Hardhat插件 + SDK完善)

## License

MIT
