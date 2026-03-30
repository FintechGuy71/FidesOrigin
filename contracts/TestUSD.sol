// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestUSD
 * @dev FidesOrigin MVP Demo - 带黑名单功能的测试代币
 * @notice 用于演示链上执行级可编程合规协议
 */
contract TestUSD is ERC20, Ownable {
    
    // 黑名单映射
    mapping(address => bool) public blacklist;
    
    // 黑名单地址列表（便于查询）
    address[] public blacklistAddresses;
    
    // 事件
    event AddressBlacklisted(address indexed account);
    event AddressRemovedFromBlacklist(address indexed account);
    event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);
    
    // 自定义错误
    error AddressIsBlacklisted(address account);
    error InvalidAmount();
    error InvalidAddress();
    
    /**
     * @dev 构造函数 - 初始化代币并添加预设黑名单
     */
    constructor() ERC20("Test USD", "TestUSD") Ownable(msg.sender) {
        // 铸造初始供应量: 1,000,000 TestUSD
        _mint(msg.sender, 1000000 * 10 ** decimals());
        
        // 添加预设黑名单地址
        _addToBlacklist(0x1234567890123456789012345678901234567890);
        _addToBlacklist(0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B);
        _addToBlacklist(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    }
    
    /**
     * @dev 检查地址是否在黑名单中
     */
    function isBlacklisted(address account) public view returns (bool) {
        return blacklist[account];
    }
    
    /**
     * @dev 获取所有黑名单地址
     */
    function getBlacklist() public view returns (address[] memory) {
        return blacklistAddresses;
    }
    
    /**
     * @dev 添加地址到黑名单（仅合约所有者）
     */
    function addToBlacklist(address account) public onlyOwner {
        _addToBlacklist(account);
    }
    
    /**
     * @dev 从黑名单移除（仅合约所有者）
     */
    function removeFromBlacklist(address account) public onlyOwner {
        require(blacklist[account], "Address not in blacklist");
        blacklist[account] = false;
        emit AddressRemovedFromBlacklist(account);
    }
    
    /**
     * @dev 批量添加黑名单（仅合约所有者）
     */
    function batchAddToBlacklist(address[] memory accounts) public onlyOwner {
        for (uint i = 0; i < accounts.length; i++) {
            _addToBlacklist(accounts[i]);
        }
    }
    
    /**
     * @dev 内部函数：添加黑名单
     */
    function _addToBlacklist(address account) internal {
        require(account != address(0), "Invalid address");
        if (!blacklist[account]) {
            blacklist[account] = true;
            blacklistAddresses.push(account);
            emit AddressBlacklisted(account);
        }
    }
    
    /**
     * @dev 重写转账函数 - 核心风控逻辑
     * @notice 如果发送方或接收方在黑名单中，转账将被拦截
     */
    function _update(address from, address to, uint256 amount) internal virtual override {
        // 检查发送方是否在黑名单
        if (blacklist[from]) {
            emit TransferBlocked(from, to, amount, "Sender is blacklisted");
            revert AddressIsBlacklisted(from);
        }
        
        // 检查接收方是否在黑名单
        if (blacklist[to]) {
            emit TransferBlocked(from, to, amount, "Recipient is blacklisted");
            revert AddressIsBlacklisted(to);
        }
        
        // 通过检查，执行转账
        super._update(from, to, amount);
    }
    
    /**
     * @dev 水龙头功能 - 免费领取测试代币
     */
    function faucet() public {
        require(!blacklist[msg.sender], "Blacklisted address cannot use faucet");
        _mint(msg.sender, 1000 * 10 ** decimals());
    }
    
    /**
     * @dev 获取合约信息
     */
    function getContractInfo() public view returns (
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 totalSupply,
        uint256 blacklistCount,
        address owner_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            blacklistAddresses.length,
            owner()
        );
    }
}
