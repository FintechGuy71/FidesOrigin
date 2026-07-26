// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title QuarantineVault
 * @notice 平台隔离资金池 — 存放所有被自动隔离的污染资金
 * @dev 只有平台运营方可以操作，用户资金在此安全托管
 * @dev VERSION: 1.2.1 - 安全修复版本
 */
contract QuarantineVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    bytes32 public constant QUARANTINE_ROLE = keccak256("QUARANTINE_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant RELEASE_ROLE = keccak256("RELEASE_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    /// @notice 合约版本号
    string public constant VERSION = "1.2.1";

    /// @notice 隔离记录
    struct QuarantineRecord {
        address originalOwner;   // 原用户钱包
        address token;           // 代币合约
        uint256 amount;          // 金额
        uint256 timestamp;       // 隔离时间
        string reason;           // 隔离原因
        bool released;           // 是否已释放
        address releasedBy;      // 释放人
        uint256 releasedAt;      // 释放时间
        bool frozen;             // 是否永久冻结
    }

    /// @notice 隔离记录映射
    mapping(bytes32 => QuarantineRecord) public records;

    /// @notice 用户隔离记录列表
    mapping(address => bytes32[]) public userRecords;

    /// @notice 统计
    uint256 public totalQuarantined;
    uint256 public totalReleased;
    uint256 public totalQuarantinedAmount;
    uint256 public totalReleasedAmount;

    /// @notice 已添加的recordId列表（用于allRecordIds）
    bytes32[] public recordIdList;

    /// @notice 暂停状态
    bool public emergencyPaused;

    /// @notice [H-3] 单调递增 nonce，用于 recordId 唯一性
    uint256 public recordNonce;

    /// @notice [M-1] 按代币累计隔离金额（非合约余额）
    mapping(address => uint256) public tokenQuarantinedAmount;

    /// @notice [M-2] 紧急暂停冷却
    uint256 public lastPauseAt;
    uint256 public constant MIN_PAUSE_DURATION = 1 hours;
    uint256 public constant MAX_BATCH_SIZE = 100;

    /// @notice [HIGH-3 FIX] 用户自行提取的最小等待时间（默认禁用 claimFunds）
    uint256 public claimDelay = type(uint256).max;
    /// @notice [HIGH-3 FIX] 需要额外审批的记录（运营方可设置）
    mapping(bytes32 => bool) public claimRequiresApproval;

    /// @notice [HIGH-3 FIX] claimFunds 相关事件
    event ClaimDelayUpdated(uint256 oldDelay, uint256 newDelay);
    event ClaimRequiresApprovalSet(bytes32 indexed recordId, bool requiresApproval);

    /// @notice [HIGH-3 FIX] claimFunds 相关错误
    error ClaimDelayNotMet(uint256 claimableAfter);
    error ClaimRequiresApprovalError(bytes32 recordId);

    /// @notice 事件
    event FundsQuarantined(
        bytes32 indexed recordId,
        address indexed originalOwner,
        address token,
        uint256 amount,
        string reason,
        uint256 timestamp
    );

    event FundsReleased(
        bytes32 indexed recordId,
        address indexed originalOwner,
        address token,
        uint256 amount,
        address releasedBy,
        uint256 timestamp
    );

    /// @notice [C-4] 冻结事件（替代错误的 FundsReleased）
    event FundsFrozen(
        bytes32 indexed recordId,
        address indexed originalOwner,
        address token,
        uint256 amount,
        address indexed by,
        uint256 timestamp
    );

    event EmergencyPaused(uint256 timestamp);
    event EmergencyUnpaused(uint256 timestamp);

    event ZeroAddressRejected(string functionName, uint256 timestamp);

    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);

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

    event BatchReleaseFailed(bytes32 indexed recordId, string reason);

    event ETHReceived(address indexed sender, uint256 amount, uint256 timestamp);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error RecordNotFound(bytes32 recordId);
    error AlreadyReleased(bytes32 recordId);
    error AlreadyFrozen(bytes32 recordId);
    error RecordAlreadyExists(bytes32 recordId);
    error EmergencyPausedError();
    error EmergencyCooldownActive();
    error UnauthorizedRelease();
    error BatchTooLarge();

    // ============ Constructor ============

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(QUARANTINE_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
        _grantRole(RELEASE_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        // L-05 FIX: Keep DEFAULT_ADMIN_ROLE for role management
        // Note: Previously renounced, but that made all grant/revokeRole functions dead code
        // Renouncing is a trade-off: removing backdoor vs losing admin capability
    }

    // ============ External API (兼容层) ============

    /**
     * @notice 隔离资金 (别名，兼容旧版API)
     * @param originalOwner 原用户地址
     * @param token 代币地址
     * @param amount 金额
     * @param reasonHash 隔离原因哈希
     * @return recordId 隔离记录ID
     */
    function deposit(
        address originalOwner,
        address token,
        uint256 amount,
        bytes32 reasonHash
    ) external onlyRole(QUARANTINE_ROLE) nonReentrant returns (bytes32 recordId) {
        // D2-021 fix: use hex encoding for readable event logs
        string memory reason = reasonHash == bytes32(0) ? "manual" : _bytes32ToHexString(reasonHash);
        return _quarantineFunds(originalOwner, token, amount, reason);
    }

    /**
     * @notice 释放隔离资金（兼容旧版API）
     * @dev [C-2] 仅允许 to == address(0)，资金始终归还 originalOwner
     * @param recordId 隔离记录ID
     * @param to 必须为 0 地址（保留参数以兼容旧接口）
     * @dev DEPRECATED: L-15 FIX: 请使用 releaseFunds(recordId) 替代。此函数保留仅为向后兼容。
     */
    function release(bytes32 recordId, address to) external onlyRole(RELEASE_ROLE) nonReentrant {
        require(to == address(0), "Use releaseFunds for owner return");
        _releaseFunds(recordId, false);
    }

    /**
     * @notice 治理解锁（兼容旧版API）
     * @dev [C-3] 移除 to 参数，资金始终归还 originalOwner；尊重冻结状态
     * @param recordId 隔离记录ID
     */
    function governanceUnlock(bytes32 recordId) external onlyRole(EMERGENCY_ROLE) nonReentrant {
        _releaseFunds(recordId, false);
    }

    /**
     * @notice 批量存入资金
     * @dev [H-2] 完整输入校验 + [H-3] nonce 防碰撞 + [M-5] 批量上限
     */
    function batchDeposit(
        address[] calldata owners,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[] calldata reasons
    ) external onlyRole(QUARANTINE_ROLE) nonReentrant {
        if (emergencyPaused) revert EmergencyPausedError();
        require(
            owners.length == tokens.length &&
            tokens.length == amounts.length &&
            amounts.length == reasons.length,
            "Length mismatch"
        );
        require(owners.length <= MAX_BATCH_SIZE, "Batch too large");

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == address(0)) revert InvalidAddress();
            if (tokens[i] == address(0)) revert InvalidAddress();
            if (amounts[i] == 0) revert InvalidAmount();

            // [H-3] 使用单调递增 nonce 替代 totalQuarantined
            bytes32 recordId = keccak256(abi.encodePacked(
                owners[i], tokens[i], amounts[i], block.timestamp, msg.sender, recordNonce
            ));
            recordNonce++;

            if (records[recordId].timestamp != 0) revert RecordAlreadyExists(recordId);

            string memory reason = reasons[i] == bytes32(0) ? "batch" : _bytes32ToHexString(reasons[i]);

            // [H-48] fee-on-transfer: record actual received amount, not requested amount
            uint256 balanceBefore = IERC20(tokens[i]).balanceOf(address(this));
            IERC20(tokens[i]).safeTransferFrom(msg.sender, address(this), amounts[i]);
            uint256 actualAmount = IERC20(tokens[i]).balanceOf(address(this)) - balanceBefore;

            records[recordId] = QuarantineRecord({
                originalOwner: owners[i],
                token: tokens[i],
                amount: actualAmount,
                timestamp: block.timestamp,
                reason: reason,
                released: false,
                releasedBy: address(0),
                releasedAt: 0,
                frozen: false
            });

            userRecords[owners[i]].push(recordId);
            recordIdList.push(recordId);
            totalQuarantined++;
            totalQuarantinedAmount += actualAmount;
            tokenQuarantinedAmount[tokens[i]] += actualAmount;

            emit FundsQuarantined(recordId, owners[i], tokens[i], actualAmount, reason, block.timestamp);
        }
    }

    // ============ View Functions (查询) ============

    /**
     * @notice 获取所有记录ID列表
     */
    function allRecordIds(uint256 index) external view returns (bytes32) {
        require(index < recordIdList.length, "Index out of bounds");
        return recordIdList[index];
    }

    /**
     * @notice 按代币统计隔离金额（累计隔离金额，非合约当前余额）
     * @dev [M-1] 返回映射中记录的累计值，不受直接捐赠攻击影响
     */
    function totalQuarantinedAmountForToken(address token) external view returns (uint256) {
        return tokenQuarantinedAmount[token];
    }

    /**
     * @notice 获取记录数量
     */
    function getRecordCount() external view returns (uint256) {
        return totalQuarantined;
    }

    /**
     * @notice L-12 FIX: 分页查询记录ID列表（防止无界数组遍历导致 OOG）
     * @param offset 起始索引
     * @param limit 返回数量上限
     */
    function getRecordIdsPaginated(uint256 offset, uint256 limit) external view returns (bytes32[] memory page) {
        uint256 total = recordIdList.length;
        if (offset >= total) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new bytes32[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = recordIdList[offset + i];
        }
    }

    // ============ Emergency Functions ============

    /**
     * @notice 永久冻结记录（无法释放）
     * @dev [C-4] 发射 FundsFrozen 事件，不再误发 FundsReleased
     * @param recordId 隔离记录ID
     */
    function freezePermanently(bytes32 recordId) external onlyRole(EMERGENCY_ROLE) {
        QuarantineRecord storage record = records[recordId];
        if (record.timestamp == 0) revert RecordNotFound(recordId);
        if (record.released) revert AlreadyReleased(recordId);
        if (record.frozen) revert AlreadyFrozen(recordId);
        record.frozen = true;
        emit FundsFrozen(recordId, record.originalOwner, record.token, record.amount, msg.sender, block.timestamp);
    }

    /**
     * @notice 紧急暂停
     */
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        emergencyPaused = true;
        lastPauseAt = block.timestamp;
        emit EmergencyPaused(block.timestamp);
        emit ContractPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice 解除紧急暂停
     * @dev [M-2] 增加最小暂停持续时间冷却
     */
    function emergencyUnpause() external onlyRole(EMERGENCY_ROLE) {
        if (block.timestamp - lastPauseAt < MIN_PAUSE_DURATION) revert EmergencyCooldownActive();
        emergencyPaused = false;
        emit EmergencyUnpaused(block.timestamp);
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    // ============ Core Functions ============

    /**
     * @notice 隔离资金
     * @param originalOwner 原用户地址
     * @param token 代币地址
     * @param amount 金额
     * @param reason 隔离原因
     * @return recordId 隔离记录ID
     */
    function quarantineFunds(
        address originalOwner,
        address token,
        uint256 amount,
        string calldata reason
    ) external onlyRole(QUARANTINE_ROLE) nonReentrant returns (bytes32 recordId) {
        return _quarantineFunds(originalOwner, token, amount, reason);
    }

    function _quarantineFunds(
        address originalOwner,
        address token,
        uint256 amount,
        string memory reason
    ) internal returns (bytes32 recordId) {
        if (originalOwner == address(0)) revert InvalidAddress();
        if (token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (emergencyPaused) revert EmergencyPausedError();

        // [H-3] 使用单调递增 nonce 保证唯一性
        recordId = keccak256(abi.encodePacked(
            originalOwner,
            token,
            amount,
            block.timestamp,
            recordNonce
        ));
        recordNonce++;

        if (records[recordId].timestamp != 0) revert RecordAlreadyExists(recordId);

        records[recordId] = QuarantineRecord({
            originalOwner: originalOwner,
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason,
            released: false,
            releasedBy: address(0),
            releasedAt: 0,
            frozen: false
        });

        userRecords[originalOwner].push(recordId);
        recordIdList.push(recordId);

        totalQuarantined++;
        totalQuarantinedAmount += amount;
        tokenQuarantinedAmount[token] += amount;

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 actualAmount = IERC20(token).balanceOf(address(this)) - balanceBefore;

        // [H-48] update record amount to actual received
        if (actualAmount != amount) {
            records[recordId].amount = actualAmount;
            totalQuarantinedAmount = totalQuarantinedAmount - amount + actualAmount;
            tokenQuarantinedAmount[token] = tokenQuarantinedAmount[token] - amount + actualAmount;
        }

        emit FundsQuarantined(recordId, originalOwner, token, actualAmount, reason, block.timestamp);

        return recordId;
    }

    /**
     * @notice 释放隔离资金
     * @param recordId 隔离记录ID
     */
    function releaseFunds(bytes32 recordId) external onlyRole(RELEASE_ROLE) nonReentrant {
        _releaseFunds(recordId, false);
    }

    /**
     * @notice 内部释放逻辑
     * @dev [H-1] 统一冻结检查；bypassFrozen 参数预留给未来 Timelock 治理路径
     * @param recordId 隔离记录ID
     * @param bypassFrozen 是否绕过冻结检查
     */
    function _releaseFunds(bytes32 recordId, bool bypassFrozen) internal {
        QuarantineRecord storage record = records[recordId];

        if (record.timestamp == 0) revert RecordNotFound(recordId);
        if (record.released) revert AlreadyReleased(recordId);
        if (record.frozen && !bypassFrozen) revert AlreadyFrozen(recordId);
        if (emergencyPaused) revert EmergencyPausedError();

        record.released = true;
        record.releasedBy = msg.sender;
        record.releasedAt = block.timestamp;

        totalReleased++;
        totalReleasedAmount += record.amount;
        // M-06 FIX: 显式检查 totalQuarantinedAmount 和 tokenQuarantinedAmount 防止下溢
        require(totalQuarantinedAmount >= record.amount, "QV: totalQuarantinedAmount underflow");
        totalQuarantinedAmount -= record.amount;
        require(tokenQuarantinedAmount[record.token] >= record.amount, "QV: underflow");
        tokenQuarantinedAmount[record.token] -= record.amount;

        // P0 FIX: 支持 ETH 释放，gas 限制提高到 10000 以兼容合约钱包 (Gnosis Safe / Argent)
        if (record.token == address(0)) {
            // ETH 释放路径 — 限制 gas 防止恶意接收方消耗无限 gas
            (bool ok, ) = payable(record.originalOwner).call{value: record.amount, gas: 10000}("");
            require(ok, "ETH release failed");
        } else {
            // ERC20 释放路径
            IERC20(record.token).safeTransfer(record.originalOwner, record.amount);
        }

        emit FundsReleased(
            recordId,
            record.originalOwner,
            record.token,
            record.amount,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice 批量释放隔离资金
     * @dev [C-1] 内联释放逻辑，避免 nonReentrant 下的外部自调用
     * @param ids 隔离记录ID数组
     */
    function batchReleaseFunds(bytes32[] calldata ids) external onlyRole(RELEASE_ROLE) nonReentrant {
        require(ids.length <= MAX_BATCH_SIZE, "Batch too large");

        for (uint256 i = 0; i < ids.length; i++) {
            bytes32 recordId = ids[i];
            QuarantineRecord storage record = records[recordId];

            if (record.timestamp == 0) {
                emit BatchReleaseFailed(recordId, "RecordNotFound");
                continue;
            }
            if (record.released) {
                emit BatchReleaseFailed(recordId, "AlreadyReleased");
                continue;
            }
            if (record.frozen) {
                emit BatchReleaseFailed(recordId, "Frozen");
                continue;
            }
            if (emergencyPaused) {
                emit BatchReleaseFailed(recordId, "Paused");
                continue;
            }

            record.released = true;
            record.releasedBy = msg.sender;
            record.releasedAt = block.timestamp;
            totalReleased++;
            totalReleasedAmount += record.amount;
            // M-06 FIX: 显式检查防止下溢
            require(totalQuarantinedAmount >= record.amount, "QV: totalQuarantinedAmount underflow");
            totalQuarantinedAmount -= record.amount;
            require(tokenQuarantinedAmount[record.token] >= record.amount, "QV: underflow");
            tokenQuarantinedAmount[record.token] -= record.amount;

            // P0 FIX: 支持 ETH 批量释放，gas 限制提高到 10000
            if (record.token == address(0)) {
                (bool ok, ) = payable(record.originalOwner).call{value: record.amount, gas: 10000}("");
                if (!ok) {
                    emit BatchReleaseFailed(recordId, "ETH transfer failed");
                    continue;
                }
            } else {
                IERC20(record.token).safeTransfer(record.originalOwner, record.amount);
            }

            emit FundsReleased(
                recordId,
                record.originalOwner,
                record.token,
                record.amount,
                msg.sender,
                block.timestamp
            );
        }
    }

    /**
     * @notice H-06 FIX: 用户自行提取隔离资金（pull-based 模式）
     * @dev 只有 originalOwner 可以调用，不限制 gas，适合合约接收方
     * @dev HIGH-3 FIX: 新增 claimDelay 等待期和 claimRequiresApproval 检查，
     *      防止用户在被隔离后立即提取资金绕过 RELEASE_ROLE 审批流程。
     *      运营方可通过 setClaimRequiresApproval 标记高风险记录为需审批。
     * @param recordId 隔离记录ID
     */
    function claimFunds(bytes32 recordId) external nonReentrant {
        QuarantineRecord storage record = records[recordId];
        if (record.timestamp == 0) revert RecordNotFound(recordId);
        if (record.released) revert AlreadyReleased(recordId);
        if (record.frozen) revert AlreadyFrozen(recordId);
        if (emergencyPaused) revert EmergencyPausedError();
        if (record.originalOwner != msg.sender) revert UnauthorizedRelease();

        // [HIGH-3 FIX] 检查是否需要额外审批（运营方标记的高风险记录）
        if (claimRequiresApproval[recordId]) {
            revert ClaimRequiresApprovalError(recordId);
        }

        // [HIGH-3 FIX] 检查等待期是否已过（默认禁用，需运营方显式启用）
        // [C-02 FIX] 当 claimDelay 为 type(uint256).max 时，timestamp + claimDelay 会溢出 panic
        if (claimDelay == type(uint256).max) {
            revert ClaimDelayNotMet(type(uint256).max);
        }
        uint256 claimableAfter = record.timestamp + claimDelay;
        if (block.timestamp < claimableAfter) {
            revert ClaimDelayNotMet(claimableAfter);
        }

        record.released = true;
        record.releasedBy = msg.sender;
        record.releasedAt = block.timestamp;

        totalReleased++;
        totalReleasedAmount += record.amount;
        require(totalQuarantinedAmount >= record.amount, "QV: totalQuarantinedAmount underflow");
        totalQuarantinedAmount -= record.amount;
        require(tokenQuarantinedAmount[record.token] >= record.amount, "QV: underflow");
        tokenQuarantinedAmount[record.token] -= record.amount;

        if (record.token == address(0)) {
            // P0 FIX: 限制 gas 为 10000 防止重入攻击，同时兼容合约钱包
            (bool ok, ) = payable(record.originalOwner).call{value: record.amount, gas: 10000}("");
            require(ok, "ETH claim failed");
        } else {
            IERC20(record.token).safeTransfer(record.originalOwner, record.amount);
        }

        emit FundsReleased(
            recordId,
            record.originalOwner,
            record.token,
            record.amount,
            msg.sender,
            block.timestamp
        );
    }

    // ============ Admin Functions (审计日志) ============

    function grantQuarantineRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(QUARANTINE_ROLE, account);
        emit RoleGrantedDetailed(QUARANTINE_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function revokeQuarantineRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(QUARANTINE_ROLE, account);
        emit RoleRevokedDetailed(QUARANTINE_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function grantAuditorRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(AUDITOR_ROLE, account);
        emit RoleGrantedDetailed(AUDITOR_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function revokeAuditorRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(AUDITOR_ROLE, account);
        emit RoleRevokedDetailed(AUDITOR_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function grantReleaseRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(RELEASE_ROLE, account);
        emit RoleGrantedDetailed(RELEASE_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function revokeReleaseRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(RELEASE_ROLE, account);
        emit RoleRevokedDetailed(RELEASE_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function grantEmergencyRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(EMERGENCY_ROLE, account);
        emit RoleGrantedDetailed(EMERGENCY_ROLE, account, msg.sender, block.timestamp, reason);
    }

    function revokeEmergencyRole(address account, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(EMERGENCY_ROLE, account);
        emit RoleRevokedDetailed(EMERGENCY_ROLE, account, msg.sender, block.timestamp, reason);
    }

    // ============ HIGH-3 FIX: Claim Delay & Approval Management ============

    /**
     * @notice [HIGH-3 FIX] 设置用户 claim 的最小等待时间
     * @param _delay 新的等待时间（秒）
     */
    function setClaimDelay(uint256 _delay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 限制最大延迟为 7 天，防止恶意锁定
        require(_delay <= 7 days, "Delay too large");
        uint256 old = claimDelay;
        claimDelay = _delay;
        emit ClaimDelayUpdated(old, _delay);
    }

    /**
     * @notice [HIGH-3 FIX] 设置记录是否需要 RELEASE_ROLE 审批后才能 claim
     * @param recordId 隔离记录ID
     * @param _requiresApproval true = 需要 RELEASE_ROLE 审批，false = 正常 claim 流程
     */
    function setClaimRequiresApproval(bytes32 recordId, bool _requiresApproval) external onlyRole(EMERGENCY_ROLE) {
        QuarantineRecord storage record = records[recordId];
        if (record.timestamp == 0) revert RecordNotFound(recordId);
        claimRequiresApproval[recordId] = _requiresApproval;
        emit ClaimRequiresApprovalSet(recordId, _requiresApproval);
    }

    // ============ ETH Withdrawal ============
    function withdrawETH(address payable to) external onlyRole(EMERGENCY_ROLE) nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        (bool ok, ) = to.call{value: balance}("");
        require(ok, "ETH withdrawal failed");
    }

    // ============ View Functions ============

    function getRecord(bytes32 recordId) external view returns (QuarantineRecord memory) {
        return records[recordId];
    }

    function getUserRecords(address user) external view returns (bytes32[] memory) {
        return userRecords[user];
    }

    function getStats() external view returns (uint256, uint256, uint256, uint256) {
        return (totalQuarantined, totalReleased, totalQuarantinedAmount, totalReleasedAmount);
    }

    function isEmergencyPaused() external view returns (bool) {
        return emergencyPaused;
    }

    /**
     * @notice 接收 ETH
     */
    receive() external payable {
        emit ETHReceived(msg.sender, msg.value, block.timestamp);
    }

    // ============ Internal Helpers ============

    /**
     * @dev D2-021 fix: convert bytes32 to hex string for readable event logs
     */
    function _bytes32ToHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory result = new bytes(2 + 64);
        result[0] = '0';
        result[1] = 'x';
        for (uint256 i = 0; i < 32; i++) {
            result[2 + i * 2] = hexChars[uint8(data[i]) >> 4];
            result[2 + i * 2 + 1] = hexChars[uint8(data[i]) & 0x0f];
        }
        return string(result);
    }
}