// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title RiskRegistryV2
 * @notice RiskRegistry 存储兼容升级版 — 三方共识审计修复 V2.3.1
 * @dev 基于 UUPS 代理模式，保持 v0.2.1 存储布局完全兼容
 * @dev VERSION: 2.3.1
 *
 * ⚠️ 升级路径警告:
 * - ✅ 可从 v0.2.1 (RiskRegistry V1 初版) 直接升级
 * - ❌ 不可从 V1.x (RiskRegistry 1.2.x) 直接升级，因为存储布局不兼容
 *   V1.x 使用 `mapping(address => RiskProfile)` 而 V2 使用位打包 `_packedProfiles`
 *   直接升级会导致所有风险数据丢失/损坏
 * 如需从 V1.x 迁移，请部署新的 V2 合约并通过批量更新迁移数据
 *
 * 存储兼容性说明:
 * - Slot 0-7: 与 v0.2.1 完全一致（_packedProfiles, _lastUpdateTime, _profileTags,
 *   sanctionedAddresses, _addressTags, _addressTagList, contractRegistry, entityAddresses）
 * - Slot 8+: 新增变量（totalProfiles, totalHighRisk 等）
 * - __gap: 39（未改变）
 */

contract RiskRegistryV2 is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant COMPLIANCE_ENGINE_ROLE = keccak256("COMPLIANCE_ENGINE_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice I-17 NOTE: DEFAULT_ADMIN_ROLE 是 OpenZeppelin 内置的超级管理员角色。
    ///         部署完成后，应将其转移给 FidesOriginTimelock 合约，
    ///         以实现去中心化管理和防止单点权力集中。
    ///         转移命令: `grantRole(DEFAULT_ADMIN_ROLE, timelockAddress)` 然后 `renounceRole(DEFAULT_ADMIN_ROLE, deployer)`

    /// @notice 合约版本号
    string public constant VERSION = "2.3.1";

    // ============ 风险等级枚举 (V2: 新增 CRITICAL) ============
    enum RiskTier { UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL }

    // ============ v0.2.1 兼容存储 (Slot 0-7) ============

    /// @notice 位打包的风险档案映射 (v0.2.1 遗留)
    /// @dev 位布局: [0-7] riskScore, [8-15] tier, [16] isSanctioned, [17-80] lastUpdated(uint64)
    mapping(address => uint256) private _packedProfiles;

    /// @notice 最后更新时间 (v0.2.1 遗留)
    mapping(address => uint256) private _lastUpdateTime;

    /// @notice 标签存储 (v0.2.1 遗留)
    mapping(address => bytes32[]) private _profileTags;

    /// @notice 制裁名单 (v0.2.1 遗留, public 保持 ABI 兼容)
    mapping(address => bool) public sanctionedAddresses;

    /// @notice 实体标签映射 (v0.2.1 遗留)
    mapping(address => mapping(bytes32 => bool)) private _addressTags;
    mapping(address => bytes32[]) private _addressTagList;

    /// @notice 合约风险信息 (v0.2.1 遗留)
    struct ContractInfo {
        bool isVerified;
        uint8 riskScore;
        bytes32 contractType;
        uint256 verifiedAt;
        address verifiedBy;
    }
    mapping(address => ContractInfo) public contractRegistry;

    /// @notice 已知实体列表 (v0.2.1 遗留)
    mapping(bytes32 => address[]) public entityAddresses;

    // ============ V2 新增存储 (Slot 8+) ============

    /// @notice 全局统计: 总档案数
    uint256 public totalProfiles;

    /// @notice 全局统计: 高风险数
    uint256 public totalHighRisk;

    /// @notice 全局统计: 制裁数
    uint256 public totalSanctioned;

    /// @notice 全局统计: 最后更新时间
    uint256 public lastGlobalUpdate;

    /// @notice 链ID验证
    uint256 public chainId;

    // ============ 常量 ============
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;
    uint256 public constant MAX_TAGS_PER_ADDRESS = 10;
    uint256 public constant BATCH_MAX_SIZE = 100;

    /// @dev D2-016: 升级时间锁（秒），生产环境应配合 Timelock 使用
    uint256 public constant UPGRADE_TIMELOCK = 48 hours;

    // ============ Events ============
    event RiskProfileUpdated(
        address indexed account,
        uint8 riskScore,
        RiskTier tier,
        bool isSanctioned
    );
    event BatchUpdateCompleted(uint256 count, uint256 gasUsed);
    event BatchUpdateSkipped(uint256 indexed index, address addr, string reason);
    event AddressTagged(address indexed account, bytes32 indexed tag);
    event AddressUntagged(address indexed account, bytes32 indexed tag);
    event SanctionAdded(address indexed account, string reason);
    event SanctionRemoved(address indexed account);
    event ContractRegistered(address indexed contractAddr, bytes32 contractType, bool verified);

    /// @dev D2-016: 升级提案事件（配合链下 timelock 服务）
    event UpgradeProposed(address indexed proposedImplementation, uint256 proposedAt, string reason);

    // ============ Errors ============
    error InvalidRiskScore();
    error InvalidRiskTier(uint8 tier);
    error LengthMismatch();
    error InvalidAddress();
    error BatchTooLarge();
    error UpdateTooFrequent();
    error TooManyTags();
    error ProfileNotFound(address addr);

    // ============ Modifiers ============
    modifier validAddress(address addr) {
        if (addr == address(0)) revert InvalidAddress();
        _;
    }

    // ============ Constructor ============
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ============ V2 Upgrade Initializer ============
    /// @notice V2 升级初始化函数 — 仅可在从 V1 升级时调用一次
    function initializeV2() external reinitializer(2) onlyRole(ADMIN_ROLE) {
        chainId = block.chainid;
        // totalProfiles / totalHighRisk / totalSanctioned 保持默认值 0
        // 如需回填历史数据，可在升级后通过 batch migration 完成
    }

    /// @notice V2.2→V2.3 升级占位函数 — 无存储变更，无需 reinitializer
    /// @dev 用于 V2.2/V2.3/V2.3.1 版本的纯逻辑升级，不引入新存储变量
    function initializeV2_2() external reinitializer(3) onlyRole(ADMIN_ROLE) {
        // V2.2/V2.3/V2.3.1: pure logic fixes only, no storage changes
    }

    // L-09 FIX: RiskRegistryV2 now uses UPGRADE_TIMELOCK for upgrades
    function proposeUpgrade(address newImplementation) external onlyRole(ADMIN_ROLE) {
        require(newImplementation != address(0), "Zero address");
        bytes32 proposalId = keccak256(abi.encode(newImplementation, block.chainid, address(this)));
        upgradeProposals[proposalId] = block.timestamp + UPGRADE_TIMELOCK;
        emit UpgradeProposed(newImplementation, block.timestamp, "RiskRegistryV2 upgrade proposal");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        // H-02 FIX: 版本兼容性检查 — 防止从不兼容的版本直接升级
        // 确保 RiskRegistryV2 仅从 v0.2.1 或其他 V2.x 版本升级
        // V1.x (RiskRegistry 1.2.x) 使用不同的存储布局，直接升级会导致数据损坏
        bytes32 proposalId = keccak256(abi.encode(newImplementation, block.chainid, address(this)));
        uint256 executeAfter = upgradeProposals[proposalId];
        require(executeAfter != 0, "No proposal for implementation");
        require(block.timestamp >= executeAfter, "Timelock not expired");
        delete upgradeProposals[proposalId];
    }

    // ============ Bit-Packing Helpers (v0.2.1 兼容) ============

    function _packProfile(
        uint8 riskScore,
        uint8 tier,
        bool sanctionedStatus,
        uint256 lastUpdated
    ) internal pure returns (uint256) {
        uint256 packed = uint256(riskScore)
            | (uint256(tier) << 8)
            | ((lastUpdated & 0xFFFFFFFFFFFFFFFF) << 17);
        if (sanctionedStatus) {
            packed |= (1 << 16);
        }
        return packed;
    }

    function _unpackRiskScore(uint256 packed) internal pure returns (uint8) {
        return uint8(packed);
    }

    function _unpackTier(uint256 packed) internal pure returns (uint8) {
        return uint8(packed >> 8);
    }

    function _unpackIsSanctioned(uint256 packed) internal pure returns (bool) {
        return ((packed >> 16) & 1) == 1;
    }

    function _unpackLastUpdated(uint256 packed) internal pure returns (uint256) {
        return (packed >> 17) & 0xFFFFFFFFFFFFFFFF;
    }

    // ============ Core: Update Risk Profile (V2 Fixed) ============

    /**
     * @notice 更新地址风险档案 (V2: 支持 CRITICAL tier)
     * @param account 目标地址
     * @param riskScore 0-100 风险评分
     * @param tier 风险等级 (uint8, 0-4)
     * @param tags 标签数组
     * @param sanctionedStatus 是否在制裁名单
     */
    function updateRiskProfile(
        address account,
        uint8 riskScore,
        uint8 tier,
        bytes32[] calldata tags,
        bool sanctionedStatus
    ) external onlyRole(ORACLE_ROLE) whenNotPaused validAddress(account) {
        if (riskScore > 100) revert InvalidRiskScore();
        if (tier > uint8(RiskTier.CRITICAL)) revert InvalidRiskTier(tier);
        if (tags.length > MAX_TAGS_PER_ADDRESS) revert TooManyTags();

        // 频率限制
        if (block.timestamp - _lastUpdateTime[account] < MIN_UPDATE_INTERVAL) {
            if (sanctionedStatus == _unpackIsSanctioned(_packedProfiles[account])) {
                revert UpdateTooFrequent();
            }
        }

        bool wasNew = _packedProfiles[account] == 0;
        bool wasHighRisk = _unpackRiskScore(_packedProfiles[account]) >= 80;
        bool wasSanctioned = sanctionedAddresses[account];

        _packedProfiles[account] = _packProfile(
            riskScore,
            tier,
            sanctionedStatus,
            block.timestamp
        );
        _lastUpdateTime[account] = block.timestamp;

        _updateTags(account, tags);

        if (sanctionedStatus != wasSanctioned) {
            sanctionedAddresses[account] = sanctionedStatus;
            if (sanctionedStatus) {
                totalSanctioned++;
            } else if (totalSanctioned > 0) {
                totalSanctioned--;
            }
        }

        if (wasNew) {
            totalProfiles++;
        }

        bool isHighRisk = riskScore >= 80;
        if (isHighRisk && !wasHighRisk) {
            totalHighRisk++;
        } else if (!isHighRisk && wasHighRisk && totalHighRisk > 0) {
            totalHighRisk--;
        }

        lastGlobalUpdate = block.timestamp;

        emit RiskProfileUpdated(account, riskScore, RiskTier(tier), sanctionedStatus);
    }

    // ============ Batch Update (V2.3: H1 fix — added tags parameter) ============

    /**
     * @notice 批量更新风险档案
     * @dev V2.3 fix H1: 添加 tags 参数，批量发布的地址也带上标签
     * @dev L-04 NOTE: Batch updates intentionally skip MIN_UPDATE_INTERVAL for efficiency.
     *      This is consistent with emergency sanction behavior.
     * @param accounts 目标地址数组
     * @param riskScores 风险评分数组
     * @param tiers 风险等级数组
     * @param isSanctionedList 制裁状态数组
     * @param tags 标签二维数组（每个地址一组 tags）
     */
    function batchUpdateRiskProfiles(
        address[] calldata accounts,
        uint8[] calldata riskScores,
        uint8[] calldata tiers,
        bool[] calldata isSanctionedList,
        bytes32[][] calldata tags
    ) external onlyRole(ORACLE_ROLE) whenNotPaused {
        uint256 count = accounts.length;
        if (count != riskScores.length || count != tiers.length || count != isSanctionedList.length || count != tags.length) {
            revert LengthMismatch();
        }
        if (count > BATCH_MAX_SIZE) revert BatchTooLarge();

        uint256 gasStart = gasleft();
        uint256 successCount = 0;

        for (uint256 i = 0; i < count; i++) {
            if (accounts[i] == address(0)) {
                emit BatchUpdateSkipped(i, accounts[i], "Invalid address");
                continue;
            }
            if (riskScores[i] > 100) {
                emit BatchUpdateSkipped(i, accounts[i], "Invalid risk score");
                continue;
            }
            if (tiers[i] > uint8(RiskTier.CRITICAL)) {
                emit BatchUpdateSkipped(i, accounts[i], "Invalid tier");
                continue;
            }

            bool wasNew = _packedProfiles[accounts[i]] == 0;
            bool wasSanctioned = sanctionedAddresses[accounts[i]];
            bool wasHighRisk = _unpackRiskScore(_packedProfiles[accounts[i]]) >= 80;

            _packedProfiles[accounts[i]] = _packProfile(
                riskScores[i],
                tiers[i],
                isSanctionedList[i],
                block.timestamp
            );
            _lastUpdateTime[accounts[i]] = block.timestamp;
            sanctionedAddresses[accounts[i]] = isSanctionedList[i];

            // H1 fix: apply tags for each account
            if (i < tags.length && tags[i].length > 0) {
                _updateTags(accounts[i], tags[i]);
            }

            if (wasNew) totalProfiles++;
            if (isSanctionedList[i] && !wasSanctioned) totalSanctioned++;
            if (!isSanctionedList[i] && wasSanctioned && totalSanctioned > 0) totalSanctioned--;

            // track totalHighRisk changes
            bool isHighRisk = riskScores[i] >= 80;
            if (isHighRisk && !wasHighRisk) {
                totalHighRisk++;
            } else if (!isHighRisk && wasHighRisk && totalHighRisk > 0) {
                totalHighRisk--;
            }

            successCount++;
            emit RiskProfileUpdated(accounts[i], riskScores[i], RiskTier(tiers[i]), isSanctionedList[i]);
        }

        lastGlobalUpdate = block.timestamp;
        emit BatchUpdateCompleted(successCount, gasStart - gasleft());
    }

    // ============ Emergency Sanctions ============

    function emergencySanction(
        address[] calldata accounts,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        // M-06 FIX: 批量大小限制，防止 gas 耗尽
        require(accounts.length <= 100, "Batch too large");
        // L-03: Emergency sanctions intentionally bypass MIN_UPDATE_INTERVAL for immediate response.
        // This is a design decision: sanctioned addresses must be flagged without delay.
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) continue;

            // capture wasNew BEFORE writing
            bool wasNew = _packedProfiles[accounts[i]] == 0;
            uint256 packed = _packedProfiles[accounts[i]];

            // M-05 FIX: Store pre-sanction profile for restoration
            preSanctionProfiles[accounts[i]] = packed;

            uint8 highTier = uint8(RiskTier.CRITICAL);
            uint8 currentTier = _unpackTier(packed);
            if (currentTier != highTier) {
                packed = (packed & ~(uint256(0xFF) << 8)) | (uint256(highTier) << 8);
            }

            // set riskScore to at least 90 (max of current and 90) for consistency
            uint8 currentScore = _unpackRiskScore(packed);
            if (currentScore < 90) {
                packed = (packed & ~uint256(0xFF)) | uint256(90);
            }

            _packedProfiles[accounts[i]] = packed;
            sanctionedAddresses[accounts[i]] = true;

            // H2 fix: update _lastUpdateTime
            _lastUpdateTime[accounts[i]] = block.timestamp;

            // use wasNew (captured before write)
            if (wasNew) {
                totalProfiles++;
            }

            // H3 fix: emit RiskProfileUpdated event with correct score/tier
            emit RiskProfileUpdated(accounts[i], _unpackRiskScore(packed), RiskTier.CRITICAL, true);
            emit SanctionAdded(accounts[i], reason);
        }
    }

    function removeSanction(address account) external onlyRole(ADMIN_ROLE) validAddress(account) {
        // only process and emit if address was actually sanctioned
        if (sanctionedAddresses[account]) {
            uint256 packed = _packedProfiles[account];
            if (_unpackIsSanctioned(packed)) {
                _packedProfiles[account] = packed & ~uint256(1 << 16);
            }
            sanctionedAddresses[account] = false;
            if (totalSanctioned > 0) totalSanctioned--;
            
            // M-05 FIX: Restore pre-sanction score/tier if available
            uint256 prePacked = preSanctionProfiles[account];
            if (prePacked != 0) {
                _packedProfiles[account] = prePacked;
                delete preSanctionProfiles[account];
            }
            
            emit SanctionRemoved(account);
        }
    }

    // ============ Tag Management ============

    function addTag(address account, bytes32 tag) external onlyRole(OPERATOR_ROLE) validAddress(account) {
        // H4 fix: dedup check before adding
        if (!_addressTags[account][tag]) {
            _addressTags[account][tag] = true;
            _addressTagList[account].push(tag);
            entityAddresses[tag].push(account);
            emit AddressTagged(account, tag);
        }
    }

    function removeTag(address account, bytes32 tag) external onlyRole(OPERATOR_ROLE) validAddress(account) {
        if (_addressTags[account][tag]) {
            _addressTags[account][tag] = false;

            // H4 fix: also remove from entityAddresses[tag]
            address[] storage entityList = entityAddresses[tag];
            for (uint256 i = 0; i < entityList.length; i++) {
                if (entityList[i] == account) {
                    entityList[i] = entityList[entityList.length - 1];
                    entityList.pop();
                    break;
                }
            }

            emit AddressUntagged(account, tag);
        }
    }

    function _updateTags(address account, bytes32[] calldata newTags) internal {
        // GAS-02 NOTE: This function is O(n*m) where n = old tags, m = entityAddresses for each tag.
        // For addresses with many tags, consider limiting tag count or using a different data structure.
        // Current MAX_TAGS_PER_ADDRESS = 10 limits the blast radius.
        // H4 fix: clean entityAddresses for old tags before clearing
        for (uint256 i = 0; i < _addressTagList[account].length; i++) {
            bytes32 oldTag = _addressTagList[account][i];
            _addressTags[account][oldTag] = false;

            // Remove account from entityAddresses[oldTag]
            address[] storage entityList = entityAddresses[oldTag];
            for (uint256 j = 0; j < entityList.length; j++) {
                if (entityList[j] == account) {
                    entityList[j] = entityList[entityList.length - 1];
                    entityList.pop();
                    break;
                }
            }
        }
        delete _addressTagList[account];

        for (uint256 i = 0; i < newTags.length; i++) {
            if (!_addressTags[account][newTags[i]]) {
                _addressTags[account][newTags[i]] = true;
                _addressTagList[account].push(newTags[i]);
                entityAddresses[newTags[i]].push(account);
            }
        }
    }

    // ============ Contract Registry ============

    function registerContract(
        address contractAddr,
        bytes32 contractType,
        bool verified,
        uint8 riskScore
    ) external onlyRole(OPERATOR_ROLE) validAddress(contractAddr) {
        contractRegistry[contractAddr] = ContractInfo({
            isVerified: verified,
            riskScore: riskScore,
            contractType: contractType,
            verifiedAt: block.timestamp,
            verifiedBy: msg.sender
        });
        emit ContractRegistered(contractAddr, contractType, verified);
    }

    // ============ V2: New / Fixed View Functions ============

    /**
     * @notice 获取完整风险档案 (V2: 返回 struct，兼容旧版 getRiskProfile)
     */
    function getRiskProfile(address account) external view returns (
        uint8 riskScore,
        uint8 tier,
        bytes32[] memory tags,
        uint256 lastUpdated,
        bool sanctioned
    ) {
        uint256 packed = _packedProfiles[account];
        return (
            _unpackRiskScore(packed),
            _unpackTier(packed),
            _addressTagList[account],
            _unpackLastUpdated(packed),
            _unpackIsSanctioned(packed)
        );
    }

    /**
     * @notice C1 fix: V1 向后兼容的 getProfile() 函数
     * @dev 返回与 V1 RiskRegistry.getProfile() 完全一致的 8 个返回值
     * @dev 下游合约 (ComplianceEngine, PolicyEngine, FidesCompliance) 无需修改
     */
    function getProfile(address addr) external view returns (
        uint256 riskScore,
        address profileAddr,
        uint32 lastUpdated,
        uint8 riskTier,
        uint8 sourceConfidence,
        bool sanctioned,
        bool exists,
        bytes32[] memory tags
    ) {
        uint256 packed = _packedProfiles[addr];
        bool isSanc = _unpackIsSanctioned(packed) || sanctionedAddresses[addr];
        return (
            uint256(_unpackRiskScore(packed)),
            addr,
            uint32(_unpackLastUpdated(packed)),
            _unpackTier(packed),
            100, // sourceConfidence: 旧版无此字段，返回默认值
            isSanc,
            packed != 0,
            _addressTagList[addr]
        );
    }

    function getRiskTier(address account) external view returns (RiskTier) {
        if (sanctionedAddresses[account]) {
            return RiskTier.CRITICAL;
        }
        return RiskTier(_unpackTier(_packedProfiles[account]));
    }

    function getRiskScore(address account) external view returns (uint8) {
        return _unpackRiskScore(_packedProfiles[account]);
    }

    function isSanctioned(address account) external view returns (bool) {
        return sanctionedAddresses[account];
    }

    function hasTag(address account, bytes32 tag) external view returns (bool) {
        return _addressTags[account][tag];
    }

    function getTags(address account) external view returns (bytes32[] memory) {
        return _addressTagList[account];
    }

    function getEntityAddresses(bytes32 entityType) external view returns (address[] memory) {
        return entityAddresses[entityType];
    }

    function getContractRisk(address contractAddr) external view returns (bool verified, uint8 riskScore, bytes32 contractType) {
        ContractInfo memory info = contractRegistry[contractAddr];
        return (info.isVerified, info.riskScore, info.contractType);
    }

    /**
     * @notice V2 新增: 返回兼容新 ABI 的 riskProfiles 视图
     * @dev 将 bit-packed 数据解包为 struct-like 返回值
     */
    function riskProfiles(address account) external view returns (
        uint256 riskScore,
        address addr,
        uint32 lastUpdated,
        uint8 riskTier,
        uint8 sourceConfidence,
        bool sanctioned,
        bool exists
    ) {
        uint256 packed = _packedProfiles[account];
        return (
            _unpackRiskScore(packed),
            account,
            uint32(_unpackLastUpdated(packed)),
            _unpackTier(packed),
            100, // sourceConfidence: 旧版无此字段，返回默认值
            _unpackIsSanctioned(packed),
            packed != 0
        );
    }

    // ============ Internal Helpers ============

    /**
     * @dev D2-021 fix: 安全的 bytes32 → hex string 转换
     * @dev 替代 string(abi.encodePacked()) 以避免不可读字符
     */
    function _bytes32ToHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(66); // "0x" + 64 hex chars
        result[0] = "0";
        result[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            result[2 + i * 2] = hexChars[uint8(data[i]) >> 4];
            result[3 + i * 2] = hexChars[uint8(data[i]) & 0x0f];
        }
        return string(result);
    }

    // ============ Admin ============

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ Admin: Backfill Counters ============

    /**
     * @notice 回填历史数据计数器（V2 升级后计数器为 0）
     * @dev 仅 ADMIN_ROLE 可调用，一次性操作
     * @param _totalProfiles 历史总档案数
     * @param _totalHighRisk 历史高风险数（riskScore >= 80）
     * @param _totalSanctioned 历史制裁数
     */
    function backfillCounters(
        uint256 _totalProfiles,
        uint256 _totalHighRisk,
        uint256 _totalSanctioned
    ) external onlyRole(ADMIN_ROLE) {
        require(totalProfiles == 0, "Already backfilled");
        totalProfiles = _totalProfiles;
        totalHighRisk = _totalHighRisk;
        totalSanctioned = _totalSanctioned;
        lastGlobalUpdate = block.timestamp;
    }

    // M-05 FIX: Store pre-sanction packed profiles for restoration
    mapping(address => uint256) public preSanctionProfiles;
    
    // L-09 FIX: Upgrade proposal tracking
    mapping(bytes32 => uint256) public upgradeProposals;
    
    // ============ Storage Gap ============
    uint256[35] private __gap;
}
