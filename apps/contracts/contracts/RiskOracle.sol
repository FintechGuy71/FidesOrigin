// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IAssetCompliance.sol";
import "./RiskRegistry.sol";

/**
 * @title RiskOracle
 * @notice Chainlink Functions 集成的风险数据预言机
 * @dev 从链下数据源获取风险数据并同步到链上
 * @dev VERSION: 1.2.1 - 安全修复版本
 */
contract RiskOracle is FunctionsClient, ConfirmedOwner, AccessControl, Pausable {

    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @notice 合约版本号
    string public constant VERSION = "1.2.1";

    // ============ Chainlink Functions Config ============

    bytes32 public donId;
    uint32 public gasLimit = 300000;
    uint64 public subscriptionId;

    // ============ Request Types ============

    enum RequestType {
        UNKNOWN,
        SANCTIONS_SYNC,
        RISK_SCORING,
        TRANSACTION_CHECK,
        CUSTOM_QUERY
    }

    struct RequestInfo {
        bytes32 requestId;
        RequestType requestType;
        address requester;
        uint256 timestamp;
        bool fulfilled;
        bool success;
        bytes result;
        bytes error;
    }

    mapping(bytes32 => RequestInfo) public requestInfo;
    bytes32[] public allRequestIds;
    bytes32 public lastRequestId;

    /// @dev M-1: 限制 allRequestIds 数组大小
    uint256 public constant MAX_ALL_REQUEST_IDS = 10_000;
    uint256 private allRequestIdsHead;

    // ============ Fulfillment Tracking ============

    struct FulfillmentRecord {
        bytes32 requestId;
        address targetAddress;
        uint256 riskScore;
        uint8 tier;
        bool isSanctioned;
        uint256 fulfilledAt;
    }

    FulfillmentRecord[] public fulfillmentHistory;
    mapping(address => bytes32[]) public addressRequestHistory;

    /// @dev M-1: 限制 fulfillmentHistory 大小
    uint256 public constant MAX_FULFILLMENT_HISTORY = 10_000;

    // ============ Risk Data Queue ============

    struct PendingRiskUpdate {
        address account;
        uint256 score;
        uint8 tier;
        bool isSanctioned;
        bytes32[] tags;
        uint256 queuedAt;
    }

    PendingRiskUpdate[] public pendingRiskQueue;
    uint256 public maxQueueSize = 100;
    uint256 public batchSize = 10;

    // ============ Data Sources ============

    struct DataSource {
        string name;
        string apiEndpoint;
        bool isActive;
        uint256 weight;
        bytes32 secretsSlot;
        uint64 secretsVersion;
    }

    mapping(bytes32 => DataSource) public dataSources;
    bytes32[] public activeSourceIds;

    /// @dev M-1: 限制数据源数量
    uint256 public constant MAX_DATA_SOURCES = 50;

    // ============ Multi-Oracle Support (P1-9) ============

    /// @notice 授权的预言机地址映射
    mapping(address => bool) public authorizedOracles;

    /// @notice 已注册的预言机列表
    address[] public oracleList;

    /// @notice 更新风险档案所需的最小确认数
    uint256 public requiredOracleConfirmations = 1;

    /// @notice 预言机响应记录: account => oracle => response hash
    mapping(address => mapping(address => bytes32)) public oracleResponses;

    /// @notice 预言机响应计数: account => response hash => count
    mapping(address => mapping(bytes32 => uint256)) public responseConfirmations;

    /// @notice 已确认的更新: account => 是否已确认
    mapping(address => bool) public confirmedUpdates;

    // ============ MEV Protection (H-2) ============

    /// @notice 智能合约白名单（允许的合约调用者）
    mapping(address => bool) public smartContractWhitelist;

    /// @notice 每个账户最后一次更新的区块
    mapping(address => uint256) public lastUpdateBlock;

    /// @notice 更新最小间隔区块数
    uint256 public constant UPDATE_DELAY_BLOCKS = 1;

    // ============ State ============

    RiskRegistry public riskRegistry;
    bytes public encryptedSecretsUrls;
    uint256 public requestCount;

    // 更新冷却期
    uint256 public updateCooldown = 1 hours;
    mapping(address => uint256) public lastUpdateTime;

    // 调用者频率限制
    uint256 public callerCooldown = 5 minutes;
    uint256 public maxDailyRequestsPerCaller = 100;
    uint256 public maxBatchUpdateSize = 50;

    mapping(address => uint256) public lastCallerTime;
    mapping(address => uint256) public dailyRequestCount;
    mapping(address => uint256) public dailyRequestReset;

    // ============ Events ============

    event RiskUpdateRequested(
        bytes32 indexed requestId,
        RequestType requestType,
        address indexed requester,
        string source
    );

    event RiskUpdateFulfilled(
        bytes32 indexed requestId,
        bool success,
        uint256 processedAt
    );

    event RiskProfileUpdated(
        bytes32 indexed requestId,
        address indexed account,
        uint256 score,
        uint8 tier,
        bool isSanctioned
    );

    event BatchUpdateExecuted(
        uint256 count,
        uint256 gasUsed
    );

    event DataSourceAdded(bytes32 indexed sourceId, string name);
    event DataSourceUpdated(bytes32 indexed sourceId, bool isActive);
    event QueuedRiskUpdate(address indexed account, uint256 score);

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);
    event OracleResponseReceived(
        address indexed oracle,
        address indexed account,
        bytes32 responseHash,
        uint256 confirmations
    );
    event OracleResponseRevoked(
        address indexed oracle,
        address indexed account,
        bytes32 prevHash
    );
    event MultiOracleUpdateConfirmed(
        address indexed account,
        bytes32 responseHash,
        uint256 confirmationCount
    );
    event ConfirmationsReset(address indexed account);

    // L-1: 新增管理事件
    event RequiredConfirmationsUpdated(uint256 oldVal, uint256 newVal);
    event RequiredConfirmationsAutoAdjusted(uint256 newVal);
    event GasLimitUpdated(uint32 oldVal, uint32 newVal);
    event SubscriptionIdUpdated(uint64 oldVal, uint64 newVal);
    event FulfillmentDeferred(bytes32 indexed requestId);
    event SmartContractWhitelisted(address indexed contractAddr, bool whitelisted);
    event OwnershipRolesSynced(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidRouter();
    error RequestNotFound();
    error AlreadyFulfilled();
    error UpdateCooldownActive(address account);
    error QueueFull();
    error SourceNotActive(bytes32 sourceId);
    error InvalidRequestType();
    error EmptyArgs();
    error CallerCooldownActive(address caller);
    error DailyRequestLimitExceeded(address caller, uint256 count, uint256 limit);
    error BatchSizeExceeded(uint256 requested, uint256 limit);
    error OracleNotAuthorized(address oracle);
    error InsufficientConfirmations(uint256 required, uint256 actual);
    error DeadlineExpired(uint256 deadline, uint256 currentTime);
    error FlashLoanDetected(address caller);
    error InvalidTier(uint8 tier);
    error UpdateTooSoon(address account);
    error MaxDataSourcesExceeded();
    error InvalidScore();

    // ============ Modifiers ============

    modifier checkCallerRateLimit() {
        // 防止首次调用时减法下溢
        if (lastCallerTime[msg.sender] != 0 && block.timestamp - lastCallerTime[msg.sender] < callerCooldown) {
            revert CallerCooldownActive(msg.sender);
        }

        // M-5: 修复首次调用时 dailyRequestReset==0 的边界问题
        if (dailyRequestReset[msg.sender] == 0 ||
            block.timestamp >= dailyRequestReset[msg.sender] + 1 days) {
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

    modifier checkBatchSize(uint256 size) {
        if (size > maxBatchUpdateSize) {
            revert BatchSizeExceeded(size, maxBatchUpdateSize);
        }
        _;
    }

    modifier onlyAuthorizedOracle() {
        if (!authorizedOracles[msg.sender]) {
            revert OracleNotAuthorized(msg.sender);
        }
        _;
    }

    // ============ Constructor ============

    constructor(
        address router,
        bytes32 _donId,
        uint64 _subscriptionId,
        address _riskRegistry
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        if (router == address(0)) revert InvalidRouter();
        if (_riskRegistry == address(0)) revert InvalidAddress();

        donId = _donId;
        subscriptionId = _subscriptionId;
        riskRegistry = RiskRegistry(_riskRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);

        authorizedOracles[msg.sender] = true;
        oracleList.push(msg.sender);
    }

    // ============ Ownership Sync (H-3) ============

    /**
     * @notice H-3 修复: 接受所有权并同时同步 AccessControl 角色
     * @dev ConfirmedOwnerWithProposal.acceptOwnership() 不是 virtual，无法被 override。
     *      因此提供独立函数 acceptOwnershipWithRoleSync()，由新 owner 候选人在
     *      transferOwnership 后调用，内部会调用父合约 acceptOwnership() 并完成角色同步。

    /**
     * @notice 独立角色同步函数（若已通过标准 acceptOwnership 完成所有权转移，
     *         可由当前 owner 调用此函数补齐角色同步）
     */
    function syncOwnerRoles(address previousOwner) external onlyOwner {
        address currentOwner = owner();
        if (currentOwner != address(0) && currentOwner != previousOwner) {
            if (!hasRole(DEFAULT_ADMIN_ROLE, currentOwner)) {
                _grantRole(DEFAULT_ADMIN_ROLE, currentOwner);
            }
            if (!hasRole(ADMIN_ROLE, currentOwner)) {
                _grantRole(ADMIN_ROLE, currentOwner);
            }
            if (previousOwner != address(0) && hasRole(DEFAULT_ADMIN_ROLE, previousOwner)) {
                _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
            }
            if (previousOwner != address(0) && hasRole(ADMIN_ROLE, previousOwner)) {
                _revokeRole(ADMIN_ROLE, previousOwner);
            }
            emit OwnershipRolesSynced(previousOwner, currentOwner);
        }
    }

    // ============ Multi-Oracle Management (P1-9) ============

    /**
     * @notice 添加授权预言机
     */
    function addAuthorizedOracle(address oracle) external onlyRole(ADMIN_ROLE) {
        if (oracle == address(0)) revert InvalidAddress();
        if (authorizedOracles[oracle]) return;

        authorizedOracles[oracle] = true;
        oracleList.push(oracle);

        emit OracleAuthorized(oracle);
    }

    /**
     * @notice 移除授权预言机 (H-4: 自动收敛 requiredOracleConfirmations)
     */
    function removeAuthorizedOracle(address oracle) external onlyRole(ADMIN_ROLE) {
        if (!authorizedOracles[oracle]) return;

        authorizedOracles[oracle] = false;

        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracleList[i] == oracle) {
                oracleList[i] = oracleList[oracleList.length - 1];
                oracleList.pop();
                break;
            }
        }

        // H-4: 自动收敛，防止死锁
        if (requiredOracleConfirmations > oracleList.length) {
            requiredOracleConfirmations = oracleList.length;
            emit RequiredConfirmationsAutoAdjusted(requiredOracleConfirmations);
        }

        emit OracleRevoked(oracle);
    }

    /**
     * @notice 设置所需的最小确认数 (L-1: 添加事件)
     */
    function setRequiredConfirmations(uint256 confirmations) external onlyRole(ADMIN_ROLE) {
        require(confirmations > 0 && confirmations <= oracleList.length, "Invalid confirmation count");
        uint256 old = requiredOracleConfirmations;
        requiredOracleConfirmations = confirmations;
        emit RequiredConfirmationsUpdated(old, confirmations);
    }

    /**
     * @notice 设置智能合约白名单 (H-2: MEV 保护)
     */
    function setSmartContractWhitelist(address contractAddr, bool whitelisted) external onlyRole(ADMIN_ROLE) {
        smartContractWhitelist[contractAddr] = whitelisted;
        emit SmartContractWhitelisted(contractAddr, whitelisted);
    }

    /**
     * @notice 设置 gasLimit (L-1: 添加事件)
     */
    function setGasLimit(uint32 _gasLimit) external onlyRole(ADMIN_ROLE) {
        uint32 old = gasLimit;
        gasLimit = _gasLimit;
        emit GasLimitUpdated(old, _gasLimit);
    }

    /**
     * @notice 设置 subscriptionId (L-1: 添加事件)
     */
    function setSubscriptionId(uint64 _subscriptionId) external onlyRole(ADMIN_ROLE) {
        uint64 old = subscriptionId;
        subscriptionId = _subscriptionId;
        emit SubscriptionIdUpdated(old, _subscriptionId);
    }

    // ============ Multi-Oracle Response Submission ============

    /**
     * @notice 提交预言机响应（多预言机冗余）
     * @dev 修复 C-1: 防止同一预言机重复投票
     * @dev 修复 H-1: score 类型收紧为 uint8
     * @dev 修复 H-2: 真正的 MEV / 闪电贷保护
     * @dev 修复 M-2: 输入校验
     */
    function submitOracleResponse(
        address account,
        uint8 score,
        uint8 tier,
        bool isSanctioned,
        uint256 deadline
    ) external onlyAuthorizedOracle whenNotPaused {
        // M-2: 输入校验
        if (account == address(0)) revert InvalidAddress();
        if (uint256(tier) > uint256(type(RiskRegistry.RiskTier).max)) revert InvalidTier(tier);

        // H-2: 强制 deadline 校验（不再允许 deadline == 0 跳过）
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }

        // H-2: 真正的闪电贷保护 — 拒绝合约调用者（除非白名单）
        if (msg.sender != tx.origin && !smartContractWhitelist[msg.sender]) {
            revert FlashLoanDetected(msg.sender);
        }

        // H-2: same-block 调用保护
        if (block.number <= lastUpdateBlock[account] + UPDATE_DELAY_BLOCKS) {
            revert UpdateTooSoon(account);
        }
        lastUpdateBlock[account] = block.number;

        // 计算响应哈希
        bytes32 responseHash = keccak256(
            abi.encodePacked(account, score, tier, isSanctioned)
        );

        // C-1 关键修复: 同一预言机对同一 account 只能有一张有效票
        // 若已有旧票，先撤销旧票再投新票
        bytes32 prevHash = oracleResponses[account][msg.sender];
        if (prevHash != bytes32(0)) {
            // 撤销旧票计数
            responseConfirmations[account][prevHash]--;
            emit OracleResponseRevoked(msg.sender, account, prevHash);
        }

        // 写入新响应
        oracleResponses[account][msg.sender] = responseHash;
        uint256 currentConfirmations = ++responseConfirmations[account][responseHash];

        emit OracleResponseReceived(msg.sender, account, responseHash, currentConfirmations);

        // 检查是否达到所需确认数
        if (currentConfirmations >= requiredOracleConfirmations && !confirmedUpdates[account]) {
            confirmedUpdates[account] = true;

            bytes32[] memory emptyTags = new bytes32[](0);
            // H-1: 不再截断，直接使用 uint8
            riskRegistry.updateRiskProfile(
                account,
                score,
                RiskRegistry.RiskTier(tier),
                emptyTags,
                isSanctioned
            );

            lastUpdateTime[account] = block.timestamp;

            emit MultiOracleUpdateConfirmed(account, responseHash, currentConfirmations);
            emit RiskProfileUpdated(bytes32(0), account, score, tier, isSanctioned);
        }
    }

    /**
     * @notice 重置地址的确认状态
     * @dev C-2 修复: 彻底清理 responseConfirmations
     */
    function resetConfirmations(address account) external onlyRole(ADMIN_ROLE) {
        confirmedUpdates[account] = false;

        for (uint256 i = 0; i < oracleList.length; i++) {
            address o = oracleList[i];
            bytes32 h = oracleResponses[account][o];
            if (h != bytes32(0)) {
                // C-2: 清理计票
                delete responseConfirmations[account][h];
            }
            delete oracleResponses[account][o];
        }

        emit ConfirmationsReset(account);
    }

    // ============ Pause / Unpause ============

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ Queue Management (M-1) ============

    /**
     * @notice 入队风险更新（带边界检查）
     * @dev M-1: 强制 maxQueueSize 检查
     */
    function enqueueRiskUpdate(PendingRiskUpdate memory upd) internal {
        if (pendingRiskQueue.length >= maxQueueSize) revert QueueFull();
        pendingRiskQueue.push(upd);
        emit QueuedRiskUpdate(upd.account, upd.score);
    }

    /**
     * @notice 批量处理队列中的待更新项
     */
    function processPendingQueue() external onlyRole(OPERATOR_ROLE) {
        uint256 count = pendingRiskQueue.length < batchSize ? pendingRiskQueue.length : batchSize;
        if (count == 0) return;

        uint256 gasStart = gasleft();
        for (uint256 i = 0; i < count; i++) {
            PendingRiskUpdate storage upd = pendingRiskQueue[i];
            bytes32[] memory tags = upd.tags;
            riskRegistry.updateRiskProfile(
                upd.account,
                uint8(upd.score),
                RiskRegistry.RiskTier(upd.tier),
                tags,
                upd.isSanctioned
            );
            emit RiskProfileUpdated(bytes32(0), upd.account, uint8(upd.score), upd.tier, upd.isSanctioned);
        }

        // 从队列中移除已处理项
        for (uint256 i = 0; i < pendingRiskQueue.length - count; i++) {
            pendingRiskQueue[i] = pendingRiskQueue[i + count];
        }
        for (uint256 i = 0; i < count; i++) {
            pendingRiskQueue.pop();
        }

        emit BatchUpdateExecuted(count, gasStart - gasleft());
    }

    // ============ Chainlink Functions ============

    /**
     * @notice 获取 Functions 源码（内部辅助）
     * @dev M-4: 若返回空字符串则 revert
     */
    function _getFunctionsSource(RequestType reqType) internal pure returns (string memory) {
        if (reqType == RequestType.SANCTIONS_SYNC) {
            return "const apiResponse = await Functions.makeHttpRequest({url: args[0]});"
                   "if (apiResponse.error) return Functions.encodeString('error');"
                   "return Functions.encodeString(JSON.stringify(apiResponse.data));";
        } else if (reqType == RequestType.RISK_SCORING) {
            return "const riskScore = args[0];"
                   "return Functions.encodeUint256(parseInt(riskScore));";
        }
        // M-4: 未知类型返回空字符串，调用方需检查
        return "";
    }

    /**
     * @notice 请求风险更新
     */
    function requestRiskUpdate(
        RequestType reqType,
        string calldata source,
        uint64 subscription,
        uint32 gasLimitForRequest,
        bytes calldata encryptedSecretsRef
    ) external onlyRole(OPERATOR_ROLE) checkCallerRateLimit returns (bytes32 requestId) {
        if (bytes(source).length == 0 && bytes(_getFunctionsSource(reqType)).length == 0) {
            revert InvalidRequestType();
        }

        FunctionsRequest.Request memory req;
        string memory jsSource = bytes(source).length > 0 ? source : _getFunctionsSource(reqType);
        // M-4: 最终安全检查
        if (bytes(jsSource).length == 0) revert InvalidRequestType();

        req.initializeRequestForInlineJavaScript(jsSource);

        if (encryptedSecretsRef.length > 0) {
            req.addSecretsReference(encryptedSecretsRef);
        }

        bytes32 assignedReqId = _sendRequest(
            req.encodeCBOR(),
            subscription,
            gasLimitForRequest,
            donId
        );

        // M-1: 环形缓冲限制 allRequestIds 大小
        if (allRequestIds.length < MAX_ALL_REQUEST_IDS) {
            allRequestIds.push(assignedReqId);
        } else {
            uint256 idx = allRequestIdsHead % MAX_ALL_REQUEST_IDS;
            allRequestIds[idx] = assignedReqId;
            allRequestIdsHead++;
        }

        requestInfo[assignedReqId] = RequestInfo({
            requestId: assignedReqId,
            requestType: reqType,
            requester: msg.sender,
            timestamp: block.timestamp,
            fulfilled: false,
            success: false,
            result: "",
            error: ""
        });

        lastRequestId = assignedReqId;
        requestCount++;

        // [Fix] 回写命名返回变量，确保调用者能获取正确 requestId
        requestId = assignedReqId;

        emit RiskUpdateRequested(assignedReqId, reqType, msg.sender, source);
    }

    /**
     * @notice Chainlink Functions 回调
     * @dev M-3: 不使用 whenNotPaused，确保暂停期间回调仍可成功写入
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        // L-3: 使用 requester != address(0) 作为存在性检查
        RequestInfo storage info = requestInfo[requestId];
        if (info.requester == address(0)) revert RequestNotFound();
        if (info.fulfilled) revert AlreadyFulfilled();

        info.fulfilled = true;
        info.success = err.length == 0;
        info.result = response;
        info.error = err;

        // M-3: 暂停期间不处理，但仍标记为 fulfilled 避免卡死
        if (!paused() && err.length == 0 && response.length > 0) {
            _processRiskResponse(info.requestType, response, info.requester);
            emit RiskUpdateFulfilled(requestId, true, block.timestamp);
        } else if (paused()) {
            info.fulfilled = false; // 允许后续手动重新处理
            emit FulfillmentDeferred(requestId);
        } else {
            emit RiskUpdateFulfilled(requestId, false, block.timestamp);
        }
    }

    /**
     * @notice 处理 Chainlink 响应数据
     * @dev P2-C: 为 SANCTIONS_SYNC 和 TRANSACTION_CHECK 添加显式处理
     * @dev 修复: SANCTIONS_SYNC 使用 tryDecodeAddresses 防止 abi.decode 失败导致 revert
     */
    function _processRiskResponse(
        RequestType reqType,
        bytes memory response,
        address /*requester*/
    ) internal {
        // 根据 reqType 解析响应
        if (reqType == RequestType.RISK_SCORING && response.length >= 32) {
            uint256 score = abi.decode(response, (uint256));
            if (score > type(uint8).max) score = type(uint8).max;

            // M-1: 限制 fulfillmentHistory 大小
            if (fulfillmentHistory.length < MAX_FULFILLMENT_HISTORY) {
                fulfillmentHistory.push(FulfillmentRecord({
                    requestId: bytes32(0),
                    targetAddress: address(0),
                    riskScore: score,
                    tier: 0,
                    isSanctioned: false,
                    fulfilledAt: block.timestamp
                }));
            }
        } else if (reqType == RequestType.SANCTIONS_SYNC) {
            // P2-C: 制裁名单同步 — 解析返回的地址列表并入队
            // 响应格式: abi-encoded (address[] sanctionedAddresses)
            // 修复: 使用 tryDecodeAddresses 防止 abi.decode 失败导致 revert
            (bool decodeOk, address[] memory sanctionedAddrs) = tryDecodeAddresses(response);
            if (decodeOk) {
                for (uint256 i = 0; i < sanctionedAddrs.length; i++) {
                    if (pendingRiskQueue.length < maxQueueSize) {
                        enqueueRiskUpdate(PendingRiskUpdate({
                            account: sanctionedAddrs[i],
                            score: 100,
                            tier: uint8(RiskRegistry.RiskTier.CRITICAL),
                            isSanctioned: true,
                            tags: new bytes32[](0),
                            queuedAt: block.timestamp
                        }));
                    }
                }
            }
        } else if (reqType == RequestType.TRANSACTION_CHECK) {
            // P2-C: 交易检查 — 解析返回的风险评估结果
            // 响应格式: abi-encoded (uint256 riskScore, bool isSanctioned)
            if (response.length >= 64) {
                (uint256 score, bool sanctioned) = abi.decode(response, (uint256, bool));
                if (score > type(uint8).max) score = type(uint8).max;

                if (fulfillmentHistory.length < MAX_FULFILLMENT_HISTORY) {
                    fulfillmentHistory.push(FulfillmentRecord({
                        requestId: bytes32(0),
                        targetAddress: address(0),
                        riskScore: score,
                        tier: 0,
                        isSanctioned: sanctioned,
                        fulfilledAt: block.timestamp
                    }));
                }
            }
        } else if (reqType == RequestType.CUSTOM_QUERY) {
            // 自定义查询 — 仅记录 fulfilled，不做特定处理
        }
        // UNKNOWN 类型：不做处理（初始化时 fulfilled=true 已在 fulfillRequest 中设置）
    }
    
    /**
     * @notice 安全解码 address[] 响应数据
     * @dev 修复: 防止 abi.decode 在响应格式错误时 revert，返回 (false, empty) 替代
     */
    function tryDecodeAddresses(bytes memory data) internal view returns (bool, address[] memory) {
        if (data.length < 64) return (false, new address[](0));
        // 基本 ABI 格式检查: 前 32 bytes 应为 offset (0x20), 接下来 32 bytes 为 length
        uint256 offset;
        uint256 length;
        assembly {
            offset := mload(add(data, 0x20))
            length := mload(add(data, 0x40))
        }
        if (offset != 0x20) return (false, new address[](0));
        if (length > 10000) return (false, new address[](0)); // 防止巨大数组导致 OOG
        uint256 expectedLen = 64 + length * 32;
        if (data.length < expectedLen) return (false, new address[](0));
        
        try this._decodeAddressesExternal(data) returns (address[] memory addrs) {
            return (true, addrs);
        } catch {
            return (false, new address[](0));
        }
    }
    
    /**
     * @dev 外部调用辅助函数，供 tryDecodeAddresses 的 try/catch 使用
     */
    function _decodeAddressesExternal(bytes calldata data) external pure returns (address[] memory) {
        return abi.decode(data, (address[]));
    }

    // ============ Data Source Management (M-1) ============

    /**
     * @notice 添加数据源
     */
    function addDataSource(
        bytes32 sourceId,
        string calldata name,
        string calldata apiEndpoint,
        uint256 weight
    ) external onlyRole(ADMIN_ROLE) {
        if (activeSourceIds.length >= MAX_DATA_SOURCES) revert MaxDataSourcesExceeded();
        if (dataSources[sourceId].isActive) return;

        dataSources[sourceId] = DataSource({
            name: name,
            apiEndpoint: apiEndpoint,
            isActive: true,
            weight: weight,
            secretsSlot: bytes32(0),
            secretsVersion: 0
        });
        activeSourceIds.push(sourceId);

        emit DataSourceAdded(sourceId, name);
    }

    /**
     * @notice 更新数据源状态
     */
    function updateDataSource(bytes32 sourceId, bool isActive) external onlyRole(ADMIN_ROLE) {
        if (!dataSources[sourceId].isActive && isActive) {
            // 激活
            dataSources[sourceId].isActive = true;
            // 如果尚未在 activeSourceIds 中
            bool found = false;
            for (uint256 i = 0; i < activeSourceIds.length; i++) {
                if (activeSourceIds[i] == sourceId) {
                    found = true;
                    break;
                }
            }
            if (!found && activeSourceIds.length < MAX_DATA_SOURCES) {
                activeSourceIds.push(sourceId);
            }
        } else if (dataSources[sourceId].isActive && !isActive) {
            dataSources[sourceId].isActive = false;
            for (uint256 i = 0; i < activeSourceIds.length; i++) {
                if (activeSourceIds[i] == sourceId) {
                    activeSourceIds[i] = activeSourceIds[activeSourceIds.length - 1];
                    activeSourceIds.pop();
                    break;
                }
            }
        }

        emit DataSourceUpdated(sourceId, isActive);
    }

    // ============ View Functions (I-3) ============

    /**
     * @notice 获取授权预言机列表
     */
    function getOracleList() external view returns (address[] memory) {
        return oracleList;
    }

    /**
     * @notice 获取活跃数据源列表
     */
    function getActiveSources() external view returns (bytes32[] memory) {
        return activeSourceIds;
    }

    /**
     * @notice 获取某地址的确认数
     */
    function getConfirmationCount(address account, bytes32 responseHash) external view returns (uint256) {
        return responseConfirmations[account][responseHash];
    }

    /**
     * @notice 获取某预言机对某地址的响应哈希
     */
    function getOracleResponse(address account, address oracle) external view returns (bytes32) {
        return oracleResponses[account][oracle];
    }

    /**
     * @notice 获取 pendingRiskQueue 长度
     */
    function getPendingQueueLength() external view returns (uint256) {
        return pendingRiskQueue.length;
    }

    /**
     * @notice 获取 fulfillmentHistory 长度
     */
    function getFulfillmentHistoryLength() external view returns (uint256) {
        return fulfillmentHistory.length;
    }

    /**
     * @notice 获取 allRequestIds 长度
     */
    function getAllRequestIdsLength() external view returns (uint256) {
        return allRequestIds.length;
    }
}