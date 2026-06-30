// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "./interfaces/IComplianceEngine.sol";
import "./interfaces/IAssetCompliance.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "./RiskRegistry.sol";

/**
 * @title PolicyEngine
 * @notice 策略引擎 — 定义和执行合规策略
 * @dev 基于 UUPS 代理模式，支持可升级
 * @dev VERSION: 1.2.1 - 修复 C-01/C-02/H-01..H-06 及相关 M/L 级别问题
 */
contract PolicyEngine is Initializable, AccessControlUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RULE_MANAGER_ROLE = keccak256("RULE_MANAGER_ROLE");
    bytes32 public constant COMPLIANCE_ENGINE_ROLE = keccak256("COMPLIANCE_ENGINE_ROLE");

    /// @notice 合约版本号
    string public constant VERSION = "1.2.1";

    /// @notice 规则上限（M-01）— P1-9: 从 200 降为 50，限制 evaluatePolicy 复杂度
    uint256 public constant MAX_RULES = 50;

    // ============ Data Structures ============

    enum ActionType {
        ALLOW,
        BLOCK,
        QUARANTINE,
        REQUIRE_KYC,
        REQUIRE_AML,
        FLAG_FOR_REVIEW
    }

    struct PolicyRule {
        string name;
        string description;
        uint256 minRiskScore;
        uint256 maxRiskScore;
        bool requiresKYC;
        bool requiresAML;
        ActionType action;
        bool active;
        uint256 priority;
    }

    struct PolicyVersion {
        uint256 version;
        uint256 timestamp;
        bytes32 rulesHash;
        string changeDescription;
    }

    // ============ State Variables ============

    /// @notice 策略规则映射
    mapping(bytes32 => PolicyRule) public rules;
    /// @notice 规则存在性显式标志（L-02 / H-02）
    mapping(bytes32 => bool) public ruleExists;
    bytes32[] public ruleIds;

    /// @notice 策略版本历史
    PolicyVersion[] public versionHistory;
    uint256 public currentVersion;

    /// @notice 合规引擎引用
    IComplianceEngine public complianceEngine;

    /// @notice 风险注册表引用
    RiskRegistry public riskRegistry;

    /// @notice 风险等级阈值
    mapping(IAssetCompliance.RiskTier => uint256) public riskTierThresholds;

    /// @notice 版本历史头指针（P2-B: 环形缓冲）
    uint256 private versionHistoryHead;

    /// @notice 最大历史版本数
    uint256 public constant MAX_HISTORY_VERSIONS = 50;

    /// @notice 存储布局版本（P1-10: 升级验证）
    uint256 public storageLayoutVersion;

    /// @notice 升级延迟时间锁（P1-10 + C-02）
    uint256 public upgradeTimelockDelay;
    mapping(bytes32 => uint256) public upgradeProposals;

    /// @notice 链ID验证（P1-4: 签名重放保护，H-06 动态校验）
    uint256 public chainId;

    // ============ Test Compatibility State ============

    struct IssuerPolicy {
        uint256 maxTxAmount;
        uint256 dailyLimit;
        bool allowMediumRisk;
        bool allowHighRisk;
        bool blockMixer;
        bool requireDestinationKYC;
        uint256 cooldownPeriod;
        address[] blockedTokens;
    }

    struct WalletPolicy {
        uint256 maxTxValue;
        uint256 maxTokenTxAmount;
        uint256 dailyEthLimit;
        uint256 dailyTokenLimit;
        bool blockContractCalls;
        bool blockUnknownToken;
        bool requireWhitelist;
        address[] allowedDex;
        address[] blockedContracts;
        address[] whitelistedContracts;
    }

    struct Operation {
        uint8 opType;
        address target;
        uint256 value;
        bytes data;
        address token;
        uint256 tokenAmount;
        uint256 chainId;
    }

    mapping(address => IssuerPolicy) public issuerPolicies;
    /// @notice 显式发行方策略启用标志（M-03）
    mapping(address => bool) public issuerPolicyEnabled;
    mapping(address => WalletPolicy) public walletPolicies;
    mapping(address => bool) public walletPolicyEnabled;
    mapping(address => mapping(address => uint256)) public dailySpent;
    /// @notice 每日限额重置时间戳（H-03 / L-07）
    mapping(address => mapping(address => uint256)) public lastResetDay;
    mapping(address => bool) public knownMixers;
    /// @notice 地址白/黑名单（H-04）
    mapping(address => bool) public whitelisted;
    mapping(address => bool) public blocklisted;
    /// @notice 冷却期记录
    mapping(address => mapping(address => uint256)) public lastTransferAt;

    IssuerPolicy public defaultIssuerPolicy;

    // ============ Events ============

    event RuleCreated(bytes32 indexed ruleId, string name, ActionType action);
    event RuleUpdated(bytes32 indexed ruleId, string name, ActionType action);
    event RuleActivated(bytes32 indexed ruleId);
    event RuleDeactivated(bytes32 indexed ruleId);
    event PolicyVersionCreated(uint256 indexed version, bytes32 rulesHash, string changeDescription, string contractVersion);
    event ComplianceEngineSet(address indexed engine);
    event ThresholdUpdated(IAssetCompliance.RiskTier indexed tier, uint256 threshold);
    event StorageLayoutUpgraded(uint256 oldVersion, uint256 newVersion);
    event IssuerPolicySet(
        address indexed issuer,
        uint256 maxTxAmount,
        uint256 dailyLimit,
        bool allowMediumRisk,
        bool allowHighRisk,
        uint256 timestamp
    );
    event WalletPolicySet(address indexed wallet);
    event MixerAdded(address indexed mixer);
    event MixerRemoved(address indexed mixer);
    event TransferRecorded(address indexed from, address indexed to, uint256 amount);
    event TransferEvaluated(address indexed from, address indexed to, uint256 amount, ActionType decision);

    // P1-12: 审计日志
    event RoleGrantedDetailed(bytes32 indexed role, address indexed account, address indexed sender, uint256 timestamp, string reason);
    event RoleRevokedDetailed(bytes32 indexed role, address indexed account, address indexed sender, uint256 timestamp, string reason);

    // P1-10: 升级提案事件
    event UpgradeProposed(bytes32 indexed proposalId, address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(bytes32 indexed proposalId, address indexed newImplementation);
    event UpgradeTimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // P0-3: 零地址检查事件
    event ZeroAddressRejected(string functionName, uint256 timestamp);

    // P0-7: 紧急暂停事件
    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);

    // ============ Errors ============

    error RuleNotFound(bytes32 ruleId);
    error InvalidRuleParameters();
    error VersionLimitExceeded();
    error EngineNotSet();
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error ChainIdMismatch(uint256 expected, uint256 actual);
    error InvalidContractAddress();
    error UpgradeTimelockActive(bytes32 proposalId, uint256 executeAfter);
    error UpgradeNotProposed(bytes32 proposalId);
    error InvalidPolicy();
    error UnauthorizedCaller();
    error RuleAlreadyExists(bytes32 ruleId);

    // ============ Constructor ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, _msgSender())) revert UnauthorizedCaller();
        _;
    }

    // ============ Initializer ============

    function initialize(address admin, address _riskRegistry) public initializer {
        // L-06: __AccessControl_init 内部已初始化 Context，不再重复调用
        __AccessControl_init();
        __ReentrancyGuard_init();

        // P0-3 / L-04: 零地址检查
        require(admin != address(0), "Zero address");
        require(_riskRegistry != address(0), "Zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RULE_MANAGER_ROLE, admin);

        riskRegistry = RiskRegistry(_riskRegistry);

        // 设置默认风险阈值
        riskTierThresholds[IAssetCompliance.RiskTier.LOW] = 30;
        riskTierThresholds[IAssetCompliance.RiskTier.MEDIUM] = 60;
        riskTierThresholds[IAssetCompliance.RiskTier.HIGH] = 80;

        // 设置默认发行方策略
        defaultIssuerPolicy = IssuerPolicy({
            maxTxAmount: 1000 * 10**18,
            dailyLimit: 5000 * 10**18,
            allowMediumRisk: false,
            allowHighRisk: false,
            blockMixer: true,
            requireDestinationKYC: false,
            cooldownPeriod: 0,
            blockedTokens: new address[](0)
        });

        // 创建初始版本
        versionHistory.push(PolicyVersion({
            version: 1,
            timestamp: block.timestamp,
            rulesHash: bytes32(0),
            changeDescription: "Initial policy version"
        }));
        currentVersion = 1;
        storageLayoutVersion = 1;

        // P1-10: 初始化升级延迟
        upgradeTimelockDelay = 2 days;

        // P1-4 / H-06: 记录链ID（同时保留动态获取）
        chainId = _currentChainId();
    }

    // ============ Upgrade Authorization (C-02) ============

    /**
     * @notice 提议升级 — 必须经过时间锁
     */
    function proposeUpgrade(address newImplementation)
        external
        onlyRole(ADMIN_ROLE)
        returns (bytes32 proposalId)
    {
        require(newImplementation != address(0), "Zero address");
        proposalId = keccak256(abi.encode(newImplementation, _currentChainId()));
        upgradeProposals[proposalId] = block.timestamp + upgradeTimelockDelay;
        emit UpgradeProposed(proposalId, newImplementation, upgradeProposals[proposalId]);
    }

    /**
     * @notice 取消升级提案
     */
    function cancelUpgradeProposal(bytes32 proposalId) external onlyRole(ADMIN_ROLE) {
        if (upgradeProposals[proposalId] == 0) revert UpgradeNotProposed(proposalId);
        delete upgradeProposals[proposalId];
    }

    /**
     * @notice UUPS 升级授权 — 强制时间锁与权限控制（C-02）
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(ADMIN_ROLE)
        override
    {
        bytes32 proposalId = keccak256(abi.encode(newImplementation, _currentChainId()));
        uint256 executeAfter = upgradeProposals[proposalId];
        if (executeAfter == 0) revert UpgradeNotProposed(proposalId);
        if (block.timestamp < executeAfter) {
            revert UpgradeTimelockActive(proposalId, executeAfter);
        }
        delete upgradeProposals[proposalId];
        emit UpgradeExecuted(proposalId, newImplementation);
    }

    /**
     * @notice 动态获取 chainId（H-06）
     */
    function _currentChainId() internal view returns (uint256 cid) {
        assembly { cid := chainid() }
    }

    /**
     * @notice 签名路径使用动态 chainId 校验（H-06）
     */
    function _verifyChainId(uint256 sigChainId) internal view {
        uint256 actual = _currentChainId();
        if (sigChainId != actual) revert ChainIdMismatch(sigChainId, actual);
    }

    // ============ Rule Management ============

    function createRule(
        bytes32 ruleId,
        string calldata name,
        string calldata description,
        uint256 minRiskScore,
        uint256 maxRiskScore,
        bool requiresKYC,
        bool requiresAML,
        ActionType action,
        uint256 priority
    ) external onlyRole(RULE_MANAGER_ROLE) { // M-07: 移除非必要的 nonReentrant
        // L-03 / L-05 / M-01 / H-02: 参数与重复校验
        if (bytes(name).length == 0 || bytes(name).length > 64) revert InvalidRuleParameters();
        if (bytes(description).length > 256) revert InvalidRuleParameters();
        if (minRiskScore > maxRiskScore || maxRiskScore > 100) revert InvalidRuleParameters();
        if (priority > 1000) revert InvalidRuleParameters();
        if (ruleIds.length >= MAX_RULES) revert InvalidRuleParameters();
        if (ruleExists[ruleId]) revert RuleAlreadyExists(ruleId);

        rules[ruleId] = PolicyRule({
            name: name,
            description: description,
            minRiskScore: minRiskScore,
            maxRiskScore: maxRiskScore,
            requiresKYC: requiresKYC,
            requiresAML: requiresAML,
            action: action,
            active: true,
            priority: priority
        });
        ruleExists[ruleId] = true;
        ruleIds.push(ruleId);

        emit RuleCreated(ruleId, name, action);
    }

    function updateRule(
        bytes32 ruleId,
        string calldata name,
        string calldata description,
        uint256 minRiskScore,
        uint256 maxRiskScore,
        bool requiresKYC,
        bool requiresAML,
        ActionType action,
        uint256 priority
    ) external onlyRole(RULE_MANAGER_ROLE) {
        if (!ruleExists[ruleId]) revert RuleNotFound(ruleId); // L-02
        if (bytes(name).length == 0 || bytes(name).length > 64) revert InvalidRuleParameters();
        if (bytes(description).length > 256) revert InvalidRuleParameters();
        if (minRiskScore > maxRiskScore || maxRiskScore > 100) revert InvalidRuleParameters();
        if (priority > 1000) revert InvalidRuleParameters();

        PolicyRule storage rule = rules[ruleId];
        rule.name = name;
        rule.description = description;
        rule.minRiskScore = minRiskScore;
        rule.maxRiskScore = maxRiskScore;
        rule.requiresKYC = requiresKYC;
        rule.requiresAML = requiresAML;
        rule.action = action;
        rule.priority = priority;

        emit RuleUpdated(ruleId, name, action);
    }

    function activateRule(bytes32 ruleId) external onlyRole(RULE_MANAGER_ROLE) {
        if (!ruleExists[ruleId]) revert RuleNotFound(ruleId);
        rules[ruleId].active = true;
        emit RuleActivated(ruleId);
    }

    function deactivateRule(bytes32 ruleId) external onlyRole(RULE_MANAGER_ROLE) {
        if (!ruleExists[ruleId]) revert RuleNotFound(ruleId);
        rules[ruleId].active = false;
        emit RuleDeactivated(ruleId);
    }

    // ============ Policy Evaluation ============

    /**
     * @notice 完整策略评估（H-04: 地址感知）— P1-9: O(n) 单次遍历
     */
    function evaluatePolicy(
        address addr,
        uint256 riskScore,
        IAssetCompliance.RiskTier /* tier */,
        uint256 deadline
    ) public view returns (ActionType[] memory actions, bool requiresKYC, bool requiresAML) {
        if (deadline > 0 && block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }

        if (address(complianceEngine) == address(0)) revert EngineNotSet();

        // H-04: 地址感知短路
        if (whitelisted[addr]) {
            return (new ActionType[](0), false, false);
        }
        if (blocklisted[addr]) {
            ActionType[] memory blockActions = new ActionType[](1);
            blockActions[0] = ActionType.BLOCK;
            return (blockActions, false, false);
        }

        // P1-9: O(n) 单次遍历 — 收集所有匹配规则的动作
        // BLOCK 动作立即短路返回
        uint256 actionCount = 0;
        ActionType[] memory tempActions = new ActionType[](ruleIds.length);

        for (uint256 i = 0; i < ruleIds.length; i++) {
            if (!ruleExists[ruleIds[i]]) continue;
            PolicyRule storage rule = rules[ruleIds[i]];
            if (!rule.active) continue;

            if (riskScore >= rule.minRiskScore && riskScore <= rule.maxRiskScore) {
                tempActions[actionCount] = rule.action;
                actionCount++;

                if (rule.requiresKYC) requiresKYC = true;
                if (rule.requiresAML) requiresAML = true;

                // M-04: 任何 BLOCK 立即终止
                if (rule.action == ActionType.BLOCK) break;
            }
        }

        // 压缩返回数组
        actions = new ActionType[](actionCount);
        for (uint256 i = 0; i < actionCount; i++) {
            actions[i] = tempActions[i];
        }
    }

    /**
     * @notice 3-parameter version — convenience function for internal/trusted callers
     * @dev M-04 FIX: This bypasses MEV deadline protection by design (deadline=0 skips check).
     *      Only use in trusted read-only contexts. For untrusted external calls,
     *      always use the 4-parameter version with an explicit deadline.
     * @dev DEPRECATED: 此函数不提供 deadline 参数，无法防 MEV 攻击。
     *             新代码应使用 4 参数版本的 evaluatePolicy(addr, riskScore, tier, deadline)。
     */
    function evaluatePolicy(
        address addr,
        uint256 riskScore,
        IAssetCompliance.RiskTier tier
    ) external view returns (ActionType[] memory, bool, bool) {
        return evaluatePolicy(addr, riskScore, tier, 0);
    }

    // ============ Risk Score Helper ============

    /**
     * @notice 将风险等级转换为代表性评分（getRiskScore 不存在于 RiskRegistry，由 getRiskLevel 推导）
     * I-03 NOTE: This helper is kept for future use though currently unused internally.
     * External callers may reference it for tier-to-score mapping.
     */
    function _tierToRiskScore(RiskRegistry.RiskTier tier) internal pure returns (uint256) {
        if (tier == RiskRegistry.RiskTier.LOW) return 10;
        if (tier == RiskRegistry.RiskTier.MEDIUM) return 50;
        if (tier == RiskRegistry.RiskTier.HIGH) return 75;
        if (tier == RiskRegistry.RiskTier.CRITICAL) return 100;
        return 100; // unknown
    }

    // ============ Transfer Evaluation (C-01 / H-01 / H-03 / H-05 / M-02 / M-03 / L-01) ============

    /**
     * @notice 评估转账 — 双向对称检查，统一返回 ActionType
     */
    function evaluateTransfer(
        address from,
        address to,
        uint256 amount,
        address issuer
    ) public view returns (ActionType decision, string memory reason) {
        // M-02: 风险注册表未配置
        if (address(riskRegistry) == address(0)) {
            return (ActionType.FLAG_FOR_REVIEW, "RiskRegistry not configured");
        }

        // C-01: 双向制裁检查
        if (riskRegistry.isSanctioned(from) || riskRegistry.isSanctioned(to)) {
            return (ActionType.BLOCK, "Sanctioned address (from or to)");
        }

        // H-01: 双向 Mixer 检查
        if (knownMixers[from] || knownMixers[to]) {
            return (ActionType.BLOCK, "Mixer transaction blocked");
        }

        // H-01: 双向风险等级（取最大值）— getRiskScore 不存在，使用 getRiskLevel 推导
        (, , , uint8 fromTier_, , ,,) = riskRegistry.getProfile(from);
        (, , , uint8 toTier_, , ,,) = riskRegistry.getProfile(to);
        RiskRegistry.RiskTier tier = uint8(fromTier_) > uint8(toTier_) ? RiskRegistry.RiskTier(fromTier_) : RiskRegistry.RiskTier(toTier_);

        // M-03: 显式发行方策略启用标志
        IssuerPolicy storage policy = issuerPolicyEnabled[issuer]
            ? issuerPolicies[issuer]
            : defaultIssuerPolicy;

        // 单笔限额
        if (amount > policy.maxTxAmount) {
            return (ActionType.BLOCK, "Exceeds max transaction amount");
        }

        // H-03: 每日限额（只读校验，状态更新在 recordTransfer）
        uint256 spent = dailySpent[issuer][from];
        uint256 resetAt = lastResetDay[issuer][from];
        if (resetAt != 0 && block.timestamp >= resetAt + 1 days) {
            spent = 0; // 视为已重置
        }
        if (spent + amount > policy.dailyLimit) {
            return (ActionType.BLOCK, "Daily limit exceeded");
        }

        // L-01: 使用枚举常量替代魔数
        if (tier == RiskRegistry.RiskTier.HIGH && !policy.allowHighRisk) {
            return (ActionType.BLOCK, "High risk address blocked");
        }
        if (tier == RiskRegistry.RiskTier.MEDIUM && !policy.allowMediumRisk) {
            return (ActionType.FLAG_FOR_REVIEW, "Medium risk - hold for review");
        }

        // H-05: 统一返回 ActionType
        return (ActionType.ALLOW, "Transfer allowed");
    }

    /**
     * @notice 转账通过后记录每日累计（H-03: 突破 view 限制的状态更新）
     */
    function recordTransfer(
        address from,
        address to,
        uint256 amount,
        address issuer
    ) external onlyRole(COMPLIANCE_ENGINE_ROLE) nonReentrant {
        // 时间窗口重置（H-03 / L-07）
        if (lastResetDay[issuer][from] == 0 || block.timestamp >= lastResetDay[issuer][from] + 1 days) {
            dailySpent[issuer][from] = 0;
            lastResetDay[issuer][from] = block.timestamp;
        }
        dailySpent[issuer][from] += amount;
        lastTransferAt[from][to] = block.timestamp;

        emit TransferRecorded(from, to, amount);
    }

    /**
     * @notice 重置某个发行方下某地址的每日计数（管理工具）
     */
    function resetDailySpent(address issuer, address account) external onlyRole(ADMIN_ROLE) {
        dailySpent[issuer][account] = 0;
        lastResetDay[issuer][account] = block.timestamp;
    }

    // ============ Operation / Transaction Evaluation (M-05) ============

    function evaluateOperation(
        Operation calldata op,
        address issuer
    ) external view returns (ActionType decision, string memory reason) {
        // H-06: 动态 chainId 校验
        if (op.chainId != _currentChainId()) {
            return (ActionType.FLAG_FOR_REVIEW, "chainId mismatch");
        }
        return evaluateTransfer(_msgSender(), op.target, op.value, issuer);
    }

    function evaluateTransaction(
        address from,
        address to,
        uint256 amount,
        address issuer
    ) external view returns (
        IAssetCompliance.RiskTier tier,
        uint256 riskScore,
        ActionType decision,
        string memory reason
    ) {
        // M-02
        if (address(riskRegistry) == address(0)) {
            return (IAssetCompliance.RiskTier.HIGH, 100, ActionType.FLAG_FOR_REVIEW, "RiskRegistry not configured");
        }

        (uint256 fromScore_, , , uint8 fromTier_, , ,,) = riskRegistry.getProfile(from);
        (uint256 toScore_, , , uint8 toTier_, , ,,) = riskRegistry.getProfile(to);
        RiskRegistry.RiskTier rawTier = uint8(fromTier_) > uint8(toTier_) ? RiskRegistry.RiskTier(fromTier_) : RiskRegistry.RiskTier(toTier_);

        // M-01 FIX: Use actual riskScore from RiskRegistry instead of tier-derived approximation
        riskScore = uint8(fromScore_) > uint8(toScore_) ? fromScore_ : toScore_;

        // M-05: 直接 cast — 两枚举底屋值一致
        tier = IAssetCompliance.RiskTier(uint8(rawTier));
        (decision, reason) = evaluateTransfer(from, to, amount, issuer);
    }

    // ============ Policy Setters ============

    function setIssuerPolicy(
        address issuer,
        IssuerPolicy calldata policy
    ) external onlyRole(ADMIN_ROLE) {
        require(issuer != address(0), "Zero address");
        if (policy.maxTxAmount == 0 && policy.dailyLimit == 0) revert InvalidPolicy();

        issuerPolicies[issuer] = policy;
        issuerPolicyEnabled[issuer] = true; // M-03

        emit IssuerPolicySet(
            issuer,
            policy.maxTxAmount,
            policy.dailyLimit,
            policy.allowMediumRisk,
            policy.allowHighRisk,
            block.timestamp
        );
    }

    function disableIssuerPolicy(address issuer) external onlyRole(ADMIN_ROLE) {
        issuerPolicyEnabled[issuer] = false;
    }

    function setWalletPolicy(
        address wallet,
        WalletPolicy calldata policy
    ) external onlyRole(ADMIN_ROLE) {
        require(wallet != address(0), "Zero address");
        walletPolicies[wallet] = policy;
        walletPolicyEnabled[wallet] = true;
        emit WalletPolicySet(wallet);
    }

    function setDefaultIssuerPolicy(IssuerPolicy calldata policy) external onlyRole(ADMIN_ROLE) {
        defaultIssuerPolicy = policy;
    }

    function addMixer(address mixer) external onlyRole(ADMIN_ROLE) {
        require(mixer != address(0), "Zero address");
        knownMixers[mixer] = true;
        emit MixerAdded(mixer);
    }

    function removeMixer(address mixer) external onlyRole(ADMIN_ROLE) {
        knownMixers[mixer] = false;
        emit MixerRemoved(mixer);
    }

    function setWhitelisted(address account, bool status) external onlyRole(ADMIN_ROLE) {
        whitelisted[account] = status;
    }

    function setBlocklisted(address account, bool status) external onlyRole(ADMIN_ROLE) {
        blocklisted[account] = status;
    }

    function setComplianceEngine(address engine) external onlyRole(ADMIN_ROLE) {
        require(engine != address(0), "Zero address");
        require(engine.code.length > 0, "Not a contract");
        complianceEngine = IComplianceEngine(engine);
        emit ComplianceEngineSet(engine);
    }

    function setRiskThreshold(IAssetCompliance.RiskTier tier, uint256 threshold) external onlyRole(ADMIN_ROLE) {
        riskTierThresholds[tier] = threshold;
        emit ThresholdUpdated(tier, threshold);
    }

    function setUpgradeTimelockDelay(uint256 delay) external onlyRole(ADMIN_ROLE) {
        require(delay >= 1 hours && delay <= 30 days, "Invalid delay");
        uint256 oldDelay = upgradeTimelockDelay;
        upgradeTimelockDelay = delay;
        emit UpgradeTimelockDelayUpdated(oldDelay, delay);
    }

    // ============ Version Management (I-02) ============

    function createPolicyVersion(
        bytes32 rulesHash,
        string calldata changeDescription
    ) external onlyRole(ADMIN_ROLE) returns (uint256 newVersion) {
        // D1-AUDIT1-035 fix: correct circular buffer logic — no double-write
        newVersion = currentVersion + 1;

        if (versionHistory.length < MAX_HISTORY_VERSIONS) {
            // Still filling the buffer: append
            versionHistory.push(PolicyVersion({
                version: newVersion,
                timestamp: block.timestamp,
                rulesHash: rulesHash,
                changeDescription: changeDescription
            }));
        } else {
            // Buffer full: overwrite oldest entry (circular)
            uint256 writeIdx = versionHistoryHead % MAX_HISTORY_VERSIONS;
            versionHistory[writeIdx] = PolicyVersion({
                version: newVersion,
                timestamp: block.timestamp,
                rulesHash: rulesHash,
                changeDescription: changeDescription
            });
        }
        versionHistoryHead++;
        currentVersion = newVersion;

        emit PolicyVersionCreated(newVersion, rulesHash, changeDescription, VERSION);
    }

    function upgradeStorageLayout(uint256 newVersion) external onlyRole(ADMIN_ROLE) {
        uint256 old = storageLayoutVersion;
        storageLayoutVersion = newVersion;
        emit StorageLayoutUpgraded(old, newVersion);
    }

    // ============ View Helpers ============

    function getRuleIdsLength() external view returns (uint256) {
        return ruleIds.length;
    }

    function getRule(bytes32 ruleId) external view returns (PolicyRule memory) {
        if (!ruleExists[ruleId]) revert RuleNotFound(ruleId);
        return rules[ruleId];
    }

    function currentChainId() external view returns (uint256) {
        return _currentChainId();
    }

    /**
     * @dev 留空以预留存储槽，便于未来存储布局扩展（I-03）
     */
    uint256[50] private __gap;
}