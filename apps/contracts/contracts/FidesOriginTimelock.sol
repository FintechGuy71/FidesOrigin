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

    /// @notice Pending operations 列表（用于紧急模式切换时批量取消）
    bytes32[] public pendingOperations;
    /// @notice operationId => index + 1（0 表示不在列表中）
    mapping(bytes32 => uint256) private _pendingOpIndex;
    
    // ============ Events ============
    
    event EmergencyModeEnabled(address indexed operator);
    event EmergencyModeDisabled(address indexed operator);
    event EmergencyOperatorAdded(address indexed operator);
    event EmergencyOperatorRemoved(address indexed operator);
    event EmergencyModeChangeAffected(address indexed caller, uint256 pendingOpsCancelled);
    
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
        // 授予自身 CANCELLER_ROLE，以便在紧急模式切换时批量取消 pending operations
        _grantRole(CANCELLER_ROLE, address(this));
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
     * @dev M-07 FIX: 任何人均可在时间锁到期后执行。切换前会批量取消所有 pending operations，
     *      防止已 schedule 的操作因紧急模式缩短延迟而被提前执行。
     */
    function executeEmergencyModeChange() external {
        if (emergencyModeChangeTimestamp == 0) revert EmergencyModeAlreadySet(emergencyMode);
        if (block.timestamp < emergencyModeChangeTimestamp) revert EmergencyModeTimelockActive(emergencyModeChangeTimestamp);

        uint256 cancelled = 0;
        // 从后往前遍历，批量取消所有仍 pending 的 operations
        // CRITICAL FIX: 使用 super.cancel(id) 而非 this.cancel(id)，
        // 因为 this.cancel(id) 会通过 _removePendingOperation 再次执行 swap-and-pop，
        // 导致数组在遍历过程中被修改。super.cancel(id) 只执行 OZ 的取消逻辑，
        // 数组清理由本循环体的 pop() 统一负责。
        for (uint256 i = pendingOperations.length; i > 0; i--) {
            bytes32 id = pendingOperations[i - 1];
            if (isOperationPending(id)) {
                super.cancel(id);
                cancelled++;
            }
            // 清理列表（无论是否成功取消）
            delete _pendingOpIndex[id];
            pendingOperations.pop();
        }

        emergencyMode = pendingEmergencyMode;
        emergencyModeChangeTimestamp = 0;

        emit EmergencyModeChangeAffected(msg.sender, cancelled);
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
     * @notice 覆盖 schedule — 记录 pending operation
     */
    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public override {
        super.schedule(target, value, data, predecessor, salt, delay);
        _addPendingOperation(hashOperation(target, value, data, predecessor, salt));
    }

    /**
     * @notice 覆盖 scheduleBatch — 记录 pending operation
     */
    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public override {
        super.scheduleBatch(targets, values, payloads, predecessor, salt, delay);
        _addPendingOperation(hashOperationBatch(targets, values, payloads, predecessor, salt));
    }

    /**
     * @notice 覆盖 execute — 移除 pending operation
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    ) public payable override {
        bytes32 id = hashOperation(target, value, payload, predecessor, salt);
        super.execute(target, value, payload, predecessor, salt);
        _removePendingOperation(id);
    }

    /**
     * @notice 覆盖 executeBatch — 移除 pending operation
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) public payable override {
        bytes32 id = hashOperationBatch(targets, values, payloads, predecessor, salt);
        super.executeBatch(targets, values, payloads, predecessor, salt);
        _removePendingOperation(id);
    }

    /**
     * @notice 覆盖 cancel — 移除 pending operation
     */
    function cancel(bytes32 id) public override {
        super.cancel(id);
        _removePendingOperation(id);
    }

    // ============ Internal Helpers ============

    function _addPendingOperation(bytes32 id) internal {
        if (_pendingOpIndex[id] == 0 && isOperationPending(id)) {
            pendingOperations.push(id);
            _pendingOpIndex[id] = pendingOperations.length;
        }
    }

    function _removePendingOperation(bytes32 id) internal {
        uint256 idx = _pendingOpIndex[id];
        if (idx > 0) {
            uint256 lastIdx = pendingOperations.length - 1;
            bytes32 lastId = pendingOperations[lastIdx];
            pendingOperations[idx - 1] = lastId;
            _pendingOpIndex[lastId] = idx;
            pendingOperations.pop();
            delete _pendingOpIndex[id];
        }
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
