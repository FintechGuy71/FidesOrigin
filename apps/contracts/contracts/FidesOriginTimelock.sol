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
    
    /// @notice M-07 FIX: 紧急模式切换时间锁
    bool public pendingEmergencyMode;
    uint256 public emergencyModeChangeTimestamp;
    
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
    error EmergencyModeTimelockActive(uint256 availableAt);
    error EmergencyOperatorAlreadySet(bool current);
    
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
     * @notice 提议启用紧急模式
     * @dev M-07 FIX: 启用紧急模式需经过 EMERGENCY_DELAY 时间锁
     */
    function proposeEnableEmergencyMode() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (emergencyMode) revert EmergencyModeAlreadySet(true);
        if (emergencyModeChangeTimestamp != 0 && !pendingEmergencyMode) revert EmergencyModeAlreadySet(false); // already has a pending disable

        pendingEmergencyMode = true;
        emergencyModeChangeTimestamp = block.timestamp + EMERGENCY_DELAY;

        emit EmergencyModeEnabled(msg.sender);
    }

    /**
     * @notice 提议关闭紧急模式
     * @dev M-07 FIX: 关闭紧急模式需经过 EMERGENCY_DELAY 时间锁
     */
    function proposeDisableEmergencyMode() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (!emergencyMode) revert EmergencyModeAlreadySet(false);
        if (emergencyModeChangeTimestamp != 0 && pendingEmergencyMode) revert EmergencyModeAlreadySet(true); // already has a pending enable

        pendingEmergencyMode = false;
        emergencyModeChangeTimestamp = block.timestamp + EMERGENCY_DELAY;

        emit EmergencyModeDisabled(msg.sender);
    }

    /**
     * @notice 执行紧急模式切换（在时间锁到期后）
     * @dev M-07 FIX: 任何人均可在时间锁到期后执行
     */
    function executeEmergencyModeChange() external {
        if (emergencyModeChangeTimestamp == 0) revert EmergencyModeAlreadySet(emergencyMode);
        if (block.timestamp < emergencyModeChangeTimestamp) revert EmergencyModeTimelockActive(emergencyModeChangeTimestamp);

        emergencyMode = pendingEmergencyMode;
        emergencyModeChangeTimestamp = 0;
    }
    
    /**
     * @notice 添加紧急操作员
     */
    function addEmergencyOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (operator == address(0)) revert InvalidAddress();
        if (emergencyOperators[operator]) revert EmergencyOperatorAlreadySet(true);
        emergencyOperators[operator] = true;
        emit EmergencyOperatorAdded(operator);
    }
    
    /**
     * @notice 移除紧急操作员
     */
    function removeEmergencyOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!emergencyOperators[operator]) revert EmergencyOperatorAlreadySet(false);
        emergencyOperators[operator] = false;
        emit EmergencyOperatorRemoved(operator);
    }
    
    // ============ Override Functions ============
    
    /**
     * @notice [M-04 FIX] 紧急模式下返回 EMERGENCY_DELAY
     * @dev ⚠️ 注意：此 override 会影响已 schedule 操作的执行时间检查。
     *      TimelockController.execute() 内部检查 block.timestamp >= getMinDelay() + when。
     *      紧急模式缩短延迟后，已 schedule 的操作可能提前执行。
     *      **安全建议**：仅在需要紧急执行新操作时短暂启用紧急模式，
     *      执行完毕后立即关闭。不要在非紧急场景下长时间保持紧急模式。
     *      生产环境建议使用多签 + 紧急多签双重确认。
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
