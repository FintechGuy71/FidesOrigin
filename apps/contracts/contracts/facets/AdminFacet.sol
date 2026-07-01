// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibComplianceStorage.sol";
import "../libraries/LibDiamond.sol";
import "../interfaces/IAssetCompliance.sol";
import "../interfaces/IComplianceErrors.sol";

contract AdminFacet is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    string public constant VERSION = "1.2.1";
    uint256 public constant MAX_HISTORY_SIZE = 10000;

    // ============ Events ============
    event RiskRegistrySet(address indexed registry);
    event PolicyEngineSet(address indexed engine);
    event RulePaused(bytes32 indexed ruleId);
    event RuleUnpaused(bytes32 indexed ruleId);
    event QuarantineReleased(
        bytes32 indexed quarantineId,
        address indexed operator,
        uint256 timestamp
    );
    event IssuerPolicySet(
        address indexed token,
        uint256 maxTxAmount,
        uint256 dailyLimit,
        uint256 cooldownPeriod,
        address indexed admin
    );
    event RoleGrantedDetailed(
        bytes32 indexed role,
        address indexed account,
        address indexed sender,
        uint256 timestamp,
        string reason
    );
    event RoleRevokedDetailed(
        bytes32 indexed role,
        address indexed account,
        address indexed sender,
        uint256 timestamp,
        string reason
    );
    event ZeroAddressRejected(string functionName, uint256 timestamp);
    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);
    event UpgradeProposed(
        bytes32 indexed proposalId,
        address indexed newImplementation,
        uint256 executeAfter
    );
    event UpgradeExecuted(
        bytes32 indexed proposalId,
        address indexed newImplementation
    );
    event UpgradeTimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // ============ Initializer ============
    function initialize(
        address _riskRegistry,
        address _policyEngine,
        address _admin
    ) external {
        LibDiamond.enforceIsContractOwner();
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        require(
            address(s.riskRegistry) == address(0),
            "Already initialized"
        );
        if (_riskRegistry == address(0) || _policyEngine == address(0))
            revert InvalidAddress();
        if (_riskRegistry.code.length == 0 || _policyEngine.code.length == 0)
            revert NotAContract();

        s.riskRegistry = RiskRegistry(_riskRegistry);
        s.policyEngine = PolicyEngine(_policyEngine);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);

        s.upgradeTimelockDelay = 2 days;
    }

    // ============ Setters ============
    function setRiskRegistry(address _r)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
    {
        if (_r == address(0)) revert InvalidAddress();
        if (_r.code.length == 0) revert NotAContract();
        LibComplianceStorage.diamondStorage().riskRegistry = RiskRegistry(_r);
        emit RiskRegistrySet(_r);
    }

    function setPolicyEngine(address _e)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
    {
        if (_e == address(0)) revert InvalidAddress();
        if (_e.code.length == 0) revert NotAContract();
        LibComplianceStorage.diamondStorage().policyEngine = PolicyEngine(_e);
        emit PolicyEngineSet(_e);
    }

    function setIssuerPolicy(
        address token,
        IAssetCompliance.IssuerPolicy calldata policy
    ) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (token == address(0)) revert InvalidAddress();
        if (policy.blockedTokens.length > 50)
            revert BatchSizeExceeded(policy.blockedTokens.length, 50);
        if (policy.maxTxAmount > policy.dailyLimit && policy.dailyLimit > 0)
            revert MaxTxExceedsDaily();
        if (policy.cooldownPeriod > 30 days) revert CooldownTooLong();
        LibComplianceStorage.diamondStorage().issuerPolicies[token] = policy;
        emit IssuerPolicySet(
            token,
            policy.maxTxAmount,
            policy.dailyLimit,
            policy.cooldownPeriod,
            msg.sender
        );
    }

    function pauseRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        LibComplianceStorage.diamondStorage().pausedRules[ruleId] = true;
        emit RulePaused(ruleId);
    }

    function unpauseRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        LibComplianceStorage.diamondStorage().pausedRules[ruleId] = false;
        emit RuleUnpaused(ruleId);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender, block.timestamp);
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    // ============ Upgrade Timelock ============
    function proposeUpgrade(address newImpl)
        external
        onlyRole(ADMIN_ROLE)
        returns (bytes32 proposalId)
    {
        if (newImpl == address(0)) revert InvalidAddress();
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        proposalId = keccak256(
            abi.encode(newImpl, block.chainid, block.timestamp)
        );
        s.upgradeProposals[proposalId] =
            block.timestamp +
            s.upgradeTimelockDelay;
        s.implementationToProposal[newImpl] = proposalId;
        emit UpgradeProposed(
            proposalId,
            newImpl,
            s.upgradeProposals[proposalId]
        );
    }

    function setUpgradeTimelockDelay(uint256 delay)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (delay < 1 hours || delay > 30 days) revert InvalidDelay();
        uint256 old = LibComplianceStorage
            .diamondStorage()
            .upgradeTimelockDelay;
        LibComplianceStorage.diamondStorage().upgradeTimelockDelay = delay;
        emit UpgradeTimelockDelayUpdated(old, delay);
    }

    // ============ Role Management ============
    function grantRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
        emit RoleGrantedDetailed(
            role,
            account,
            msg.sender,
            block.timestamp,
            reason
        );
    }

    function revokeRoleWithReason(
        bytes32 role,
        address account,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
        emit RoleRevokedDetailed(
            role,
            account,
            msg.sender,
            block.timestamp,
            reason
        );
    }

    // ============ Quarantine Management ============
    function releaseQuarantine(bytes32 quarantineId)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        LibComplianceStorage.QuarantineRecord
            storage r = LibComplianceStorage.diamondStorage().quarantinedTxs[
                quarantineId
            ];
        if (r.released) revert AlreadyReleased();
        if (r.from == address(0)) revert QuarantineNotFound();
        r.released = true;
        emit QuarantineReleased(quarantineId, msg.sender, block.timestamp);
    }

    // ============ Public Getters (matching original state variables) ============
    function riskRegistry() external view returns (RiskRegistry) {
        return LibComplianceStorage.diamondStorage().riskRegistry;
    }

    function policyEngine() external view returns (PolicyEngine) {
        return LibComplianceStorage.diamondStorage().policyEngine;
    }

    function totalChecks() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().totalChecks;
    }

    function blockedTransactions() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().blockedTransactions;
    }

    function quarantinedTransactions() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().quarantinedTransactions;
    }

    function quarantineNonce() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().quarantineNonce;
    }

    function upgradeTimelockDelay() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().upgradeTimelockDelay;
    }

    function addressCheckCount(address addr) external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().addressCheckCount[addr];
    }

    function pausedRules(bytes32 ruleId) external view returns (bool) {
        return LibComplianceStorage.diamondStorage().pausedRules[ruleId];
    }

    function dailySpent(address account, uint256 dayKey)
        external
        view
        returns (uint256)
    {
        return LibComplianceStorage.diamondStorage().dailySpent[account][
            dayKey
        ];
    }

    function lastTransferTime(address account) external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().lastTransferTime[account];
    }

    function implementationToProposal(address impl)
        external
        view
        returns (bytes32)
    {
        return LibComplianceStorage
            .diamondStorage()
            .implementationToProposal[impl];
    }

    function upgradeProposals(bytes32 proposalId)
        external
        view
        returns (uint256)
    {
        return LibComplianceStorage
            .diamondStorage()
            .upgradeProposals[proposalId];
    }

    // ============ Complex Getters ============
    function getQuarantineRecord(bytes32 id)
        external
        view
        returns (LibComplianceStorage.QuarantineRecord memory)
    {
        return LibComplianceStorage.diamondStorage().quarantinedTxs[id];
    }

    function getQuarantineListLength() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().quarantineList.length;
    }

    function getQuarantineListPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory page)
    {
        uint256 total = LibComplianceStorage
            .diamondStorage()
            .quarantineList
            .length;
        if (offset >= total) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new bytes32[](end - offset);
        for (uint256 i = 0; i < page.length; i++)
            page[i] = LibComplianceStorage.diamondStorage().quarantineList[
                offset + i
            ];
    }

    function getCheckHistoryLength() external view returns (uint256) {
        return LibComplianceStorage.diamondStorage().checkHistory.length;
    }

    function getCheckHistoryPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (LibComplianceStorage.CheckRecord[] memory page)
    {
        uint256 total = LibComplianceStorage
            .diamondStorage()
            .checkHistory
            .length;
        if (offset >= total)
            return new LibComplianceStorage.CheckRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new LibComplianceStorage.CheckRecord[](end - offset);
        for (uint256 i = 0; i < page.length; i++)
            page[i] = LibComplianceStorage.diamondStorage().checkHistory[
                offset + i
            ];
    }

    function getCheckRecord(uint256 index)
        external
        view
        returns (LibComplianceStorage.CheckRecord memory)
    {
        if (index >= LibComplianceStorage.diamondStorage().checkHistory.length)
            revert IndexOutOfBounds();
        return LibComplianceStorage.diamondStorage().checkHistory[index];
    }

    // ============ Mapping Getters (for public state variable compatibility) ============
    function checkHistory(uint256 index)
        external
        view
        returns (LibComplianceStorage.CheckRecord memory)
    {
        return LibComplianceStorage.diamondStorage().checkHistory[index];
    }

    function quarantinedTxs(bytes32 id)
        external
        view
        returns (LibComplianceStorage.QuarantineRecord memory)
    {
        return LibComplianceStorage.diamondStorage().quarantinedTxs[id];
    }

    function issuerPolicies(address issuer)
        external
        view
        returns (IAssetCompliance.IssuerPolicy memory)
    {
        return LibComplianceStorage.diamondStorage().issuerPolicies[issuer];
    }
}
