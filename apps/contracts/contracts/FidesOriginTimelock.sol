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

    /// @notice [H-1 FIX] 紧急操作独立时间戳存储。
    ///      原实现调用 super.schedule(..., EMERGENCY_DELAY)，但 OZ v5 的
    ///      _schedule 强制 delay >= getMinDelay()（本合约为 2 天），4 小时的
    ///      紧急延迟必然 revert TimelockInsufficientDelay，导致紧急调度完全失效
    ///      （原测试从未覆盖该路径）。修复：紧急操作绕过 OZ schedule，用独立映射
    ///      记录就绪时间；通过覆写 getTimestamp() 使 OZ 的 execute/cancel 状态机
    ///      对紧急操作正确工作（execute → _beforeCall → isOperationReady → getTimestamp）。
    mapping(bytes32 => uint256) private _emergencyTimestamps;

    /// @notice [H-1 FIX] 紧急操作调度事件
    event EmergencyCallScheduled(bytes32 indexed id, address indexed target, uint256 value, uint256 readyAt);
    
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
    error EmergencyOperationAlreadyExists(bytes32 id);
    error PendingModeChangeActive(uint256 availableAt);
    
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
     * @dev [L-11 FIX] 已有未执行的同类提案时 revert（原实现重复提议会重置计时器，
     *      紧急操作员可无限推迟模式切换）。取消或执行后才能重新提议。
     */
    function proposeEnableEmergencyMode() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (emergencyMode) revert EmergencyModeAlreadySet(true);
        if (emergencyModeChangeTimestamp != 0) {
            revert PendingModeChangeActive(emergencyModeChangeTimestamp);
        }

        pendingEmergencyMode = true;
        emergencyModeChangeTimestamp = block.timestamp + EMERGENCY_DELAY;

        emit EmergencyModeEnabled(msg.sender);
    }

    /**
     * @notice 提议关闭紧急模式
     * @dev M-07 FIX: 关闭紧急模式需经过 EMERGENCY_DELAY 时间锁
     * @dev [L-11 FIX] 同上：已有 pending 提案时 revert 而非重置计时。
     */
    function proposeDisableEmergencyMode() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (!emergencyMode) revert EmergencyModeAlreadySet(false);
        if (emergencyModeChangeTimestamp != 0) {
            revert PendingModeChangeActive(emergencyModeChangeTimestamp);
        }

        pendingEmergencyMode = false;
        emergencyModeChangeTimestamp = block.timestamp + EMERGENCY_DELAY;

        emit EmergencyModeDisabled(msg.sender);
    }

    /**
     * @notice [L-11 FIX] 取消待执行的紧急模式切换提案
     */
    function cancelEmergencyModeChange() external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (emergencyModeChangeTimestamp == 0) revert EmergencyModeAlreadySet(emergencyMode);
        emergencyModeChangeTimestamp = 0;
        emit EmergencyModeChangeAffected(msg.sender, 0);
    }

    /**
     * @notice 执行紧急模式切换（在时间锁到期后）
     * @dev M-07 FIX: 任何人均可在时间锁到期后执行。切换前会批量取消所有 pending operations，
     *      防止已 schedule 的操作因紧急模式缩短延迟而被提前执行。
     * @dev H-03 FIX: 添加 EXECUTOR_ROLE 访问控制，防止时间锁到期后被任意地址 frontrun。
     */
    function executeEmergencyModeChange() external onlyRole(EXECUTOR_ROLE) {
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
     * @notice [K3 CRITICAL FIX] 已移除 getMinDelay() override
     * @dev 紧急模式不再影响已 schedule 操作的延迟检查。
     *      紧急操作使用专门的 scheduleEmergency() / executeEmergency() 函数。
     *      所有已有的 pending operations 在切换到紧急模式时会被取消。
     */
    function getMinDelay() public view virtual override returns (uint256) {
        return MIN_DELAY;
    }

    /**
     * @notice [H-1 FIX] 时间戳统一读取：优先 OZ 标准存储，回退紧急映射。
     * @dev OZ 的 execute/_beforeCall/isOperationReady 均经 getTimestamp 读取，
     *      覆写后紧急操作的状态机（Waiting → Ready → Done）由本函数驱动。
     *      执行完成后 OZ 将 _timestamps[id] 置为 _DONE_TIMESTAMP(1)，
     *      本函数因 super 值非零而优先返回 Done 时间戳，逻辑自洽。
     */
    function getTimestamp(bytes32 id) public view virtual override returns (uint256) {
        uint256 standard = super.getTimestamp(id);
        if (standard != 0) return standard;
        return _emergencyTimestamps[id];
    }
    
    /**
     * @notice 紧急模式下的有效延迟（仅用于新 schedule 的紧急操作）
     */
    function getEmergencyDelay() external view returns (uint256) {
        return EMERGENCY_DELAY;
    }
    
    /**
     * @notice Schedule an emergency operation with EMERGENCY_DELAY
     * @dev 仅紧急操作员可在紧急模式下调用
     * @dev [H-1 FIX] 不再调用 super.schedule：OZ v5 _schedule 强制
     *      delay >= getMinDelay()（2 天），4 小时紧急延迟必然 revert。
     *      改为直接写入 _emergencyTimestamps；execute 走 OZ 标准路径，
     *      经覆写的 getTimestamp() 读取紧急就绪时间，到期后状态机判定 Ready。
     *      [L-11 关联] 紧急操作不再要求 PROPOSER_ROLE（原 super.schedule 隐式
     *      携带 onlyRole(PROPOSER_ROLE)，是第二重障碍）。
     */
    function scheduleEmergency(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt
    ) external {
        if (!emergencyOperators[msg.sender]) revert NotEmergencyOperator(msg.sender);
        if (!emergencyMode) revert EmergencyModeAlreadySet(false); // must be in emergency mode
        if (target == address(0)) revert InvalidAddress();

        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        // 与 OZ _schedule 一致的存在性检查（覆盖 Waiting/Ready/Done 三态）
        if (isOperation(id) || _emergencyTimestamps[id] != 0) {
            revert EmergencyOperationAlreadyExists(id);
        }
        uint256 readyAt = block.timestamp + EMERGENCY_DELAY;
        _emergencyTimestamps[id] = readyAt;
        emit EmergencyCallScheduled(id, target, value, readyAt);
    }

    /**
     * @notice Check whether an emergency operation is ready
     * @dev [H-1 FIX] 原实现 `timestamp + EMERGENCY_DELAY <= block.timestamp`
     *      在就绪时间上再叠加一次紧急延迟（双重等待）。就绪时间已在调度时
     *      包含 EMERGENCY_DELAY，直接比较即可。语义与 OZ isOperationReady 一致。
     */
    function isEmergencyOperationReady(bytes32 id) public view returns (bool) {
        return isOperationReady(id);
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
     * @dev [H-1 FIX] 同步清理紧急操作时间戳，防止取消后经紧急映射“复活”。
     */
    function cancel(bytes32 id) public override {
        super.cancel(id);
        delete _emergencyTimestamps[id];
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
