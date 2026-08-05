// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IPreTransactionGuard.sol";
import "../RiskRegistry.sol";

contract PreTransactionGuard is IPreTransactionGuard, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    string public constant VERSION = "1.0.0";

    RiskRegistry public riskRegistry;
    mapping(address => bool) public sanctionedCache;
    uint256 public blockThreshold = 80;
    uint256 public warnThreshold = 50;
    
    error InvalidAddress();

    constructor(address _riskRegistry) {
        riskRegistry = RiskRegistry(_riskRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function assessAddress(address addr) external view override returns (RiskAssessment memory) {
        if (addr == address(0)) revert InvalidAddress();
        if (sanctionedCache[addr]) return RiskAssessment(Action.BLOCK, 100, 100, "Sanctioned", block.timestamp);
        (uint256 score,,,,, bool sanctioned, bool exists,) = riskRegistry.getProfile(addr);
        if (!exists) return RiskAssessment(Action.ALLOW, 0, 0, "No data", block.timestamp);
        Action a = Action.ALLOW;
        if (sanctioned || score >= blockThreshold) a = Action.BLOCK;
        else if (score >= warnThreshold) a = Action.WARN;
        return RiskAssessment(a, score, 80, a == Action.BLOCK ? "High risk" : "Medium risk", block.timestamp);
    }
    
    function assessTransaction(TransactionIntent calldata intent) external view override returns (RiskAssessment memory) {
        RiskAssessment memory r1 = this.assessAddress(intent.from);
        if (r1.action == Action.BLOCK) return r1;
        RiskAssessment memory r2 = this.assessAddress(intent.to);
        if (r2.action == Action.BLOCK) return r2;
        uint256 maxScore = r1.riskScore > r2.riskScore ? r1.riskScore : r2.riskScore;
        Action a = r1.action;
        if (uint(r2.action) > uint(a)) a = r2.action;
        return RiskAssessment(a, maxScore, 80, "Transaction checked", block.timestamp);
    }
    
    function assessBatch(address[] calldata addrs) external view override returns (RiskAssessment[] memory results) {
        results = new RiskAssessment[](addrs.length);
        for (uint i = 0; i < addrs.length; i++) results[i] = this.assessAddress(addrs[i]);
    }
    
    function currentMerkleRoot() external pure override returns (bytes32) {
        return bytes32(0);
    }
    
    function updateSanctionedCache(address addr, bool sanctioned) external onlyRole(OPERATOR_ROLE) {
        sanctionedCache[addr] = sanctioned;
    }
    
    function setBlockThreshold(uint256 t) external onlyRole(ADMIN_ROLE) { blockThreshold = t; }
    function setWarnThreshold(uint256 t) external onlyRole(ADMIN_ROLE) { warnThreshold = t; }
}
