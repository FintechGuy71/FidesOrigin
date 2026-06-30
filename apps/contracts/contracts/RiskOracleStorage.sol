// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RiskRegistry.sol";

/**
 * @title RiskOracleStorage
 * @notice RiskOracle 存储层 — 所有状态变量、事件、错误、常量、基础查询
 * @dev 被 RiskOracleQueue 和 RiskOracleConsensus 继承，确保单一存储实例
 */
abstract contract RiskOracleStorage {

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
        bool deferred;
        bytes result;
        bytes error;
    }

    mapping(bytes32 => RequestInfo) public requestInfo;
    bytes32[] public allRequestIds;
    bytes32 public lastRequestId;

    /// @dev M-1: 限制 allRequestIds 数组大小
    uint256 public constant MAX_ALL_REQUEST_IDS = 10_000;
    uint256 internal allRequestIdsHead;

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
    event QueueDropped(address indexed account, uint256 timestamp);

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
