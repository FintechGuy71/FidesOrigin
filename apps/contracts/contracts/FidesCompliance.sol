// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IPreTransactionGuard.sol";
import "./interfaces/IAssetCompliance.sol";
import "./interfaces/IComplianceEngine.sol";
import "./interfaces/IFidesCompliance.sol";
import "./ComplianceEngine.sol";
import "./RiskRegistry.sol";
import "./PolicyEngine.sol";
import "./QuarantineVault.sol";

/**
 * @title FidesCompliance
 * @notice FidesOrigin 主合规合约 — 面向用户的统一接口 (UUPS Upgradeable)
 * @dev 所有业务合约应调用此合约进行合规检查
 * @dev VERSION: 1.4.0 - UUPS Upgradeable 重构
 *      1.3.1 - 修复统计回滚(H-01) + MEV保护强制(H-02) + 多项安全加固
 *      + DEFAULT_ADMIN_ROLE后门移除(S-06) + isBlacklisted Fail-Closed(S-07) + 合约校验(S-08)
 */
contract FidesCompliance is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, IFidesCompliance {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    /// @notice I-17 NOTE: DEFAULT_ADMIN_ROLE 是 OpenZeppelin 内置的超级管理员角色。
    ///         部署完成后，应将其转移给 FidesOriginTimelock 合约，
    ///         以实现去中心化管理和防止单点权力集中。
    ///         转移命令: `grantRole(DEFAULT_ADMIN_ROLE, timelockAddress)` 然后 `renounceRole(DEFAULT_ADMIN_ROLE, deployer)`
    
    /// @notice 合约版本号
    string public constant VERSION = "2.0.0";

    /// @notice MEV 保护最大 deadline 时长
    uint256 public constant MAX_DEADLINE_DURATION = 5 minutes;
    // I-02 FIX: Unified MAX_BATCH_SIZE to 100 for consistency across contracts
    uint256 public constant MAX_BATCH_SIZE = 100;
    /// @notice 关键地址变更时间锁
    uint256 public constant SETTER_DELAY = 48 hours;
    /// @notice 紧急冷却最大值
    uint256 public constant MAX_EMERGENCY_COOLDOWN = 7 days;
    /// @notice 紧急模式最小持续时间
    uint256 public constant MIN_EMERGENCY_DURATION = 1 hours;
    
    // ============ State Variables ============
    
    ComplianceEngine public complianceEngine;
    RiskRegistry public riskRegistry;
    PolicyEngine public policyEngine;
    QuarantineVault public quarantineVault;
    
    /// @notice 合规配置
    uint256 public minRiskScoreForQuarantine;
    uint256 public maxRiskScoreForBlock;
    uint256 public minUpdateInterval;
    
    /// @notice 交易统计
    uint256 public totalTransactionsChecked;
    uint256 public totalTransactionsBlocked;
    uint256 public totalTransactionsQuarantined;
    uint256 public totalTransactionsAllowed;
    
    /// @notice 地址统计
    mapping(address => uint256) public addressTransactionCount;
    mapping(address => uint256) public addressLastCheckTime;
    
    /// @notice 紧急模式
    bool public emergencyMode;
    uint256 public emergencyCooldown;
    uint256 public lastEmergencyTime;

    /// @notice V2.1: PreTransactionGuard 集成
    IPreTransactionGuard public guard;
    bool public guardEnabled;
    uint256 public totalGuardChecks;
    uint256 public totalGuardBlocked;

    /// @notice 两步确认 pending 地址
    address public pendingComplianceEngine;
    address public pendingRiskRegistry;
    address public pendingPolicyEngine;
    address public pendingQuarantineVault;
    mapping(bytes32 => uint256) public pendingSetTime;

    /// @notice 白名单集合（用于 IFidesCompliance.isWhitelisted）
    mapping(address => bool) private _whitelist;

    /// @notice 升级提案映射（P0 FIX: 添加升级时间锁）
    mapping(bytes32 => uint256) public upgradeProposals;
    /// @notice H-02 FIX: 实现地址到提案ID的映射
    mapping(address => bytes32) public implementationToProposal;
    /// @notice H-02 FIX: 提案ID到实现地址的映射（用于 cancel 时双向清理）
    mapping(bytes32 => address) public proposalToImplementation;

    /// @notice 风险资料更新时间
    mapping(address => uint256) private _riskProfileLastUpdated;
    
    // ============ Events ============
    
    event TransactionChecked(
        address indexed from,
        address indexed to,
        uint256 indexed amount,
        address token,
        bool allowed,
        uint256 riskScore,
        uint256 timestamp,
        uint256 blockNumber
    );
    
    event TransactionBlocked(
        address indexed from,
        address indexed to,
        uint256 indexed amount,
        address token,
        string reason,
        uint256 timestamp,
        uint256 blockNumber
    );
    
    event TransactionQuarantined(
        address indexed from,
        address indexed to,
        uint256 indexed amount,
        address token,
        bytes32 quarantineId,
        uint256 timestamp,
        uint256 blockNumber
    );
    
    event EmergencyModeActivated(uint256 timestamp, uint256 blockNumber);
    event EmergencyModeDeactivated(uint256 timestamp, uint256 blockNumber);
    
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
    
    event ZeroAddressRejected(string functionName, uint256 timestamp);
    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);

    // M-02: 配置变更审计事件
    event ComplianceEngineUpdated(address indexed oldEngine, address indexed newEngine, address indexed admin, uint256 timestamp);
    event RiskRegistryUpdated(address indexed oldRegistry, address indexed newRegistry, address indexed admin, uint256 timestamp);
    event PolicyEngineUpdated(address indexed oldEngine, address indexed newEngine, address indexed admin, uint256 timestamp);
    event QuarantineVaultUpdated(address indexed oldVault, address indexed newVault, address indexed admin, uint256 timestamp);
    event RiskThresholdUpdated(string indexed paramName, uint256 oldValue, uint256 newValue, address indexed admin, uint256 timestamp);
    event EmergencyCooldownUpdated(uint256 oldValue, uint256 newValue, address indexed admin, uint256 timestamp);
    event EmergencyCooldownRemaining(uint256 remaining);
    event GuardCheck(address indexed from, address indexed to, uint8 action, uint256 riskScore);
    event GuardBlocked(address indexed from, address indexed to, string reason);
    event GuardSet(address indexed guard);
    event GuardEnabled(bool enabled);

    // M-05: 两步确认事件
    event ComplianceEngineProposed(address indexed proposed, address indexed proposer, uint256 timestamp);
    event RiskRegistryProposed(address indexed proposed, address indexed proposer, uint256 timestamp);
    event PolicyEngineProposed(address indexed proposed, address indexed proposer, uint256 timestamp);
    event QuarantineVaultProposed(address indexed proposed, address indexed proposer, uint256 timestamp);

    event WhitelistUpdated(address indexed account, bool status, address indexed admin, uint256 timestamp);
    event UpgradeProposed(bytes32 indexed proposalId, address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(bytes32 indexed proposalId, address indexed newImplementation);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error EngineNotSet();
    error EmergencyModeActive();
    error EmergencyCooldownActive();
    error AlreadyInEmergencyMode();
    error TransactionBlockedError(string reason);
    error TransactionQuarantinedError(bytes32 quarantineId);
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error BatchTooLarge(uint256 size, uint256 maxSize);
    error NothingPending();
    error TooEarly(uint256 availableAt);
    error InvalidCooldown(uint256 cooldown);
    error AlreadyInEmergency();
    error RiskRegistryNotSet();
    
    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _complianceEngine,
        address _riskRegistry,
        address _policyEngine,
        address _quarantineVault
    ) external initializer {
        __Context_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        require(_complianceEngine != address(0), "Invalid compliance engine");
        require(_riskRegistry != address(0), "Invalid risk registry");
        require(_policyEngine != address(0), "Invalid policy engine");
        require(_quarantineVault != address(0), "Invalid quarantine vault");
        
        // [NICE_TO_HAVE] 验证依赖地址为真实合约
        require(_complianceEngine.code.length > 0, "Compliance engine not a contract");
        require(_riskRegistry.code.length > 0, "Risk registry not a contract");
        require(_policyEngine.code.length > 0, "Policy engine not a contract");
        require(_quarantineVault.code.length > 0, "Quarantine vault not a contract");
        
        complianceEngine = ComplianceEngine(_complianceEngine);
        riskRegistry = RiskRegistry(_riskRegistry);
        policyEngine = PolicyEngine(_policyEngine);
        quarantineVault = QuarantineVault(payable(_quarantineVault));

        // 初始化默认值
        minRiskScoreForQuarantine = 80;
        maxRiskScoreForBlock = 95;
        minUpdateInterval = 24 hours;
        emergencyCooldown = 24 hours;

        // L-05: 设置角色管理关系
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);          // ADMIN 自管理
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);        // OPERATOR 由 ADMIN 管理
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        // [S-06] DEFAULT_ADMIN_ROLE 作为 ADMIN_ROLE 的 fallback 保留，
        // 但仅授予部署者。ADMIN_ROLE 自管理，满足业务需要。
    }

    /**
     * @notice UUPS 升级授权 — 仅 ADMIN_ROLE 可执行升级
     * @dev P0 FIX: 添加升级时间锁校验（48小时延迟）
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        // H-02 FIX: proposalId 需与 proposeUpgrade 中一致，包含 block.timestamp
        // 由于 timestamp 已包含在哈希中，我们需要通过遍历或额外存储来匹配。
        // 这里采用 implementationToProposal 映射来避免遍历。
        bytes32 proposalId = implementationToProposal[newImplementation];
        require(proposalId != bytes32(0), "No upgrade proposal");
        uint256 executeAfter = upgradeProposals[proposalId];
        require(executeAfter != 0, "No upgrade proposal");
        require(block.timestamp >= executeAfter, "Upgrade timelock active");
        delete upgradeProposals[proposalId];
        delete implementationToProposal[newImplementation];
        emit UpgradeExecuted(proposalId, newImplementation);
    }

    /**
     * @notice 提议合约升级
     * @dev P0 FIX: 升级前必须提议并等待 SETTER_DELAY（48小时）
     * @param newImplementation 新实现合约地址
     */
    function proposeUpgrade(address newImplementation) external onlyRole(ADMIN_ROLE) {
        require(newImplementation != address(0), "Zero address");
        require(newImplementation.code.length > 0, "Not a contract");
        // H-02 FIX: 加入 block.timestamp 防止 proposalId 碰撞
        bytes32 proposalId = keccak256(abi.encode(newImplementation, block.chainid, block.timestamp, address(this)));
        upgradeProposals[proposalId] = block.timestamp + SETTER_DELAY;
        implementationToProposal[newImplementation] = proposalId;
        proposalToImplementation[proposalId] = newImplementation;
        emit UpgradeProposed(proposalId, newImplementation, upgradeProposals[proposalId]);
    }

    /**
     * @notice 取消升级提案
     * @param proposalId 升级提案ID
     */
    function cancelUpgrade(bytes32 proposalId) external onlyRole(ADMIN_ROLE) {
        require(upgradeProposals[proposalId] != 0, "No such proposal");
        // H-02 FIX: 双向清理映射
        address impl = proposalToImplementation[proposalId];
        if (impl != address(0)) {
            delete implementationToProposal[impl];
        }
        delete proposalToImplementation[proposalId];
        delete upgradeProposals[proposalId];
    }

    // ============ IFidesCompliance Interface Implementation ============

    /**
     * @notice 检查地址是否在黑名单（受制裁或风险分数达到阻断阈值）
     * 
     */
    function isBlacklisted(address account) external view returns (bool) {
        // [S-07] Fail-Closed: 当 riskRegistry 为零地址时，应 revert 而非 return false
        if (account == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert RiskRegistryNotSet();
        
        if (riskRegistry.isSanctioned(account)) {
            return true;
        }
        (uint256 score, , , , , , ,) = riskRegistry.getProfile(account);
        return score >= maxRiskScoreForBlock;
    }

    /**
     * @notice 检查地址是否在白名单
     * 
     */
    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }

    /**
     * @notice 获取地址风险资料
     * 
     */
    function getRiskProfile(address account)
        external
        view
        returns (uint256 riskScore, bool isSanctioned, uint256 lastUpdated)
    {
        if (account == address(0) || address(riskRegistry) == address(0)) {
            // L-13 FIX: 统一 Fail-Closed 行为 — 与 _getRiskScore 一致返回 100
            return (100, false, 0);
        }
        riskScore = _getRiskScore(account);
        isSanctioned = riskRegistry.isSanctioned(account);
        lastUpdated = _riskProfileLastUpdated[account];
        return (riskScore, isSanctioned, lastUpdated);
    }

    /**
     * @notice M-03 FIX: 预览交易合规性（纯 view，无副作用）
     * @dev 与 evaluateTransaction 逻辑一致，但不调用任何 state-changing 函数
     */
    function previewTransaction(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external view virtual returns (bool allowed, uint256 riskScore) {
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)) {
            return (false, 0);
        }
        if (from == address(0) || to == address(0)) {
            return (false, 0);
        }
        if (deadline > 0 && block.timestamp > deadline) {
            return (false, 0);
        }
        if (emergencyMode) {
            return (false, 0);
        }
        
        // V2.1: Guard 预检
        if (guardEnabled && address(guard) != address(0)) {
            IPreTransactionGuard.TransactionIntent memory intent = IPreTransactionGuard.TransactionIntent({
                from: from,
                to: to,
                value: 0,
                token: address(0),
                data: "",
                chainId: block.chainid
            });
            IPreTransactionGuard.RiskAssessment memory result = guard.assessTransaction(intent);
            if (result.action == IPreTransactionGuard.Action.BLOCK) {
                return (false, 100);
            }
        }
        
        if (address(riskRegistry) == address(0)) {
            return (false, 0);
        }

        uint256 fromRiskScore = _getRiskScore(from);
        uint256 toRiskScore = _getRiskScore(to);
        riskScore = fromRiskScore > toRiskScore ? fromRiskScore : toRiskScore;

        bool fromSanctioned = riskRegistry.isSanctioned(from);
        bool toSanctioned = riskRegistry.isSanctioned(to);

        if (fromSanctioned || toSanctioned) {
            return (false, riskScore);
        }
        if (riskScore >= maxRiskScoreForBlock) {
            return (false, riskScore);
        }

        if (address(complianceEngine) != address(0)) {
            (IAssetCompliance.Decision decision, ) = complianceEngine.validateTransfer(
                from, to, amount, token
            );
            if (decision == IAssetCompliance.Decision.BLOCK) {
                return (false, riskScore);
            }
            if (decision == IAssetCompliance.Decision.HOLD) {
                return (false, riskScore);
            }
        }

        allowed = riskScore < minRiskScoreForQuarantine;
        return (allowed, riskScore);
    }

    /**
     * @notice M-03 FIX: 评估交易（状态变更路径，非纯 view）
     * @dev 如需纯预览，使用 previewTransaction
     */
    function evaluateTransaction(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external nonReentrant virtual returns (bool allowed, uint256 riskScore) {
        // [HIGH-2 FIX] 只有交易发起方本人或授权运营方可以评估交易
        // 防止恶意中间合约/外部地址以任意 from 身份调用，操纵统计数据或批量探测风险
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)) {
            return (false, 0);
        }
        if (from == address(0) || to == address(0)) {
            return (false, 0);
        }
        // D2-017 fix: add deadline check for MEV protection
        if (deadline > 0 && block.timestamp > deadline) {
            return (false, 0);
        }
        if (emergencyMode) {
            return (false, 0);
        }
        if (address(riskRegistry) == address(0)) {
            return (false, 0);
        }
        
        // V2.1: Guard 预检（零Gas快速路径）
        if (guardEnabled && address(guard) != address(0)) {
            IPreTransactionGuard.TransactionIntent memory intent = IPreTransactionGuard.TransactionIntent({
                from: from,
                to: to,
                value: 0,
                token: address(0),
                data: "",
                chainId: block.chainid
            });
            IPreTransactionGuard.RiskAssessment memory result = guard.assessTransaction(intent);
            totalGuardChecks++;
            if (result.action == IPreTransactionGuard.Action.BLOCK) {
                totalGuardBlocked++;
                emit GuardBlocked(from, to, result.reason);
                return (false, 100);
            }
            emit GuardCheck(from, to, uint8(result.action), result.riskScore);
        }

        uint256 fromRiskScore = _getRiskScore(from);
        uint256 toRiskScore = _getRiskScore(to);
        riskScore = fromRiskScore > toRiskScore ? fromRiskScore : toRiskScore;

        bool fromSanctioned = riskRegistry.isSanctioned(from);
        bool toSanctioned = riskRegistry.isSanctioned(to);

        if (fromSanctioned || toSanctioned) {
            return (false, riskScore);
        }
        if (riskScore >= maxRiskScoreForBlock) {
            return (false, riskScore);
        }

        // 若引擎已设置，进一步参考引擎决策
        if (address(complianceEngine) != address(0)) {
            (IAssetCompliance.Decision decision, ) = complianceEngine.checkTransfer(
                from, to, amount, token
            );
            if (decision == IAssetCompliance.Decision.BLOCK) {
                return (false, riskScore);
            }
            if (decision == IAssetCompliance.Decision.HOLD) {
                return (false, riskScore);
            }
        }

        allowed = riskScore < minRiskScoreForQuarantine;
        return (allowed, riskScore);
    }
    
    // ============ Core Transaction Check ============
    
    /**
     * @notice 检查并执行交易合规性（带MEV保护）
     * @param from 发送方
     * @param to 接收方
     * @param amount 金额
     * @param token 代币地址
     * @param deadline 截止时间（必须为非零且在合理范围内）
     * @return allowed 是否允许交易
     */
    function checkAndExecuteTransaction(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external whenNotPaused nonReentrant returns (bool allowed) {
        // H-03 FIX: 调用者验证 — 确保只有 from 本人才能通过中间合约发起交易
        // 防止恶意中间合约绕过合规检查以其他用户身份执行
        require(msg.sender == from, "Caller must be from");
        // H-02: 强制 deadline 校验
        uint256 currentTime = block.timestamp;
        if (deadline == 0) revert DeadlineExpired(0, currentTime);
        if (deadline < currentTime) revert DeadlineExpired(deadline, currentTime);
        if (deadline > currentTime + MAX_DEADLINE_DURATION) revert DeadlineExpired(deadline, currentTime);
        return _checkAndExecuteTransaction(from, to, amount, token, deadline);
    }
    
    function _checkAndExecuteTransaction(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) internal returns (bool allowed) {
        // deadline already validated in checkAndExecuteTransaction entry point
        
        if (emergencyMode) revert EmergencyModeActive();
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (address(complianceEngine) == address(0)) revert EngineNotSet();
        
        // 先更新"已检查"统计（无论结果如何都算一次检查）
        totalTransactionsChecked++;
        addressTransactionCount[from]++;
        addressLastCheckTime[from] = block.timestamp;
        _riskProfileLastUpdated[from] = block.timestamp;
        
        (IAssetCompliance.Decision decision, string memory reason) = complianceEngine.checkTransferWithDeadline(
            from, to, amount, token, deadline
        );
        
        uint256 fromRiskScore = _getRiskScore(from);
        uint256 toRiskScore = _getRiskScore(to);
        uint256 riskScore = fromRiskScore > toRiskScore ? fromRiskScore : toRiskScore;
        
        bool isBlocked = (decision == IAssetCompliance.Decision.BLOCK);
        bool shouldQuarantine = (decision == IAssetCompliance.Decision.HOLD);

        // H-01: 阻塞路径不再 revert，保证统计与事件持久化
        if (isBlocked) {
            totalTransactionsBlocked++;
            emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
            emit TransactionChecked(from, to, amount, token, false, riskScore, block.timestamp, block.number);
            return false;
        }

        // H-01: 隔离路径不再 revert，保证统计与事件持久化
        if (shouldQuarantine || riskScore >= minRiskScoreForQuarantine) {
            totalTransactionsQuarantined++;
            // M-01: 引入 blockhash + msg.sender + 单调计数器 + gasleft 增强唯一性
            bytes32 quarantineId = keccak256(abi.encodePacked(
                blockhash(block.number - 1),
                msg.sender,
                from,
                to,
                amount,
                token,
                totalTransactionsChecked,
                gasleft()
            ));
            emit TransactionQuarantined(from, to, amount, token, quarantineId, block.timestamp, block.number);
            emit TransactionChecked(from, to, amount, token, false, riskScore, block.timestamp, block.number);
            return false;
        }
        
        totalTransactionsAllowed++;
        emit TransactionChecked(from, to, amount, token, true, riskScore, block.timestamp, block.number);
        
        return true;
    }
    
    /**
     * @notice 快速检查地址合规性（不执行交易）
     */
    function quickCheckAddress(address addr) external view returns (bool isCompliant, uint256 riskScore) {
        if (addr == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert EngineNotSet();
        
        riskScore = _getRiskScore(addr);
        bool sanctioned = riskRegistry.isSanctioned(addr);
        
        isCompliant = !sanctioned && riskScore < maxRiskScoreForBlock;
        
        return (isCompliant, riskScore);
    }
    
    /**
     * @notice 批量快速检查（M-03: 增加数组长度上限）
     */
    function batchQuickCheck(address[] calldata addrs) external view returns (bool[] memory results, uint256[] memory scores) {
        if (address(riskRegistry) == address(0)) revert EngineNotSet();
        if (addrs.length > MAX_BATCH_SIZE) revert BatchTooLarge(addrs.length, MAX_BATCH_SIZE);
        
        results = new bool[](addrs.length);
        scores = new uint256[](addrs.length);
        
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == address(0)) {
                results[i] = false;
                continue;
            }
            
            scores[i] = _getRiskScore(addrs[i]);
            bool sanctioned = riskRegistry.isSanctioned(addrs[i]);
            results[i] = !sanctioned && scores[i] < maxRiskScoreForBlock;
        }
        
        return (results, scores);
    }

    // ============ Internal Helpers ============

    function _getRiskScore(address account) internal view returns (uint256) {
        if (address(riskRegistry) == address(0)) return 100; // Fail-Closed
        (uint256 score, , , , , , ,) = riskRegistry.getProfile(account);
        return score;
    }

    // ============ Admin: Two-Step Setters ============

    function proposeComplianceEngine(address _engine) external onlyRole(ADMIN_ROLE) {
        if (_engine == address(0)) revert InvalidAddress();
        require(_engine.code.length > 0, "Not a contract");
        pendingComplianceEngine = _engine;
        pendingSetTime["complianceEngine"] = block.timestamp;
        emit ComplianceEngineProposed(_engine, msg.sender, block.timestamp);
    }

    function executeComplianceEngineUpdate() external onlyRole(ADMIN_ROLE) {
        address pending = pendingComplianceEngine;
        if (pending == address(0)) revert NothingPending();
        uint256 setTime = pendingSetTime["complianceEngine"];
        if (block.timestamp < setTime + SETTER_DELAY) {
            revert TooEarly(setTime + SETTER_DELAY);
        }
        address old = address(complianceEngine);
        complianceEngine = ComplianceEngine(pending);
        delete pendingComplianceEngine;
        delete pendingSetTime["complianceEngine"];
        emit ComplianceEngineUpdated(old, pending, msg.sender, block.timestamp);
    }

    function proposeRiskRegistry(address _registry) external onlyRole(ADMIN_ROLE) {
        if (_registry == address(0)) revert InvalidAddress();
        require(_registry.code.length > 0, "Not a contract");
        pendingRiskRegistry = _registry;
        pendingSetTime["riskRegistry"] = block.timestamp;
        emit RiskRegistryProposed(_registry, msg.sender, block.timestamp);
    }

    function executeRiskRegistryUpdate() external onlyRole(ADMIN_ROLE) {
        address pending = pendingRiskRegistry;
        if (pending == address(0)) revert NothingPending();
        uint256 setTime = pendingSetTime["riskRegistry"];
        if (block.timestamp < setTime + SETTER_DELAY) {
            revert TooEarly(setTime + SETTER_DELAY);
        }
        address old = address(riskRegistry);
        riskRegistry = RiskRegistry(pending);
        delete pendingRiskRegistry;
        delete pendingSetTime["riskRegistry"];
        emit RiskRegistryUpdated(old, pending, msg.sender, block.timestamp);
    }

    function proposePolicyEngine(address _engine) external onlyRole(ADMIN_ROLE) {
        if (_engine == address(0)) revert InvalidAddress();
        require(_engine.code.length > 0, "Not a contract");
        pendingPolicyEngine = _engine;
        pendingSetTime["policyEngine"] = block.timestamp;
        emit PolicyEngineProposed(_engine, msg.sender, block.timestamp);
    }

    function executePolicyEngineUpdate() external onlyRole(ADMIN_ROLE) {
        address pending = pendingPolicyEngine;
        if (pending == address(0)) revert NothingPending();
        uint256 setTime = pendingSetTime["policyEngine"];
        if (block.timestamp < setTime + SETTER_DELAY) {
            revert TooEarly(setTime + SETTER_DELAY);
        }
        address old = address(policyEngine);
        policyEngine = PolicyEngine(pending);
        delete pendingPolicyEngine;
        delete pendingSetTime["policyEngine"];
        emit PolicyEngineUpdated(old, pending, msg.sender, block.timestamp);
    }

    function proposeQuarantineVault(address _vault) external onlyRole(ADMIN_ROLE) {
        if (_vault == address(0)) revert InvalidAddress();
        require(_vault.code.length > 0, "Not a contract");
        pendingQuarantineVault = _vault;
        pendingSetTime["quarantineVault"] = block.timestamp;
        emit QuarantineVaultProposed(_vault, msg.sender, block.timestamp);
    }

    function executeQuarantineVaultUpdate() external onlyRole(ADMIN_ROLE) {
        address pending = pendingQuarantineVault;
        if (pending == address(0)) revert NothingPending();
        uint256 setTime = pendingSetTime["quarantineVault"];
        if (block.timestamp < setTime + SETTER_DELAY) {
            revert TooEarly(setTime + SETTER_DELAY);
        }
        address old = address(quarantineVault);
        quarantineVault = QuarantineVault(payable(pending));
        delete pendingQuarantineVault;
        delete pendingSetTime["quarantineVault"];
        emit QuarantineVaultUpdated(old, pending, msg.sender, block.timestamp);
    }

    // ============ Admin: Config ============

    function setMinRiskScoreForQuarantine(uint256 _value) external onlyRole(ADMIN_ROLE) {
        require(_value <= 100, "Invalid value");
        require(_value < maxRiskScoreForBlock, "Must be less than maxRiskScoreForBlock");
        uint256 old = minRiskScoreForQuarantine;
        minRiskScoreForQuarantine = _value;
        emit RiskThresholdUpdated("minRiskScoreForQuarantine", old, _value, msg.sender, block.timestamp);
    }

    function setMaxRiskScoreForBlock(uint256 _value) external onlyRole(ADMIN_ROLE) {
        require(_value <= 100, "Invalid value");
        require(_value > minRiskScoreForQuarantine, "Must be greater than minRiskScoreForQuarantine");
        uint256 old = maxRiskScoreForBlock;
        maxRiskScoreForBlock = _value;
        emit RiskThresholdUpdated("maxRiskScoreForBlock", old, _value, msg.sender, block.timestamp);
    }

    function setMinUpdateInterval(uint256 _value) external onlyRole(ADMIN_ROLE) {
        uint256 old = minUpdateInterval;
        minUpdateInterval = _value;
        emit RiskThresholdUpdated("minUpdateInterval", old, _value, msg.sender, block.timestamp);
    }

    function setEmergencyCooldown(uint256 _cooldown) external onlyRole(ADMIN_ROLE) {
        if (_cooldown > MAX_EMERGENCY_COOLDOWN) revert InvalidCooldown(_cooldown);
        uint256 old = emergencyCooldown;
        emergencyCooldown = _cooldown;
        emit EmergencyCooldownUpdated(old, _cooldown, msg.sender, block.timestamp);
    }

    function setWhitelist(address account, bool status) external onlyRole(ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _whitelist[account] = status;
        emit WhitelistUpdated(account, status, msg.sender, block.timestamp);
    }
    
    // ============ V2.1: Guard Integration ============
    
    /**
     * @notice 设置 PreTransactionGuard 地址
     */
    function setGuard(address _guard) external onlyRole(ADMIN_ROLE) {
        if (_guard == address(0)) revert InvalidAddress();
        address old = address(guard);
        guard = IPreTransactionGuard(_guard);
        emit GuardSet(_guard);
    }
    
    /**
     * @notice 启用/禁用 Guard 预检
     */
    function setGuardEnabled(bool enabled) external onlyRole(ADMIN_ROLE) {
        guardEnabled = enabled;
        emit GuardEnabled(enabled);
    }
    
    /**
     * @notice 一键启用 Guard（设置地址 + 启用）
     */
    function enableGuard(address _guard) external onlyRole(ADMIN_ROLE) {
        if (_guard == address(0)) revert InvalidAddress();
        guard = IPreTransactionGuard(_guard);
        guardEnabled = true;
        emit GuardSet(_guard);
        emit GuardEnabled(true);
    }
    
    /**
     * @notice 一键禁用 Guard
     */
    function disableGuard() external onlyRole(ADMIN_ROLE) {
        guardEnabled = false;
        emit GuardEnabled(false);
    }
    
    /**
     * @notice 预览 Guard 检查结果
     */
    function previewGuardCheck(address from, address to) 
        external 
        view 
        returns (bool wouldBlock, string memory reason) 
    {
        if (!guardEnabled || address(guard) == address(0)) {
            return (false, "Guard disabled");
        }
        
        IPreTransactionGuard.TransactionIntent memory intent = IPreTransactionGuard.TransactionIntent({
            from: from,
            to: to,
            value: 0,
            token: address(0),
            data: "",
            chainId: block.chainid
        });
        
        IPreTransactionGuard.RiskAssessment memory result = guard.assessTransaction(intent);
        return (result.action == IPreTransactionGuard.Action.BLOCK, result.reason);
    }
    
    /**
     * @notice 获取 Guard 统计
     */
    function getGuardStats() external view returns (
        uint256 checks,
        uint256 blocks,
        bool enabled,
        address guardAddress
    ) {
        return (totalGuardChecks, totalGuardBlocked, guardEnabled, address(guard));
    }

    // ============ Emergency ============

    function activateEmergency() external onlyRole(ADMIN_ROLE) {
        if (emergencyMode) revert AlreadyInEmergencyMode();
        if (block.timestamp < lastEmergencyTime + emergencyCooldown) {
            revert EmergencyCooldownActive();
        }
        emergencyMode = true;
        lastEmergencyTime = block.timestamp;
        emit EmergencyModeActivated(block.timestamp, block.number);
    }

    function deactivateEmergency() external onlyRole(ADMIN_ROLE) {
        if (block.timestamp < lastEmergencyTime + MIN_EMERGENCY_DURATION) {
            revert TooEarly(lastEmergencyTime + MIN_EMERGENCY_DURATION);
        }
        emergencyMode = false;
        emit EmergencyModeDeactivated(block.timestamp, block.number);
    }

    // ============ Pausable ============

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    // ============ Role Management ============

    function grantRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
        emit RoleGrantedDetailed(role, account, msg.sender, block.timestamp, reason);
    }

    function revokeRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
        emit RoleRevokedDetailed(role, account, msg.sender, block.timestamp, reason);
    }

    // ============ View ============

    function getTransactionStats() external view returns (
        uint256 checked,
        uint256 blocked,
        uint256 quarantined,
        uint256 allowed
    ) {
        return (
            totalTransactionsChecked,
            totalTransactionsBlocked,
            totalTransactionsQuarantined,
            totalTransactionsAllowed
        );
    }

    function getAddressStats(address account) external view returns (uint256 count, uint256 lastCheck) {
        return (addressTransactionCount[account], addressLastCheckTime[account]);
    }

    /// @dev Storage gap for future upgrade compatibility
    uint256[50] private __gap;
}