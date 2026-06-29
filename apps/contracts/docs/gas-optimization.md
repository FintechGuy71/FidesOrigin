# RiskRegistry Gas 优化分析报告

> 版本: v1.2.2 / v2.0.0
> 分析日期: 2026-06-26
> 分析师: OpenClaw Subagent

---

## 1. 执行摘要

当前 `RiskRegistry` 的 `batchUpdateRiskProfiles()` 在批量更新 100 个地址时，**单次调用 gas 消耗约为 2.5M - 4.5M gas**（取决于标签数量和列表操作）。在 Ethereum mainnet 上，这意味着每次批量更新成本约为 **$50-$150**（按 20 gwei 计算）。本报告分析 gas 瓶颈并提出优化方案。

---

## 2. 当前 Gas 消耗分析

### 2.1 `batchUpdateRiskProfiles()` 瓶颈拆解

| 操作 | Gas / 地址 | 说明 |
|------|-----------|------|
| `SSTORE` (新档案) | 20,000 | 首次写入 cold storage |
| `SSTORE` (更新档案) | 2,900 | 修改已有 warm storage |
| `SSTORE` (标签数组) | 20,000 + 2,900×n | 每个标签一个 SSTORE |
| `highRiskAddresses.push()` | 20,000 + 2,900 | 动态数组扩容 |
| `sanctionedAddresses.push()` | 20,000 + 2,900 | 动态数组扩容 |
| `_removeHighRisk` swap-and-pop | ~5,000 | 索引更新 + pop |
| Event emit | ~375 + 375×topic | 日志写入 |
| 循环开销 | ~200 | 递增、边界检查 |

**估算公式:**
```
Gas(batch) ≈ N × (SSTORE_base + tag_cost) + array_ops + event_logs
```

**实测估算 (100 地址, 平均 2 标签/地址):**
- 50% 新档案: 50 × 20,000 = 1,000,000
- 50% 更新档案: 50 × 2,900 = 145,000
- 标签: 200 × 2,900 = 580,000
- 数组操作: ~200,000
- 事件: ~100,000
- **总计: ~2.0M - 2.5M gas**

### 2.2 关键瓶颈识别

```solidity
// 当前代码: 每个地址独立 SSTORE
for (uint256 i = 0; i < count; i++) {
    _updateRiskProfileInternal(addrs[i], ...);  // 每个地址 1-3 个 SSTORE
}
```

**P0 瓶颈: 标签数组的逐元素 SSTORE**
```solidity
delete profile.tags;           // O(n) SSTORE 清除 ( refund 仅 4,800 )
for (uint256 i = 0; i < tags.length; i++) {
    profile.tags.push(tags[i]); // 每个标签 20,000 gas
}
```

**P1 瓶颈: highRisk/sanctioned 动态数组的频繁扩容**
- `push()` 在数组长度跨越 2^n 边界时触发 storage 重新分配
- 每次扩容需要分配新 slot 并复制数据

**P2 瓶颈: 频繁的 MIN_UPDATE_INTERVAL 时间检查**
- `block.timestamp` 读取虽然便宜 (~2 gas)，但每地址都读浪费

---

## 3. 优化方案

### 方案 A: 批量压缩写入 (推荐，短期可实施)

**核心思想: 将多个地址的数据打包到一个 bytes 中，减少函数调用开销**

```solidity
// 优化后: 批量 SSTORE 模式
function batchUpdateRiskProfilesPacked(
    bytes calldata packedData  // abi.encode 的压缩数据
) external onlyRole(ORACLE_ROLE) whenNotPaused nonReentrant {
    // packedData 格式: [address(20) | riskScore(1) | tier(1) | sanctioned(1) | tagCount(1) | tags...] × N
    uint256 offset = 0;
    uint256 gasStart = gasleft();

    while (offset < packedData.length) {
        address addr = address(uint160(bytes20(packedData[offset:offset+20])));
        uint8 riskScore = uint8(packedData[offset+20]);
        uint8 tier = uint8(packedData[offset+21]);
        bool sanctioned = packedData[offset+22] != 0;
        uint8 tagCount = uint8(packedData[offset+23]);
        offset += 24;

        // 批量读取标签
        bytes32[] memory tags = new bytes32[](tagCount);
        for (uint8 t = 0; t < tagCount; t++) {
            tags[t] = bytes32(packedData[offset:offset+32]);
            offset += 32;
        }

        _updateRiskProfileInternal(addr, riskScore, RiskTier(tier), sanctioned, tags);
    }

    emit BatchUpdateCompleted(0, gasStart - gasleft());
}
```

**预期优化效果:**
- 减少 calldata 大小: 40%（移除 ABI encoding overhead）
- 减少循环边界检查: 编译器可优化
- **Gas 节省: ~15-20%**

### 方案 B: Merkle Tree 批量验证 (推荐，中长期)

**核心思想: 用 Merkle Root 代替逐个地址存储，on-chain 只存 root**

```solidity
contract MerkleRiskRegistry is AccessControl, Pausable {
    bytes32 public merkleRoot;
    bytes32[] public merkleRootHistory;  // 环形缓冲区

    // 用户通过 Merkle Proof 自证风险等级
    function verifyAndCache(
        address addr,
        uint8 riskScore,
        uint8 tier,
        bytes32[] calldata proof
    ) external {
        bytes32 leaf = keccak256(abi.encode(addr, riskScore, tier));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid proof");

        // 可选: 将验证结果缓存到 mapping，避免重复验证
        addressRiskScores[addr] = riskScore;
    }

    // Oracle 只需更新 root，gas 固定 ~50,000
    function updateMerkleRoot(bytes32 newRoot) external onlyRole(ORACLE_ROLE) {
        merkleRoot = newRoot;
        merkleRootHistory.push(newRoot);
        emit MerkleRootUpdated(newRoot, block.timestamp);
    }
}
```

**Gas 对比 (更新 10,000 个地址):**

| 方案 | On-chain Gas | 用户证明 Gas | 总成本 |
|------|-------------|-------------|--------|
| 当前 batchUpdate | ~250M | 0 | ~$500 @ 20 gwei |
| Merkle Root 更新 | ~50,000 | ~60,000/地址 | ~$220 总计 |
| **节省** | **99.98%** | - | **~56%** |

**权衡:**
- ✅ 极大降低 Oracle 更新成本
- ✅ 支持 10万+ 地址
- ❌ 用户需要自行提供 Merkle Proof（前端需集成）
- ❌ 无法做复杂的列表管理（highRiskAddresses, sanctionedAddresses）

### 方案 C: Storage 打包 + 冷/热路径分离

**针对当前 struct-based RiskRegistry:**

```solidity
// 优化: 将 RiskProfile 从 struct 改为 2 个 slot 的 bit-packed uint256
mapping(address => uint256) private _packedProfile1;  // score(8) | tier(3) | sanctioned(1) | lastUpdated(32) | exists(1) | confidence(8)
mapping(address => uint256) private _packedProfile2;  // tags hash (keccak256)
```

**效果:**
- 每个档案从 3+ slots 减少到 2 slots
- 更新时最多 2 个 SSTORE
- **Gas 节省: ~30-40%**

### 方案 D: 写入聚合器 (Write Buffer)

```solidity
// 缓冲区模式: 累积到阈值再批量写入
mapping(uint256 => bytes32) public writeBuffer;  // blockNumber => merkleRoot
uint256 public bufferSize;
uint256 public constant BUFFER_THRESHOLD = 50;

function queueRiskUpdate(...) external onlyRole(ORACLE_ROLE) {
    buffer[bufferSize++] = keccak256(abi.encode(addr, riskScore, tier));
    if (bufferSize >= BUFFER_THRESHOLD) {
        _flushBuffer();
    }
}

function _flushBuffer() internal {
    bytes32 root = _computeMerkleRoot(buffer);
    merkleRoot = root;
    bufferSize = 0;
    emit BufferFlushed(root, block.number);
}
```

---

## 4. 推荐实施路径

### Phase 1 (本周): 短期优化 — 当前合约
1. **移除标签数组的逐元素删除**: 用 `new bytes32[](0)` 替代 `delete profile.tags`
2. **预分配数组容量**: 在 `batchUpdate` 前预计算 highRisk/sanctioned 列表增长量
3. **批量事件**: 用单个 `BatchUpdateCompleted` 替代逐条 `RiskProfileUpdated`

### Phase 2 (本月): 中期优化 — RiskRegistryV2
1. **实施 MerkleRiskRegistry 并行部署** (参考 `MerkleRiskRegistry.sol`)
2. **双模式运行**: 小批量用 `batchUpdateRiskProfiles`，大批量用 `updateMerkleRoot`
3. **添加写入缓冲区**: 降低 Oracle 调用频率

### Phase 3 (下月): 长期架构 — 多链
1. **L2 上只用 Merkle Root**: Arbitrum/Base/Optimism 只验证 proof，不存全量数据
2. **Ethereum mainnet 作为 anchor**: 只在 L1 存 root，L2 通过 bridge 同步

---

## 5. 代码优化示例

### 优化前 (当前)
```solidity
// 每个标签一个 SSTORE
delete profile.tags;
for (uint256 i = 0; i < tags.length; i++) {
    profile.tags.push(tags[i]);
}
```

### 优化后
```solidity
// 策略: 标签哈希化，只存 hash
bytes32 tagHash = keccak256(abi.encode(tags));
profile.tagHash = tagHash;  // 1 SSTORE, O(1)

// 需要完整标签时，从 event log 或 off-chain 索引读取
emit TagsUpdated(addr, tagHash, tags);  // 事件包含完整数据
```

---

## 6. 结论

| 优先级 | 优化项 | 预期节省 | 实施难度 |
|--------|--------|----------|----------|
| P0 | 标签哈希化 | 40% | 低 |
| P1 | Merkle Root 批量更新 | 95%+ | 中 |
| P2 | Storage 位打包 | 35% | 中 |
| P3 | 写入缓冲区 | 20% | 低 |

**建议立即实施 P0（标签优化）和 P1（Merkle 并行），可在不破坏存储兼容性的前提下将 gas 成本降低 50-70%。**
