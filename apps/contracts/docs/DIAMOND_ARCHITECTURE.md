# FidesOrigin ComplianceEngine Diamond Architecture

## 概述

原 `ComplianceEngine.sol` 合约大小为 **24,822 bytes**，超过 EIP-170 的 **24,576 bytes**（24KB）合约大小限制。本方案采用 **EIP-2535 Diamond Pattern** 进行重构，将单体合约拆分为多个独立的 Facet，每个 Facet 均小于 24KB。

## 设计目标

1. **合约大小控制**：每个 Facet 必须 < 24KB
2. **外部接口兼容**：保持所有外部函数签名不变
3. **事件兼容**：保持所有事件定义不变
4. **存储兼容**：使用 AppStorage 模式确保存储布局兼容
5. **权限继承**：保留 AccessControl、Pausable、ReentrancyGuard 功能

---

## 1. Facet 拆分方案

### 1.1 Facet 清单

| Facet | 职责 | 预计大小 | 状态 |
|-------|------|---------|------|
| **DiamondComplianceEngine** | Diamond 主合约（代理 + 路由） | ~1.1 KB | ✅ |
| **DiamondCutFacet** | 标准 DiamondCut 接口（升级） | ~0.4 KB | ✅ |
| **DiamondLoupeFacet** | 标准 DiamondLoupe 接口（自省） | ~3.7 KB | ✅ |
| **AdminFacet** | 权限管理、暂停、配置、时间锁、getter | ~13.3 KB | ✅ |
| **ComplianceCoreFacet** | 核心合规检查、转账检查、隔离、批量检查 | ~11.4 KB | ✅ |
| **AssetComplianceFacet** | IAssetCompliance 接口实现 | ~5.6 KB | ✅ |
| **WalletComplianceFacet** | IWalletCompliance 接口实现 | ~5.5 KB | ✅ |

### 1.2 为什么这样拆分

- **AdminFacet**：包含所有状态变量的 getter 函数、角色管理、策略配置、升级时间锁。这些函数本身占用了大量空间（public mapping getter + 复杂逻辑）。
- **ComplianceCoreFacet**：核心业务逻辑（checkTransfer、checkAddressCompliance、quarantine）。这是最主要的业务逻辑，需要独立出来。
- **AssetComplianceFacet**：IAssetCompliance 接口函数，独立出来便于资产发行方直接集成。
- **WalletComplianceFacet**：IWalletCompliance 接口函数，独立出来便于钱包服务商集成。
- **DiamondCutFacet + DiamondLoupeFacet**：EIP-2535 标准 facet，提供升级和自省能力。

---

## 2. Storage 布局设计（AppStorage 模式）

### 2.1 存储位置

```solidity
bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("compliance.engine.diamond.storage");
```

### 2.2 AppStorage 结构

```solidity
struct AppStorage {
    // Core contracts
    RiskRegistry riskRegistry;
    PolicyEngine policyEngine;

    // Stats
    uint256 totalChecks;
    uint256 blockedTransactions;
    uint256 quarantinedTransactions;

    // Quarantine
    uint256 quarantineNonce;
    mapping(bytes32 => QuarantineRecord) quarantinedTxs;
    bytes32[] quarantineList;

    // Check history
    CheckRecord[] checkHistory;
    mapping(address => uint256) addressCheckCount;

    // Rules
    mapping(bytes32 => bool) pausedRules;

    // Issuer policies
    mapping(address => IAssetCompliance.IssuerPolicy) issuerPolicies;
    mapping(address => mapping(uint256 => uint256)) dailySpent;
    mapping(address => uint256) lastTransferTime;

    // Upgrade timelock
    uint256 upgradeTimelockDelay;
    mapping(bytes32 => uint256) upgradeProposals;
    mapping(address => bytes32) implementationToProposal;
}
```

### 2.3 为什么使用 AppStorage

- **统一存储**：所有业务状态集中在一个 struct 中，通过 `diamondStorage()` 函数定位到固定的 storage slot
- **避免冲突**：不同的 Facet 不会意外覆盖彼此的存储
- **兼容升级**：未来新增字段只需在 struct 末尾追加，不影响现有布局
- **delegatecall 安全**：Diamond 的 `fallback` 使用 `delegatecall` 调用 Facet，AppStorage 确保所有 Facet 访问同一个存储上下文

### 2.4 Diamond 标准存储（LibDiamond）

```solidity
struct DiamondStorage {
    mapping(bytes4 => address) facetAddressAndSelectorPosition;  // selector -> facet
    bytes4[] selectorList;                                       // 所有 selector 列表
    address contractOwner;                                      // Diamond 合约 owner
}
```

- 存储在 `keccak256("diamond.standard.diamond.storage")` slot
- 与 `LibComplianceStorage` 的存储完全隔离

---

## 3. 函数到 Facet 的映射表

### 3.1 DiamondCutFacet

| 函数签名 | Selector | 说明 |
|---------|----------|------|
| `diamondCut(FacetCut[],address,bytes)` | `0x1f931c1c` | 添加/替换/移除 facet 函数 |

### 3.2 DiamondLoupeFacet

| 函数签名 | Selector | 说明 |
|---------|----------|------|
| `facets()` | `0x7a0ed627` | 获取所有 facet 及其 selector |
| `facetFunctionSelectors(address)` | `0xadfca15e` | 获取指定 facet 的所有 selector |
| `facetAddresses()` | `0x52ef6b2c` | 获取所有 facet 地址 |
| `facetAddress(bytes4)` | `0xcd98a296` | 获取指定 selector 对应的 facet |

### 3.3 AdminFacet

| 函数签名 | Selector | 说明 |
|---------|----------|------|
| `initialize(address,address,address)` | 动态 | 初始化 Diamond（仅一次） |
| `setRiskRegistry(address)` | 动态 | 设置风险注册表 |
| `setPolicyEngine(address)` | 动态 | 设置策略引擎 |
| `setIssuerPolicy(address,IssuerPolicy)` | 动态 | 设置发行方策略 |
| `pauseRule(bytes32)` | 动态 | 暂停规则 |
| `unpauseRule(bytes32)` | 动态 | 恢复规则 |
| `pause()` | 动态 | 暂停合约 |
| `unpause()` | 动态 | 恢复合约 |
| `proposeUpgrade(address)` | 动态 | 提议升级 |
| `setUpgradeTimelockDelay(uint256)` | 动态 | 设置升级延迟 |
| `grantRoleWithReason(bytes32,address,string)` | 动态 | 授予角色 |
| `revokeRoleWithReason(bytes32,address,string)` | 动态 | 撤销角色 |
| `releaseQuarantine(bytes32)` | 动态 | 释放隔离交易 |
| `riskRegistry()` | 动态 | 获取风险注册表 |
| `policyEngine()` | 动态 | 获取策略引擎 |
| `totalChecks()` | 动态 | 获取总检查数 |
| `blockedTransactions()` | 动态 | 获取阻止交易数 |
| `quarantinedTransactions()` | 动态 | 获取隔离交易数 |
| `quarantineNonce()` | 动态 | 获取隔离 nonce |
| `upgradeTimelockDelay()` | 动态 | 获取升级延迟 |
| `addressCheckCount(address)` | 动态 | 获取地址检查次数 |
| `pausedRules(bytes32)` | 动态 | 获取规则暂停状态 |
| `dailySpent(address,uint256)` | 动态 | 获取日累计转账 |
| `lastTransferTime(address)` | 动态 | 获取最后转账时间 |
| `implementationToProposal(address)` | 动态 | 获取实现到提案映射 |
| `upgradeProposals(bytes32)` | 动态 | 获取提案时间 |
| `getQuarantineRecord(bytes32)` | 动态 | 获取隔离记录 |
| `getQuarantineListLength()` | 动态 | 获取隔离列表长度 |
| `getQuarantineListPaginated(uint256,uint256)` | 动态 | 分页获取隔离列表 |
| `getCheckHistoryLength()` | 动态 | 获取检查历史长度 |
| `getCheckHistoryPaginated(uint256,uint256)` | 动态 | 分页获取检查历史 |
| `getCheckRecord(uint256)` | 动态 | 获取单条检查记录 |
| `checkHistory(uint256)` | 动态 | public mapping getter |
| `quarantinedTxs(bytes32)` | 动态 | public mapping getter |
| `issuerPolicies(address)` | 动态 | public mapping getter |
| `VERSION` | 动态 | 版本常量 |
| `ADMIN_ROLE` | 动态 | 角色常量 |
| `OPERATOR_ROLE` | 动态 | 角色常量 |
| `MAX_HISTORY_SIZE` | 动态 | 常量 |

### 3.4 ComplianceCoreFacet

| 函数签名 | Selector | 说明 |
|---------|----------|------|
| `checkAddressCompliance(address)` | 动态 | 地址合规检查 |
| `checkTransfer(address,address,uint256,address)` | 动态 | 转账合规检查 |
| `checkTransferWithDeadline(address,address,uint256,address,uint256)` | 动态 | 带截止时间的转账检查 |
| `quarantineTransaction(address,address,uint256,address,string)` | 动态 | 手动隔离交易 |
| `batchCheckAddressCompliance(address[])` | 动态 | 批量地址检查 |
| `checkTransactionCompliance(address,address,uint256,address,uint256)` | 动态 | IComplianceEngine 接口 |
| `checkTransactionCompliance(address,address,uint256,address)` | 动态 | IComplianceEngine 接口（简版） |
| `ADMIN_ROLE` | 动态 | 角色常量 |
| `OPERATOR_ROLE` | 动态 | 角色常量 |
| `MAX_HISTORY_SIZE` | 动态 | 常量 |

### 3.5 AssetComplianceFacet

| 函数签名 | Selector | 说明 |
|---------|----------|------|
| `validateTransfer(address,address,uint256,address)` | 动态 | 转账前验证 |
| `preTransferHook(address,address,uint256)` | 动态 | 转账前钩子 |
| `postTransferHook(address,address,uint256,bool)` | 动态 | 转账后钩子 |
| `getAddressRisk(address)` | 动态 | 获取地址风险 |
| `getRiskTier(address)` | 动态 | 获取风险等级 |
| `isSanctioned(address)` | 动态 | 检查是否受制裁 |
| `getIssuerPolicy(address)` | 动态 | 获取发行方策略 |
| `getDailySpent(address,address)` | 动态 | 获取日累计转账 |
| `OPERATOR_ROLE` | 动态 | 角色常量 |

### 3.6 WalletComplianceFacet

| 函数签名 | Selector | 说明 |
|---------|----------|------|
| `validateOperation(address,Operation,address)` | 动态 | 验证操作 |
| `preExecutionHook(address,Operation)` | 动态 | 执行前钩子 |
| `postExecutionHook(address,Operation,bool)` | 动态 | 执行后钩子 |
| `validateBatch(address,Operation[])` | 动态 | 批量验证 |
| `preBatchExecutionHook(address,Operation[])` | 动态 | 批量执行前钩子 |
| `analyzeOperationRisk(Operation)` | 动态 | 分析操作风险 |
| `getWalletPolicy(address)` | 动态 | 获取钱包策略 |
| `getContractRisk(address)` | 动态 | 获取合约风险 |
| `OPERATOR_ROLE` | 动态 | 角色常量 |

---

## 4. 部署流程

### 4.1 部署顺序

```
1. 部署 DiamondCutFacet
2. 部署 DiamondLoupeFacet
3. 部署 AdminFacet
4. 部署 ComplianceCoreFacet
5. 部署 AssetComplianceFacet
6. 部署 WalletComplianceFacet
7. 部署 DiamondComplianceEngine（构造函数传入所有 Facet）
```

### 4.2 构造函数参数

```solidity
constructor(
    address _contractOwner,           // Diamond 合约 owner
    IDiamondCut.FacetCut[] memory _diamondCut,  // 所有 facet 的 selector 列表
    address _init,                     // AdminFacet 地址（用于初始化）
    bytes memory _calldata             // initialize(_riskRegistry, _policyEngine, _admin) 的编码
) payable
```

### 4.3 示例部署脚本（Hardhat/Foundry）

```solidity
// 1. 部署所有 facets
DiamondCutFacet diamondCutFacet = new DiamondCutFacet();
DiamondLoupeFacet diamondLoupeFacet = new DiamondLoupeFacet();
AdminFacet adminFacet = new AdminFacet();
ComplianceCoreFacet coreFacet = new ComplianceCoreFacet();
AssetComplianceFacet assetFacet = new AssetComplianceFacet();
WalletComplianceFacet walletFacet = new WalletComplianceFacet();

// 2. 构建 selector 列表
IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](6);

// DiamondCutFacet
cut[0] = IDiamondCut.FacetCut({
    facetAddress: address(diamondCutFacet),
    action: IDiamondCut.FacetCutAction.Add,
    functionSelectors: getSelectors("DiamondCutFacet")
});

// DiamondLoupeFacet
cut[1] = IDiamondCut.FacetCut({
    facetAddress: address(diamondLoupeFacet),
    action: IDiamondCut.FacetCutAction.Add,
    functionSelectors: getSelectors("DiamondLoupeFacet")
});

// AdminFacet
cut[2] = IDiamondCut.FacetCut({
    facetAddress: address(adminFacet),
    action: IDiamondCut.FacetCutAction.Add,
    functionSelectors: getSelectors("AdminFacet")
});

// ComplianceCoreFacet
cut[3] = IDiamondCut.FacetCut({
    facetAddress: address(coreFacet),
    action: IDiamondCut.FacetCutAction.Add,
    functionSelectors: getSelectors("ComplianceCoreFacet")
});

// AssetComplianceFacet
cut[4] = IDiamondCut.FacetCut({
    facetAddress: address(assetFacet),
    action: IDiamondCut.FacetCutAction.Add,
    functionSelectors: getSelectors("AssetComplianceFacet")
});

// WalletComplianceFacet
cut[5] = IDiamondCut.FacetCut({
    facetAddress: address(walletFacet),
    action: IDiamondCut.FacetCutAction.Add,
    functionSelectors: getSelectors("WalletComplianceFacet")
});

// 3. 编码初始化数据
bytes memory initData = abi.encodeWithSelector(
    AdminFacet.initialize.selector,
    address(riskRegistry),    // 预部署
    address(policyEngine),    // 预部署
    admin                   // 初始 admin 地址
);

// 4. 部署 Diamond
DiamondComplianceEngine diamond = new DiamondComplianceEngine(
    admin,      // _contractOwner
    cut,        // 所有 facet 的 selector 列表
    address(adminFacet),  // _init（用于初始化 delegatecall）
    initData    // 初始化 calldata
);
```

### 4.4 注意事项

1. **初始化只能执行一次**：`AdminFacet.initialize()` 使用 `require(address(s.riskRegistry) == address(0))` 防止重复初始化
2. **Owner 权限**：`DiamondComplianceEngine` 的构造函数设置 `_contractOwner` 为 Diamond 的 owner，只有 owner 可以调用 `diamondCut` 进行升级
3. **AccessControl 状态共享**：所有继承 `AccessControl` 的 Facet 共享 OZ v5 的命名空间存储 (`keccak256("openzeppelin.storage.AccessControl")`)，角色状态跨 Facet 一致
4. **Pausable 状态共享**：同理，`Pausable` 和 `ReentrancyGuard` 的命名空间存储跨 Facet 共享

---

## 5. 关键设计决策

### 5.1 为什么保留 OZ AccessControl / Pausable / ReentrancyGuard？

- **命名空间存储兼容**：OZ v5 的 `AccessControl`、`Pausable`、`ReentrancyGuard` 都使用 `ERC7201` 命名空间存储模式，多个 Facet 继承同一合约时共享同一个 storage slot
- **最小改动**：无需手动重新实现 `_grantRole`、`_checkRole`、`_pause`、`_nonReentrantBefore` 等内部逻辑
- **修饰符可用**：`onlyRole`、`whenNotPaused`、`nonReentrant` 修饰符在每个 Facet 中独立可用

### 5.2 为什么事件定义在每个 Facet 中？

- Solidity 事件不占用合约存储，只产生日志
- 在 `delegatecall` 上下文中，事件由 Diamond 地址发出，对外部观察者无影响
- 每个 Facet 保留自己发出的事件定义，确保 ABI 兼容性

### 5.3 为什么 getter 集中在 AdminFacet？

- 原合约中大量 `public` 状态变量（`riskRegistry`、`totalChecks`、`issuerPolicies` 等）会自动生成 getter 函数
- 在 Diamond 中，这些 getter 需要手动实现，因为它们不是直接的状态变量
- 集中管理便于维护和验证

### 5.4 为什么 Diamond 不使用 UUPS？

- Diamond 本身通过 `diamondCut` 支持升级，无需 UUPS 代理模式
- 原合约的 `upgradeTimelockDelay` 逻辑保留在 `AdminFacet` 中，作为额外的安全层（虽然不能直接限制 `diamondCut`，但可用于其他逻辑）
- 如果仍需要保留 `authorizeUpgrade` 逻辑，可以在 `DiamondCutFacet` 中集成时间锁检查

---

## 6. 合约大小验证

```
LibDiamond.sol:              ~6.4 KB
LibComplianceStorage.sol:    ~1.9 KB
DiamondComplianceEngine.sol: ~1.1 KB
DiamondCutFacet.sol:         ~0.4 KB
DiamondLoupeFacet.sol:       ~3.7 KB
AdminFacet.sol:              ~13.3 KB
ComplianceCoreFacet.sol:   ~11.4 KB
AssetComplianceFacet.sol:    ~5.6 KB
WalletComplianceFacet.sol:   ~5.5 KB
```

所有 Facet 均小于 24KB 限制。✅

---

## 7. 迁移指南

### 7.1 对于现有集成者

- **Diamond 地址作为 ComplianceEngine**：集成者只需将原 `ComplianceEngine` 地址替换为 `DiamondComplianceEngine` 地址
- **ABI 兼容**：所有外部函数签名、事件定义、错误定义保持不变
- **无需重新部署 RiskRegistry / PolicyEngine**：只需在 `initialize` 中传入现有地址

### 7.2 对于前端 / SDK

- 继续使用原 `ComplianceEngine` 的 ABI，但合约地址改为 Diamond 地址
- 如果需要查询 facet 结构，使用 `DiamondLoupeFacet` 的函数（可选）

### 7.3 对于升级

- 使用 `DiamondCutFacet.diamondCut()` 替换或添加新的 Facet
- 支持热升级：无需暂停业务，逐个替换 Facet
- 升级权限由 `contractOwner` 控制

---

## 8. 文件结构

```
contracts/
├── DiamondComplianceEngine.sol          # Diamond 主合约（代理 + fallback）
├── interfaces/
│   ├── IDiamond.sol                     # Diamond 标准接口
│   ├── IDiamondCut.sol                  # DiamondCut 接口
│   ├── IDiamondLoupe.sol                # DiamondLoupe 接口
│   ├── IComplianceEngine.sol            # 原接口（不变）
│   ├── IAssetCompliance.sol             # 原接口（不变）
│   └── IWalletCompliance.sol            # 原接口（不变）
├── libraries/
│   ├── LibDiamond.sol                   # Diamond 标准库
│   └── LibComplianceStorage.sol         # AppStorage 共享存储库
├── facets/
│   ├── DiamondCutFacet.sol              # 升级 Facet
│   ├── DiamondLoupeFacet.sol            # 自省 Facet
│   ├── AdminFacet.sol                   # 管理 Facet
│   ├── ComplianceCoreFacet.sol          # 核心合规 Facet
│   ├── AssetComplianceFacet.sol         # 资产合规 Facet
│   └── WalletComplianceFacet.sol        # 钱包合规 Facet
```

---

## 9. 安全注意事项

1. **初始化保护**：`initialize()` 只能执行一次，防止存储被重置
2. **DiamondCut 权限**：只有 `contractOwner` 可以调用 `diamondCut`，确保升级权限受控
3. **AccessControl 默认角色**：`DEFAULT_ADMIN_ROLE` 在初始化时授予 `_admin`，建议随后设置多签或治理合约
4. **Storage Gap**：AppStorage 模式下无需 `__gap`，因为新增字段通过 struct 追加实现
5. **Selector 冲突**：部署前需验证所有 Facet 的 selector 无冲突

---

## 10. 参考标准

- [EIP-2535: Diamonds, Multi-Facet Proxy](https://eips.ethereum.org/EIPS/eip-2535)
- [Diamond Standard 参考实现](https://github.com/mudgen/diamond-3-hardhat)
- OpenZeppelin Contracts v5.0 (ERC7201 命名空间存储)

---

*文档版本: 1.0.0*
*最后更新: 2026-07-01*
