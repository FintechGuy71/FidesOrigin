// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibComplianceStorage.sol";

/**
 * @title BaseFacet
 * @notice H-08 FIX: Diamond Facet 统一继承基类
 * @dev 所有 facet 必须继承此基类，确保 AccessControl、Pausable、ReentrancyGuard 的
 *      存储布局在所有 facet 中完全一致，防止存储碰撞风险。
 *      LibComplianceStorage 管理所有应用层状态，OZ 合约管理访问控制、暂停和重入保护。
 */
abstract contract BaseFacet is AccessControl, Pausable, ReentrancyGuard {
    // H-08: 统一继承顺序，确保所有 facet 的 OZ 存储 slot 一致
}
