// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestUSD
 * @dev FidesOrigin MVP Demo Phase 2
 * @notice 链上执行级可编程合规协议 - 多标签风控 + 交易限额
 */
contract TestUSD is ERC20, Ownable {
    
    // ========== 标签类型 ==========
    enum RiskLevel { 
        UNKNOWN,    // 0: 未分类
        VIP,        // 1: VIP用户 - 更高限额
        NORMAL,     // 2: 普通用户
        GREY,       // 3: 灰名单 - 限制交易
        BLACK       // 4: 黑名单 - 禁止交易
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
        uint256 dailyLimit;      // 单日限额
        uint256 singleLimit;     // 单笔限额
        bool enabled;            // 是否启用限额
    }
    
    // 各标签对应的限额配置
    mapping(RiskLevel => LimitConfig) public riskLimits;
    
    // 用户每日已用额度 (用户 => 日期 => 已用金额)
    mapping(address => mapping(uint256 => uint256)) public dailyUsed;
    
    // 默认限额配置
    uint256 public constant DEFAULT_DAILY_LIMIT = 10000 * 10**18;   // 10,000 TUSD
    uint256 public constant DEFAULT_SINGLE_LIMIT = 5000 * 10**18;   // 5,000 TUSD
    uint256 public constant VIP_DAILY_LIMIT = 100000 * 10**18;      // 100,000 TUSD
    uint256 public constant VIP_SINGLE_LIMIT = 50000 * 10**18;      // 50,000 TUSD
    uint256 public constant GREY_DAILY_LIMIT = 1000 * 10**18;       // 1,000 TUSD
    uint256 public constant GREY_SINGLE_LIMIT = 500 * 10**18;       // 500 TUSD
    
    // ========== 事件 ==========
    event AddressTagged(address indexed account, RiskLevel level, string reason);
    event AddressUntagged(address indexed account, RiskLevel previousLevel);
    event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);
    event LimitExceeded(address indexed account, uint256 attempted, uint256 remaining, string limitType);
    event LimitsUpdated(RiskLevel level, uint256 dailyLimit, uint256 singleLimit);
    
    // ========== 错误定义 ==========
    error AddressBlacklisted(address account);
    error DailyLimitExceeded(address account, uint256 attempted, uint256 remaining);
    error SingleLimitExceeded(uint256 attempted, uint256 maximum);
    error GreyListRestricted(address account);
    
    // ========== 构造函数 ==========
    constructor() ERC20("Test USD", "TestUSD") Ownable(msg.sender) {
        // 铸造初始供应量
        _mint(msg.sender, 1000000 * 10 ** decimals());
        
        // 初始化默认限额配置
        riskLimits[RiskLevel.NORMAL] = LimitConfig(DEFAULT_DAILY_LIMIT, DEFAULT_SINGLE_LIMIT, true);
        riskLimits[RiskLevel.VIP] = LimitConfig(VIP_DAILY_LIMIT, VIP_SINGLE_LIMIT, true);
        riskLimits[RiskLevel.GREY] = LimitConfig(GREY_DAILY_LIMIT, GREY_SINGLE_LIMIT, true);
        riskLimits[RiskLevel.BLACK] = LimitConfig(0, 0, false);
        
        // 添加预设黑名单（Phase 1 的地址）
        _tagAddress(0x1234567890123456789012345678901234567890, RiskLevel.BLACK, "Preset: Hacker");
        _tagAddress(0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B, RiskLevel.BLACK, "Preset: Scammer");
        _tagAddress(0xdAC17F958D2ee523a2206206994597C13D831ec7, RiskLevel.BLACK, "Preset: Risk Address");
        
        // 添加预设 VIP（演示用）
        _tagAddress(0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1, RiskLevel.VIP, "Preset: VIP User");
        
        // 添加预设灰名单（演示用）
        _tagAddress(0x8ba1f109551bD432803012645Hac136c82C3e8C9, RiskLevel.GREY, "Preset: Grey List");
    }
    
    // ========== 标签管理函数 ==========
    
    /**
     * @dev 给地址打标签
     */
    function tagAddress(address account, RiskLevel level, string memory reason) public onlyOwner {
        _tagAddress(account, level, reason);
    }
    
    /**
     * @dev 批量打标签
     */
    function batchTagAddresses(address[] memory accounts, RiskLevel level, string memory reason) public onlyOwner {
        for (uint i = 0; i < accounts.length; i++) {
            _tagAddress(accounts[i], level, reason);
        }
    }
    
    /**
     * @dev 移除标签
     */
    function untagAddress(address account) public onlyOwner {
        RiskLevel previousLevel = addressRiskLevel[account];
        require(previousLevel != RiskLevel.UNKNOWN, "Address not tagged");
        
        _removeFromList(account, previousLevel);
        addressRiskLevel[account] = RiskLevel.UNKNOWN;
        
        emit AddressUntagged(account, previousLevel);
    }
    
    /**
     * @dev 内部函数：打标签
     */
    function _tagAddress(address account, RiskLevel level, string memory reason) internal {
        require(account != address(0), "Invalid address");
        
        // 如果已有标签，先从旧列表移除
        RiskLevel currentLevel = addressRiskLevel[account];
        if (currentLevel != RiskLevel.UNKNOWN) {
            _removeFromList(account, currentLevel);
        }
        
        // 添加到新列表
        addressRiskLevel[account] = level;
        if (level == RiskLevel.VIP) {
            vipList.push(account);
        } else if (level == RiskLevel.GREY) {
            greyList.push(account);
        } else if (level == RiskLevel.BLACK) {
            blackList.push(account);
        }
        
        emit AddressTagged(account, level, reason);
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
    
    // ========== 限额配置管理 ==========
    
    /**
     * @dev 更新限额配置
     */
    function updateLimits(RiskLevel level, uint256 dailyLimit, uint256 singleLimit) public onlyOwner {
        riskLimits[level] = LimitConfig(dailyLimit, singleLimit, true);
        emit LimitsUpdated(level, dailyLimit, singleLimit);
    }
    
    /**
     * @dev 启用/禁用限额
     */
    function toggleLimit(RiskLevel level, bool enabled) public onlyOwner {
        riskLimits[level].enabled = enabled;
    }
    
    // ========== 核心风控逻辑 ==========
    
    /**
     * @dev 重写转账函数
     */
    function _update(address from, address to, uint256 amount) internal virtual override {
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
        _checkLimits(from, amount);
        
        // 4. 更新已用额度
        _updateDailyUsed(from, amount);
        
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
    function faucet() public {
        require(addressRiskLevel[msg.sender] != RiskLevel.BLACK, "Blacklisted");
        _mint(msg.sender, 10000 * 10 ** decimals());
    }
    
    /**
     * @dev 批量铸造（仅所有者）
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
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
        uint256 blackCount
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            vipList.length,
            greyList.length,
            blackList.length
        );
    }
}
