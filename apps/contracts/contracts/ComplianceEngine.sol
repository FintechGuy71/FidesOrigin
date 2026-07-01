// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "./interfaces/IComplianceEngine.sol";
import "./interfaces/IAssetCompliance.sol";
import "./interfaces/IWalletCompliance.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "./RiskRegistry.sol";
import "./PolicyEngine.sol";

contract ComplianceEngine is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable, IComplianceEngine, IWalletCompliance {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    string public constant VERSION = "1.2.1";

    RiskRegistry public riskRegistry;
    PolicyEngine public policyEngine;

    uint256 public totalChecks;
    uint256 public blockedTransactions;
    uint256 public quarantinedTransactions;

    uint256 public constant MAX_HISTORY_SIZE = 10000;

    uint256 public quarantineNonce;

    struct CheckRecord {
        address addr;
        uint256 riskScore;
        bool isCompliant;
        uint256 timestamp;
        uint256 blockNumber;
        bytes32 checkType;
        string reason;
    }

    CheckRecord[] public checkHistory;
    mapping(address => uint256) public addressCheckCount;
    mapping(bytes32 => bool) public pausedRules;
    mapping(address => IssuerPolicy) public issuerPolicies;
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    mapping(address => uint256) public lastTransferTime;

    mapping(bytes32 => QuarantineRecord) public quarantinedTxs;
    bytes32[] public quarantineList;

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

    uint256 public upgradeTimelockDelay;
    mapping(bytes32 => uint256) public upgradeProposals;
    mapping(address => bytes32) public implementationToProposal;

    // ============ Events ============

    event ComplianceCheckPerformed(address indexed addr, uint256 indexed riskScore, bool indexed isCompliant, uint256 timestamp, uint256 blockNumber, bytes32 checkType);
    event TransactionBlocked(address indexed from, address indexed to, uint256 indexed amount, address token, string reason, uint256 timestamp, uint256 blockNumber);
    event TransactionQuarantined(address indexed from, address indexed to, uint256 indexed amount, address token, bytes32 quarantineId, uint256 timestamp, uint256 blockNumber);
    event RiskRegistrySet(address indexed registry);
    event PolicyEngineSet(address indexed engine);
    event RulePaused(bytes32 indexed ruleId);
    event RuleUnpaused(bytes32 indexed ruleId);
    event QuarantineReleased(bytes32 indexed quarantineId, address indexed operator, uint256 timestamp);
    event IssuerPolicySet(address indexed token, uint256 maxTxAmount, uint256 dailyLimit, uint256 cooldownPeriod, address indexed admin);
    event RoleGrantedDetailed(bytes32 indexed role, address indexed account, address indexed sender, uint256 timestamp, string reason);
    event RoleRevokedDetailed(bytes32 indexed role, address indexed account, address indexed sender, uint256 timestamp, string reason);
    event ZeroAddressRejected(string functionName, uint256 timestamp);
    event ContractPaused(address indexed account, uint256 timestamp);
    event ContractUnpaused(address indexed account, uint256 timestamp);
    event UpgradeProposed(bytes32 indexed proposalId, address indexed newImplementation, uint256 executeAfter);
    event UpgradeExecuted(bytes32 indexed proposalId, address indexed newImplementation);
    event UpgradeTimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // ============ Errors ============

    error InvalidAddress();
    error RegistryNotSet();
    error PolicyNotSet();
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error UnauthorizedCaller(address caller);
    error BatchSizeExceeded(uint256 size, uint256 maxSize);
    error UpgradeTimelockActive(bytes32 proposalId, uint256 executeAfter);
    error UpgradeNotProposed(bytes32 proposalId);
    error AlreadyReleased();
    error QuarantineNotFound();
    error IndexOutOfBounds();
    error NotAContract();
    error MaxTxExceedsDaily();
    error CooldownTooLong();
    error InvalidDelay();
    error RiskBlocked();

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _riskRegistry, address _policyEngine) external initializer {
        __Context_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        if (_riskRegistry == address(0) || _policyEngine == address(0)) revert InvalidAddress();
        if (_riskRegistry.code.length == 0 || _policyEngine.code.length == 0) revert NotAContract();

        riskRegistry = RiskRegistry(_riskRegistry);
        policyEngine = PolicyEngine(_policyEngine);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);

        upgradeTimelockDelay = 2 days;
    }

    // ============ Internal Helpers ============

    /// @dev Returns (blocked, score, reason). reason="" if clean.
    function _checkRisk(address addr) internal view returns (bool blocked, uint256 score, string memory reason) {
        (uint256 s, , , , , bool sanctioned, bool exists, ) = riskRegistry.getProfile(addr);
        score = s;
        if (!exists) { blocked = true; reason = "No profile - fail closed"; }
        else if (sanctioned) { blocked = true; reason = "Sanctioned"; }
        else if (s >= 95) { blocked = true; reason = "Critical"; }
        else if (s >= 80) { blocked = true; reason = "High risk"; }
    }

    /// @dev Block helper: emit + increment + return
    function _blk(address f, address t, uint256 a, address tk, string memory r)
        internal returns (Decision, string memory)
    {
        emit TransactionBlocked(f, t, a, tk, r, block.timestamp, block.number);
        blockedTransactions++;
        return (Decision.BLOCK, r);
    }

    // ============ M-03: UUPS Upgrade Timelock ============

    function proposeUpgrade(address newImpl) external onlyRole(ADMIN_ROLE) returns (bytes32 proposalId) {
        if (newImpl == address(0)) revert InvalidAddress();
        proposalId = keccak256(abi.encode(newImpl, block.chainid, block.timestamp));
        upgradeProposals[proposalId] = block.timestamp + upgradeTimelockDelay;
        implementationToProposal[newImpl] = proposalId;
        emit UpgradeProposed(proposalId, newImpl, upgradeProposals[proposalId]);
    }

    function setUpgradeTimelockDelay(uint256 delay) external onlyRole(ADMIN_ROLE) {
        if (delay < 1 hours || delay > 30 days) revert InvalidDelay();
        uint256 old = upgradeTimelockDelay;
        upgradeTimelockDelay = delay;
        emit UpgradeTimelockDelayUpdated(old, delay);
    }

    function _authorizeUpgrade(address newImpl) internal override onlyRole(ADMIN_ROLE) {
        bytes32 pid = implementationToProposal[newImpl];
        if (pid == bytes32(0)) revert UpgradeNotProposed(pid);
        uint256 afterTime = upgradeProposals[pid];
        if (block.timestamp < afterTime) revert UpgradeTimelockActive(pid, afterTime);
        delete upgradeProposals[pid];
        delete implementationToProposal[newImpl];
        emit UpgradeExecuted(pid, newImpl);
    }

    // ============ Core Compliance Checks ============

    function checkAddressCompliance(address addr)
        public whenNotPaused
        returns (bool isCompliant, uint256 riskScore, string memory reason)
    {
        if (addr == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert RegistryNotSet();

        (bool blocked, uint256 s, string memory r) = _checkRisk(addr);
        riskScore = s;
        if (blocked) { isCompliant = false; reason = r; }
        else { isCompliant = true; reason = "Low risk"; }

        totalChecks++;
        addressCheckCount[addr]++;

        CheckRecord memory rec = CheckRecord({
            addr: addr, riskScore: riskScore, isCompliant: isCompliant,
            timestamp: block.timestamp, blockNumber: block.number,
            checkType: "address", reason: reason
        });
        if (checkHistory.length >= MAX_HISTORY_SIZE) {
            checkHistory[(totalChecks - 1) % MAX_HISTORY_SIZE] = rec;
        } else {
            checkHistory.push(rec);
        }

    }

    function checkTransfer(address from, address to, uint256 amount, address token)
        public whenNotPaused
        returns (Decision decision, string memory reason)
    {
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender))
            revert UnauthorizedCaller(msg.sender);
        return checkTransferWithDeadline(from, to, amount, token, block.timestamp + 1 hours);
    }

    function checkTransferWithDeadline(
        address from, address to, uint256 amount, address token, uint256 deadline
    ) public whenNotPaused nonReentrant returns (Decision decision, string memory reason) {
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender))
            revert UnauthorizedCaller(msg.sender);
        if (deadline < block.timestamp)
            revert DeadlineExpired(deadline, block.timestamp);
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (address(policyEngine) == address(0)) revert PolicyNotSet();

        (bool blkFrom, , string memory rFrom) = _checkRisk(from);
        if (blkFrom) return _blk(from, to, amount, token, rFrom);

        (bool blkTo, , string memory rTo) = _checkRisk(to);
        if (blkTo) return _blk(from, to, amount, token, rTo);

        IssuerPolicy memory policy = issuerPolicies[token];

        for (uint256 i = 0; i < policy.blockedTokens.length; i++) {
            if (policy.blockedTokens[i] == to)
                return _blk(from, to, amount, token, "Dest blocked");
        }

        if (policy.maxTxAmount > 0 && amount > policy.maxTxAmount)
            return _blk(from, to, amount, token, "Max tx");

        if (policy.dailyLimit > 0) {
            uint256 dayKey = block.timestamp / 1 days;
            if (dailySpent[from][dayKey] + amount > policy.dailyLimit)
                return _blk(from, to, amount, token, "Daily limit exceeded");
        }

        if (policy.cooldownPeriod > 0 && lastTransferTime[from] != 0
            && block.timestamp - lastTransferTime[from] < policy.cooldownPeriod)
        {
            bytes32 qId = keccak256(abi.encodePacked(
                block.timestamp, block.number, quarantineNonce++,
                from, to, amount, token, msg.sender
            ));
            quarantinedTxs[qId] = QuarantineRecord({
                from: from, to: to, amount: amount, token: token,
                timestamp: block.timestamp, released: false, operator: msg.sender,
                reason: "Cooldown"
            });
            quarantineList.push(qId);
            quarantinedTransactions++;
            lastTransferTime[from] = block.timestamp;
            emit TransactionQuarantined(from, to, amount, token, qId, block.timestamp, block.number);
            return (Decision.HOLD, "Cooldown");
        }

        if (policy.dailyLimit > 0) {
            dailySpent[from][block.timestamp / 1 days] += amount;
        }
        lastTransferTime[from] = block.timestamp;

        return (Decision.ALLOW, "Transfer allowed");
    }

    function quarantineTransaction(
        address from, address to, uint256 amount, address token, string memory reason
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant returns (bytes32 quarantineId) {
        quarantineId = keccak256(abi.encodePacked(
            block.timestamp, block.number, quarantineNonce++,
            from, to, amount, token, msg.sender
        ));
        quarantinedTxs[quarantineId] = QuarantineRecord({
            from: from, to: to, amount: amount, token: token,
            timestamp: block.timestamp, released: false, operator: msg.sender, reason: reason
        });
        quarantineList.push(quarantineId);
        quarantinedTransactions++;
        emit TransactionQuarantined(from, to, amount, token, quarantineId, block.timestamp, block.number);
    }

    function releaseQuarantine(bytes32 quarantineId)
        external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant
    {
        QuarantineRecord storage r = quarantinedTxs[quarantineId];
        if (r.released) revert AlreadyReleased();
        if (r.from == address(0)) revert QuarantineNotFound();
        r.released = true;
    }

    function getQuarantineRecord(bytes32 id) external view returns (QuarantineRecord memory) {
        return quarantinedTxs[id];
    }

    function getQuarantineListLength() external view returns (uint256) {
        return quarantineList.length;
    }

    function getCheckHistoryLength() external view returns (uint256) {
        return checkHistory.length;
    }

    function getCheckHistoryPaginated(uint256 offset, uint256 limit)
        external view returns (CheckRecord[] memory page)
    {
        uint256 total = checkHistory.length;
        if (offset >= total) return new CheckRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new CheckRecord[](end - offset);
        for (uint256 i = 0; i < page.length; i++) page[i] = checkHistory[offset + i];
    }

    function getQuarantineListPaginated(uint256 offset, uint256 limit)
        external view returns (bytes32[] memory page)
    {
        uint256 total = quarantineList.length;
        if (offset >= total) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new bytes32[](end - offset);
        for (uint256 i = 0; i < page.length; i++) page[i] = quarantineList[offset + i];
    }

    function getCheckRecord(uint256 index) external view returns (CheckRecord memory) {
        if (index >= checkHistory.length) revert IndexOutOfBounds();
        return checkHistory[index];
    }

    function setRiskRegistry(address _r) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (_r == address(0)) revert InvalidAddress();
        if (_r.code.length == 0) revert NotAContract();
        riskRegistry = RiskRegistry(_r);
    }

    function setPolicyEngine(address _e) external onlyRole(ADMIN_ROLE) whenNotPaused {
        if (_e == address(0)) revert InvalidAddress();
        if (_e.code.length == 0) revert NotAContract();
        policyEngine = PolicyEngine(_e);
    }

    function setIssuerPolicy(address token, IssuerPolicy calldata policy)
        external onlyRole(ADMIN_ROLE) whenNotPaused
    {
        if (token == address(0)) revert InvalidAddress();
        if (policy.blockedTokens.length > 50) revert BatchSizeExceeded(policy.blockedTokens.length, 50);
        if (policy.maxTxAmount > policy.dailyLimit && policy.dailyLimit > 0) revert MaxTxExceedsDaily();
        if (policy.cooldownPeriod > 30 days) revert CooldownTooLong();
        issuerPolicies[token] = policy;
    }

    function pauseRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        pausedRules[ruleId] = true;
    }

    function unpauseRule(bytes32 ruleId) external onlyRole(ADMIN_ROLE) {
        pausedRules[ruleId] = false;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function batchCheckAddressCompliance(address[] calldata addrs)
        external whenNotPaused returns (bool[] memory results, uint256[] memory scores)
    {
        if (addrs.length > 100) revert BatchSizeExceeded(addrs.length, 100);
        results = new bool[](addrs.length);
        scores = new uint256[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            (bool c, uint256 s, ) = checkAddressCompliance(addrs[i]);
            results[i] = c;
            scores[i] = s;
        }
    }

    // ============ IAssetCompliance Interface ============

    function validateTransfer(
        address from, address to, uint256 amount, address assetContract
    ) external view returns (Decision decision, string memory reason) {
        if (msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender))
            revert UnauthorizedCaller(msg.sender);
        if (from == address(0) || to == address(0)) return (Decision.BLOCK, "Invalid address");
        if (address(riskRegistry) == address(0)) return (Decision.BLOCK, "Registry not set");

        (bool b1, , string memory r1) = _checkRisk(from);
        if (b1) return (Decision.BLOCK, r1);
        (bool b2, , string memory r2) = _checkRisk(to);
        if (b2) return (Decision.BLOCK, r2);

        IssuerPolicy memory p = issuerPolicies[assetContract];
        if (p.maxTxAmount > 0 && amount > p.maxTxAmount) return (Decision.BLOCK, "Max tx");
        if (p.dailyLimit > 0) {
            if (dailySpent[from][block.timestamp / 1 days] + amount > p.dailyLimit)
                return (Decision.BLOCK, "Daily limit exceeded");
        }
        return (Decision.ALLOW, "Transfer allowed");
    }

    function preTransferHook(address from, address to, uint256) external view {
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert RegistryNotSet();
        (bool b1, , ) = _checkRisk(from);
        if (b1) revert RiskBlocked();
        (bool b2, , ) = _checkRisk(to);
        if (b2) revert RiskBlocked();
    }

    function postTransferHook(address from, address to, uint256 amount, bool success)
        external onlyRole(OPERATOR_ROLE)
    {
        emit TransferRecorded(msg.sender, from, to, amount, success);
    }

    function getAddressRisk(address account) external view returns (RiskProfile memory) {
        if (address(riskRegistry) == address(0))
            return RiskProfile(0, RiskTier.UNKNOWN, new bytes32[](0), 0, false);
        (uint256 score, , uint32 lu, uint8 rt, , bool san, bool ex, bytes32[] memory tags) = riskRegistry.getProfile(account);
        if (!ex) return RiskProfile(0, RiskTier.UNKNOWN, new bytes32[](0), 0, false);
        return RiskProfile(uint8(score), RiskTier(rt), tags, lu, san);
    }

    function getRiskTier(address account) external view returns (RiskTier) {
        if (address(riskRegistry) == address(0)) return RiskTier.UNKNOWN;
        (, , , uint8 tier, , , bool ex, ) = riskRegistry.getProfile(account);
        if (!ex) return RiskTier.UNKNOWN;
        return RiskTier(tier);
    }

    function isSanctioned(address account) external view returns (bool) {
        if (address(riskRegistry) == address(0)) return false;
        (, , , , , bool san, bool ex, ) = riskRegistry.getProfile(account);
        return ex && san;
    }

    function getIssuerPolicy(address issuer) external view returns (IssuerPolicy memory) {
        return issuerPolicies[issuer];
    }

    function getDailySpent(address account, address) external view returns (uint256) {
        return dailySpent[account][block.timestamp / 1 days];
    }

    function checkTransactionCompliance(
        address from, address to, uint256 amount, address token, uint256 deadline
    ) external returns (bool isCompliant, uint8[] memory actionTypes) {
        (Decision d, ) = checkTransferWithDeadline(from, to, amount, token, deadline);
        isCompliant = d != Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(d);
    }

    function checkTransactionCompliance(
        address from, address to, uint256 amount, address token
    ) external returns (bool isCompliant, uint8[] memory actionTypes) {
        (Decision d, ) = checkTransfer(from, to, amount, token);
        isCompliant = d != Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(d);
    }

    // ============ IWalletCompliance Interface ============

    function validateOperation(
        address walletOwner, Operation calldata op, address walletContract
    ) external view returns (Decision decision, string memory reason) {
        (bool b, , string memory r) = _checkRisk(walletOwner);
        if (b) return (Decision.BLOCK, r);
        if (op.opType == OperationType.TRANSFER)
            return this.validateTransfer(walletOwner, op.target, op.value, walletContract);
        return (Decision.ALLOW, "Op allowed");
    }

    function preExecutionHook(address walletOwner, Operation calldata op) external view {
        if (op.target == address(0)) revert InvalidAddress();
        if (address(riskRegistry) == address(0)) revert RegistryNotSet();
        (bool b, , ) = _checkRisk(walletOwner);
        if (b) revert RiskBlocked();
        if (op.opType == OperationType.TRANSFER)
            this.preTransferHook(walletOwner, op.target, op.value);
    }

    function postExecutionHook(address walletOwner, Operation calldata op, bool success)
        external onlyRole(OPERATOR_ROLE)
    {
        emit OperationExecuted(msg.sender, walletOwner, op.opType, success);
    }

    function validateBatch(address walletOwner, Operation[] calldata ops)
        external view returns (Decision[] memory decisions)
    {
        decisions = new Decision[](ops.length);
        for (uint256 i = 0; i < ops.length; i++)
            (decisions[i], ) = this.validateOperation(walletOwner, ops[i], address(0));
    }

    function preBatchExecutionHook(address walletOwner, Operation[] calldata ops) external view {
        for (uint256 i = 0; i < ops.length; i++)
            this.preExecutionHook(walletOwner, ops[i]);
    }

    function analyzeOperationRisk(Operation calldata op)
        external view returns (uint8 riskScore, RiskTier tier, string memory riskFactors)
    {
        if (op.target == address(0)) return (100, RiskTier.CRITICAL, "Zero target");
        (uint256 ts, , , uint8 tt, , bool tSan, bool tEx, ) = riskRegistry.getProfile(op.target);
        if (!tEx) return (50, RiskTier.MEDIUM, "Unknown target");
        if (tSan) return (100, RiskTier.CRITICAL, "Sanctioned target");
        return (uint8(ts), RiskTier(tt), "Standard");
    }

    function getWalletPolicy(address) external pure returns (WalletPolicy memory) {
        return WalletPolicy(0, 0, 0, 0, false, false, false, new address[](0), new address[](0), new bytes32[](0));
    }

    function getContractRisk(address target)
        external view returns (bool isVerified, uint8 riskScore, string memory contractType)
    {
        (uint256 score, , , , , , bool ex, ) = riskRegistry.getProfile(target);
        if (!ex) return (false, 0, "Unknown");
        return (true, uint8(score), "Contract");
    }

    function grantRoleWithReason(bytes32 role, address account, string calldata reason)
        external onlyRole(ADMIN_ROLE)
    {
        _grantRole(role, account);
    }

    function revokeRoleWithReason(bytes32 role, address account, string calldata reason)
        external onlyRole(ADMIN_ROLE)
    {
        _revokeRole(role, account);
    }

    /// @dev Storage gap for future upgrade compatibility (H-09)
    uint256[50] private __gap;
}
