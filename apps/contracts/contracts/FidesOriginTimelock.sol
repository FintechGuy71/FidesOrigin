// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title FidesOriginTimelock
 * @notice FidesOrigin 协议的时间锁控制器
 * @dev 用于生产环境的安全升级，所有管理操作需延迟执行
 * 
 * 安全模型：
 * - Proposers: 多签钱包 (至少3/5签名)
 * - Executors: 多签钱包 + 紧急多签 (2/3签名)
 * - Admin: 部署者 (初始化后 renounce)
 * - 延迟期: 48小时 (可配置)
 */
contract FidesOriginTimelock is TimelockController {
    
    /// @notice 最小延迟期 (48小时)
    uint256 public constant MIN_DELAY = 2 days;
    
    /// @notice 紧急延迟期 (4小时) - 仅用于关键安全修复
    uint256 public constant EMERGENCY_DELAY = 4 hours;
    
    /// @notice 是否为紧急模式
    bool public emergencyMode;
    
    /// @notice 紧急操作员 (安全团队多签)
    mapping(address => bool) public emergencyOperators;
    
    // ============ Events ============
    
    event EmergencyModeEnabled(address indexed operator);
    event EmergencyModeDisabled(address indexed operator);
    event EmergencyOperatorAdded(address indexed operator);
    event EmergencyOperatorRemoved(address indexed operator);
    
    // ============ Errors ============
    
    error NotEmergencyOperator(address caller);
    error EmergencyModeAlreadySet(bool current);
    error InvalidAddress();
    
    // ============ Constructor ============
    
    constructor(
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(MIN_DELAY, proposers, executors, admin) {
        // 初始化时，admin 应该是部署者，之后需要 renounce
    }
    
    // ============ Emergency Functions ============
    
    /**
     * @notice 启用紧急模式标记
     * @dev 紧急模式下，建议通过标准 Timelock 流程更新延迟期
     */
    function enableEmergencyMode() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (emergencyMode) revert EmergencyModeAlreadySet(true);
        
        emergencyMode = true;
        
        emit EmergencyModeEnabled(msg.sender);
    }
    
    /**
     * @notice 关闭紧急模式标记
     */
    function disableEmergencyMode() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (!emergencyMode) revert EmergencyModeAlreadySet(false);
        
        emergencyMode = false;
        
        emit EmergencyModeDisabled(msg.sender);
    }
    
    /**
     * @notice 添加紧急操作员
     */
    function addEmergencyOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (operator == address(0)) revert InvalidAddress();
        if (emergencyOperators[operator]) revert EmergencyModeAlreadySet(true);
        emergencyOperators[operator] = true;
        emit EmergencyOperatorAdded(operator);
    }
    
    /**
     * @notice 移除紧急操作员
     */
    function removeEmergencyOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!emergencyOperators[operator]) revert EmergencyModeAlreadySet(false);
        emergencyOperators[operator] = false;
        emit EmergencyOperatorRemoved(operator);
    }
    
    // ============ Override Functions ============
    
    /**
     * @notice [H-5] 修复: 紧急模式下缩短最小延迟期
     */
    function getMinDelay() public view virtual override returns (uint256) {
        return emergencyMode ? EMERGENCY_DELAY : MIN_DELAY;
    }
    
    /**
     * @notice 获取当前有效延迟期
     */
    function getEffectiveDelay() external view returns (uint256) {
        return emergencyMode ? EMERGENCY_DELAY : MIN_DELAY;
    }
    
    /**
     * @notice 检查是否为紧急操作员
     */
    function isEmergencyOperator(address account) external view returns (bool) {
        return emergencyOperators[account];
    }
}
