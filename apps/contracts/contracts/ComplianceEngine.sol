// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "./interfaces/IComplianceEngine.sol";
import "./interfaces/IAssetCompliance.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "./RiskRegistry.sol";
import "./PolicyEngine.sol";

/**
 * @title ComplianceEngine
 * @notice 核心合规引擎 — 协调所有合规检查
 * @dev VERSION: 1.2.1 - 修复时间操纵风险(P0-6) + 事件索引(P1-6) + 审计日志(P1-12) + MEV保护(P1-11)
 *      + whenNotPaused(S-04) + Fail-Closed(S-05)
 */
contract ComplianceEngine is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
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
    
    /// @notice 发行方策略配置
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
    
    // ============ Errors ============
    
    error InvalidAddress();
    error RegistryNotSet();
    error PolicyNotSet();
    error RulePausedError(bytes32 ruleId);
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error UnauthorizedCaller(address caller);
    error BatchSizeExceeded(uint256 size, uint256 maxSize);
    
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
        
        // L-15: Set ADMIN_ROLE as admin of itself and OPERATOR_ROLE before renouncing DEFAULT_ADMIN_ROLE
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        
        // L-15: Renounce DEFAULT_ADMIN_ROLE after granting ADMIN_ROLE to reduce centralization risk
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
    
    // ============ Core Compliance Checks ============
    
    /**
     * @notice 检查地址合规性
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
        returns (IComplianceEngine.Decision decision, string memory reason) 
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
        returns (IComplianceEngine.Decision decision, string memory reason) 
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
            decision = IComplianceEngine.Decision.BLOCK;
            reason = fromReason;
            emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
            blockedTransactions++;
            return (decision, reason);
        }
        
        // 检查接收方
        (bool toCompliant, , string memory toReason) = checkAddressCompliance(to);
        if (!toCompliant) {
            decision = IComplianceEngine.Decision.BLOCK;
            reason = toReason;
            emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
            blockedTransactions++;
            return (decision, reason);
        }
        
        // 检查发行方策略
        IssuerPolicy memory policy = issuerPolicies[token];
        
        // [Fix] 检查代币黑名单
        if (policy.blockedTokens.length > 0) {
            for (uint256 i = 0; i < policy.blockedTokens.length; i++) {
                if (policy.blockedTokens[i] == token) {
                    decision = IComplianceEngine.Decision.BLOCK;
                    reason = "Token is blocked by issuer policy";
                    emit TransactionBlocked(from, to, amount, token, reason, block.timestamp, block.number);
                    blockedTransactions++;
                    return (decision, reason);
                }
            }
        }
        
        if (policy.maxTxAmount > 0 && amount > policy.maxTxAmount) {
            decision = IComplianceEngine.Decision.BLOCK;
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
                decision = IComplianceEngine.Decision.BLOCK;
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
                
                decision = IComplianceEngine.Decision.HOLD;
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
        
        decision = IComplianceEngine.Decision.ALLOW;
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