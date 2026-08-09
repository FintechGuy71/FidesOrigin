// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./RiskRegistry.sol";

/**
 * @title RiskOracleLite
 * @notice 精简版 RiskOracle — 核心功能保留，移除冗余模块
 * @dev 26386 bytes → 目标 < 24576 bytes
 * @dev 移除：多预言机共识、DataSource管理、fulfillmentHistory、复杂assembly解码
 * @dev 保留：Chainlink Functions、队列管理、暂停、deferredCount
 * @dev 预留：未来可通过 Diamond 模式扩展为多预言机
 * @dev VERSION: 2.1.0-lite
 */
contract RiskOracleLite is FunctionsClient, Ownable, Pausable {
    using FunctionsRequest for FunctionsRequest.Request;

    string public constant VERSION = "2.1.0-lite";

    // ============ Chainlink Config ============
    bytes32 public donId;
    uint32 public gasLimit = 300000;
    uint64 public subscriptionId;

    // ============ RiskRegistry ============
    RiskRegistry public riskRegistry;

    // ============ Request Tracking ============
    enum RequestType { UNKNOWN, SANCTIONS_SYNC, RISK_SCORING, TRANSACTION_CHECK, CUSTOM_QUERY }

    struct RequestInfo {
        bytes32 requestId;
        RequestType requestType;
        address requester;
        uint256 timestamp;
        bool fulfilled;
        bool success;
        bool deferred;
    }

    mapping(bytes32 => RequestInfo) public requestInfo;
    bytes32 public lastRequestId;
    uint256 public requestCount;
    uint256 public deferredCount;

    uint256 public constant MAX_ALL_REQUEST_IDS = 10_000;
    bytes32[] public allRequestIds;
    uint256 internal allRequestIdsHead;

    // ============ Queue ============
    struct PendingRiskUpdate {
        address account;
        uint256 score;
        uint8 tier;
        bool isSanctioned;
        uint256 queuedAt;
    }

    PendingRiskUpdate[] public pendingRiskQueue;
    uint256 public queueHead;
    uint256 public queueCount;
    uint256 public maxQueueSize = 100;
    uint256 public batchSize = 10;

    // ============ Access Control ============
    mapping(address => bool) public operators;
    address[] public operatorList;

    // ============ Rate Limiting ============
    uint256 public callerCooldown = 5 minutes;
    uint256 public maxDailyRequestsPerCaller = 100;
    mapping(address => uint256) public lastCallerTime;
    mapping(address => uint256) public dailyRequestCount;
    mapping(address => uint256) public dailyRequestReset;

    // ============ Functions Source ============
    mapping(RequestType => string) public functionsSources;

    // ============ Events ============
    event RiskUpdateRequested(bytes32 indexed requestId, RequestType requestType, address indexed requester);
    event RiskUpdateFulfilled(bytes32 indexed requestId, bool success, uint256 processedAt);
    event RiskProfileUpdated(bytes32 indexed requestId, address indexed account, uint256 score, uint8 tier, bool isSanctioned);
    event FulfillmentDeferred(bytes32 indexed requestId);
    event DeferredRequestProcessed(bytes32 indexed requestId);
    event QueuedRiskUpdate(address indexed account, uint256 score);
    event BatchUpdateExecuted(uint256 count, uint256 gasUsed);
    event FunctionsSourceUpdated(RequestType indexed reqType, string source);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event QueueDropped(address indexed account, uint256 timestamp);
    event BatchQueueItemSkipped(uint256 indexed index, address account, string reason);

    // ============ Errors ============
    error InvalidAddress();
    error InvalidRouter();
    error RequestNotFound();
    error AlreadyFulfilled();
    error CallerCooldownActive(address caller);
    error DailyRequestLimitExceeded(address caller, uint256 count, uint256 limit);
    error InvalidRequestType();
    error QueueFull();
    error UnauthorizedOperator(address caller);

    // ============ Modifiers ============
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedOperator(msg.sender);
        }
        _;
    }

    modifier checkCallerRateLimit() {
        if (lastCallerTime[msg.sender] != 0 && block.timestamp - lastCallerTime[msg.sender] < callerCooldown) {
            revert CallerCooldownActive(msg.sender);
        }
        if (dailyRequestReset[msg.sender] == 0 || block.timestamp >= dailyRequestReset[msg.sender] + 1 days) {
            dailyRequestCount[msg.sender] = 0;
            dailyRequestReset[msg.sender] = block.timestamp;
        }
        if (dailyRequestCount[msg.sender] >= maxDailyRequestsPerCaller) {
            revert DailyRequestLimitExceeded(msg.sender, dailyRequestCount[msg.sender], maxDailyRequestsPerCaller);
        }
        dailyRequestCount[msg.sender]++;
        lastCallerTime[msg.sender] = block.timestamp;
        _;
    }

    // ============ Constructor ============
    constructor(
        address router,
        bytes32 _donId,
        uint64 _subscriptionId,
        address _riskRegistry
    ) FunctionsClient(router) Ownable(msg.sender) {
        if (router == address(0)) revert InvalidRouter();
        if (_riskRegistry == address(0)) revert InvalidAddress();

        donId = _donId;
        subscriptionId = _subscriptionId;
        riskRegistry = RiskRegistry(_riskRegistry);

        operators[msg.sender] = true;
        operatorList.push(msg.sender);
    }

    // ============ Operator Management ============
    function addOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert InvalidAddress();
        if (!operators[operator]) {
            operators[operator] = true;
            operatorList.push(operator);
            emit OperatorAdded(operator);
        }
    }

    function removeOperator(address operator) external onlyOwner {
        if (operators[operator]) {
            operators[operator] = false;
            for (uint256 i = 0; i < operatorList.length; i++) {
                if (operatorList[i] == operator) {
                    operatorList[i] = operatorList[operatorList.length - 1];
                    operatorList.pop();
                    break;
                }
            }
            emit OperatorRemoved(operator);
        }
    }

    // ============ Config Setters ============
    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function setMaxQueueSize(uint256 _size) external onlyOwner {
        maxQueueSize = _size;
    }

    function setBatchSize(uint256 _size) external onlyOwner {
        batchSize = _size;
    }

    function setFunctionsSource(RequestType reqType, string calldata source) external onlyOwner {
        functionsSources[reqType] = source;
        emit FunctionsSourceUpdated(reqType, source);
    }

    // ============ Pause ============
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Chainlink Functions ============
    function requestRiskUpdate(
        RequestType reqType,
        string calldata source,
        uint64 subscription,
        uint32 gasLimitForRequest
    ) external onlyOperator checkCallerRateLimit returns (bytes32 requestId) {
        string memory jsSource;
        if (bytes(source).length > 0) {
            jsSource = source;
        } else {
            jsSource = functionsSources[reqType];
        }
        if (bytes(jsSource).length == 0) revert InvalidRequestType();

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(jsSource);

        bytes32 assignedReqId = _sendRequest(req.encodeCBOR(), subscription, gasLimitForRequest, donId);

        if (allRequestIds.length < MAX_ALL_REQUEST_IDS) {
            allRequestIds.push(assignedReqId);
        } else {
            allRequestIds[allRequestIdsHead % MAX_ALL_REQUEST_IDS] = assignedReqId;
            allRequestIdsHead++;
        }

        requestInfo[assignedReqId] = RequestInfo({
            requestId: assignedReqId,
            requestType: reqType,
            requester: msg.sender,
            timestamp: block.timestamp,
            fulfilled: false,
            success: false,
            deferred: false
        });
        lastRequestId = assignedReqId;
        requestCount++;
        requestId = assignedReqId;

        emit RiskUpdateRequested(assignedReqId, reqType, msg.sender);
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        RequestInfo storage info = requestInfo[requestId];
        if (info.requester == address(0)) revert RequestNotFound();
        if (info.fulfilled) revert AlreadyFulfilled();

        if (!paused() && err.length == 0 && response.length > 0) {
            info.fulfilled = true;
            info.success = true;
            _processRiskResponse(info.requestType, response);
            emit RiskUpdateFulfilled(requestId, true, block.timestamp);
        } else if (paused()) {
            info.fulfilled = true;
            info.deferred = true;
            deferredCount++;
            emit FulfillmentDeferred(requestId);
        } else {
            info.fulfilled = true;
            info.success = err.length == 0;
            emit RiskUpdateFulfilled(requestId, false, block.timestamp);
        }
    }

    // ============ Response Processing ============
    function _processRiskResponse(RequestType reqType, bytes memory response) internal {
        if (reqType == RequestType.RISK_SCORING && response.length >= 32) {
            uint256 score = abi.decode(response, (uint256));
            if (score > type(uint8).max) score = type(uint8).max;
            // 记录但不存储历史
        } else if (reqType == RequestType.SANCTIONS_SYNC) {
            (bool ok, address[] memory addrs) = _tryDecodeAddresses(response);
            if (ok) {
                for (uint256 i = 0; i < addrs.length; i++) {
                    if (queueCount < maxQueueSize) {
                        _enqueueRiskUpdate(PendingRiskUpdate({
                            account: addrs[i],
                            score: 100,
                            tier: uint8(RiskRegistry.RiskTier.CRITICAL),
                            isSanctioned: true,
                            queuedAt: block.timestamp
                        }));
                    } else {
                        emit QueueDropped(addrs[i], block.timestamp);
                    }
                }
            }
        } else if (reqType == RequestType.TRANSACTION_CHECK && response.length >= 64) {
            (uint256 score, bool sanctioned) = abi.decode(response, (uint256, bool));
            if (score > type(uint8).max) score = type(uint8).max;
            // 记录但不存储历史
        }
    }

    function _tryDecodeAddresses(bytes memory data) internal pure returns (bool, address[] memory) {
        if (data.length < 64) return (false, new address[](0));
        // Check basic ABI layout: offset (0x20) + length
        uint256 offset;
        uint256 length;
        assembly {
            offset := mload(add(data, 0x20))
            length := mload(add(data, 0x40))
        }
        if (offset != 0x20) return (false, new address[](0));
        if (length > 10000) return (false, new address[](0));
        if (data.length < 64 + length * 32) return (false, new address[](0));
        
        // Safe to decode
        address[] memory addrs = abi.decode(data, (address[]));
        return (true, addrs);
    }

    // ============ Queue Management ============
    function _enqueueRiskUpdate(PendingRiskUpdate memory upd) internal {
        if (queueCount >= maxQueueSize) revert QueueFull();
        uint256 idx = (queueHead + queueCount) % maxQueueSize;
        if (idx >= pendingRiskQueue.length) {
            pendingRiskQueue.push(upd);
        } else {
            pendingRiskQueue[idx] = upd;
        }
        queueCount++;
        emit QueuedRiskUpdate(upd.account, upd.score);
    }

    function processPendingQueue() external onlyOperator returns (uint256 count, uint256 gasUsed) {
        count = queueCount < batchSize ? queueCount : batchSize;
        if (count == 0) return (0, 0);

        uint256 gasStart = gasleft();
        uint256 successCount = 0;

        for (uint256 i = 0; i < count; i++) {
            uint256 idx = queueHead % maxQueueSize;
            PendingRiskUpdate storage upd = pendingRiskQueue[idx];

            try riskRegistry.updateRiskProfile(
                upd.account,
                uint8(upd.score),
                RiskRegistry.RiskTier(upd.tier),
                new bytes32[](0),
                upd.isSanctioned
            ) {
                emit RiskProfileUpdated(bytes32(0), upd.account, uint8(upd.score), upd.tier, upd.isSanctioned);
                successCount++;
            } catch Error(string memory reason) {
                emit BatchQueueItemSkipped(i, upd.account, reason);
            } catch {
                emit BatchQueueItemSkipped(i, upd.account, "unknown revert");
            }

            queueHead++;
            queueCount--;
        }

        gasUsed = gasStart - gasleft();
        emit BatchUpdateExecuted(successCount, gasUsed);
        count = successCount;
    }

    // ============ Deferred Processing ============
    function processDeferredRequests(bytes32[] calldata requestIds) external onlyOperator {
        for (uint256 i = 0; i < requestIds.length; i++) {
            bytes32 reqId = requestIds[i];
            RequestInfo storage info = requestInfo[reqId];
            if (!info.fulfilled || !info.deferred) continue;

            info.deferred = false;
            if (deferredCount > 0) deferredCount--;
            emit DeferredRequestProcessed(reqId);
        }
    }

    // ============ View Functions ============
    function getPendingQueueLength() external view returns (uint256) {
        return queueCount;
    }

    function getAllRequestIdsLength() external view returns (uint256) {
        return allRequestIds.length;
    }

    function getOperatorList() external view returns (address[] memory) {
        return operatorList;
    }
}
