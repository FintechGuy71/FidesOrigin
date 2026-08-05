// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RiskRegistryV3 is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    string public constant VERSION = "3.0.0";

    struct HotProfile {
        uint256 riskScore;
        uint8 riskTier;
        bool sanctioned;
        bool exists;
        uint32 lastUpdated;
    }

    mapping(address => HotProfile) public hotProfiles;
    address[] public hotAddresses;
    uint256 public maxHotProfiles = 100000;
    uint256 public hotCount;

    mapping(address => uint256) public dailyVolume;
    mapping(address => uint256) public dailyReset;

    function initialize(address admin) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function setHotProfile(address addr, uint256 score, uint8 tier, bool sanctioned) 
        external onlyRole(OPERATOR_ROLE) 
    {
        if (!hotProfiles[addr].exists) {
            require(hotCount < maxHotProfiles, "Full");
            hotCount++;
            hotAddresses.push(addr);
        }
        hotProfiles[addr] = HotProfile(score, tier, sanctioned, true, uint32(block.timestamp));
    }

    function getRiskScore(address addr) external view returns (uint256) {
        if (hotProfiles[addr].exists) return hotProfiles[addr].riskScore;
        return 0;
    }

    function isSanctioned(address addr) external view returns (bool) {
        return hotProfiles[addr].sanctioned;
    }

    function recordVolume(address addr, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (block.timestamp - dailyReset[addr] > 1 days) {
            dailyVolume[addr] = 0;
            dailyReset[addr] = block.timestamp;
        }
        dailyVolume[addr] += amount;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
