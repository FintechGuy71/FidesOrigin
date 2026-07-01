// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "./interfaces/IComplianceEngine.sol";
import "./interfaces/IAssetCompliance.sol";
import "./interfaces/IWalletCompliance.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "./RiskRegistry.sol";
import "./PolicyEngine.sol";

/**
 * @title ComplianceEngine
 * @notice 核心合规引擎 — 协调所有合规检查
 * @dev VERSION: 1.2.1 - 修复时间操纵风险(P0-6) + 事件索引(P1-6) + 审计日志(P1-12) + MEV保护(P1-11)
 *      + whenNotPaused(S-04) + Fail-Closed(S-05)
 */
contract ComplianceEngine is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, IComplianceEngine, IWalletCompliance {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    /// @notice I-17 NOTE: DEFAULT_ADMIN_ROLE 是 OpenZeppelin 内置的超级管理员角色。
    ///         部署完成后，应将其转移给 FidesOriginTimelock 合约，
    ///         以实现去中心化管理和防止单点权力集中。
    ///         转移命令: `grantRole(DEFAULT_ADMIN_ROLE, timelockAddress)` 然后 `renounceRole(DEFAULT_ADMIN_ROLE, deployer)`
    
    /// @notice 合约版本号
    string public constant VERSION = "1.2.1";
    
    // ============ State Variables ============
    
    RiskRegistry public riskRegistry;
    PolicyEngine public policyEngine;
    
    /// @notice 合规检查计数器
    uint256 public totalChecks;
    uint256 public blockedTransactions;
    uint256 public quarantinedTransactions;
    
    uint256 public constant MAX_HISTORY_SIZE = 10000;
    
    /// @notice 隔离交易 nonce — 保证 quarantineId 唯一性 (H-1)
    uint256 public quarantineNonce;
    
    /// @notice 检查历史
    struct CheckRecord {
        address addr;
        uint256 riskScore;
        bool isCompliant;
        uint256 timestamp;
        uint256 blockNumber;
        bytes32 checkType;
        string reason;
    }
    
    CheckRecord[] public checkHistory;
    mapping(address => uint256) public addressCheckCount;
    
    /// @notice 暂停的合规规则
    mapping(bytes32 => bool) public pausedRules;
    
    /// @notice 发行方策略配置
    mapping(address => IssuerPolicy) public issuerPolicies;
    
    /// @notice 地址日累计转账额 (address => dayKey => amount)
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    
    /// @notice 最后转账时间
    mapping(address => uint256) public lastTransferTime;
    
    /// @notice 隔离交易
    mapping(bytes32 => QuarantineRecord) public quarantinedTxs;
    bytes32[] public quarantineList;
    
    struct QuarantineRecord {
        address from;
        address to;
        uint256 amount;
        address token;
        uint256 timestamp;
        bool released;
        address operator;
        string reason;
    }
    
    /// @notice M-03: UUPS upgrade timelock state
    uint256 public upgradeTimelockDelay;
    mapping(bytes32 => uint256) public upgradeProposals;
    mapping(address => bytes32) public implementationToProposal;
    
    // ============ Events ============
    
    event ComplianceCheckPerformed(
        address indexed addr,
        uint256 indexed riskScore,
        bool indexed isCompliant,
        uint256 timestamp,
        uint256 blockNumber,
        bytes32 checkType
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
    
    event RiskRegistrySet(address indexed registry);
    event PolicyEngineSet(address indexed engine);
    event RulePaused(bytes32 indexed ruleId);
    event RuleUnpaused(bytes32 indexed ruleId);
    event QuarantineReleased(
        bytes32 indexed quarantineId,
        address indexed operator,
        uint256 timestamp
    );
    
    /// @notice H-04 FIX: setIssuerPolicy 事件，记录发行方策略变更
    event IssuerPolicySet(address indexed token, uint256 maxTxAmount, uint256 dailyLimit, uint256 cooldownPeriod, address indexed admin);
    
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
    
    // M-03: Upgrade timelock events
    event UpgradeProposed(bytes32 indexed proposalId, address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(bytes32 indexed proposalId, address indexed newImplementation);
    event UpgradeTimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error RegistryNotSet();
    error PolicyNotSet();
    error RulePausedError(bytes32 ruleId);
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error UnauthorizedCaller(address caller);
    error BatchSizeExceeded(uint256 size, uint256 maxSize);
    error UpgradeTimelockActive(bytes32 proposalId, uint256 executeAfter);
    error UpgradeNotProposed(bytes32 proposalId);
    
    // ============ Constructor & Initializer ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _riskRegistry, address _policyEngine) external initializer {
        __Context_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        require(_riskRegistry != address(0), "Invalid risk registry");
        require(_policyEngine != address(0), "Invalid policy engine");
        // [NICE_TO_HAVE] 验证依赖地址为真实合约
        require(_riskRegistry.code.length > 0, "Risk registry not a contract");
        require(_policyEngine.code.length > 0, "Policy engine not a contract");
        
        riskRegistry = RiskRegistry(_riskRegistry);
        policyEngine = PolicyEngine(_policyEngine);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        // L-15: Set ADMIN_ROLE as admin of itself and OPERATOR_ROLE
        // DEFAULT_ADMIN_ROLE is retained as ultimate safety net for role recovery
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        
        // M-03: Initialize upgrade timelock delay
        upgradeTimelockDelay = 2 days;
    }
    
    // M-03: UUPS upgrade timelock proposal
    function proposeUpgrade(address newImplementation) external onlyRole(ADMIN_ROLE) returns (bytes32 proposalId) {
        require(newImplementation != address(0), "Zero address");
        proposalId = keccak256(abi.encode(newImplementation, block.chainid, block.timestamp));
        upgradeProposals[proposalId] = block.timestamp + upgradeTimelockDelay;
        implementationToProposal[newImplementation] = proposalId;
        emit UpgradeProposed(proposalId, newImplementation, upgradeProposals[proposalId]);
    }
    
    function setUpgradeTimelockDelay(uint256 delay) external onlyRole(ADMIN_ROLE) {
        require(delay >= 1 hours && delay <= 30 days, "Invalid delay");
        uint256 oldDelay = upgradeTimelockDelay;
        upgradeTimelockDelay = delay;
        emit UpgradeTimelockDelayUpdated(oldDelay, delay);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {
        bytes32 proposalId = implementationToProposal[newImplementation];
        if (proposalId == bytes32(0)) revert UpgradeNotProposed(proposalId);
        uint256 executeAfter = upgradeProposals[proposalId];
        if (block.timestamp < executeAfter) revert UpgradeTimelockActive(proposalId, executeAfter);
        delete upgradeProposals[proposalId];
        delete implementationToProposal[newImplementation];
        emit UpgradeExecuted(proposalId, newImplementation);
    }
    
    // ============ Core Compliance Checks ============
    
    /**
     * @notice 检查地址合规性
     * @dev GAS-01 NOTE: Each call writes to checkHistory + counters. Consider batching
     *      or moving statistics to off-chain indexing for high-throughput scenarios.
     * @dev M-08 NOTE: 此函数会修改状态（totalChecks, checkHistory），
     *      外部调用者应谨慎使用。推荐通过 checkTransfer/checkTransactionCompliance 间接调用。
     * @param addr 目标地址
     * @return isCompliant 是否合规
     * @return riskScore 风险分数
     * @return reason 原因
     */
    function checkAddressCompliance(address addr) 
        public 
        whenNotPaused 
        returns (bool isCompliant, uint256 riskScore, string memory reason) 
    {
        if (addr == address(0)) {
            emit ZeroAddressRejected("checkAddressCompliance", block.timestamp);
            revert InvalidAddress();
        }
        if (address(riskRegistry) == address(0)) revert RegistryNotSet();
        
        (uint256 _score, , , , , bool _sanctioned, bool _exists, ) = riskRegistry.getProfile(addr);
        riskScore = _score;
        
        // [S-05] Fail-Closed: 未知地址默认视为不合规
        if (!_exists) {
            isCompliant = false;
            reason = "No risk profile - fail closed";
        } else if (_sanctioned) {
            isCompliant = false;
            reason = "Sanctioned address";
        } else if (riskScore >= 95) {
            isCompliant = false;
            reason = "Critical risk score";
        } else if (riskScore >= 80) {
            isCompliant = false;
            reason = "High risk score";
        } else {
            isCompliant = true;
            reason = "Low risk";
        }
        
        totalChecks++;
        addressCheckCount[addr]++;
        
        if (checkHistory.length >= MAX_HISTORY_SIZE) {
            uint256 index = (totalChecks - 1) % MAX_HISTORY_SIZE;
            checkHistory[index] = CheckRecord({
                addr: addr,
                riskScore: riskScore,
                isCompliant: isCompliant,
                timestamp: block.timestamp,
                blockNumber: block.number,
                checkType: "address",
                reason: reason
            });
        } else {
            checkHistory.push(CheckRecord({
                addr: addr,
                riskScore: riskScore,
                isCompliant: isCompliant,
                timestamp: block.timestamp,
                blockNumber: block.number,
                checkType: "address",
                reason: reason
            }));
        }
        
        emit ComplianceCheckPerformed(addr, riskScore, isCompliant, block.timestamp, block.number, "address");
        
        return (isCompliant, riskScore, reason);
    }
    
    /**
     * @notice 检查转账合规性
     * @param from 发送方
     * @param to 接收方
     * @param amount 金额
     * @param token 代币地址
     * @return decision 决策
     * @return reason 原因
     */
    function checkTransfer(address from, address to, uint256 amount, address token) 
        public 
        whenNotPaused
        returns (Decision decision, string memory reason) 
    {
        // [C-1] 修复: 调用者权限验证
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert UnauthorizedCaller(msg.sender);
        }
        return checkTransferWithDeadline(from, to, amount, token, block.timestamp + 1 hours);
    }
    
    /**
     * @notice 检查转账合规性（带 deadline）
     * @param from 发送方
     * @param to 接收方
     * @param amount 金额
     * @param token 代币地址
     * @param deadline 截止时间
     * @return decision 决策
     * @return reason 原因
     */
    function checkTransferWithDeadline(
        address from, 
        address to, 
        uint256 amount, 
        address token,
        uint256 deadline
    ) 
        public 
        whenNotPaused
        nonReentrant
        returns (Decision decision, string memory reason) 
    {
        // [C-1] 修复: 调用者权限验证 — 只有 from 本人或授权 Operator 才能发起
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert UnauthorizedCaller(msg.sender);
        }
        
        // MEV 保护 - deadline 检查
        if (deadline < block.timestamp) {
            revert DeadlineExpired(deadline, block.timestamp);
        }
        
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (address(policyEngine) == address(0)) revert PolicyNotSet();
        
        // 检查发送方
        (bool fromCompliant, , string memory fromReason) = checkAddressCompliance(from);
        if (!fromCompliant) {
            decision = Decision.BLOCK;
            reason = fromReason;
            emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
            blockedTransactions++;
            return (decision, reason);
        }
        
        // 检查接收方
        (bool toCompliant, , string memory toReason) = checkAddressCompliance(to);
        if (!toCompliant) {
            decision = Decision.BLOCK;
            reason = toReason;
            emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
            blockedTransactions++;
            return (decision, reason);
        }
        
        // 检查发行方策略
        IssuerPolicy memory policy = issuerPolicies[token];
        
        // [Fix] 检查代币黑名单
        // M-02 FIX: Check if destination is a blocked token, not self-reference
        if (policy.blockedTokens.length > 0) {
            for (uint256 i = 0; i < policy.blockedTokens.length; i++) {
                if (policy.blockedTokens[i] == to) {
                    decision = Decision.BLOCK;
                    reason = "Destination token is blocked by issuer policy";
                    emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
                    blockedTransactions++;
                    return (decision, reason);
                }
            }
        }
        
        if (policy.maxTxAmount > 0 && amount > policy.maxTxAmount) {
            decision = Decision.BLOCK;
            reason = "Exceeds max transaction amount";
            emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
            blockedTransactions++;
            return (decision, reason);
        }
        
        // [C-2] 修复: 检查日限额（仅查询，不修改状态）
        if (policy.dailyLimit > 0) {
            uint256 dayKey = block.timestamp / 1 days;
            uint256 spent = dailySpent[from][dayKey];
            if (spent + amount > policy.dailyLimit) {
                decision = Decision.BLOCK;
                reason = "Daily limit exceeded";
                emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
                blockedTransactions++;
                return (decision, reason);
            }
        }
        
        // [M-2] 修复: 检查冷却期（增加 != 0 判断防止新地址被阻断）
        if (policy.cooldownPeriod > 0) {
            if (lastTransferTime[from] != 0 && block.timestamp - lastTransferTime[from] < policy.cooldownPeriod) {
                // [H-1] 修复: 使用递增 nonce 保证 quarantineId 唯一性
                bytes32 quarantineId = keccak256(abi.encodePacked(
                    block.timestamp,
                    block.number,
                    quarantineNonce++,
                    from,
                    to,
                    amount,
                    token,
                    msg.sender
                ));
                
                quarantinedTxs[quarantineId] = QuarantineRecord({
                    from: from,
                    to: to,
                    amount: amount,
                    token: token,
                    timestamp: block.timestamp,
                    released: false,
                    operator: msg.sender,
                    reason: "Cooldown period active"
                });
                quarantineList.push(quarantineId);
                quarantinedTransactions++;
                
                // L-01 FIX: Update lastTransferTime even for HOLD to prevent perpetual holding
                lastTransferTime[from] = block.timestamp;
                
                decision = Decision.HOLD;
                reason = "Cooldown period active";
                emit TransactionQuarantined(from, to, amount, token, quarantineId, block.timestamp, block.number);
                return (decision, reason);
            }
        }
        
        // [C-2] 修复: 只有最终判定为 ALLOW 时才更新所有状态
        if (policy.dailyLimit > 0) {
            dailySpent[from][block.timestamp / 1 days] += amount;
        }
        lastTransferTime[from] = block.timestamp;
        
        decision = Decision.ALLOW;
        reason = "Transfer allowed";
        return (decision, reason);
    }
    
    /**
     * @notice 手动隔离交易
     */
    function quarantineTransaction(
        address from,
        address to,
        uint256 amount,
        address token,
        string memory reason
    ) 
        external 
        onlyRole(OPERATOR_ROLE) 
        whenNotPaused
        nonReentrant 
        returns (bytes32 quarantineId) 
    {
        // [H-1] 修复: 使用递增 nonce 保证 quarantineId 唯一性
        quarantineId = keccak256(abi.encodePacked(
            block.timestamp,
            block.number,
            quarantineNonce++,
            from,
            to,
            amount,
            token,
            msg.sender
        ));
        
        quarantinedTxs[quarantineId] = QuarantineRecord({
            from: from,
            to: to,
            amount: amount,
            token: token,
            timestamp: block.timestamp,
            released: false,
            operator: msg.sender,
            reason: reason
        });
        quarantineList.push(quarantineId);
        quarantinedTransactions++;
        
        emit TransactionQuarantined(from, to, amount, token, quarantineId, block.timestamp, block.number);
    }
    
    /**
     * @notice 释放隔离的交易
     */
    function releaseQuarantine(
        bytes32 quarantineId
    ) 
        external 
        onlyRole(OPERATOR_ROLE) 
        whenNotPaused
        nonReentrant 
    {
        QuarantineRecord storage record = quarantinedTxs[quarantineId];
        require(!record.released, "Already released");
        require(record.from != address(0), "Quarantine not found");
        
        record.released = true;
        
        emit QuarantineReleased(quarantineId, msg.sender, block.timestamp);
    }
    
    /**
     * @notice 获取隔离记录
     */
    function getQuarantineRecord(bytes32 quarantineId) 
        external 
        view 
        returns (QuarantineRecord memory) 
    {
        return quarantinedTxs[quarantineId];
    }
    
    /**
     * @notice 获取隔离列表长度
     */
    function getQuarantineListLength() external view returns (uint256) {
        return quarantineList.length;
    }
    
    /**
     * @notice 获取检查历史长度
     */
    function getCheckHistoryLength() external view returns (uint256) {
        return checkHistory.length;
    }
    
    /**
     * @notice L-12 FIX: 分页查询检查历史（防止无界数组遍历导致 OOG）
     * @param offset 起始索引
     * @param limit 返回数量上限
     */
    function getCheckHistoryPaginated(uint256 offset, uint256 limit) external view returns (CheckRecord[] memory page) {
        uint256 total = checkHistory.length;
        if (offset >= total) return new CheckRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new CheckRecord[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = checkHistory[offset + i];
        }
    }
    
    /**
     * @notice L-12 FIX: 分页查询隔离列表（防止无界数组遍历导致 OOG）
     * @param offset 起始索引
     * @param limit 返回数量上限
     */
    function getQuarantineListPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory page) {
        uint256 total = quarantineList.length;
        if (offset >= total) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new bytes32[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = quarantineList[offset + i];
        }
    }
    
    /**
     * @notice 获取检查记录
     */
    function getCheckRecord(uint256 index) external view returns (CheckRecord memory) {
        require(index < checkHistory.length, "Index out of bounds");
        return checkHistory[index];
    }
    
    /**
     * @notice 设置风险注册表
     */
    function setRiskRegistry(address _registry) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        if (_registry == address(0)) revert InvalidAddress();
        require(_registry.code.length > 0, "Not a contract");
        riskRegistry = RiskRegistry(_registry);
        emit RiskRegistrySet(_registry);
    }
    
    /**
     * @notice 设置策略引擎
     */
    function setPolicyEngine(address _engine) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        if (_engine == address(0)) revert InvalidAddress();
        require(_engine.code.length > 0, "Not a contract");
        policyEngine = PolicyEngine(_engine);
        emit PolicyEngineSet(_engine);
    }
    
    /**
     * @notice 设置发行方策略
     * @dev 修复: 增加输入校验，防止恶意/误操作导致 DoS
     */
    function setIssuerPolicy(
        address token,
        IssuerPolicy calldata policy
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (token == address(0)) revert InvalidAddress();
        if (policy.blockedTokens.length > 50) revert BatchSizeExceeded(policy.blockedTokens.length, 50);
        if (policy.maxTxAmount > policy.dailyLimit && policy.dailyLimit > 0) revert("maxTxAmount > dailyLimit");
        if (policy.cooldownPeriod > 30 days) revert("cooldown too long");
        issuerPolicies[token] = policy;
        // H-04 FIX: emit event for issuer policy changes
        emit IssuerPolicySet(token, policy.maxTxAmount, policy.dailyLimit, policy.cooldownPeriod, msg.sender);
    }
    
    /**
     * @notice 暂停规则
     */
    function pauseRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        pausedRules[ruleId] = true;
        emit RulePaused(ruleId);
    }
    
    /**
     * @notice 恢复规则
     */
    function unpauseRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        pausedRules[ruleId] = false;
        emit RuleUnpaused(ruleId);
    }
    
    /**
     * @notice 紧急暂停合约
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }
    
    /**
     * @notice 恢复合约
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }
    
    /**
     * @notice 批量检查地址合规性
     */
    function batchCheckAddressCompliance(address[] calldata addrs) 
        external 
        whenNotPaused
        returns (bool[] memory results, uint256[] memory scores) 
    {
        if (addrs.length > 100) revert BatchSizeExceeded(addrs.length, 100);
        
        results = new bool[](addrs.length);
        scores = new uint256[](addrs.length);
        
        for (uint256 i = 0; i < addrs.length; i++) {
            (bool compliant, uint256 score, ) = checkAddressCompliance(addrs[i]);
            results[i] = compliant;
            scores[i] = score;
        }
    }
    
    // ============ IAssetCompliance / IComplianceEngine Interface Implementation ============
    
    /**
     * @notice 转账前合规检查 (view函数)
     * @dev IAssetCompliance.validateTransfer 实现
     */
    function validateTransfer(
        address from,
        address to,
        uint256 amount,
        address assetContract
    ) external view returns (Decision decision, string memory reason) {
        // 权限检查（和 checkTransfer 一致）
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert UnauthorizedCaller(msg.sender);
        }
        
        // 简化：复用 checkTransfer 逻辑但不改状态
        if (from == address(0) || to == address(0)) {
            return (Decision.BLOCK, "Invalid address");
        }
        if (address(riskRegistry) == address(0)) {
            return (Decision.BLOCK, "Registry not set");
        }
        
        // 检查发送方
        (uint256 fromScore, , , , , bool fromSanctioned, bool fromExists, ) = riskRegistry.getProfile(from);
        if (!fromExists) {
            return (Decision.BLOCK, "No risk profile - fail closed");
        }
        if (fromSanctioned) {
            return (Decision.BLOCK, "Sanctioned address");
        }
        if (fromScore >= 95) {
            return (Decision.BLOCK, "Critical risk score");
        }
        if (fromScore >= 80) {
            return (Decision.BLOCK, "High risk score");
        }
        
        // 检查接收方
        (uint256 toScore, , , , , bool toSanctioned, bool toExists, ) = riskRegistry.getProfile(to);
        if (!toExists) {
            return (Decision.BLOCK, "No risk profile - fail closed");
        }
        if (toSanctioned) {
            return (Decision.BLOCK, "Sanctioned address");
        }
        if (toScore >= 95) {
            return (Decision.BLOCK, "Critical risk score");
        }
        if (toScore >= 80) {
            return (Decision.BLOCK, "High risk score");
        }
        
        // 检查发行方策略
        IssuerPolicy memory policy = issuerPolicies[assetContract];
        if (policy.maxTxAmount > 0 && amount > policy.maxTxAmount) {
            return (Decision.BLOCK, "Exceeds max transaction amount");
        }
        if (policy.dailyLimit > 0) {
            uint256 dayKey = block.timestamp / 1 days;
            uint256 spent = dailySpent[from][dayKey];
            if (spent + amount > policy.dailyLimit) {
                return (Decision.BLOCK, "Daily limit exceeded");
            }
        }
        
        return (Decision.ALLOW, "Transfer allowed");
    }
    
    /**
     * @notice 转账前钩子 - 如果BLOCK则revert
     * @dev IAssetCompliance.preTransferHook 实现
     */
    function preTransferHook(
        address from,
        address to,
        uint256 amount
    ) external view {
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert RegistryNotSet();
        
        (uint256 fromScore, , , , , bool fromSanctioned, bool fromExists, ) = riskRegistry.getProfile(from);
        if (!fromExists) revert("No risk profile - fail closed");
        if (fromSanctioned) revert("Sanctioned address");
        if (fromScore >= 95) revert("Critical risk score");
        if (fromScore >= 80) revert("High risk score");
        
        (uint256 toScore, , , , , bool toSanctioned, bool toExists, ) = riskRegistry.getProfile(to);
        if (!toExists) revert("No risk profile - fail closed");
        if (toSanctioned) revert("Sanctioned address");
        if (toScore >= 95) revert("Critical risk score");
        if (toScore >= 80) revert("High risk score");
    }
    
    /**
     * @notice 转账后钩子 - 记录转账
     * @dev IAssetCompliance.postTransferHook 实现
     * @dev M-07 FIX: 添加 onlyRole(OPERATOR_ROLE) 限制，防止未授权调用
     */
    function postTransferHook(
        address from,
        address to,
        uint256 amount,
        bool success
    ) external onlyRole(OPERATOR_ROLE) {
        emit TransferRecorded(
            msg.sender, // asset contract caller
            from,
            to,
            amount,
            success
        );
    }
    
    /**
     * @notice 获取地址完整风险档案
     * @dev IAssetCompliance.getAddressRisk 实现
     */
    function getAddressRisk(address account) external view returns (RiskProfile memory) {
        if (address(riskRegistry) == address(0)) {
            return RiskProfile({
                riskScore: 0,
                tier: RiskTier.UNKNOWN,
                tags: new bytes32[](0),
                lastUpdated: 0,
                isSanctioned: false
            });
        }
        (uint256 score, , uint32 lastUpdated, uint8 riskTier, , bool sanctioned, bool exists, bytes32[] memory tags) = riskRegistry.getProfile(account);
        if (!exists) {
            return RiskProfile({
                riskScore: 0,
                tier: RiskTier.UNKNOWN,
                tags: new bytes32[](0),
                lastUpdated: 0,
                isSanctioned: false
            });
        }
        return RiskProfile({
            riskScore: uint8(score),
            tier: RiskTier(riskTier),
            tags: tags,
            lastUpdated: lastUpdated,
            isSanctioned: sanctioned
        });
    }
    
    /**
     * @notice 获取地址风险等级
     * @dev IAssetCompliance.getRiskTier 实现
     */
    function getRiskTier(address account) external view returns (RiskTier) {
        if (address(riskRegistry) == address(0)) return RiskTier.UNKNOWN;
        (, , , uint8 tier, , , bool exists, ) = riskRegistry.getProfile(account);
        if (!exists) return RiskTier.UNKNOWN;
        return RiskTier(tier);
    }
    
    /**
     * @notice 检查地址是否在制裁名单
     * @dev IAssetCompliance.isSanctioned 实现
     */
    function isSanctioned(address account) external view returns (bool) {
        if (address(riskRegistry) == address(0)) return false;
        (, , , , , bool sanctioned, bool exists, ) = riskRegistry.getProfile(account);
        if (!exists) return false;
        return sanctioned;
    }
    
    /**
     * @notice 获取发行方策略配置
     * @dev IAssetCompliance.getIssuerPolicy 实现
     */
    function getIssuerPolicy(address issuer) external view returns (IssuerPolicy memory) {
        return issuerPolicies[issuer];
    }
    
    /**
     * @notice 计算地址日累计转账额
     * @dev IAssetCompliance.getDailySpent 实现
     */
    function getDailySpent(address account, address asset) external view returns (uint256) {
        uint256 dayKey = block.timestamp / 1 days;
        return dailySpent[account][dayKey];
    }
    
    /**
     * @notice 交易合规检查（带 deadline）
     * @dev IComplianceEngine.checkTransactionCompliance 实现
     */
    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external returns (bool isCompliant, uint8[] memory actionTypes) {
        (Decision decision, ) = checkTransferWithDeadline(from, to, amount, token, deadline);
        isCompliant = decision != Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(decision);
        return (isCompliant, actionTypes);
    }
    
    /**
     * @notice 交易合规检查（简版）
     * @dev IComplianceEngine.checkTransactionCompliance 实现
     */
    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token
    ) external returns (bool isCompliant, uint8[] memory actionTypes) {
        (Decision decision, ) = checkTransfer(from, to, amount, token);
        isCompliant = decision != Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(decision);
        return (isCompliant, actionTypes);
    }
    
    // ============ IWalletCompliance Interface Implementation ============
    
    /**
     * @notice 验证单个操作合规性
     * @dev IWalletCompliance.validateOperation 实现
     */
    function validateOperation(
        address walletOwner,
        Operation calldata op,
        address walletContract
    ) external view returns (Decision decision, string memory reason) {
        // Basic validation: check wallet owner risk
        (uint256 score, , , , , bool sanctioned, bool exists, ) = riskRegistry.getProfile(walletOwner);
        if (!exists) {
            return (Decision.BLOCK, "No risk profile - fail closed");
        }
        if (sanctioned) {
            return (Decision.BLOCK, "Sanctioned address");
        }
        if (score >= 95) {
            return (Decision.BLOCK, "Critical risk score");
        }
        if (score >= 80) {
            return (Decision.BLOCK, "High risk score");
        }
        // For TRANSFER operations, validate like a regular transfer
        if (op.opType == OperationType.TRANSFER) {
            return this.validateTransfer(walletOwner, op.target, op.value, walletContract);
        }
        return (Decision.ALLOW, "Operation allowed");
    }
    
    /**
     * @notice 执行前钩子 - 会revert如果BLOCK
     * @dev IWalletCompliance.preExecutionHook 实现
     */
    function preExecutionHook(
        address walletOwner,
        Operation calldata op
    ) external view {
        if (op.target == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert RegistryNotSet();
        
        (uint256 score, , , , , bool sanctioned, bool exists, ) = riskRegistry.getProfile(walletOwner);
        if (!exists) revert("No risk profile - fail closed");
        if (sanctioned) revert("Sanctioned address");
        if (score >= 95) revert("Critical risk score");
        if (score >= 80) revert("High risk score");
        
        // For TRANSFER operations, also run preTransferHook
        if (op.opType == OperationType.TRANSFER) {
            this.preTransferHook(walletOwner, op.target, op.value);
        }
    }
    
    /**
     * @notice 执行后钩子
     * @dev IWalletCompliance.postExecutionHook 实现
     */
    function postExecutionHook(
        address walletOwner,
        Operation calldata op,
        bool success
    ) external onlyRole(OPERATOR_ROLE) {
        emit OperationExecuted(
            msg.sender,
            walletOwner,
            op.opType,
            success
        );
    }
    
    /**
     * @notice 批量验证操作
     * @dev IWalletCompliance.validateBatch 实现
     */
    function validateBatch(
        address walletOwner,
        Operation[] calldata ops
    ) external view returns (Decision[] memory decisions) {
        decisions = new Decision[](ops.length);
        for (uint256 i = 0; i < ops.length; i++) {
            (decisions[i], ) = this.validateOperation(walletOwner, ops[i], address(0));
        }
    }
    
    /**
     * @notice 批量执行前检查
     * @dev IWalletCompliance.preBatchExecutionHook 实现
     */
    function preBatchExecutionHook(
        address walletOwner,
        Operation[] calldata ops
    ) external view {
        for (uint256 i = 0; i < ops.length; i++) {
            this.preExecutionHook(walletOwner, ops[i]);
        }
    }
    
    /**
     * @notice 解析操作风险特征
     * @dev IWalletCompliance.analyzeOperationRisk 实现
     */
    function analyzeOperationRisk(
        Operation calldata op
    ) external view returns (uint8 riskScore, RiskTier tier, string memory riskFactors) {
        if (op.target == address(0)) {
            return (100, RiskTier.CRITICAL, "Zero address target");
        }
        // Get target contract risk
        (uint256 targetScore, , , uint8 targetTier, , bool targetSanctioned, bool targetExists, ) = riskRegistry.getProfile(op.target);
        if (!targetExists) {
            return (50, RiskTier.MEDIUM, "Unknown target address");
        }
        if (targetSanctioned) {
            return (100, RiskTier.CRITICAL, "Sanctioned target");
        }
        return (uint8(targetScore), RiskTier(targetTier), "Standard risk");
    }
    
    /**
     * @notice 获取钱包策略
     * @dev IWalletCompliance.getWalletPolicy 实现
     */
    function getWalletPolicy(address wallet) external view returns (WalletPolicy memory) {
        // Return empty policy - wallet policies are managed by PolicyEngine
        return WalletPolicy({
            maxTxValue: 0,
            maxTokenTxAmount: 0,
            dailyEthLimit: 0,
            dailyTokenLimit: 0,
            blockContractCalls: false,
            blockUnknownTokens: false,
            requireWhitelist: false,
            allowedDex: new address[](0),
            blockedContracts: new address[](0),
            whitelistedContracts: new bytes32[](0)
        });
    }
    
    /**
     * @notice 检查目标合约风险
     * @dev IWalletCompliance.getContractRisk 实现
     */
    function getContractRisk(address target) external view returns (bool isVerified, uint8 riskScore, string memory contractType) {
        (uint256 score, , , , , , bool exists, ) = riskRegistry.getProfile(target);
        if (!exists) {
            return (false, 0, "Unknown");
        }
        return (true, uint8(score), "Contract");
    }
    
    /**
     * @notice 授权角色并记录详细日志
     */
    function grantRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
        emit RoleGrantedDetailed(role, account, msg.sender, block.timestamp, reason);
    }
    
    /**
     * @notice 撤销角色并记录详细日志
     */
    function revokeRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
        emit RoleRevokedDetailed(role, account, msg.sender, block.timestamp, reason);
    }
    
    /// @dev Storage gap for future upgrade compatibility (H-09)
    uint256[50] private __gap;
}