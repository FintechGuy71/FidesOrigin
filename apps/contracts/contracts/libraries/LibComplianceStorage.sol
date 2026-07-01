// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../RiskRegistry.sol";
import "../PolicyEngine.sol";
import "../interfaces/IAssetCompliance.sol";

library LibComplianceStorage {
    bytes32 constant DIAMOND_STORAGE_POSITION =
        keccak256("compliance.engine.diamond.storage");

    struct CheckRecord {
        address addr;
        uint256 riskScore;
        bool isCompliant;
        uint256 timestamp;
        uint256 blockNumber;
        bytes32 checkType;
        string reason;
    }

    struct QuarantineRecord {
        address from;
        address to;
        uint256 amount;
        address token;
        uint256 timestamp;
        bool released;
        address operator;
        string reason;
    }

    struct AppStorage {
        // Core contracts
        RiskRegistry riskRegistry;
        PolicyEngine policyEngine;
        // Stats
        uint256 totalChecks;
        uint256 blockedTransactions;
        uint256 quarantinedTransactions;
        // Quarantine
        uint256 quarantineNonce;
        mapping(bytes32 => QuarantineRecord) quarantinedTxs;
        bytes32[] quarantineList;
        // Check history
        CheckRecord[] checkHistory;
        mapping(address => uint256) addressCheckCount;
        // Rules
        mapping(bytes32 => bool) pausedRules;
        // Issuer policies
        mapping(address => IAssetCompliance.IssuerPolicy) issuerPolicies;
        mapping(address => mapping(uint256 => uint256)) dailySpent;
        mapping(address => uint256) lastTransferTime;
        // Upgrade timelock
        uint256 upgradeTimelockDelay;
        mapping(bytes32 => uint256) upgradeProposals;
        mapping(address => bytes32) implementationToProposal;
    }

    function diamondStorage()
        internal
        pure
        returns (AppStorage storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
