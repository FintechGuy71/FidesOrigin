// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAssetCompliance.sol";

/**
 * @title IComplianceEngine
 * @notice 核心合规引擎接口标准
 * @dev 继承 IAssetCompliance，扩展 checkTransactionCompliance 功能
 */
interface IComplianceEngine is IAssetCompliance {
    
    /**
     * @notice 交易合规检查（带 deadline）
     * @dev IComplianceEngine 特有功能
     */
    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external returns (bool isCompliant, uint8[] memory actionTypes);
    
    /**
     * @notice 交易合规检查（简版）
     * @dev IComplianceEngine 特有功能
     */
    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token
    ) external returns (bool isCompliant, uint8[] memory actionTypes);
}
