// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title TestUSD
 * @dev FidesOrigin MVP Demo Phase 3
 * @notice 链上执行级可编程合规协议 - 多标签风控 + 交易限额 + 时间锁 + 多签
 */
contract TestUSD is ERC20, AccessControl, Pausable {
    using EnumerableSet for EnumerableSet.AddressSet;
    
    // ========== 角色定义 ==========
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VIEWER_ROLE = keccak256("VIEWER_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    
    // ========== 标签类型 ==========
    enum RiskLevel { 
        UNKNOWN,    // 0: 未分类
        VIP,        // 1: VIP用户 - 更高限额
        NORMAL,     // 2: 普通用户
        GREY,       // 3: 灰名单 - 限制交易
        BLACK       // 4: 黑名单 - 禁止交易
    }
    
    // ========== 操作类型 ==========
    enum OperationType {
        MINT,
        BURN,
        TRANSFER_OWNERSHIP,
        UPDATE_LIMITS,
        TAG_ADDRESS,
        UNTAG_ADDRESS,
        UPDATE_TIMELock,
        EMERGENCY_PAUSE,
        EMERGENCY_UNPAUSE
    }
    
    // ========== 时间锁操作 ==========
    struct TimelockOperation {
        bytes32 operationId;
        OperationType operationType;
        address target;
        uint256 value;
        bytes data;
        uint256 timestamp;
        bool executed;
        mapping(address => bool) signatures;
        uint256 signatureCount;
        uint256 requiredSignatures;
    }
    
    // ========== 操作日志 ==========
    struct OperationLog {
        uint256 id;
        OperationType operationType;
        address operator;
        bytes32 operationId;
        string details;
        uint256 timestamp;
    }
    
    // ========== 状态变量 ==========
    
    // 地址标签映射
    mapping(address => RiskLevel) public addressRiskLevel;
    
    // 各标签地址列表
    address[] public vipList;
    address[] public greyList;
    address[] public blackList;
    
    // 交易限额配置
    struct LimitConfig {
        uint256 dailyLimit;
        uint256 singleLimit;
        bool enabled;
    }
    
    // 各标签对应的限额配置
    mapping(RiskLevel => LimitConfig) public riskLimits;
    
    // 用户每日已用额度 (用户 => 日期 => 已用金额)
    mapping(address => mapping(uint256 => uint256)) public dailyUsed;
    
    // 默认限额配置
    uint256 public constant DEFAULT_DAILY_LIMIT = 10000 * 10**18;
    uint256 public constant DEFAULT_SINGLE_LIMIT = 5000 * 10**18;
    uint256 public constant VIP_DAILY_LIMIT = 100000 * 10**18;
    uint256 public constant VIP_SINGLE_LIMIT = 50000 * 10**18;
    uint256 public constant GREY_DAILY_LIMIT = 1000 * 10**18;
    uint256 public constant GREY_SINGLE_LIMIT = 500 * 10**18;
    
    // ========== 时间锁变量 ==========
    uint256 public timelockDelay = 2 days;
    uint256 public constant MIN_DELAY = 1 days;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;
    
    mapping(bytes32 => TimelockOperation) public timelockOperations;
    bytes32[] public pendingOperations;
    
    // 多签配置
    uint256 public requiredSignatures = 2;
    uint256 public signerCount;
    EnumerableSet.AddressSet private _signers;
    
    // ========== 操作日志变量 ==========
    OperationLog[] public operationLogs;
    uint256 public logCounter;
    
    // ========== 事件 ==========
    event AddressTagged(address indexed account, RiskLevel level, string reason, address indexed operator);
    event AddressUntagged(address indexed account, RiskLevel previousLevel, address indexed operator);
    event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);
    event LimitExceeded(address indexed account, uint256 attempted, uint256 remaining, string limitType);
    event LimitsUpdated(RiskLevel level, uint256 dailyLimit, uint256 singleLimit, address indexed operator);
    
    // 时间锁事件
    event TimelockOperationScheduled(
        bytes32 indexed operationId,
        OperationType indexed operationType,
        address indexed target,
        uint256 value,
        bytes data,
        uint256 executeTime
    );
    event TimelockOperationExecuted(bytes32 indexed operationId, address indexed executor);
    event TimelockOperationCancelled(bytes32 indexed operationId, address indexed canceller);
    event TimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);
    
    // 多签事件
    event SignerAdded(address indexed signer, address indexed addedBy);
    event SignerRemoved(address indexed signer, address indexed removedBy);
    event RequiredSignaturesChanged(uint256 oldRequired, uint256 newRequired);
    event SignatureSubmitted(bytes32 indexed operationId, address indexed signer);
    
    // 操作日志事件
    event OperationLogged(uint256 indexed id, OperationType indexed operationType, address indexed operator, string details);
    
    // ========== 错误定义 ==========
    error AddressBlacklisted(address account);
    error DailyLimitExceeded(address account, uint256 attempted, uint256 remaining);
    error SingleLimitExceeded(uint256 attempted, uint256 maximum);
    error GreyListRestricted(address account);
    error NotEnoughSignatures(uint256 current, uint256 required);
    error TimelockNotReady(bytes32 operationId, uint256 executeTime);
    error TimelockExpired(bytes32 operationId);
    error AlreadySigned(bytes32 operationId, address signer);
    error NotSigner(address account);
    error CannotRemoveLastSigner();
    error InvalidTimelockDelay(uint256 delay);
    
    // ========== 修饰器 ==========
    modifier onlySigner() {
        require(hasRole(SIGNER_ROLE, msg.sender), "Not a signer");
        _;
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not an admin");
        _;
    }
    
    // ========== 构造函数 ==========
    constructor() ERC20("Test USD", "TestUSD") {
        // 设置角色
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(VIEWER_ROLE, msg.sender);
        _grantRole(SIGNER_ROLE, msg.sender);
        
        signerCount = 1;
        _signers.add(msg.sender);
        
        // 铸造初始供应量
        _mint(msg.sender, 1000000 * 10 ** decimals());
        
        // 初始化默认限额配置
        riskLimits[RiskLevel.NORMAL] = LimitConfig(DEFAULT_DAILY_LIMIT, DEFAULT_SINGLE_LIMIT, true);
        riskLimits[RiskLevel.VIP] = LimitConfig(VIP_DAILY_LIMIT, VIP_SINGLE_LIMIT, true);
        riskLimits[RiskLevel.GREY] = LimitConfig(GREY_DAILY_LIMIT, GREY_SINGLE_LIMIT, true);
        riskLimits[RiskLevel.BLACK] = LimitConfig(0, 0, false);
        
        // 添加预设黑名单
        _tagAddress(0x1234567890123456789012345678901234567890, RiskLevel.BLACK, "Preset: Hacker");
        _tagAddress(0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B, RiskLevel.BLACK, "Preset: Scammer");
        _tagAddress(0xdAC17F958D2ee523a2206206994597C13D831ec7, RiskLevel.BLACK, "Preset: Risk Address");
        
        // 添加预设 VIP
        _tagAddress(0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1, RiskLevel.VIP, "Preset: VIP User");
        
        // 添加预设灰名单
        _tagAddress(0x8ba1f109551bD432803012645Hac136c82C3e8C9, RiskLevel.GREY, "Preset: Grey List");
        
        _logOperation(OperationType.MINT, bytes32(0), "Contract initialized");
    }
    
    // ========== 标签管理函数 ==========
    
    /**
     * @dev 给地址打标签
     */
    function tagAddress(address account, RiskLevel level, string memory reason) public onlyRole(OPERATOR_ROLE) whenNotPaused {
        _tagAddress(account, level, reason);
        _logOperation(OperationType.TAG_ADDRESS, bytes32(0), 
            string(abi.encodePacked("Tagged ", _toAsciiString(account), " as ", _riskLevelToString(level))));
    }
    
    /**
     * @dev 批量打标签
     */
    function batchTagAddresses(
        address[] memory accounts, 
        RiskLevel level, 
        string memory reason
    ) public onlyRole(OPERATOR_ROLE) whenNotPaused {
        for (uint i = 0; i < accounts.length; i++) {
            _tagAddress(accounts[i], level, reason);
        }
        _logOperation(OperationType.TAG_ADDRESS, bytes32(0), 
            string(abi.encodePacked("Batch tagged ", uintToString(accounts.length), " addresses")));
    }
    
    /**
     * @dev 移除标签
     */
    function untagAddress(address account) public onlyRole(OPERATOR_ROLE) whenNotPaused {
        RiskLevel previousLevel = addressRiskLevel[account];
        require(previousLevel != RiskLevel.UNKNOWN, "Address not tagged");
        
        _removeFromList(account, previousLevel);
        addressRiskLevel[account] = RiskLevel.UNKNOWN;
        
        emit AddressUntagged(account, previousLevel, msg.sender);
        _logOperation(OperationType.UNTAG_ADDRESS, bytes32(0), 
            string(abi.encodePacked("Untagged ", _toAsciiString(account))));
    }
    
    /**
     * @dev 内部函数：打标签
     */
    function _tagAddress(address account, RiskLevel level, string memory reason) internal {
        require(account != address(0), "Invalid address");
        
        RiskLevel currentLevel = addressRiskLevel[account];
        if (currentLevel != RiskLevel.UNKNOWN) {
            _removeFromList(account, currentLevel);
        }
        
        addressRiskLevel[account] = level;
        if (level == RiskLevel.VIP) {
            vipList.push(account);
        } else if (level == RiskLevel.GREY) {
            greyList.push(account);
        } else if (level == RiskLevel.BLACK) {
            blackList.push(account);
        }
        
        emit AddressTagged(account, level, reason, msg.sender);
    }
    
    /**
     * @dev 从列表中移除地址
     */
    function _removeFromList(address account, RiskLevel level) internal {
        address[] storage list;
        if (level == RiskLevel.VIP) list = vipList;
        else if (level == RiskLevel.GREY) list = greyList;
        else if (level == RiskLevel.BLACK) list = blackList;
        else return;
        
        for (uint i = 0; i < list.length; i++) {
            if (list[i] == account) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
    }
    
    // ========== 时间锁功能 ==========
    
    /**
     * @dev 调度时间锁操作
     */
    function scheduleOperation(
        OperationType operationType,
        address target,
        uint256 value,
        bytes memory data
    ) public onlyRole(ADMIN_ROLE) returns (bytes32 operationId) {
        operationId = keccak256(abi.encode(
            operationType,
            target,
            value,
            data,
            block.timestamp
        ));
        
        require(timelockOperations[operationId].timestamp == 0, "Operation already scheduled");
        
        TimelockOperation storage op = timelockOperations[operationId];
        op.operationId = operationId;
        op.operationType = operationType;
        op.target = target;
        op.value = value;
        op.data = data;
        op.timestamp = block.timestamp + timelockDelay;
        op.executed = false;
        op.requiredSignatures = requiredSignatures;
        
        pendingOperations.push(operationId);
        
        emit TimelockOperationScheduled(
            operationId,
            operationType,
            target,
            value,
            data,
            op.timestamp
        );
        
        return operationId;
    }
    
    /**
     * @dev 为多签操作签名
     */
    function signOperation(bytes32 operationId) public onlySigner {
        TimelockOperation storage op = timelockOperations[operationId];
        require(op.timestamp != 0, "Operation not found");
        require(!op.executed, "Operation already executed");
        require(!op.signatures[msg.sender], "Already signed");
        require(block.timestamp < op.timestamp + GRACE_PERIOD, "Operation expired");
        
        op.signatures[msg.sender] = true;
        op.signatureCount++;
        
        emit SignatureSubmitted(operationId, msg.sender);
    }
    
    /**
     * @dev 执行时间锁操作
     */
    function executeOperation(bytes32 operationId) public {
        TimelockOperation storage op = timelockOperations[operationId];
        
        require(op.timestamp != 0, "Operation not found");
        require(!op.executed, "Already executed");
        require(block.timestamp >= op.timestamp, "Timelock not ready");
        require(block.timestamp <= op.timestamp + GRACE_PERIOD, "Operation expired");
        require(op.signatureCount >= op.requiredSignatures, "Not enough signatures");
        
        op.executed = true;
        
        // 执行操作
        (bool success, ) = op.target.call{value: op.value}(op.data);
        require(success, "Execution failed");
        
        emit TimelockOperationExecuted(operationId, msg.sender);
        _logOperation(op.operationType, operationId, "Executed via timelock");
        
        // 从待处理列表移除
        _removePendingOperation(operationId);
    }
    
    /**
     * @dev 取消时间锁操作
     */
    function cancelOperation(bytes32 operationId) public onlyRole(ADMIN_ROLE) {
        TimelockOperation storage op = timelockOperations[operationId];
        require(op.timestamp != 0, "Operation not found");
        require(!op.executed, "Already executed");
        
        delete timelockOperations[operationId];
        _removePendingOperation(operationId);
        
        emit TimelockOperationCancelled(operationId, msg.sender);
    }
    
    /**
     * @dev 更新时间锁延迟
     */
    function updateTimelockDelay(uint256 newDelay) public onlyRole(ADMIN_ROLE) {
        require(newDelay >= MIN_DELAY && newDelay <= MAX_DELAY, "Invalid delay");
        
        bytes32 operationId = scheduleOperation(
            OperationType.UPDATE_TIMELock,
            address(this),
            0,
            abi.encodeWithSelector(this._executeUpdateTimelockDelay.selector, newDelay)
        );
        
        _logOperation(OperationType.UPDATE_TIMELock, operationId, 
            string(abi.encodePacked("Schedule delay update to ", uintToString(newDelay))));
    }
    
    function _executeUpdateTimelockDelay(uint256 newDelay) external {
        require(msg.sender == address(this), "Only via timelock");
        uint256 oldDelay = timelockDelay;
        timelockDelay = newDelay;
        emit TimelockDelayUpdated(oldDelay, newDelay);
    }
    
    /**
     * @dev 从待处理列表移除
     */
    function _removePendingOperation(bytes32 operationId) internal {
        for (uint i = 0; i < pendingOperations.length; i++) {
            if (pendingOperations[i] == operationId) {
                pendingOperations[i] = pendingOperations[pendingOperations.length - 1];
                pendingOperations.pop();
                break;
            }
        }
    }
    
    // ========== 多签管理 ==========
    
    /**
     * @dev 添加签名者
     */
    function addSigner(address signer) public onlyRole(ADMIN_ROLE) {
        require(signer != address(0), "Invalid address");
        require(!_signers.contains(signer), "Already a signer");
        
        _grantRole(SIGNER_ROLE, signer);
        _signers.add(signer);
        signerCount++;
        
        emit SignerAdded(signer, msg.sender);
        _logOperation(OperationType.TRANSFER_OWNERSHIP, bytes32(0), 
            string(abi.encodePacked("Added signer: ", _toAsciiString(signer))));
    }
    
    /**
     * @dev 移除签名者
     */
    function removeSigner(address signer) public onlyRole(ADMIN_ROLE) {
        require(_signers.contains(signer), "Not a signer");
        require(signerCount > 1, "Cannot remove last signer");
        
        _revokeRole(SIGNER_ROLE, signer);
        _signers.remove(signer);
        signerCount--;
        
        // 调整所需签名数
        if (requiredSignatures > signerCount) {
            requiredSignatures = signerCount;
        }
        
        emit SignerRemoved(signer, msg.sender);
        _logOperation(OperationType.TRANSFER_OWNERSHIP, bytes32(0), 
            string(abi.encodePacked("Removed signer: ", _toAsciiString(signer))));
    }
    
    /**
     * @dev 更新所需签名数
     */
    function updateRequiredSignatures(uint256 newRequired) public onlyRole(ADMIN_ROLE) {
        require(newRequired > 0 && newRequired <= signerCount, "Invalid requirement");
        
        uint256 oldRequired = requiredSignatures;
        requiredSignatures = newRequired;
        
        emit RequiredSignaturesChanged(oldRequired, newRequired);
    }
    
    /**
     * @dev 检查是否为签名者
     */
    function isSigner(address account) public view returns (bool) {
        return _signers.contains(account);
    }
    
    /**
     * @dev 获取所有签名者
     */
    function getSigners() public view returns (address[] memory) {
        return _signers.values();
    }
    
    // ========== 紧急暂停 ==========
    
    /**
     * @dev 紧急暂停合约
     */
    function emergencyPause() public onlyRole(ADMIN_ROLE) {
        _pause();
        _logOperation(OperationType.EMERGENCY_PAUSE, bytes32(0), "Emergency pause triggered");
    }
    
    /**
     * @dev 解除暂停
     */
    function emergencyUnpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
        _logOperation(OperationType.EMERGENCY_UNPAUSE, bytes32(0), "Emergency unpause triggered");
    }
    
    // ========== 操作日志 ==========
    
    /**
     * @dev 记录操作
     */
    function _logOperation(OperationType operationType, bytes32 operationId, string memory details) internal {
        logCounter++;
        operationLogs.push(OperationLog({
            id: logCounter,
            operationType: operationType,
            operator: msg.sender,
            operationId: operationId,
            details: details,
            timestamp: block.timestamp
        }));
        
        emit OperationLogged(logCounter, operationType, msg.sender, details);
    }
    
    /**
     * @dev 获取操作日志
     */
    function getOperationLogs(uint256 start, uint256 limit) public view returns (OperationLog[] memory) {
        uint256 end = start + limit;
        if (end > operationLogs.length) {
            end = operationLogs.length;
        }
        
        OperationLog[] memory logs = new OperationLog[](end - start);
        for (uint i = start; i < end; i++) {
            logs[i - start] = operationLogs[i];
        }
        return logs;
    }
    
    /**
     * @dev 获取日志总数
     */
    function getLogCount() public view returns (uint256) {
        return operationLogs.length;
    }
    
    // ========== 查询函数 ==========
    
    /**
     * @dev 获取地址风险等级
     */
    function getRiskLevel(address account) public view returns (RiskLevel) {
        RiskLevel level = addressRiskLevel[account];
        return level == RiskLevel.UNKNOWN ? RiskLevel.NORMAL : level;
    }
    
    /**
     * @dev 获取地址标签名称
     */
    function getRiskLevelName(address account) public view returns (string memory) {
        RiskLevel level = getRiskLevel(account);
        return _riskLevelToString(level);
    }
    
    /**
     * @dev 内部：风险等级转字符串
     */
    function _riskLevelToString(RiskLevel level) internal pure returns (string memory) {
        if (level == RiskLevel.VIP) return "VIP";
        if (level == RiskLevel.NORMAL) return "Normal";
        if (level == RiskLevel.GREY) return "Grey";
        if (level == RiskLevel.BLACK) return "Black";
        return "Unknown";
    }
    
    /**
     * @dev 获取各标签列表
     */
    function getVIPList() public view returns (address[] memory) {
        return vipList;
    }
    
    function getGreyList() public view returns (address[] memory) {
        return greyList;
    }
    
    function getBlackList() public view returns (address[] memory) {
        return blackList;
    }
    
    /**
     * @dev 获取今日已用额度
     */
    function getDailyUsed(address account) public view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailyUsed[account][today];
    }
    
    /**
     * @dev 获取剩余额度
     */
    function getRemainingLimit(address account) public view returns (uint256) {
        RiskLevel level = getRiskLevel(account);
        LimitConfig memory config = riskLimits[level];
        
        if (!config.enabled) return 0;
        
        uint256 used = getDailyUsed(account);
        if (used >= config.dailyLimit) return 0;
        return config.dailyLimit - used;
    }
    
    /**
     * @dev 获取完整限额信息
     */
    function getLimitInfo(address account) public view returns (
        string memory levelName,
        uint256 dailyLimit,
        uint256 singleLimit,
        uint256 dailyUsed_,
        uint256 remaining,
        bool limited
    ) {
        RiskLevel level = getRiskLevel(account);
        LimitConfig memory config = riskLimits[level];
        uint256 used = getDailyUsed(account);
        uint256 remain = config.enabled && used < config.dailyLimit ? config.dailyLimit - used : 0;
        
        return (
            getRiskLevelName(account),
            config.dailyLimit,
            config.singleLimit,
            used,
            remain,
            config.enabled
        );
    }
    
    /**
     * @dev 获取待处理操作
     */
    function getPendingOperations() public view returns (bytes32[] memory) {
        return pendingOperations;
    }
    
    /**
     * @dev 获取操作详情
     */
    function getOperationDetails(bytes32 operationId) public view returns (
        OperationType operationType,
        address target,
        uint256 value,
        bytes memory data,
        uint256 timestamp,
        bool executed,
        uint256 signatureCount,
        uint256 requiredSignatures
    ) {
        TimelockOperation storage op = timelockOperations[operationId];
        return (
            op.operationType,
            op.target,
            op.value,
            op.data,
            op.timestamp,
            op.executed,
            op.signatureCount,
            op.requiredSignatures
        );
    }
    
    /**
     * @dev 检查操作是否已签名
     */
    function isOperationSigned(bytes32 operationId, address signer) public view returns (bool) {
        return timelockOperations[operationId].signatures[signer];
    }
    
    // ========== 限额配置管理 ==========
    
    /**
     * @dev 更新限额配置
     */
    function updateLimits(RiskLevel level, uint256 dailyLimit, uint256 singleLimit) public onlyRole(ADMIN_ROLE) {
        riskLimits[level] = LimitConfig(dailyLimit, singleLimit, true);
        emit LimitsUpdated(level, dailyLimit, singleLimit, msg.sender);
        _logOperation(OperationType.UPDATE_LIMITS, bytes32(0), 
            string(abi.encodePacked("Updated limits for ", _riskLevelToString(level))));
    }
    
    /**
     * @dev 启用/禁用限额
     */
    function toggleLimit(RiskLevel level, bool enabled) public onlyRole(OPERATOR_ROLE) {
        riskLimits[level].enabled = enabled;
    }
    
    // ========== 核心风控逻辑 ==========
    
    /**
     * @dev 重写转账函数
     */
    function _update(address from, address to, uint256 amount) internal virtual override whenNotPaused {
        // 1. 检查黑名单
        if (addressRiskLevel[from] == RiskLevel.BLACK) {
            emit TransferBlocked(from, to, amount, "Sender is blacklisted");
            revert AddressBlacklisted(from);
        }
        if (addressRiskLevel[to] == RiskLevel.BLACK) {
            emit TransferBlocked(from, to, amount, "Recipient is blacklisted");
            revert AddressBlacklisted(to);
        }
        
        // 2. 检查灰名单限制（只能接收，不能发送）
        if (addressRiskLevel[from] == RiskLevel.GREY) {
            emit TransferBlocked(from, to, amount, "Grey list address cannot send");
            revert GreyListRestricted(from);
        }
        
        // 3. 检查交易限额（只对发送方）
        if (from != address(0)) { // 排除铸造
            _checkLimits(from, amount);
        }
        
        // 4. 更新已用额度
        if (from != address(0)) {
            _updateDailyUsed(from, amount);
        }
        
        // 5. 执行转账
        super._update(from, to, amount);
    }
    
    /**
     * @dev 检查交易限额
     */
    function _checkLimits(address account, uint256 amount) internal view {
        RiskLevel level = getRiskLevel(account);
        LimitConfig memory config = riskLimits[level];
        
        if (!config.enabled) return;
        
        // 检查单笔限额
        if (amount > config.singleLimit) {
            emit LimitExceeded(account, amount, config.singleLimit, "Single");
            revert SingleLimitExceeded(amount, config.singleLimit);
        }
        
        // 检查单日限额
        uint256 today = block.timestamp / 1 days;
        uint256 used = dailyUsed[account][today];
        if (used + amount > config.dailyLimit) {
            uint256 remaining = config.dailyLimit > used ? config.dailyLimit - used : 0;
            emit LimitExceeded(account, amount, remaining, "Daily");
            revert DailyLimitExceeded(account, amount, remaining);
        }
    }
    
    /**
     * @dev 更新每日已用额度
     */
    function _updateDailyUsed(address account, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        dailyUsed[account][today] += amount;
    }
    
    // ========== 工具函数 ==========
    
    /**
     * @dev 水龙头 - 免费领取测试代币
     */
    function faucet() public whenNotPaused {
        require(addressRiskLevel[msg.sender] != RiskLevel.BLACK, "Blacklisted");
        _mint(msg.sender, 10000 * 10 ** decimals());
    }
    
    /**
     * @dev 批量铸造（需要多签）
     */
    function mint(address to, uint256 amount) public onlyRole(ADMIN_ROLE) {
        require(addressRiskLevel[to] != RiskLevel.BLACK, "Cannot mint to blacklisted");
        _mint(to, amount);
        _logOperation(OperationType.MINT, bytes32(0), 
            string(abi.encodePacked("Minted ", uintToString(amount), " to ", _toAsciiString(to))));
    }
    
    /**
     * @dev 销毁代币
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
        _logOperation(OperationType.BURN, bytes32(0), 
            string(abi.encodePacked("Burned ", uintToString(amount))));
    }
    
    /**
     * @dev 获取合约完整信息
     */
    function getContractInfo() public view returns (
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 totalSupply,
        uint256 vipCount,
        uint256 greyCount,
        uint256 blackCount,
        bool paused,
        uint256 timelockDelay_,
        uint256 requiredSigs,
        uint256 signerCount_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            vipList.length,
            greyList.length,
            blackList.length,
            paused(),
            timelockDelay,
            requiredSignatures,
            signerCount
        );
    }
    
    /**
     * @dev 地址转字符串
     */
    function _toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = '0';
        s[1] = 'x';
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19-i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i+2] = char(hi);
            s[2*i+3] = char(lo);
        }
        return string(s);
    }
    
    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
    
    /**
     * @dev uint 转字符串
     */
    function uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = v;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }
}
