# FidesOrigin API 文档

## 概述

FidesOrigin 是一个链上执行级可编程合规协议，通过 Merkle Tree 存储风险地址，实现高效的大规模地址验证。

**当前版本**: v11.0
**数据库规模**: 20,645 地址
**Merkle Root**: `0xc58ee277d934b4f0c80f40c85c2cdc38718bbd4b6e00773f3887b3d4ed36bed4`

---

## MerkleRiskRegistry 合约

### 合约地址
- **Sepolia Testnet**: `待部署`

### 角色
| 角色 | 权限 |
|------|------|
| `DEFAULT_ADMIN_ROLE` | 合约部署者，最高权限 |
| `ADMIN_ROLE` | 更新 Merkle Root |
| `ORACLE_ROLE` | 设置地址风险分数、添加标签 |

### 核心函数

#### updateMerkleRoot
```solidity
function updateMerkleRoot(bytes32 newRoot) external onlyRole(ADMIN_ROLE)
```
更新 Merkle Root。触发 `MerkleRootUpdated` 事件。

**参数:**
- `newRoot`: 新的 Merkle Root (bytes32)

**要求:**
- 调用者必须有 `ADMIN_ROLE`
- `newRoot` 不能等于当前 root

---

#### verifyAddress
```solidity
function verifyAddress(
    address addr,
    uint256 riskScore,
    string memory riskTier,
    bytes32[] calldata proof
) external view returns (bool)
```
验证单个地址是否在 Merkle Tree 中。

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| `addr` | address | 要验证的地址 |
| `riskScore` | uint256 | 风险分数 (0-100) |
| `riskTier` | string | 风险等级 "BLACK"/"GREY" |
| `proof` | bytes32[] | Merkle Proof |

**返回:** `true` 如果地址在树中且参数匹配

**使用示例:**
```javascript
const leaf = [address, riskScore, riskTier];
const proof = tree.getProof(index);
const isValid = await contract.verifyAddress(address, riskScore, riskTier, proof);
```

---

#### batchVerify
```solidity
function batchVerify(
    address[] calldata addresses,
    uint256[] calldata riskScores,
    string[] calldata riskTiers,
    bytes32[][] calldata proofs
) external view returns (bool[] memory results)
```
批量验证多个地址。Gas 效率比多次单地址调用更高。

**参数:**
- `addresses`: 地址数组
- `riskScores`: 风险分数数组
- `riskTiers`: 风险等级数组
- `proofs`: Merkle Proof 数组

**返回:** 每个地址的验证结果数组

---

#### setAddressRiskScore
```solidity
function setAddressRiskScore(address addr, uint256 riskScore) external onlyRole(ORACLE_ROLE)
```
设置地址的链上风险分数。

**参数:**
- `addr`: 地址
- `riskScore`: 风险分数 (0-100)

---

#### addAddressTag
```solidity
function addAddressTag(address addr, bytes32 tag) external onlyRole(ORACLE_ROLE)
```
为地址添加标签。

**参数:**
- `addr`: 地址
- `tag`: 标签 (bytes32)，如 `keccak256("SANCTIONED")`

---

### 事件

#### MerkleRootUpdated
```solidity
event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot, uint256 timestamp);
```

#### AddressRiskUpdated
```solidity
event AddressRiskUpdated(address indexed addr, uint256 riskScore, string tags);
```

---

## Merkle Tree 使用指南

### 生成 Proof

```javascript
const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');

// 从数据库构建树
const values = addressLabels.map(e => [e.address, e.riskScore, e.riskTier]);
const tree = StandardMerkleTree.of(values, ['address', 'uint256', 'string']);

// 获取某个地址的 proof
const index = // 地址在数组中的索引
const proof = tree.getProof(index);

// 验证（链下）
const isValid = tree.verify(index, [address, riskScore, riskTier]);
```

### Leaf Hash 格式

Leaf 使用 OpenZeppelin StandardMerkleTree 格式：
```solidity
leaf = keccak256(bytes.concat(keccak256(abi.encode(addr, riskScore, riskTier))))
```

---

## 数据源

| 来源 | 类型 | 数量 | 更新频率 |
|------|------|------|----------|
| OFAC SDN | 制裁 | 900+ | 实时 |
| Chainalysis | 制裁 | 已知 | 实时 |
| Etherscan | 黑客/诈骗 | 动态 | 每周 |
| GitHub 公开列表 | 代币/协议 | 动态 | 每周 |
| Uniswap Token List | DEX代币 | 552 | 每月 |
| PoolTogether | 协议代币 | 13 | 每月 |

---

## 部署脚本

### 部署到 Sepolia
```bash
# 1. 设置环境变量
export PRIVATE_KEY=your_private_key
export RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# 2. 运行部署脚本
node scripts/deploy-merkle-registry.js
```

### 更新 Merkle Root
```bash
export CONTRACT_ADDRESS=deployed_address
node scripts/update-merkle-root-v11.js
```

---

## 测试

### 运行测试
```bash
# 全部测试
npx hardhat test

# MerkleRiskRegistry 扩展测试
npx hardhat test test/MerkleRiskRegistry.extended.test.js

# 单个合约测试
npx hardhat test test/FidesOrigin.test.js
```

### 测试覆盖
- 构造函数与初始化
- Merkle Root 更新（权限、事件、历史）
- 地址验证（有效/无效 proof）
- 批量验证
- 风险分数操作
- 标签管理
- 访问控制
- Gas 优化

---

## 安全注意事项

1. **Merkle Root 更新**: 仅 `ADMIN_ROLE` 可更新，建议通过时间锁执行
2. **Oracle 权限**: `ORACLE_ROLE` 可修改风险分数，需严格管控
3. **Proof 生成**: 必须在可信环境生成，防止篡改
4. **前端验证**: 所有前端验证必须配合链上确认

---

## 集成示例

### 在 DeFi 协议中使用
```solidity
import "./MerkleRiskRegistry.sol";

contract MyDeFiProtocol {
    MerkleRiskRegistry public riskRegistry;
    
    constructor(address _riskRegistry) {
        riskRegistry = MerkleRiskRegistry(_riskRegistry);
    }
    
    function transfer(address to, uint256 amount) external {
        // 检查接收方是否在黑名单
        require(
            !riskRegistry.verifyAddress(to, 80, "BLACK", proof),
            "Recipient is blacklisted"
        );
        // ... 执行转账
    }
}
```

---

*文档版本: v11.0 | 生成时间: 2026-05-10*
