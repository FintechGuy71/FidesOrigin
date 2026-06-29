# FidesOrigin 多链部署设计文档

> 版本: v1.0
> 日期: 2026-06-26
> 覆盖网络: Ethereum Mainnet, Arbitrum, Base, Optimism

---

## 1. 设计目标

1. **统一地址标识**: 各链 RiskRegistry proxy 地址如何保持一致性或可预测发现
2. **跨链数据同步**: 风险数据在各链间如何保持一致
3. **最小化信任假设**: 不依赖单一中心化 relayer
4. **成本优化**: L2 部署和运营成本最小化

---

## 2. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Ethereum Mainnet (L1)                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ RiskRegistry     │  │ MerkleRiskRegistry│  │ Message Bridge   │       │
│  │ Proxy (UUPS)     │  │ (Anchor Root)     │  │ (LayerZero/      │       │
│  │                  │  │                   │  │  Axelar)         │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                 │
│           │  full data          │  merkle root        │  cross-chain    │
│           │  (source of truth)  │  (lightweight)      │  messages       │
└───────────┼─────────────────────┼─────────────────────┼─────────────────┘
            │                     │                     │
            │                     │                     │
┌───────────┼─────────────────────┼─────────────────────┼─────────────────┐
│           │      Arbitrum       │                     │                 │
│  ┌────────▼─────────┐  ┌────────▼─────────┐  ┌────────▼─────────┐       │
│  │ RiskRegistry     │  │ MerkleRiskRegistry│  │ LZ Endpoint      │       │
│  │ Proxy (UUPS)     │  │ (Verify Only)     │  │                  │       │
│  │                  │  │                   │  │                  │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
├───────────┼─────────────────────┼─────────────────────┼─────────────────┤
│           │      Base           │                     │                 │
│  ┌────────▼─────────┐  ┌────────▼─────────┐  ┌────────▼─────────┐       │
│  │ RiskRegistry     │  │ MerkleRiskRegistry│  │ Axelar Gateway   │       │
│  │ Proxy (UUPS)     │  │ (Verify Only)     │  │                  │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
├───────────┼─────────────────────┼─────────────────────┼─────────────────┤
│           │      Optimism       │                     │                 │
│  ┌────────▼─────────┐  ┌────────▼─────────┐  ┌────────▼─────────┐       │
│  │ RiskRegistry     │  │ MerkleRiskRegistry│  │ LZ Endpoint      │       │
│  │ Proxy (UUPS)     │  │ (Verify Only)     │  │                  │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 各网络角色定义

| 网络 | 角色 | 数据模式 | 部署合约 |
|------|------|----------|----------|
| Ethereum Mainnet | **Source of Truth** | 全量存储 | RiskRegistry + MerkleRiskRegistry |
| Arbitrum | **Replica + Verify** | Merkle Proof 验证 | MerkleRiskRegistry + LZ Receiver |
| Base | **Replica + Verify** | Merkle Proof 验证 | MerkleRiskRegistry + Axelar Receiver |
| Optimism | **Replica + Verify** | Merkle Proof 验证 | MerkleRiskRegistry + LZ Receiver |

---

## 4. RiskRegistry Proxy 地址统一方案

### 方案 A: CREATE2 确定性部署 (推荐)

使用 `CREATE2` + 统一 `salt` 确保各链 proxy 地址一致：

```solidity
// 部署脚本核心逻辑
bytes32 constant SALT = keccak256("FidesOrigin_RiskRegistry_2026");

function deployRiskRegistryProxy(
    address implementation,
    address admin,
    bytes memory initData
) internal returns (address proxy) {
    proxy = Clones.cloneDeterministic(implementation, SALT);
    (bool success, ) = proxy.call(initData);
    require(success, "Init failed");
}
```

**结果**: 如果各链使用相同的 `factory + implementation + SALT`，proxy 地址将完全一致。

**前提条件**:
- 各链使用相同的 Proxy Factory 合约（如 OpenZeppelin ERC1967ProxyFactory）
- 部署者地址相同（需跨链控制同一 EOA/多签）
- 构造函数参数相同

### 方案 B: 地址注册表

部署一个链上注册表合约，记录各链 RiskRegistry 地址：

```solidity
contract FidesRegistry {
    mapping(uint256 => address) public riskRegistryByChainId;
    mapping(uint256 => address) public merkleRegistryByChainId;

    function register(uint256 chainId, address riskRegistry, address merkleRegistry)
        external onlyOwner
    {
        riskRegistryByChainId[chainId] = riskRegistry;
        merkleRegistryByChainId[chainId] = merkleRegistry;
    }
}
```

**部署地址 (Ethereum Mainnet)**: 作为权威源，其他链可读取。

### 方案 C: ENS 子域名

```
riskregistry.fidesorigin.eth → 0x7a41... (Ethereum)
riskregistry.arb.fidesorigin.eth → 0x... (Arbitrum)
riskregistry.base.fidesorigin.eth → 0x... (Base)
riskregistry.op.fidesorigin.eth → 0x... (Optimism)
```

**优点**: 人类可读，可更新
**缺点**: 依赖 ENS 可用性，L2 支持有限

---

## 5. 跨链数据同步方案

### 5.1 方案对比

| 方案 | 延迟 | 成本 | 去中心化 | 复杂度 | 推荐度 |
|------|------|------|----------|--------|--------|
| **LayerZero** | ~1-5 min | 中 | 中 (依赖预言机) | 中 | ⭐⭐⭐⭐ |
| **Axelar** | ~2-10 min | 中 | 高 (PoS 验证者) | 中 | ⭐⭐⭐⭐⭐ |
| **独立部署** | 即时 | 低 | 高 | 低 | ⭐⭐⭐ |
| **Chainlink CCIP** | ~15-30 min | 高 | 高 | 高 | ⭐⭐⭐ |

### 5.2 推荐方案: Axelar + 独立部署 混合模式

```
┌────────────────────────────────────────────────────────────┐
│  Ethereum Mainnet (Source)                                  │
│  ┌─────────────────────────────────────┐                   │
│  │ RiskRegistry (full data)            │                   │
│  │ └─ event: RiskProfileUpdated(...)   │                   │
│  └──────────┬──────────────────────────┘                   │
│             │                                               │
│             │  Axelar GMP (Generic Message Passing)         │
│             │  payload: {chainId, merkleRoot, timestamp}    │
│             ▼                                               │
│  ┌─────────────────────────────────────┐                   │
│  │ Axelar Gateway (send)               │                   │
│  └─────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Arbitrum       │ │  Base        │ │  Optimism    │
│  Axelar Gateway │ │  Axelar GW   │ │  Axelar GW   │
│       │         │ │     │        │ │     │        │
│       ▼         │ │     ▼        │ │     ▼        │
│  MerkleRiskRegistry│ │ MerkleRiskReg │ │ MerkleRiskReg│
│  updateMerkleRoot()│ │ updateMerkleRoot()│ │ updateMerkleRoot()│
└─────────────────┘ └──────────────┘ └──────────────┘
```

**消息格式**:
```solidity
struct CrossChainUpdate {
    uint256 sourceChainId;
    bytes32 merkleRoot;
    uint256 timestamp;
    uint256 nonce;       // 防重放
    bytes signature;     // Oracle 多签
}
```

**L2 合约接收逻辑**:
```solidity
function _execute(
    string calldata sourceChain,
    string calldata sourceAddress,
    bytes calldata payload
) internal override {
    CrossChainUpdate memory update = abi.decode(payload, (CrossChainUpdate));

    require(update.sourceChainId == 1, "Only Ethereum mainnet");
    require(update.timestamp > lastSyncTime, "Stale update");
    require(_verifySignature(update), "Invalid sig");

    merkleRoot = update.merkleRoot;
    lastSyncTime = update.timestamp;

    emit CrossChainSynced(update.merkleRoot, update.timestamp);
}
```

### 5.3 独立部署模式 (fallback)

如果跨链桥不可用，各链独立运行：
- 各链有独立的 Oracle 节点
- 定期手动同步 Merkle Root
- 数据一致性最终由 Merkle Root 保证

---

## 6. 部署脚本模板

### 6.1 Hardhat + Ethers.js 部署脚本

```javascript
// scripts/deploy-multichain.js
const { ethers, upgrades } = require('hardhat');
const hre = require('hardhat');

// ==================== 配置 ====================
const CONFIG = {
  mainnet: {
    rpc: process.env.ETH_RPC,
    chainId: 1,
    verify: true,
    gasPrice: undefined, // auto
  },
  arbitrum: {
    rpc: process.env.ARB_RPC,
    chainId: 42161,
    verify: true,
    gasPrice: undefined,
  },
  base: {
    rpc: process.env.BASE_RPC,
    chainId: 8453,
    verify: true,
    gasPrice: undefined,
  },
  optimism: {
    rpc: process.env.OP_RPC,
    chainId: 10,
    verify: true,
    gasPrice: undefined,
  },
};

// CREATE2 Salt (统一各链)
const SALT = ethers.keccak256(ethers.toUtf8Bytes('FidesOrigin_RiskRegistry_v2_2026'));

// ==================== 部署 RiskRegistry (全量) ====================
async function deployRiskRegistry(deployer, network) {
  const RiskRegistry = await ethers.getContractFactory('RiskRegistryV2', deployer);

  const proxy = await upgrades.deployProxy(RiskRegistry, [deployer.address], {
    initializer: 'initialize',
    unsafeAllow: ['constructor'],
  });

  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  const implAddr = await upgrades.erc1967.getImplementationAddress(proxyAddr);

  console.log(`[${network}] RiskRegistry Proxy: ${proxyAddr}`);
  console.log(`[${network}] RiskRegistry Implementation: ${implAddr}`);

  return { proxy, proxyAddr, implAddr };
}

// ==================== 部署 MerkleRiskRegistry (轻量) ====================
async function deployMerkleRegistry(deployer, initialRoot) {
  const MerkleRiskRegistry = await ethers.getContractFactory('MerkleRiskRegistry', deployer);
  const merkleRegistry = await MerkleRiskRegistry.deploy(initialRoot);
  await merkleRegistry.waitForDeployment();

  const addr = await merkleRegistry.getAddress();
  console.log(`MerkleRiskRegistry: ${addr}`);

  return { merkleRegistry, addr };
}

// ==================== 部署跨链桥接收器 ====================
async function deployBridgeReceiver(deployer, merkleRegistryAddr, gatewayAddr) {
  const BridgeReceiver = await ethers.getContractFactory('FidesBridgeReceiver', deployer);
  const receiver = await BridgeReceiver.deploy(merkleRegistryAddr, gatewayAddr);
  await receiver.waitForDeployment();

  const addr = await receiver.getAddress();
  console.log(`BridgeReceiver: ${addr}`);

  return { receiver, addr };
}

// ==================== 主流程 ====================
async function main() {
  const network = hre.network.name;
  const [deployer] = await ethers.getSigners();

  console.log(`Deploying to ${network} from ${deployer.address}`);

  // 1. 部署 RiskRegistry (Mainnet 全量, L2 可选)
  const { proxyAddr } = await deployRiskRegistry(deployer, network);

  // 2. 部署 MerkleRiskRegistry (所有链)
  const initialRoot = ethers.ZeroHash;
  const { addr: merkleAddr } = await deployMerkleRegistry(deployer, initialRoot);

  // 3. L2: 部署桥接接收器
  if (network !== 'mainnet') {
    const gatewayAddr = getGatewayAddress(network);
    await deployBridgeReceiver(deployer, merkleAddr, gatewayAddr);
  }

  // 4. 保存部署信息
  const deployment = {
    network,
    chainId: CONFIG[network]?.chainId || (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RiskRegistry: { proxy: proxyAddr },
      MerkleRiskRegistry: { address: merkleAddr },
    },
  };

  const fs = require('fs');
  fs.writeFileSync(
    `./deployments/${network}-latest.json`,
    JSON.stringify(deployment, null, 2)
  );

  // 5. 验证合约
  if (CONFIG[network]?.verify) {
    await verifyContract(proxyAddr, []);
  }
}

// ==================== 辅助函数 ====================
function getGatewayAddress(network) {
  const gateways = {
    arbitrum: '0xe432150cce91c13a887f7D836923d5597adD8E31', // Axelar
    base: '0xe432150cce91c13a887f7D836923d5597adD8E31',
    optimism: '0xe432150cce91c13a887f7D836923d5597adD8E31',
  };
  return gateways[network];
}

async function verifyContract(address, constructorArgs) {
  try {
    await hre.run('verify:verify', {
      address,
      constructorArguments: constructorArgs,
    });
  } catch (e) {
    console.log('Verification failed:', e.message);
  }
}

main().catch(console.error);
```

### 6.2 环境变量模板 (.env)

```bash
# RPC Endpoints
ETH_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ARB_RPC=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
OP_RPC=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY

# 部署者私钥 (建议使用硬件钱包或安全 KMS)
DEPLOYER_PK=0x...

# 验证 API Keys
ETHERSCAN_API_KEY=...
ARBISCAN_API_KEY=...
BASESCAN_API_KEY=...
OPTIMISTIC_ETHERSCAN_API_KEY=...

# Axelar / LayerZero
AXELAR_GATEWAY_MAINNET=0xe432150cce91c13a887f7D836923d5597adD8E31
LZ_ENDPOINT_MAINNET=0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675
```

---

## 7. 升级流程

### UUPS 跨链升级检查清单

```
□ 1. 在 testnet 完成升级测试
□ 2. 使用 OpenZeppelin upgrades plugin 验证存储兼容性
   npx hardhat run scripts/validate-upgrade.js --network <network>
□ 3. 多签钱包提案 (Gnosis Safe / Safe{Wallet})
□ 4. 各链独立执行升级 (非原子性，需监控)
□ 5. 升级后验证:
   - proxiableUUID() 返回正确值
   - VERSION 字符串更新
   - 核心功能 smoke test
□ 6. 更新部署文档和监控告警
```

---

## 8. 监控与告警

| 指标 | 阈值 | 告警方式 |
|------|------|----------|
| Merkle Root 同步延迟 | > 30 min | PagerDuty |
| L2 Merkle Root 与 L1 不一致 | any mismatch | Slack + Email |
| Oracle 更新失败率 | > 5% | Slack |
| Gas Price  spikes | > 100 gwei | Slack |

---

## 9. 附录: 各链合约地址占位符

| 网络 | RiskRegistry Proxy | MerkleRiskRegistry | Bridge Receiver |
|------|-------------------|-------------------|-----------------|
| Ethereum | `0x7a41...` | TBD | N/A |
| Arbitrum | TBD | TBD | TBD |
| Base | TBD | TBD | TBD |
| Optimism | TBD | TBD | TBD |

> 注: TBD 项需在部署后回填。
