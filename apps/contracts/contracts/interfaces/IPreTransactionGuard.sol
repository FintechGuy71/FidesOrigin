// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPreTransactionGuard {
    enum Action { ALLOW, WARN, BLOCK }
    
    struct RiskAssessment {
        Action action;
        uint256 riskScore;
        uint256 confidence;
        string reason;
        uint256 assessmentTime;
    }
    
    struct TransactionIntent {
        address from;
        address to;
        uint256 value;
        address token;
        bytes data;
        uint256 chainId;
    }

    function assessAddress(address addr) external view returns (RiskAssessment memory);
    function assessTransaction(TransactionIntent calldata intent) external view returns (RiskAssessment memory);
    function assessBatch(address[] calldata addrs) external view returns (RiskAssessment[] memory);
    function currentMerkleRoot() external view returns (bytes32);
    
    event ThresholdUpdated(string thresholdType, uint256 oldValue, uint256 newValue);
    event SanctionedCacheUpdated(address indexed addr, bool sanctioned);
    event AssessmentPerformed(address indexed addr, uint256 riskScore, Action action, uint256 timestamp);
}
