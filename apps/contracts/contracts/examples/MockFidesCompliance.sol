// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IFidesCompliance.sol";

contract MockFidesCompliance is IFidesCompliance {
    mapping(address => bool) private _blacklisted;
    mapping(address => RiskProfile) private _profiles;

    function isBlacklisted(address account) external view returns (bool) {
        return _blacklisted[account];
    }

    function isWhitelisted(address /* account */) external pure returns (bool) {
        return false;
    }

    function getRiskProfile(address account) external view returns (uint256 riskScore, bool isSanctioned, uint256 lastUpdated) {
        RiskProfile memory p = _profiles[account];
        return (p.score, p.level == RiskLevel.BLACKLIST, p.lastUpdated);
    }

    function evaluateTransaction(address, address, uint256, address, uint256) external pure returns (bool, uint256) {
        return (true, 0);
    }

    function blacklist(address account) external {
        _blacklisted[account] = true;
    }

    function setRiskProfile(address account, RiskProfile calldata profile) external {
        _profiles[account] = profile;
    }
}
