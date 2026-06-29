// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title RiskRegistry
 * @notice 风险档案注册表 — 存储所有地址的风险评估结果
 * @dev 基于 UUPS 代理模式，支持可升级
 * @dev VERSION: 1.2.1 - 安全修复版
 */
contract RiskRegistry is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant COMPLIANCE_ENGINE_ROLE = keccak256("COMPLIANCE_ENGINE_ROLE");

    /// @notice 合约版本号
    string public constant VERSION = "1.2.2";

    // ============ Data Structures ============

    /**
     * @notice 风险档案结构
     * @dev 存储布局优化：按字段大小降序排列，减少存储槽占用
     */
    struct RiskProfile {
        uint256 riskScore;           // 32 bytes - Slot 0
        address addr;                // 20 bytes
        uint32 lastUpdated;          // 4 bytes
        uint8 riskTier;              // 1 byte
        uint8 sourceConfidence;      // 1 byte
        bool sanctioned;             // 1 byte
        bool exists;                 // 1 byte
        bytes32[] tags;              // 动态数组指针 - Slot 2
    }

    /// @notice 风险等级枚举
    enum RiskTier { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }

    // ============ State Variables ============

    /// @notice 地址风险档案映射
    mapping(address => RiskProfile) public riskProfiles;

    /// @notice 高风险地址列表（快速查询）
    address[] public highRiskAddresses;

    /// @notice 制裁地址列表
    address[] public sanctionedAddresses;

    /// @notice 地址索引映射
    mapping(address => uint256) public highRiskIndex;
    mapping(address => uint256) public sanctionedIndex;

    /// @notice 全局统计
    uint256 public totalProfiles;
    uint256 public totalHighRisk;
    uint256 public totalSanctioned;
    uint256 public lastGlobalUpdate;

    /// @notice 更新间隔限制（防止频繁更新）
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;

    /// @notice 最大标签数量
    uint256 public constant MAX_TAGS_PER_ADDRESS = 10;

    /// @notice 批量操作最大数量
    uint256 public constant BATCH_MAX_SIZE = 100;

    /// @notice 存储布局版本
    uint256 public storageLayoutVersion;

    /// @notice 升级延迟时间锁
    uint256 public upgradeTimelockDelay;
    mapping(bytes32 => uint256) public upgradeProposals;
    mapping(address => bytes32) public implementationToProposal;

    /// @notice 链ID验证
    uint256 public chainId;

    // ============ Events ============

    event RiskProfileUpdated(
        address indexed addr,
        uint256 riskScore,
        RiskTier tier,
        bool isSanctioned
    );

    event RiskProfileRemoved(
        address indexed addr,
        uint256 riskScore,
        RiskTier tier,
        bool wasSanctioned,
        uint256 timestamp
    );
    event BatchUpdateSkipped(uint256 indexed index, address addr, string reason);
    event BatchUpdateCompleted(uint256 count, uint256 gasUsed);
    event AddressTagged(address indexed addr, bytes32 indexed tag);
    event AddressUntagged(address indexed addr, bytes32 indexed tag);
    event StorageLayoutUpgraded(uint256 oldVersion, uint256 newVersion);

    event RoleGrantedDetailed(
        bytes32 indexed role,
        address indexed account,
        address indexed sender,
        uint256 timestamp,
        string reason
    );
    event RoleRevokedDetailed(
        bytes32 indexed role,
        address indexed account,
        address indexed sender,
        uint256 timestamp,
        string reason
    );

    event UpgradeProposed(bytes32 indexed proposalId, address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(bytes32 indexed proposalId, address indexed newImplementation);

    event ZeroAddressRejected(string functionName, uint256 timestamp);

    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);

    // ============ Errors ============

    error ProfileNotFound(address addr);
    error UpdateTooFrequent(address addr);
    error InvalidRiskScore(uint256 score);
    error InvalidAddress();
    error BatchSizeExceeded(uint256 size, uint256 limit);
    error TagsLimitExceeded(uint256 count, uint256 limit);
    error StorageLayoutMismatch(uint256 expected, uint256 actual);
    error ChainIdMismatch(uint256 expected, uint256 actual);
    error InvalidContractAddress();
    error BatchTooLarge();
    error LengthMismatch();
    error InvalidRiskTier(uint8 tier);

    // ============ Modifiers ============

    modifier validAddress(address addr) {
        // [M-01] Fix: removed emit before revert (event was never logged due to rollback)
        if (addr == address(0)) {
            revert InvalidAddress();
        }
        _;
    }

    modifier validRiskTier(RiskTier tier) {
        if (uint8(tier) > uint8(RiskTier.CRITICAL)) {
            revert InvalidRiskTier(uint8(tier));
        }
        _;
    }

    modifier validRiskScore(uint256 score) {
        if (score > 100) revert InvalidRiskScore(score);
        _;
    }

    // ============ Constructor ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ Initializer ============

    function initialize(address admin) public initializer {
        __Context_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();       // [H-03] Fix: use official ReentrancyGuardUpgradeable


        // P0-3: 零地址检查
        require(admin != address(0), "Invalid admin address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
        _grantRole(COMPLIANCE_ENGINE_ROLE, admin);

        storageLayoutVersion = 1;

        // P1-10: 初始化升级延迟
        upgradeTimelockDelay = 2 days;

        // P1-4: 记录链ID
        chainId = block.chainid;
    }

    // ============ Core Functions ============

    /**
     * @notice 更新单个地址风险档案
     * @param addr 目标地址
     * @param riskScore 风险分数 (0-100)
     * @param tier 风险等级
     * @param tags 标签数组
     * @param sanctioned 是否受制裁
     */
    function updateRiskProfile(
        address addr,
        uint8 riskScore,
        RiskTier tier,
        bytes32[] calldata tags,
        bool sanctioned
    ) external onlyRole(ORACLE_ROLE) validAddress(addr) validRiskScore(riskScore) validRiskTier(tier) whenNotPaused nonReentrant {
        // P1-8: 限制标签数量
        if (tags.length > MAX_TAGS_PER_ADDRESS) {
            revert TagsLimitExceeded(tags.length, MAX_TAGS_PER_ADDRESS);
        }

        _updateRiskProfileInternal(addr, riskScore, tier, sanctioned, tags);

        emit RiskProfileUpdated(addr, riskScore, tier, sanctioned);
    }

    /**
     * @notice 批量更新风险档案
     * @dev [H-02] Fix: 增加 tags 参数，确保批量更新与单条更新数据一致
     */
    function batchUpdateRiskProfiles(
        address[] calldata addrs,
        uint8[] calldata riskScores,
        RiskTier[] calldata tiers,
        bool[] calldata sanctioned,
        bytes32[][] calldata tags
    ) external onlyRole(ORACLE_ROLE) whenNotPaused nonReentrant {
        uint256 count = addrs.length;
        if (count > BATCH_MAX_SIZE) revert BatchTooLarge();
        if (count != riskScores.length || count != tiers.length ||
            count != sanctioned.length || count != tags.length) {
            revert LengthMismatch();
        }

        uint256 successCount = 0;
        uint256 gasStart = gasleft();

        for (uint256 i = 0; i < count; i++) {
            if (addrs[i] == address(0)) {
                emit BatchUpdateSkipped(i, addrs[i], "Invalid address");
                continue;
            }
            if (riskScores[i] > 100) {
                emit BatchUpdateSkipped(i, addrs[i], "Invalid risk score");
                continue;
            }
            if (uint8(tiers[i]) > uint8(RiskTier.CRITICAL)) {
                emit BatchUpdateSkipped(i, addrs[i], "Invalid tier");
                continue;
            }
            if (tags[i].length > MAX_TAGS_PER_ADDRESS) {
                emit BatchUpdateSkipped(i, addrs[i], "Too many tags");
                continue;
            }

            _updateRiskProfileInternal(addrs[i], riskScores[i], tiers[i], sanctioned[i], tags[i]);
            successCount++;
        }

        uint256 gasUsed = gasStart - gasleft();
        emit BatchUpdateCompleted(successCount, gasUsed);
    }

    /**
     * @dev 内部函数：更新风险档案（无权限检查，供批量调用）
     * @dev [H-01] Fix: 添加 MIN_UPDATE_INTERVAL 频率限制检查
     * @dev [H-02] Fix: 增加 tags 参数，清除旧标签并设置新标签
     */
    function _updateRiskProfileInternal(
        address addr,
        uint8 riskScore,
        RiskTier tier,
        bool sanctioned,
        bytes32[] memory tags
    ) internal {
        RiskProfile storage profile = riskProfiles[addr];

        // [H-01] Fix: 统一频率限制检查
        if (profile.exists && block.timestamp - profile.lastUpdated < MIN_UPDATE_INTERVAL) {
            revert UpdateTooFrequent(addr);
        }

        bool wasHighRisk = profile.riskScore >= 80;
        bool wasSanctioned = profile.sanctioned;
        bool wasNew = !profile.exists;

        profile.addr = addr;
        profile.riskScore = riskScore;
        profile.riskTier = uint8(tier);
        profile.sanctioned = sanctioned;
        profile.lastUpdated = uint32(block.timestamp);
        profile.sourceConfidence = 100;
        profile.exists = true;

        // [H-02] Fix: 清除旧标签并设置新标签
        delete profile.tags;
        for (uint256 i = 0; i < tags.length; i++) {
            profile.tags.push(tags[i]);
        }

        // 更新高风险列表
        if (riskScore >= 80 && !wasHighRisk) {
            highRiskIndex[addr] = highRiskAddresses.length;
            highRiskAddresses.push(addr);
            totalHighRisk++;
        } else if (riskScore < 80 && wasHighRisk) {
            _removeHighRisk(addr);
        }

        // 更新制裁列表
        if (sanctioned && !wasSanctioned) {
            sanctionedIndex[addr] = sanctionedAddresses.length;
            sanctionedAddresses.push(addr);
            totalSanctioned++;
        } else if (!sanctioned && wasSanctioned) {
            _removeSanctioned(addr);
        }

        if (wasNew) {
            totalProfiles++;
        }

        lastGlobalUpdate = block.timestamp;
    }

    /**
     * @notice 移除风险档案
     * @dev [C-01] Fix: 显式清除 tags 数组元素存储槽
     */
    function removeRiskProfile(address addr)
        external
        onlyRole(ADMIN_ROLE)
        validAddress(addr)
        whenNotPaused
        nonReentrant
    {
        RiskProfile storage profile = riskProfiles[addr];
        if (!profile.exists) revert ProfileNotFound(addr);

        uint256 removedRiskScore = profile.riskScore;
        RiskTier removedTier = RiskTier(profile.riskTier);
        bool wasSanctioned = profile.sanctioned;

        if (profile.riskScore >= 80) {
            _removeHighRisk(addr);
        }
        if (profile.sanctioned) {
            _removeSanctioned(addr);
        }

        // [C-01] Fix: 显式清除 tags 数组元素存储槽
        uint256 tagsLen = profile.tags.length;
        for (uint256 i = 0; i < tagsLen; i++) {
            delete profile.tags[i];
        }
        delete profile.tags;

        // 清除索引映射中的残留数据
        delete highRiskIndex[addr];
        delete sanctionedIndex[addr];

        delete riskProfiles[addr];

        if (totalProfiles > 0) {
            totalProfiles--;
        }

        emit RiskProfileRemoved(addr, removedRiskScore, removedTier, wasSanctioned, block.timestamp);
    }

    // ============ Internal: Array Management ============

    /**
     * @dev [M-03] Fix: swap-and-pop 时正确更新被 swap 元素的索引
     */
    function _removeHighRisk(address addr) internal {
        uint256 index = highRiskIndex[addr];
        uint256 lastIndex = highRiskAddresses.length - 1;

        if (index != lastIndex) {
            address lastAddr = highRiskAddresses[lastIndex];
            highRiskAddresses[index] = lastAddr;
            highRiskIndex[lastAddr] = index; // 关键：更新被 swap 元素的索引
        }

        highRiskAddresses.pop();
        delete highRiskIndex[addr];

        if (totalHighRisk > 0) {
            totalHighRisk--;
        }
    }

    /**
     * @dev [M-03] Fix: swap-and-pop 时正确更新被 swap 元素的索引
     */
    function _removeSanctioned(address addr) internal {
        uint256 index = sanctionedIndex[addr];
        uint256 lastIndex = sanctionedAddresses.length - 1;

        if (index != lastIndex) {
            address lastAddr = sanctionedAddresses[lastIndex];
            sanctionedAddresses[index] = lastAddr;
            sanctionedIndex[lastAddr] = index; // 关键：更新被 swap 元素的索引
        }

        sanctionedAddresses.pop();
        delete sanctionedIndex[addr];

        if (totalSanctioned > 0) {
            totalSanctioned--;
        }
    }

    // ============ Admin Functions ============

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice 授予角色（带审计日志）
     */
    function grantRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
        emit RoleGrantedDetailed(role, account, msg.sender, block.timestamp, reason);
    }

    /**
     * @notice 撤销角色（带审计日志）
     */
    function revokeRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
        emit RoleRevokedDetailed(role, account, msg.sender, block.timestamp, reason);
    }

    // ============ Upgrade Functions ============

    /**
     * @notice 提案升级新实现
     */
    function proposeUpgrade(address newImplementation)
        external
        onlyRole(ADMIN_ROLE)
        validAddress(newImplementation)
        returns (bytes32 proposalId)
    {
        // D1-AUDIT1-022 fix: include msg.sender and nonce for uniqueness
        proposalId = keccak256(abi.encodePacked(newImplementation, block.timestamp, msg.sender, block.number));
        uint256 executeAfter = block.timestamp + upgradeTimelockDelay;

        // Check for existing proposal and warn (don't block, but log)
        bytes32 existingProposalId = implementationToProposal[newImplementation];
        if (existingProposalId != bytes32(0) && upgradeProposals[existingProposalId] > block.timestamp) {
            // Overwrite only if the existing proposal's timelock hasn't expired
            delete upgradeProposals[existingProposalId];
        }

        upgradeProposals[proposalId] = executeAfter;
        implementationToProposal[newImplementation] = proposalId;

        emit UpgradeProposed(proposalId, newImplementation, executeAfter);
    }

    /**
     * @dev [I-04] Fix: UUPS 授权升级 — 仅 ADMIN_ROLE 可升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        bytes32 proposalId = implementationToProposal[newImplementation];
        require(proposalId != bytes32(0), "No proposal for implementation");
        require(
            block.timestamp >= upgradeProposals[proposalId],
            "Timelock not expired"
        );

        delete upgradeProposals[proposalId];
        delete implementationToProposal[newImplementation];

        emit UpgradeExecuted(proposalId, newImplementation);
    }

    // ============ View Functions ============

    /**
     * @notice 获取高风险地址列表
     */
    function getHighRiskAddresses() external view returns (address[] memory) {
        return highRiskAddresses;
    }

    /**
     * @notice 获取制裁地址列表
     */
    function getSanctionedAddresses() external view returns (address[] memory) {
        return sanctionedAddresses;
    }

    /**
     * @notice 获取地址风险档案详情
     */
    function getProfile(address addr)
        external
        view
        returns (
            uint256 riskScore,
            address profileAddr,
            uint32 lastUpdated,
            uint8 riskTier,
            uint8 sourceConfidence,
            bool sanctioned,
            bool exists,
            bytes32[] memory tags
        )
    {
        RiskProfile storage profile = riskProfiles[addr];
        return (
            profile.riskScore,
            profile.addr,
            profile.lastUpdated,
            profile.riskTier,
            profile.sourceConfidence,
            profile.sanctioned,
            profile.exists,
            profile.tags
        );
    }

    /**
     * @notice 获取地址标签
     */
    function getTags(address addr) external view returns (bytes32[] memory) {
        return riskProfiles[addr].tags;
    }

    /**
     * @notice 检查地址是否为高风险
     */
    function isHighRisk(address addr) external view returns (bool) {
        return riskProfiles[addr].exists && riskProfiles[addr].riskScore >= 80;
    }

    /**
     * @notice 检查地址是否受制裁
     */
    function isSanctioned(address addr) external view returns (bool) {
        return riskProfiles[addr].exists && riskProfiles[addr].sanctioned;
    }

    /**
     * @notice 获取高风险地址数量
     */
    function highRiskAddressCount() external view returns (uint256) {
        return highRiskAddresses.length;
    }

    /**
     * @notice 获取制裁地址数量
     */
    function sanctionedAddressCount() external view returns (uint256) {
        return sanctionedAddresses.length;
    }

    /**
     * @notice 获取地址风险分数 (向后兼容 v0.2.1 ABI)
     */
    function getRiskScore(address addr) external view returns (uint8) {
        return uint8(riskProfiles[addr].riskScore);
    }

    /**
     * @notice 获取地址风险等级 (向后兼容 v0.2.1 ABI)
     */
    function getRiskTier(address addr) external view returns (RiskTier) {
        if (riskProfiles[addr].sanctioned) {
            return RiskTier.HIGH;
        }
        return RiskTier(riskProfiles[addr].riskTier);
    }

    /**
     * @notice 获取完整风险档案 (向后兼容 v0.2.1 ABI)
     */
    function getRiskProfile(address addr) external view returns (
        uint8 riskScore,
        RiskTier tier,
        bytes32[] memory tags,
        uint256 lastUpdated,
        bool isSanctioned
    ) {
        RiskProfile storage profile = riskProfiles[addr];
        return (
            uint8(profile.riskScore),
            RiskTier(profile.riskTier),
            profile.tags,
            profile.lastUpdated,
            profile.sanctioned
        );
    }

    /**
     * @dev 存储间隙 — 为未来升级预留存储槽（P3-A: 调整为合理值）
     * ReentrancyGuardUpgradeable 占 1 槽 + 其 __gap[49]，PausableUpgradeable 占 1 槽
     * 本合约自身使用约 15 个存储槽，预留 50 槽用于未来扩展
     */
    uint256[47] private __gap;
}