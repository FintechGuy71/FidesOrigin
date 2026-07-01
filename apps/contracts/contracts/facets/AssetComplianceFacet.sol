// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/LibComplianceStorage.sol";
import "../interfaces/IAssetCompliance.sol";
import "../interfaces/IComplianceErrors.sol";

contract AssetComplianceFacet is AccessControl, IAssetCompliance {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============ Internal Helpers ============
    function _checkRisk(
        address addr
    )
        internal
        view
        returns (bool blocked, uint256 score, string memory reason)
    {
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0))
            return (true, 0, "Registry not set");
        (
            uint256 sc,
            ,
            ,
            ,
            ,
            bool sanctioned,
            bool exists,

        ) = s.riskRegistry.getProfile(addr);
        score = sc;
        if (!exists) {
            blocked = true;
            reason = "No profile - fail closed";
        } else if (sanctioned) {
            blocked = true;
            reason = "Sanctioned";
        } else if (sc >= 95) {
            blocked = true;
            reason = "Critical";
        } else if (sc >= 80) {
            blocked = true;
            reason = "High risk";
        }
    }

    // ============ IAssetCompliance Implementation ============
    function validateTransfer(
        address from,
        address to,
        uint256 amount,
        address assetContract
    )
        external
        view
        returns (Decision decision, string memory reason)
    {
        if (
            msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)
        ) revert UnauthorizedCaller(msg.sender);
        if (from == address(0) || to == address(0))
            return (Decision.BLOCK, "Invalid address");
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0))
            return (Decision.BLOCK, "Registry not set");

        (bool b1, , string memory r1) = _checkRisk(from);
        if (b1) return (Decision.BLOCK, r1);
        (bool b2, , string memory r2) = _checkRisk(to);
        if (b2) return (Decision.BLOCK, r2);

        IAssetCompliance.IssuerPolicy memory p = s.issuerPolicies[
            assetContract
        ];
        if (p.maxTxAmount > 0 && amount > p.maxTxAmount)
            return (Decision.BLOCK, "Max tx");
        if (p.dailyLimit > 0) {
            if (
                s.dailySpent[from][block.timestamp / 1 days] + amount >
                p.dailyLimit
            ) return (Decision.BLOCK, "Daily limit exceeded");
        }
        return (Decision.ALLOW, "Transfer allowed");
    }

    function preTransferHook(
        address from,
        address to,
        uint256
    ) external view {
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0)) revert RegistryNotSet();
        (bool b1, , ) = _checkRisk(from);
        if (b1) revert RiskBlocked();
        (bool b2, , ) = _checkRisk(to);
        if (b2) revert RiskBlocked();
    }

    function postTransferHook(
        address from,
        address to,
        uint256 amount,
        bool success
    ) external onlyRole(OPERATOR_ROLE) {
        emit TransferRecorded(msg.sender, from, to, amount, success);
    }

    function getAddressRisk(
        address account
    ) external view returns (RiskProfile memory) {
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0))
            return RiskProfile(0, RiskTier.UNKNOWN, new bytes32[](0), 0, false);
        (
            uint256 score,
            ,
            uint32 lu,
            uint8 rt,
            ,
            bool san,
            bool ex,
            bytes32[] memory tags
        ) = s.riskRegistry.getProfile(account);
        if (!ex)
            return RiskProfile(0, RiskTier.UNKNOWN, new bytes32[](0), 0, false);
        return RiskProfile(uint8(score), RiskTier(rt), tags, lu, san);
    }

    function getRiskTier(address account) external view returns (RiskTier) {
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0)) return RiskTier.UNKNOWN;
        (, , , uint8 tier, , , bool ex, ) = s.riskRegistry.getProfile(account);
        if (!ex) return RiskTier.UNKNOWN;
        return RiskTier(tier);
    }

    function isSanctioned(address account) external view returns (bool) {
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0)) return false;
        (, , , , , bool san, bool ex, ) = s.riskRegistry.getProfile(account);
        return ex && san;
    }

    function getIssuerPolicy(
        address issuer
    ) external view returns (IssuerPolicy memory) {
        return LibComplianceStorage.diamondStorage().issuerPolicies[issuer];
    }

    function getDailySpent(
        address account,
        address
    ) external view returns (uint256) {
        return LibComplianceStorage
            .diamondStorage()
            .dailySpent[account][block.timestamp / 1 days];
    }
}
