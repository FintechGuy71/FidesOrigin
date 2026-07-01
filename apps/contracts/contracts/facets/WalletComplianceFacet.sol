// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/LibComplianceStorage.sol";
import "../interfaces/IAssetCompliance.sol";
import "../interfaces/IWalletCompliance.sol";
import "../interfaces/IComplianceErrors.sol";

contract WalletComplianceFacet is AccessControl, IWalletCompliance {
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

    // ============ IWalletCompliance Implementation ============
    function validateOperation(
        address walletOwner,
        Operation calldata op,
        address walletContract
    )
        external
        view
        returns (IAssetCompliance.Decision decision, string memory reason)
    {
        (bool b, , string memory r) = _checkRisk(walletOwner);
        if (b) return (IAssetCompliance.Decision.BLOCK, r);
        if (op.opType == OperationType.TRANSFER)
            return
                IAssetCompliance(address(this)).validateTransfer(
                    walletOwner,
                    op.target,
                    op.value,
                    walletContract
                );
        return (IAssetCompliance.Decision.ALLOW, "Op allowed");
    }

    function preExecutionHook(
        address walletOwner,
        Operation calldata op
    ) external view {
        if (op.target == address(0)) revert InvalidAddress();
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0)) revert RegistryNotSet();
        (bool b, , ) = _checkRisk(walletOwner);
        if (b) revert RiskBlocked();
        if (op.opType == OperationType.TRANSFER)
            IAssetCompliance(address(this)).preTransferHook(
                walletOwner,
                op.target,
                op.value
            );
    }

    function postExecutionHook(
        address walletOwner,
        Operation calldata op,
        bool success
    ) external onlyRole(OPERATOR_ROLE) {
        emit OperationExecuted(msg.sender, walletOwner, op.opType, success);
    }

    function validateBatch(
        address walletOwner,
        Operation[] calldata ops
    ) external view returns (IAssetCompliance.Decision[] memory decisions) {
        decisions = new IAssetCompliance.Decision[](ops.length);
        for (uint256 i = 0; i < ops.length; i++)
            (decisions[i], ) = this.validateOperation(
                walletOwner,
                ops[i],
                address(0)
            );
    }

    function preBatchExecutionHook(
        address walletOwner,
        Operation[] calldata ops
    ) external view {
        for (uint256 i = 0; i < ops.length; i++)
            this.preExecutionHook(walletOwner, ops[i]);
    }

    function analyzeOperationRisk(
        Operation calldata op
    )
        external
        view
        returns (
            uint8 riskScore,
            IAssetCompliance.RiskTier tier,
            string memory riskFactors
        )
    {
        if (op.target == address(0))
            return (100, IAssetCompliance.RiskTier.CRITICAL, "Zero target");
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        (
            uint256 ts,
            ,
            ,
            uint8 tt,
            ,
            bool tSan,
            bool tEx,

        ) = s.riskRegistry.getProfile(op.target);
        if (!tEx) return (50, IAssetCompliance.RiskTier.MEDIUM, "Unknown target");
        if (tSan) return (100, IAssetCompliance.RiskTier.CRITICAL, "Sanctioned target");
        return (uint8(ts), IAssetCompliance.RiskTier(tt), "Standard");
    }

    function getWalletPolicy(
        address
    ) external pure returns (WalletPolicy memory) {
        return
            WalletPolicy(
                0,
                0,
                0,
                0,
                false,
                false,
                false,
                new address[](0),
                new address[](0),
                new bytes32[](0)
            );
    }

    function getContractRisk(
        address target
    )
        external
        view
        returns (bool isVerified, uint8 riskScore, string memory contractType)
    {
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        (
            uint256 score,
            ,
            ,
            ,
            ,
            ,
            bool ex,

        ) = s.riskRegistry.getProfile(target);
        if (!ex) return (false, 0, "Unknown");
        return (true, uint8(score), "Contract");
    }
}
