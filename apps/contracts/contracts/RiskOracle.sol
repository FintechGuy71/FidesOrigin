// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IAssetCompliance.sol";
import "./RiskRegistry.sol";
import "./RiskOracleStorage.sol";
import "./RiskOracleQueue.sol";
import "./RiskOracleConsensus.sol";

/**
 * @title RiskOracle
 * @notice Chainlink Functions 集成的风险数据预言机
 * @dev 从链下数据源获取风险数据并同步到链上
 * @dev VERSION: 1.2.1 - 安全修复版本
 * @dev Architecture: Facade over RiskOracleStorage + RiskOracleQueue + RiskOracleConsensus
 */
contract RiskOracle is FunctionsClient, ConfirmedOwner, AccessControl, Pausable, RiskOracleQueue, RiskOracleConsensus {

    using FunctionsRequest for FunctionsRequest.Request;

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

    // ============ Multi-Oracle Management (Facade) ============

    /**
     * @notice 添加授权预言机
     */
    function addAuthorizedOracle(address oracle) external onlyRole(ADMIN_ROLE) {
        _addAuthorizedOracle(oracle);
    }

    /**
     * @notice 移除授权预言机 (H-4: 自动收敛 requiredOracleConfirmations)
     */
    function removeAuthorizedOracle(address oracle) external onlyRole(ADMIN_ROLE) {
        _removeAuthorizedOracle(oracle);
    }

    /**
     * @notice 设置所需的最小确认数 (L-1: 添加事件)
     */
    function setRequiredConfirmations(uint256 confirmations) external onlyRole(ADMIN_ROLE) {
        _setRequiredConfirmations(confirmations);
    }

    /**
     * @notice 设置智能合约白名单 (H-2: MEV 保护)
     */
    function setSmartContractWhitelist(address contractAddr, bool whitelisted) external onlyRole(ADMIN_ROLE) {
        _setSmartContractWhitelist(contractAddr, whitelisted);
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

    // ============ Multi-Oracle Response Submission (Facade) ============

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
        _submitOracleResponse(account, score, tier, isSanctioned, deadline);
    }

    /**
     * @notice 重置地址的确认状态
     * @dev C-2 修复: 彻底清理 responseConfirmations
     */
    function resetConfirmations(address account) external onlyRole(ADMIN_ROLE) {
        _resetConfirmations(account);
    }

    // ============ Pause / Unpause ============

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ Queue Management (Facade) ============

    /**
     * @notice 批量处理队列中的待更新项
     */
    function processPendingQueue() external onlyRole(OPERATOR_ROLE) {
        _processPendingQueue();
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
            deferred: false,
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

        // M-05 FIX: 暂停期间仍标记 fulfilled=true，使用 deferred 标记供后续手动处理
        // Chainlink 不会对同一 requestId 重发回调，fulfilled=false 会导致请求永久丢失
        if (!paused() && err.length == 0 && response.length > 0) {
            info.fulfilled = true;
            info.success = true;
            info.result = response;
            info.error = err;
            _processRiskResponse(info.requestType, response, info.requester);
            emit RiskUpdateFulfilled(requestId, true, block.timestamp);
        } else if (paused()) {
            // Mark as fulfilled but deferred — result stored for later processing
            info.fulfilled = true;
            info.deferred = true;
            info.result = response;
            info.error = err;
            emit FulfillmentDeferred(requestId);
        } else {
            info.fulfilled = true;
            info.success = err.length == 0;
            info.result = response;
            info.error = err;
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
                        _enqueueRiskUpdate(PendingRiskUpdate({
                            account: sanctionedAddrs[i],
                            score: 100,
                            tier: uint8(RiskRegistry.RiskTier.CRITICAL),
                            isSanctioned: true,
                            tags: new bytes32[](0),
                            queuedAt: block.timestamp
                        }));
                    } else {
                        // L-08 FIX: Emit event when address is dropped due to full queue
                        emit QueueDropped(sanctionedAddrs[i], block.timestamp);
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
     * L-17 NOTE: This must remain external because Solidity try/catch only works on external calls.
     * The function is pure and has no side effects; it is not intended for direct external use.
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
}
