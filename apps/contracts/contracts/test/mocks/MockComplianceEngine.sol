// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/IAssetCompliance.sol";
import "../../interfaces/IWalletCompliance.sol";
import "../../interfaces/IComplianceEngine.sol";
import "../../interfaces/IComplianceErrors.sol";

/**
 * @title MockComplianceEngine
 * @notice Mock compliance engine for testing that implements all required interfaces
 */
contract MockComplianceEngine is IAssetCompliance, IWalletCompliance, IComplianceEngine {
    mapping(address => bool) public sanctioned;
    mapping(address => uint8) public riskScores;
    mapping(address => uint8) public riskTiers;
    mapping(address => bool) public kycVerified;
    mapping(address => uint256) public dailySpent;
    IssuerPolicy public defaultPolicy;

    bool public shouldBlock;
    bool public shouldHold;
    string public blockReason;

    constructor() {
        defaultPolicy = IssuerPolicy({
            maxTxAmount: 1000000 * 10**18,
            dailyLimit: 5000000 * 10**18,
            allowMediumRisk: false,
            allowHighRisk: false,
            blockMixer: true,
            requireDestinationKYC: false,
            cooldownPeriod: 0,
            blockedTokens: new address[](0)
        });
    }

    function setRiskScore(address account, uint8 score, uint8 tier) external {
        riskScores[account] = score;
        riskTiers[account] = tier;
    }

    function setSanctioned(address account, bool status) external {
        sanctioned[account] = status;
    }

    function setKYCVerified(address account, bool status) external {
        kycVerified[account] = status;
    }

    function setShouldBlock(bool _shouldBlock, string calldata reason) external {
        shouldBlock = _shouldBlock;
        blockReason = reason;
    }

    function setShouldHold(bool _shouldHold) external {
        shouldHold = _shouldHold;
    }

    // ============ IAssetCompliance Implementation ============

    function validateTransfer(address from, address to, uint256, address)
        external view returns (Decision decision, string memory reason)
    {
        if (shouldBlock) return (Decision.BLOCK, blockReason);
        if (sanctioned[from] || sanctioned[to]) return (Decision.BLOCK, "Sanctioned");
        if (riskScores[from] >= 95 || riskScores[to] >= 95) return (Decision.BLOCK, "Critical risk");
        if (shouldHold) return (Decision.HOLD, "Hold");
        return (Decision.ALLOW, "Transfer allowed");
    }

    function preTransferHook(address from, address to, uint256) external view {
        if (sanctioned[from] || sanctioned[to]) revert RiskBlocked();
        if (riskScores[from] >= 95 || riskScores[to] >= 95) revert RiskBlocked();
    }

    function postTransferHook(address, address, uint256, bool) external {
        // no-op
    }

    function getAddressRisk(address account) external view returns (RiskProfile memory) {
        return RiskProfile({
            riskScore: riskScores[account],
            tier: RiskTier(riskTiers[account]),
            tags: new bytes32[](0),
            lastUpdated: 0,
            isSanctioned: sanctioned[account]
        });
    }

    function getRiskTier(address account) external view returns (RiskTier) {
        return RiskTier(riskTiers[account]);
    }

    function isSanctioned(address account) external view returns (bool) {
        return sanctioned[account];
    }

    function getIssuerPolicy(address) external view returns (IssuerPolicy memory) {
        return defaultPolicy;
    }

    function getDailySpent(address account, address) external view returns (uint256) {
        return dailySpent[account];
    }

    // ============ IWalletCompliance Implementation ============

    function validateOperation(address walletOwner, Operation calldata op, address)
        external view returns (Decision decision, string memory reason)
    {
        if (sanctioned[walletOwner]) return (Decision.BLOCK, "Sanctioned");
        if (riskScores[walletOwner] >= 95) return (Decision.BLOCK, "Critical");
        if (op.target == address(0)) return (Decision.BLOCK, "Zero target");
        return (Decision.ALLOW, "Op allowed");
    }

    function preExecutionHook(address walletOwner, Operation calldata op) external view {
        if (sanctioned[walletOwner]) revert RiskBlocked();
        if (op.target == address(0)) revert InvalidAddress();
    }

    function postExecutionHook(address, Operation calldata, bool) external {
        // no-op
    }

    function validateBatch(address walletOwner, Operation[] calldata ops)
        external view returns (Decision[] memory decisions)
    {
        decisions = new Decision[](ops.length);
        for (uint256 i = 0; i < ops.length; i++) {
            (decisions[i], ) = this.validateOperation(walletOwner, ops[i], address(0));
        }
    }

    function preBatchExecutionHook(address walletOwner, Operation[] calldata ops) external view {
        for (uint256 i = 0; i < ops.length; i++) {
            this.preExecutionHook(walletOwner, ops[i]);
        }
    }

    function analyzeOperationRisk(Operation calldata op)
        external pure returns (uint8 riskScore, RiskTier tier, string memory riskFactors)
    {
        if (op.target == address(0)) return (100, RiskTier.CRITICAL, "Zero target");
        return (0, RiskTier.LOW, "Standard");
    }

    function getWalletPolicy(address) external pure returns (WalletPolicy memory) {
        return WalletPolicy(0, 0, 0, 0, false, false, false, new address[](0), new address[](0), new bytes32[](0));
    }

    function getContractRisk(address) external pure returns (bool, uint8, string memory) {
        return (false, 0, "Unknown");
    }

    // ============ IComplianceEngine Implementation ============

    function checkTransactionCompliance(address from, address to, uint256 amount, address token, uint256)
        external view returns (bool isCompliant, uint8[] memory actionTypes)
    {
        (Decision d, ) = this.validateTransfer(from, to, amount, token);
        isCompliant = d != Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(d);
    }

    function checkTransactionCompliance(address from, address to, uint256 amount, address token)
        external view returns (bool isCompliant, uint8[] memory actionTypes)
    {
        (Decision d, ) = this.validateTransfer(from, to, amount, token);
        isCompliant = d != Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(d);
    }
}
