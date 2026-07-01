// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/LibComplianceStorage.sol";
import "../interfaces/IAssetCompliance.sol";
import "../interfaces/IComplianceErrors.sol";

contract ComplianceCoreFacet is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant MAX_HISTORY_SIZE = 10000;

    // ============ Events ============
    event ComplianceCheckPerformed(
        address indexed addr,
        uint256 indexed riskScore,
        bool indexed isCompliant,
        uint256 timestamp,
        uint256 blockNumber,
        bytes32 checkType
    );
    event TransactionBlocked(
        address indexed from,
        address indexed to,
        uint256 indexed amount,
        address token,
        string reason,
        uint256 timestamp,
        uint256 blockNumber
    );
    event TransactionQuarantined(
        address indexed from,
        address indexed to,
        uint256 indexed amount,
        address token,
        bytes32 quarantineId,
        uint256 timestamp,
        uint256 blockNumber
    );

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

    function _blk(
        address f,
        address t,
        uint256 a,
        address tk,
        string memory r
    ) internal returns (IAssetCompliance.Decision, string memory) {
        emit TransactionBlocked(
            f,
            t,
            a,
            tk,
            r,
            block.timestamp,
            block.number
        );
        LibComplianceStorage.diamondStorage().blockedTransactions++;
        return (IAssetCompliance.Decision.BLOCK, r);
    }

    // ============ Core Compliance Checks ============
    function checkAddressCompliance(
        address addr
    )
        public
        whenNotPaused
        returns (bool isCompliant, uint256 riskScore, string memory reason)
    {
        if (addr == address(0)) revert InvalidAddress();
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.riskRegistry) == address(0)) revert RegistryNotSet();

        (bool blocked, uint256 s2, string memory r) = _checkRisk(addr);
        riskScore = s2;
        if (blocked) {
            isCompliant = false;
            reason = r;
        } else {
            isCompliant = true;
            reason = "Low risk";
        }

        s.totalChecks++;
        s.addressCheckCount[addr]++;

        LibComplianceStorage.CheckRecord memory rec = LibComplianceStorage
            .CheckRecord({
                addr: addr,
                riskScore: riskScore,
                isCompliant: isCompliant,
                timestamp: block.timestamp,
                blockNumber: block.number,
                checkType: "address",
                reason: reason
            });
        if (s.checkHistory.length >= MAX_HISTORY_SIZE) {
            s.checkHistory[(s.totalChecks - 1) % MAX_HISTORY_SIZE] = rec;
        } else {
            s.checkHistory.push(rec);
        }

        emit ComplianceCheckPerformed(
            addr,
            riskScore,
            isCompliant,
            block.timestamp,
            block.number,
            "address"
        );
    }

    function checkTransfer(
        address from,
        address to,
        uint256 amount,
        address token
    ) public whenNotPaused returns (IAssetCompliance.Decision decision, string memory reason) {
        if (
            msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)
        ) revert UnauthorizedCaller(msg.sender);
        return
            checkTransferWithDeadline(
                from,
                to,
                amount,
                token,
                block.timestamp + 1 hours
            );
    }

    function checkTransferWithDeadline(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    )
        public
        whenNotPaused
        nonReentrant
        returns (IAssetCompliance.Decision decision, string memory reason)
    {
        if (
            msg.sender != from && !hasRole(OPERATOR_ROLE, msg.sender)
        ) revert UnauthorizedCaller(msg.sender);
        if (deadline < block.timestamp)
            revert DeadlineExpired(deadline, block.timestamp);
        if (from == address(0) || to == address(0)) revert InvalidAddress();
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        if (address(s.policyEngine) == address(0)) revert PolicyNotSet();

        (bool blkFrom, , string memory rFrom) = _checkRisk(from);
        if (blkFrom) return _blk(from, to, amount, token, rFrom);

        (bool blkTo, , string memory rTo) = _checkRisk(to);
        if (blkTo) return _blk(from, to, amount, token, rTo);

        IAssetCompliance.IssuerPolicy memory policy = s.issuerPolicies[token];

        for (uint256 i = 0; i < policy.blockedTokens.length; i++) {
            if (policy.blockedTokens[i] == to)
                return _blk(from, to, amount, token, "Dest blocked");
        }

        if (policy.maxTxAmount > 0 && amount > policy.maxTxAmount)
            return _blk(from, to, amount, token, "Max tx");

        if (policy.dailyLimit > 0) {
            uint256 dayKey = block.timestamp / 1 days;
            if (s.dailySpent[from][dayKey] + amount > policy.dailyLimit)
                return _blk(from, to, amount, token, "Daily limit exceeded");
        }

        if (
            policy.cooldownPeriod > 0 &&
            s.lastTransferTime[from] != 0 &&
            block.timestamp - s.lastTransferTime[from] <
            policy.cooldownPeriod
        ) {
            bytes32 qId = keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.number,
                    s.quarantineNonce++,
                    from,
                    to,
                    amount,
                    token,
                    msg.sender
                )
            );
            s.quarantinedTxs[qId] = LibComplianceStorage.QuarantineRecord({
                from: from,
                to: to,
                amount: amount,
                token: token,
                timestamp: block.timestamp,
                released: false,
                operator: msg.sender,
                reason: "Cooldown"
            });
            s.quarantineList.push(qId);
            s.quarantinedTransactions++;
            s.lastTransferTime[from] = block.timestamp;
            emit TransactionQuarantined(
                from,
                to,
                amount,
                token,
                qId,
                block.timestamp,
                block.number
            );
            return (IAssetCompliance.Decision.HOLD, "Cooldown");
        }

        if (policy.dailyLimit > 0) {
            s.dailySpent[from][block.timestamp / 1 days] += amount;
        }
        s.lastTransferTime[from] = block.timestamp;

        return (IAssetCompliance.Decision.ALLOW, "Transfer allowed");
    }

    function quarantineTransaction(
        address from,
        address to,
        uint256 amount,
        address token,
        string memory reason
    )
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
        nonReentrant
        returns (bytes32 quarantineId)
    {
        LibComplianceStorage.AppStorage storage s = LibComplianceStorage
            .diamondStorage();
        quarantineId = keccak256(
            abi.encodePacked(
                block.timestamp,
                block.number,
                s.quarantineNonce++,
                from,
                to,
                amount,
                token,
                msg.sender
            )
        );
        s.quarantinedTxs[quarantineId] = LibComplianceStorage
            .QuarantineRecord({
                from: from,
                to: to,
                amount: amount,
                token: token,
                timestamp: block.timestamp,
                released: false,
                operator: msg.sender,
                reason: reason
            });
        s.quarantineList.push(quarantineId);
        s.quarantinedTransactions++;
        emit TransactionQuarantined(
            from,
            to,
            amount,
            token,
            quarantineId,
            block.timestamp,
            block.number
        );
    }

    function batchCheckAddressCompliance(
        address[] calldata addrs
    )
        external
        whenNotPaused
        returns (bool[] memory results, uint256[] memory scores)
    {
        if (addrs.length > 100)
            revert BatchSizeExceeded(addrs.length, 100);
        results = new bool[](addrs.length);
        scores = new uint256[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            (bool c, uint256 s2, ) = checkAddressCompliance(addrs[i]);
            results[i] = c;
            scores[i] = s2;
        }
    }

    // ============ IComplianceEngine Interface ============
    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 deadline
    ) external whenNotPaused returns (bool isCompliant, uint8[] memory actionTypes) {
        (IAssetCompliance.Decision d, ) = checkTransferWithDeadline(
            from,
            to,
            amount,
            token,
            deadline
        );
        isCompliant = d != IAssetCompliance.Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(d);
    }

    function checkTransactionCompliance(
        address from,
        address to,
        uint256 amount,
        address token
    ) external whenNotPaused returns (bool isCompliant, uint8[] memory actionTypes) {
        (IAssetCompliance.Decision d, ) = checkTransfer(from, to, amount, token);
        isCompliant = d != IAssetCompliance.Decision.BLOCK;
        actionTypes = new uint8[](1);
        actionTypes[0] = uint8(d);
    }
}
