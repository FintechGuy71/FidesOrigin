// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/LibDiamond.sol";

/**
 * @title BaseFacet
 * @notice C-01 FIX: Diamond Facet 统一继承基类 — 使用 Diamond Storage，避免 OZ 状态合约继承导致的存储碰撞
 * @dev 所有 facet 必须继承此基类。
 * @dev 完全不继承任何 OpenZeppelin 状态合约（AccessControl / Pausable / ReentrancyGuard），
 *      所有状态通过独立的 Diamond Storage slot 管理，彻底消除存储布局依赖风险。
 */
abstract contract BaseFacet {

    // C-01 FIX: 独立的 Diamond Storage position，与 LibDiamond / LibComplianceStorage 不冲突
    bytes32 constant BASE_FACET_STORAGE_POSITION =
        keccak256("fidesorigin.base.facet.storage");

    struct BaseFacetStorage {
        // AccessControl 状态
        mapping(bytes32 => mapping(address => bool)) roles;
        mapping(bytes32 => bytes32) roleAdmin;
        // Pausable 状态
        bool paused;
        // ReentrancyGuard 状态 (0 = 未进入, 1 = 已退出, 2 = 已进入)
        uint256 reentrancyStatus;
    }

    function baseFacetStorage()
        internal
        pure
        returns (BaseFacetStorage storage bs)
    {
        bytes32 position = BASE_FACET_STORAGE_POSITION;
        assembly {
            bs.slot := position
        }
    }

    // ============ AccessControl Constants ============
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    // ============ Modifiers ============

    modifier onlyRole(bytes32 role) {
        require(
            hasRole(role, msg.sender),
            "BaseFacet: Missing role"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!baseFacetStorage().paused, "BaseFacet: Paused");
        _;
    }

    modifier whenPaused() {
        require(baseFacetStorage().paused, "BaseFacet: Not paused");
        _;
    }

    modifier nonReentrant() {
        require(
            baseFacetStorage().reentrancyStatus != 2,
            "BaseFacet: Reentrant call"
        );
        baseFacetStorage().reentrancyStatus = 2;
        _;
        baseFacetStorage().reentrancyStatus = 1;
    }

    // ============ AccessControl Functions ============

    // [L-9 FIX] 标准角色事件（与 OZ AccessControl 对齐）：
    // 原实现 _grantRole/_revokeRole 静默变更角色，仅 *WithReason 封装路径
    // 有事件——其他内部调用路径完全无链上审计痕迹。
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    function hasRole(bytes32 role, address account)
        public
        view
        returns (bool)
    {
        return baseFacetStorage().roles[role][account];
    }

    function getRoleAdmin(bytes32 role) public view returns (bytes32) {
        return baseFacetStorage().roleAdmin[role];
    }

    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            baseFacetStorage().roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            baseFacetStorage().roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal {
        baseFacetStorage().roleAdmin[role] = adminRole;
    }

    // ============ Pausable Functions ============

    function _pause() internal whenNotPaused {
        baseFacetStorage().paused = true;
    }

    function _unpause() internal whenPaused {
        baseFacetStorage().paused = false;
    }

    function paused() public view returns (bool) {
        return baseFacetStorage().paused;
    }
}
