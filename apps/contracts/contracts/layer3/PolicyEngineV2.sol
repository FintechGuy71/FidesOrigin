// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract PolicyEngineV2 is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RULE_MANAGER_ROLE = keccak256("RULE_MANAGER_ROLE");
    string public constant VERSION = "2.1.0";

    enum ActionType { ALLOW, BLOCK, QUARANTINE }

    struct TemporalRule {
        uint256 minRiskScore;
        uint256 maxRiskScore;
        ActionType action;
        bool active;
        uint256 startTime;
        uint256 endTime;
        uint256 maxTxPerHour;
        uint256 maxVolumePerDay;
    }

    mapping(bytes32 => TemporalRule) public temporalRules;
    bytes32[] public ruleIds;

    mapping(address => uint256[]) public txTimestamps;

    function initialize(address admin) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RULE_MANAGER_ROLE, admin);
    }

    function addRule(bytes32 id, uint256 minScore, uint256 maxScore, ActionType action) 
        external onlyRole(RULE_MANAGER_ROLE) 
    {
        temporalRules[id] = TemporalRule(minScore, maxScore, action, true, 0, 0, 0, 0);
        ruleIds.push(id);
    }

    function evaluate(address, uint256 score) external view returns (ActionType, string memory) {
        for (uint i = 0; i < ruleIds.length; i++) {
            TemporalRule storage r = temporalRules[ruleIds[i]];
            if (!r.active) continue;
            if (block.timestamp < r.startTime) continue;
            if (r.endTime != 0 && block.timestamp > r.endTime) continue;
            if (score >= r.minRiskScore && score <= r.maxRiskScore) {
                return (r.action, "Rule matched");
            }
        }
        return (ActionType.ALLOW, "No match");
    }

    function recordTx(address addr) external {
        txTimestamps[addr].push(block.timestamp);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
