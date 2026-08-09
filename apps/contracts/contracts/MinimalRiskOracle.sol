// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MinimalRiskOracle
 * @notice 精简版 RiskOracle，仅用于 deferredCount 监控和测试
 * @dev 完整功能版 RiskOracle 部署前，此合约提供 deferredCount 指标
 * @dev 可由 ADMIN_ROLE 地址更新计数，后续可迁移到完整 RiskOracle
 */
contract MinimalRiskOracle is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice 当前 deferred 队列深度（供链下监控/告警读取）
    uint256 public deferredCount;

    event DeferredCountUpdated(uint256 oldCount, uint256 newCount, address indexed operator);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    /**
     * @notice 增加 deferred 计数
     * @param _amount 增加数量
     */
    function increaseDeferredCount(uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        uint256 oldCount = deferredCount;
        deferredCount += _amount;
        emit DeferredCountUpdated(oldCount, deferredCount, msg.sender);
    }

    /**
     * @notice 减少 deferred 计数
     * @param _amount 减少数量
     */
    function decreaseDeferredCount(uint256 _amount) external onlyRole(OPERATOR_ROLE) {
        uint256 oldCount = deferredCount;
        require(deferredCount >= _amount, "Count cannot go negative");
        deferredCount -= _amount;
        emit DeferredCountUpdated(oldCount, deferredCount, msg.sender);
    }

    /**
     * @notice 直接设置 deferred 计数（管理员紧急操作）
     * @param _count 新计数值
     */
    function setDeferredCount(uint256 _count) external onlyRole(ADMIN_ROLE) {
        uint256 oldCount = deferredCount;
        deferredCount = _count;
        emit DeferredCountUpdated(oldCount, deferredCount, msg.sender);
    }

    /**
     * @notice 转移所有权
     * @param _newAdmin 新管理员地址
     */
    function transferOwnership(address _newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newAdmin != address(0), "Invalid address");
        address previousOwner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
        _grantRole(ADMIN_ROLE, _newAdmin);
        _grantRole(OPERATOR_ROLE, _newAdmin);
        _revokeRole(ADMIN_ROLE, previousOwner);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
        emit OwnershipTransferred(previousOwner, _newAdmin);
    }
}
