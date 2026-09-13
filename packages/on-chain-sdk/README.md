# @fintechguy71/on-chain-sdk

FidesOrigin On-Chain SDK — 直接智能合约交互、Guard 交易前校验（零 Gas）、风险画像只读查询。

> 当前面向 Sepolia 测试网。合约地址见仓库 `DEPLOYED.md`；生产集成请通过构造参数传入你自己的地址集。

## 安装

```bash
npm install @fintechguy71/on-chain-sdk ethers
```

## 快速开始

```ts
import { FidesOriginSDK, Decision, SEPOLIA_ADDRESSES } from '@fintechguy71/on-chain-sdk';
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');

const sdk = new FidesOriginSDK(
  {
    complianceEngine: SEPOLIA_ADDRESSES.complianceEngine,
    riskRegistry: SEPOLIA_ADDRESSES.riskRegistry,
  },
  provider
);
```

## Guard：交易前校验（零 Gas）

```ts
const validation = await sdk.validateTransfer(
  '0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...'
);

if (validation.decision === Decision.BLOCK) {
  console.warn('Transfer blocked:', validation.reason);
} else if (validation.decision === Decision.FLAG) {
  console.warn('Transfer flagged for review:', validation.reason);
}

// 快速判断
const canSend = await sdk.wouldTransferSucceed('0xSender...', '0xRecipient...', 1000000000000000000n, '0xTokenAddress...');
```

## 风险画像（gas-free 只读）

```ts
const profile = await sdk.getRiskProfile('0x...');
console.log(profile.riskScore, profile.tier, profile.isSanctioned);

const sanctioned = await sdk.isSanctioned('0x...');
const tier = await sdk.getRiskTier('0x...');   // RiskTier 枚举
const tags = await sdk.getTags('0x...');        // bytes32 → 可读字符串
```

## 事件监听

```ts
// Guard 校验结果
const unsub = sdk.onTransferValidated((asset, from, to, amount, decision, reason) => {
  console.log(`Transfer ${decision === Decision.ALLOW ? 'allowed' : 'blocked'}: ${reason}`);
});

// 新增制裁地址
const unsub2 = sdk.onSanctionAdded((account, reason) => {
  console.log('Sanctioned:', account, reason);
});

// 退订
unsub();
unsub2();
// 或全部移除
sdk.removeAllListeners();
```

## 注意

- 地址会经 ethers `getAddress` 校验（EIP-55 checksum）。传入地址请用合法大小写或全小写。
- 所有查询均为 `view` 调用，不消耗 Gas、不产生链上状态变更。
