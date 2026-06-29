// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFidesCompliance
 * @notice FidesOrigin 可编程合规引擎接口
 * @dev 供智能钱包调用，查询地址风险状态
 */
interface IFidesCompliance {
    enum RiskLevel {
        UNKNOWN,       // 0
        WHITELIST,     // 1
        LOW,           // 2
        MEDIUM,        // 3
        HIGH,          // 4
        BLACKLIST      // 5
    }

    struct RiskProfile {
        RiskLevel level;
        uint256 score;
        string[] tags;
        uint256 lastUpdated;
        address updatedBy;
        bytes32 reasonHash;
        bool exists;
    }

    function isBlacklisted(address _account) external view returns (bool);
    function isWhitelisted(address _account) external view returns (bool);
    function getRiskProfile(address _account) external view returns (uint256 riskScore, bool isSanctioned, uint256 lastUpdated);
    function evaluateTransaction(address _from, address _to, uint256 _amount, address _token, uint256 _deadline) external returns (bool allowed, uint256 riskScore);
}
