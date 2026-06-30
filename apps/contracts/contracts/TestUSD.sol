// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
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
    
    // ========== 标签类型 ==========
    enum RiskLevel { 
        UNKNOWN,    // 0: 未分类
        VIP,        // 1: VIP用户 - 更高限额
        NORMAL,     // 2: 普通用户
        GREY,       // 3: 灰名单 - 限制交易
        BLACK       // 4: 黑名单 - 禁止交易
    }
    
    // ========== 数据结构 ==========
    struct LimitConfig {
        uint256 dailyLimit;
        uint256 singleLimit;
        bool enabled;
    }
    
    struct UserDailyUsage {
        uint256 dayStart;
        uint256 used;
    }
    
    // ========== 状态变量 ==========
    mapping(address => RiskLevel) public addressRiskLevel;
    mapping(RiskLevel => LimitConfig) public riskLimits;
    mapping(address => UserDailyUsage) public dailyUsage;
    mapping(RiskLevel => EnumerableSet.AddressSet) private _riskLevelAddresses;
    
    // [C-1 fix] 记录已领取 faucet 的地址，防止无限铸币
    mapping(address => bool) private _faucetUsed;
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18;
    
    /// @notice 合约版本
    uint256 public constant VERSION = 3;
    
    // ========== 事件定义 ==========
    event AddressTagged(address indexed account, RiskLevel level, string reason);
    event AddressUntagged(address indexed account);
    event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);
    event LimitExceeded(address indexed account, uint256 amount, uint256 limit, string limitType);
    event LimitsUpdated(RiskLevel level, uint256 dailyLimit, uint256 singleLimit);
    event LimitToggled(RiskLevel level, bool enabled);
    event FaucetClaimed(address indexed account, uint256 amount);
    
    // ========== 错误定义 ==========
    error AddressBlacklisted(address account);
    error GreyListRestricted(address account);
    error DailyLimitExceeded(address account, uint256 amount, uint256 limit);
    error SingleLimitExceeded(address account, uint256 amount, uint256 limit);
    error InvalidAddress();
    error LengthMismatch();
    error BatchTooLarge();
    error FaucetAlreadyUsed(address account);
    error CannotBlacklistAdmin(address account);
    
    // ========== 构造函数 ==========
    constructor() ERC20("TestUSD", "TUSD") {
        // [M-2 fix] 配置角色层级：ADMIN 管理 OPERATOR 和 VIEWER
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(VIEWER_ROLE, ADMIN_ROLE);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        // 初始化限额配置
        riskLimits[RiskLevel.UNKNOWN] = LimitConfig(1000000 * 10**18, 1000000 * 10**18, true);
        riskLimits[RiskLevel.NORMAL] = LimitConfig(1000000 * 10**18, 1000000 * 10**18, true);
        riskLimits[RiskLevel.VIP] = LimitConfig(10000000 * 10**18, 10000000 * 10**18, true);
        riskLimits[RiskLevel.GREY] = LimitConfig(0, 0, true);
        riskLimits[RiskLevel.BLACK] = LimitConfig(0, 0, false);
        
        // 铸造初始代币
        _mint(msg.sender, 100000000 * 10**18); // 1亿代币
        
        // 预设标签
        _tagAddress(0xdAC17F958D2ee523a2206206994597C13D831ec7, RiskLevel.BLACK, "Preset: Risk Address");
    }
    
    // ========== 标签管理函数 ==========
    /**
     * @dev 给地址打标签
     */
    function tagAddress(address account, RiskLevel level, string memory reason) public onlyRole(OPERATOR_ROLE) whenNotPaused {
        _tagAddress(account, level, reason);
    }
    
    function _tagAddress(address account, RiskLevel level, string memory reason) internal {
        if (account == address(0)) revert InvalidAddress();
        
        // [M-1 fix] 禁止将 DEFAULT_ADMIN 持有者打入黑名单
        if (level == RiskLevel.BLACK && hasRole(DEFAULT_ADMIN_ROLE, account)) {
            revert CannotBlacklistAdmin(account);
        }
        
        // 从旧列表移除
        RiskLevel oldLevel = addressRiskLevel[account];
        _riskLevelAddresses[oldLevel].remove(account);
        
        // 添加新标签
        addressRiskLevel[account] = level;
        _riskLevelAddresses[level].add(account);
        
        emit AddressTagged(account, level, reason);
    }
    
    /**
     * @dev 移除地址标签
     */
    function untagAddress(address account) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        RiskLevel level = addressRiskLevel[account];
        _riskLevelAddresses[level].remove(account);
        delete addressRiskLevel[account];
        emit AddressUntagged(account);
    }
    
    /**
     * @dev 获取地址风险等级
     */
    function getRiskLevel(address account) public view returns (RiskLevel) {
        return addressRiskLevel[account];
    }
    
    /**
     * @dev 检查地址是否在黑名单
     */
    function isBlacklisted(address account) external view returns (bool) {
        return addressRiskLevel[account] == RiskLevel.BLACK;
    }
    
    /**
     * @dev 获取特定等级的所有地址
     */
    function getAddressesByRiskLevel(RiskLevel level) external view returns (address[] memory) {
        return _riskLevelAddresses[level].values();
    }
    
    /**
     * @dev 获取特定等级地址数量
     */
    function getRiskLevelCount(RiskLevel level) external view returns (uint256) {
        return _riskLevelAddresses[level].length();
    }
    
    // ========== 限额管理函数 ==========
    /**
     * @dev 更新限额配置
     */
    function setRiskLimits(
        RiskLevel level,
        uint256 dailyLimit,
        uint256 singleLimit
    ) external onlyRole(ADMIN_ROLE) {
        riskLimits[level] = LimitConfig(dailyLimit, singleLimit, true);
        emit LimitsUpdated(level, dailyLimit, singleLimit);
    }
    
    /**
     * @dev 启用/禁用限额
     */
    function toggleLimit(RiskLevel level, bool enabled) external onlyRole(ADMIN_ROLE) {
        riskLimits[level].enabled = enabled;
        emit LimitToggled(level, enabled);
    }
    
    // ========== 核心风控逻辑 ==========
    /**
     * @dev 转账前钩子 - OpenZeppelin v5 风格 _update
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._update(from, to, amount);
        
        // [H-2 fix] 合规检查仅对真实转账生效（非铸造、非销毁）
        if (from != address(0) && to != address(0)) {
            // 1. 检查黑名单
            if (addressRiskLevel[from] == RiskLevel.BLACK) {
                revert AddressBlacklisted(from);
            }
            if (addressRiskLevel[to] == RiskLevel.BLACK) {
                revert AddressBlacklisted(to);
            }
            
            // 2. 检查灰名单限制（只能接收，不能发送）
            if (addressRiskLevel[from] == RiskLevel.GREY) {
                revert GreyListRestricted(from);
            }
            
            // 3. 检查交易限额
            _checkLimits(from, amount);
            
            // 4. 更新已用额度
            _updateDailyUsed(from, amount);
        }
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
            revert SingleLimitExceeded(account, amount, config.singleLimit);
        }
        
        // 检查日限额
        UserDailyUsage memory usage = dailyUsage[account];
        uint256 currentDay = block.timestamp / 1 days;
        
        uint256 usedToday = (usage.dayStart == currentDay) ? usage.used : 0;
        
        // [L-1 fix] 移除冗余溢出检查（Solidity 0.8+ 已内置溢出保护）
        if (usedToday + amount > config.dailyLimit) {
            revert DailyLimitExceeded(account, amount, config.dailyLimit);
        }
    }
    
    /**
     * @dev 更新日使用额度
     */
    function _updateDailyUsed(address account, uint256 amount) internal {
        uint256 currentDay = block.timestamp / 1 days;
        UserDailyUsage storage usage = dailyUsage[account];
        
        if (usage.dayStart != currentDay) {
            usage.dayStart = currentDay;
            usage.used = 0;
        }
        usage.used += amount;
    }
    
    // ========== 管理功能 ==========
    /**
     * @dev 铸造代币
     */
    function mint(address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (to == address(0)) revert InvalidAddress();
        _mint(to, amount);
    }
    
    /**
     * @dev 批量转账（Gas优化版）
     * @notice 一次性计算总金额、检查黑名单/灰名单、检查限额、更新日使用额度
     * 循环中调用父类 _update，跳过重复限额检查
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external whenNotPaused returns (bool) {
        if (recipients.length != amounts.length) revert LengthMismatch();
        if (recipients.length > 100) revert BatchTooLarge();
        
        address sender = _msgSender();
        
        // 1. 一次性计算总金额
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        // 2. 一次性检查 sender 黑名单
        if (addressRiskLevel[sender] == RiskLevel.BLACK) {
            revert AddressBlacklisted(sender);
        }
        
        // [H-1 fix] 检查 sender 灰名单（原代码遗漏）
        if (addressRiskLevel[sender] == RiskLevel.GREY) {
            revert GreyListRestricted(sender);
        }
        
        // 3. 一次性检查所有接收方黑名单
        for (uint256 i = 0; i < recipients.length; i++) {
            if (addressRiskLevel[recipients[i]] == RiskLevel.BLACK) {
                revert AddressBlacklisted(recipients[i]);
            }
        }
        
        // 4. 一次性检查限额（使用总金额）
        _checkLimits(sender, totalAmount);
        
        // 5. 一次性更新日使用额度
        _updateDailyUsed(sender, totalAmount);
        
        // 6. 循环执行转账，调用父类 _update 跳过重复限额检查
        for (uint256 i = 0; i < recipients.length; i++) {
            super._update(sender, recipients[i], amounts[i]);
        }
        
        return true;
    }
    
    /**
     * @dev 暂停合约
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev 恢复合约
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // ========== 查询函数 ==========
    /**
     * @dev 获取合约信息
     */
    function getContractInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 totalSupplyAmount,
        uint256 vipCount,
        uint256 greyCount,
        uint256 blackCount,
        bool isPaused
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            _riskLevelAddresses[RiskLevel.VIP].length(),
            _riskLevelAddresses[RiskLevel.GREY].length(),
            _riskLevelAddresses[RiskLevel.BLACK].length(),
            paused()
        );
    }
    
    /**
     * @dev 获取用户限额信息
     */
    function getLimitInfo(address account) external view returns (
        RiskLevel level,
        uint256 dailyLimit,
        uint256 singleLimit,
        uint256 usedToday,
        uint256 remainingToday
    ) {
        level = getRiskLevel(account);
        LimitConfig memory config = riskLimits[level];
        
        dailyLimit = config.dailyLimit;
        singleLimit = config.singleLimit;
        
        UserDailyUsage memory usage = dailyUsage[account];
        uint256 currentDay = block.timestamp / 1 days;
        
        usedToday = (usage.dayStart == currentDay) ? usage.used : 0;
        remainingToday = (config.dailyLimit > usedToday) ? config.dailyLimit - usedToday : 0;
    }
    
    /**
     * @dev 水龙头 - 用于测试
     * [C-1 fix] 每个地址仅可领取一次，防止无限铸币
     */
    function faucet() external whenNotPaused {
        if (_faucetUsed[msg.sender]) revert FaucetAlreadyUsed(msg.sender);
        _faucetUsed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
}