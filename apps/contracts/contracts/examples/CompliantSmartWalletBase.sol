// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IWalletCompliance.sol";
import "../interfaces/IAssetCompliance.sol";
import "../interfaces/IFidesCompliance.sol";
import "../QuarantineVault.sol";

/**
 * @title CompliantSmartWalletBase
 * @notice 集成FidesOrigin合规协议的智能钱包基础合约
 * @dev 核心执行、隔离、合规检查
 * @dev 不包含签名执行功能，可独立使用或作为CompliantSmartWallet的基类
 */
contract CompliantSmartWalletBase is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 public constant ENGINE_CHANGE_TIMELOCK = 2 days;

    // ============ State ============

    /// @notice 钱包所有者
    address public owner;

    /// @notice 待确认的新Owner (两步转移)
    address public pendingOwner;

    /// @notice FidesOrigin合规引擎 (旧接口)
    IWalletCompliance public complianceEngine;

    /// @notice FidesOrigin可编程合规引擎 (新接口)
    IFidesCompliance public fidesCompliance;

    /// @notice 平台隔离仓
    QuarantineVault public quarantineVault;

    /// @notice 合规检查是否启用
    bool public complianceEnabled = true;

    /// @notice 操作nonce（用于事件ID）
    uint256 public operationNonce;

    /// @notice 操作白名单 (常用合约)
    mapping(address => bool) public whitelistedTargets;

    /// @notice 日限额跟踪
    mapping(uint256 => uint256) public dailyEthSpent;
    mapping(address => mapping(uint256 => uint256)) public dailyTokenSpent;

    /// @notice 钱包策略
    IWalletCompliance.WalletPolicy public policy;

    /// @notice 紧急暂停
    bool public emergencyPaused;

    /// @notice 待生效的合规引擎变更 (时间锁)
    address public pendingComplianceEngine;
    uint256 public pendingEngineChangeTime;

    // ============ Quarantine State ============

    /// @notice 自动隔离是否启用
    bool public autoQuarantineEnabled = true;

    /// @notice 隔离触发阈值(低于此金额不自动隔离, 0=全部隔离)
    uint256 public quarantineThreshold = 1000 * 10**18;

    /// @notice 用户各代币的冻结余额(已被隔离的金额)
    mapping(address => uint256) public frozenBalances;

    /// @notice 各代币的隔离记录ID列表 (token => recordIds)
    mapping(address => bytes32[]) public quarantineRecordIds;

    /// @notice 可用余额(用户实际可支配)
    mapping(address => uint256) public availableBalances;

    /// @notice 平台运营方地址
    address public operator;

    struct QuarantineRecord {
        bytes32 recordId;
        address token;
        uint256 amount;
        uint256 timestamp;
    }

    /// @notice 隔离记录详情 (recordId => record)
    mapping(bytes32 => QuarantineRecord) public quarantineRecords;

    // ============ Structs ============

    struct OperationResult {
        bool success;
        bytes returnData;
        IAssetCompliance.Decision decision;
        string reason;
    }

    // ============ Events ============

    event OperationExecuted(
        bytes32 indexed opHash,
        IWalletCompliance.OperationType opType,
        address target,
        uint256 value,
        bool success
    );

    event BatchExecuted(
        uint256 count,
        uint256 successCount,
        uint256 blockedCount
    );

    event BatchHookResult(bool success, string reason);
    event OwnerChanged(address indexed newOwner);
    event OwnerChangeProposed(address indexed current, address indexed pending);
    event ComplianceEngineSet(address indexed engine);
    event EngineChangeProposed(address indexed proposed, uint256 effectiveTime);
    event TargetWhitelisted(address indexed target);
    event TargetRemovedFromWhitelist(address indexed target);
    event EmergencyPaused(address indexed triggeredBy);
    event EmergencyUnpaused(address indexed triggeredBy);
    event Received(address indexed from, uint256 amount);

    // ============ Quarantine Events ============

    event IncomingTransferIntercepted(address indexed sender, uint256 amount, string reason);
    event AutoQuarantineTriggered(
        address indexed token,
        uint256 amount,
        bytes32 indexed recordId,
        string reason
    );
    event BalanceFrozen(address indexed token, uint256 amount, string reason);
    event BalanceReleased(address indexed token, uint256 amount);
    event QuarantineVaultSet(address indexed vault);
    event EthQuarantinedToVault(address indexed vault, uint256 amount);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier compliantOp(IWalletCompliance.Operation calldata op) {
        if (complianceEnabled) {
            _preComplianceCheck(owner, op);
        }
        _;
    }

    modifier notEmergency() {
        require(!emergencyPaused, "Emergency mode active");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner, "Not operator or owner");
        _;
    }

    // ============ Errors ============

    error InvalidAddress();
    error EthTransferFailed();
    error ContractCallFailed();
    error IncomingTransferDenied(address sender, bytes32 reasonCode);
    error InsufficientAvailableBalance();
    error QuarantineFailed();
    error QuarantineVaultNotSet();
    error NotOperator();
    error BatchTooLarge();
    error EmptyBatch();
    error DailyEthLimitExceeded();
    error DailyTokenLimitExceeded();
    error TimelockNotExpired();
    error NoPendingChange();

    // ============ Constructor ============

    constructor(
        address _owner,
        address _complianceEngine,
        address _fidesCompliance,
        address _operator,
        address _quarantineVault
    ) {
        if (_owner == address(0)) revert InvalidAddress();
        if (_complianceEngine == address(0)) revert InvalidAddress();
        if (_fidesCompliance == address(0)) revert InvalidAddress();
        if (_operator == address(0)) revert InvalidAddress();
        if (_quarantineVault == address(0)) revert InvalidAddress();
        // [NICE_TO_HAVE] 验证依赖地址为真实合约
        if (_complianceEngine.code.length == 0) revert InvalidAddress();
        if (_fidesCompliance.code.length == 0) revert InvalidAddress();
        if (_quarantineVault.code.length == 0) revert InvalidAddress();

        owner = _owner;
        operator = _operator;
        complianceEngine = IWalletCompliance(_complianceEngine);
        fidesCompliance = IFidesCompliance(_fidesCompliance);
        quarantineVault = QuarantineVault(payable(_quarantineVault));

        // 设置默认策略
        policy = IWalletCompliance.WalletPolicy({
            maxTxValue: 100 ether,
            maxTokenTxAmount: 1000000 * 10**18,
            dailyEthLimit: 500 ether,
            dailyTokenLimit: 5000000 * 10**18,
            blockContractCalls: false,
            blockUnknownTokens: false,
            requireWhitelist: false,
            allowedDex: new address[](0),
            blockedContracts: new address[](0),
            whitelistedContracts: new bytes32[](0)
        });
    }

    // ============ Receive ============

    receive() external payable nonReentrant {
        emit Received(msg.sender, msg.value);

        if (autoQuarantineEnabled && msg.value >= quarantineThreshold) {
            address qv = address(quarantineVault);
            if (qv != address(0)) {
                uint256 amount = msg.value;
                // 先记账 (CEI)
                frozenBalances[address(0)] += amount;
                // 实际转入隔离仓
                (bool ok, ) = qv.call{value: amount}("");
                if (!ok) {
                    // 回滚记账
                    frozenBalances[address(0)] -= amount;
                    revert EthTransferFailed();
                }
                emit IncomingTransferIntercepted(msg.sender, amount, "eth-deposit-quarantined");
                emit EthQuarantinedToVault(qv, amount);
                emit AutoQuarantineTriggered(
                    address(0),
                    amount,
                    keccak256(abi.encodePacked(msg.sender, amount, block.timestamp, block.number)),
                    "eth-deposit"
                );
            } else {
                emit IncomingTransferIntercepted(msg.sender, msg.value, "eth-deposit-no-vault");
            }
        }
    }

    // ============ Core Execution Functions ============

    /**
     * @notice 执行通用操作 (带合规检查)
     */
    function execute(
        IWalletCompliance.Operation calldata op
    ) external onlyOwner compliantOp(op) notEmergency nonReentrant returns (bytes memory) {
        return _executeOperation(op);
    }

    /**
     * @notice 执行ETH转账
     */
    function transferETH(
        address to,
        uint256 amount
    ) external onlyOwner notEmergency nonReentrant returns (bool) {
        if (to == address(0) || amount == 0) revert InvalidAddress();
        _syncAvailableBalance(address(0));
        if (availableBalances[address(0)] < amount) revert InsufficientAvailableBalance();

        IWalletCompliance.Operation memory op = IWalletCompliance.Operation({
            opType: IWalletCompliance.OperationType.TRANSFER,
            target: to,
            value: amount,
            data: "",
            token: address(0),
            tokenAmount: 0,
            chainId: block.chainid
        });

        // [1] 合规前置检查 + 策略强制
        if (complianceEnabled) {
            _preComplianceCheck(owner, op);
        }
        _enforcePolicy(op);

        // [2] 先记账 - CEI pattern
        _recordSpending(amount, address(0), 0);

        // [3] 再转账
        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            _refundSpending(amount, address(0), 0);
            revert EthTransferFailed();
        }

        // [4] 合规后置回调
        if (complianceEnabled) {
            _postComplianceCheck(owner, op, success);
        }

        uint256 nonce = operationNonce++;
        emit OperationExecuted(
            keccak256(abi.encode(op, nonce, block.chainid, address(this))),
            IWalletCompliance.OperationType.TRANSFER,
            to,
            amount,
            success
        );

        return success;
    }

    /**
     * @notice 执行ERC20转账(带可用余额控制)
     */
    function transferToken(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner notEmergency nonReentrant returns (bool) {
        if (token == address(0) || to == address(0) || amount == 0) revert InvalidAddress();

        _syncAvailableBalance(token);

        if (availableBalances[token] < amount) {
            revert InsufficientAvailableBalance();
        }

        IWalletCompliance.Operation memory op = IWalletCompliance.Operation({
            opType: IWalletCompliance.OperationType.TOKEN_TRANSFER,
            target: to,
            value: 0,
            data: abi.encodeWithSignature("transfer(address,uint256)", to, amount),
            token: token,
            tokenAmount: amount,
            chainId: block.chainid
        });

        // [1] 合规前置检查 + 策略强制
        if (complianceEnabled) {
            _preComplianceCheck(owner, op);
        }
        _enforcePolicy(op);

        // [2] 先扣可用余额 + 记账 - CEI pattern
        availableBalances[token] -= amount;
        _recordSpending(0, token, amount);

        // [3] 再转账 (M-06 FIX: use SafeERC20 instead of raw call)
        IERC20(token).safeTransfer(to, amount);
        // safeTransfer reverts on failure, no need to check return value

        // [4] 合规后置回调
        if (complianceEnabled) {
            _postComplianceCheck(owner, op, true);
        }

        uint256 nonce = operationNonce++;
        emit OperationExecuted(
            keccak256(abi.encode(op, nonce, block.chainid, address(this))),
            IWalletCompliance.OperationType.TOKEN_TRANSFER,
            to,
            amount,
            true
        );

        return true;
    }

    /**
     * @notice 执行合约调用
     */
    function callContract(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner notEmergency nonReentrant returns (bytes memory) {
        if (target == address(0)) revert InvalidAddress();
        if (address(this).balance < value) revert InsufficientAvailableBalance();

        IWalletCompliance.Operation memory op = IWalletCompliance.Operation({
            opType: IWalletCompliance.OperationType.CONTRACT_CALL,
            target: target,
            value: value,
            data: data,
            token: address(0),
            tokenAmount: 0,
            chainId: block.chainid
        });

        // [1] 合规前置检查 + 策略强制
        if (complianceEnabled) {
            _preComplianceCheck(owner, op);
        }
        _enforcePolicy(op);

        // [2] 先记账 - CEI pattern
        _recordSpending(value, address(0), 0);

        // [3] 再调用
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            _refundSpending(value, address(0), 0);
            revert ContractCallFailed();
        }

        // [4] 合规后置回调
        if (complianceEnabled) {
            _postComplianceCheck(owner, op, success);
        }

        uint256 nonce = operationNonce++;
        emit OperationExecuted(
            keccak256(abi.encode(op, nonce, block.chainid, address(this))),
            IWalletCompliance.OperationType.CONTRACT_CALL,
            target,
            value,
            success
        );

        return returnData;
    }

    /**
     * @notice 批量执行操作 (带批量合规检查)
     */
    function executeBatch(
        IWalletCompliance.Operation[] calldata ops
    ) external onlyOwner notEmergency nonReentrant returns (OperationResult[] memory results) {
        if (ops.length == 0) revert EmptyBatch();
        if (ops.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        results = new OperationResult[](ops.length);

        // 批量合规检查 — 失败必须回滚
        if (complianceEnabled && address(complianceEngine) != address(0)) {
            bool batchOk = true;
            string memory batchReason;
            try complianceEngine.preBatchExecutionHook(owner, ops) {
                // pass
            } catch Error(string memory reason) {
                batchOk = false;
                batchReason = reason;
            } catch {
                batchOk = false;
                batchReason = "batch hook unknown failure";
            }
            emit BatchHookResult(batchOk, batchReason);
            require(batchOk, string(abi.encodePacked("batch blocked: ", batchReason)));
        }

        uint256 successCount = 0;
        uint256 blockedCount = 0;

        for (uint256 i = 0; i < ops.length; i++) {
            // 策略强制
            _enforcePolicy(ops[i]);

            if (complianceEnabled && address(complianceEngine) != address(0)) {
                (IAssetCompliance.Decision decision, string memory reason) =
                    complianceEngine.validateOperation(owner, ops[i], address(this));

                if (decision == IAssetCompliance.Decision.BLOCK) {
                    results[i] = OperationResult({
                        success: false,
                        returnData: "",
                        decision: decision,
                        reason: reason
                    });
                    blockedCount++;
                    continue;
                }
            }

            (bool success, bytes memory returnData) = _executeOperationRaw(ops[i]);

            results[i] = OperationResult({
                success: success,
                returnData: returnData,
                decision: success ? IAssetCompliance.Decision.ALLOW : IAssetCompliance.Decision.BLOCK,
                reason: success ? "" : "execution failed"
            });

            if (success) {
                successCount++;
                // 仅成功操作计入日限额 - C-3 fix
                _recordSpending(ops[i].value, ops[i].token, ops[i].tokenAmount);
            } else {
                blockedCount++;
            }

            if (complianceEnabled) {
                _postComplianceCheck(owner, ops[i], success);
            }

            uint256 nonce = operationNonce++;
            emit OperationExecuted(
                keccak256(abi.encode(ops[i], nonce, block.chainid, address(this))),
                ops[i].opType,
                ops[i].target,
                ops[i].value,
                success
            );
        }

        emit BatchExecuted(ops.length, successCount, blockedCount);

        return results;
    }

    // ============ Internal Execution ============

    /**
     * @dev 内部执行操作 (用于 execute 入口)
     */
    function _executeOperation(
        IWalletCompliance.Operation memory op
    ) internal returns (bytes memory) {
        _enforcePolicy(op);

        // M-07 FIX: Check balance BEFORE recording spending (check-effect-interact)
        if (op.token != address(0) && op.tokenAmount > 0) {
            _syncAvailableBalance(op.token);
            if (availableBalances[op.token] < op.tokenAmount) {
                revert InsufficientAvailableBalance();
            }
            availableBalances[op.token] -= op.tokenAmount;
        }

        _recordSpending(op.value, op.token, op.tokenAmount);

        (bool success, bytes memory returnData) = op.target.call{value: op.value}(op.data);
        if (!success) {
            _refundSpending(op.value, op.token, op.tokenAmount);
            if (op.token != address(0) && op.tokenAmount > 0) {
                availableBalances[op.token] += op.tokenAmount;
            }
            revert ContractCallFailed();
        }

        uint256 nonce = operationNonce++;
        emit OperationExecuted(
            keccak256(abi.encode(op, nonce, block.chainid, address(this))),
            op.opType,
            op.target,
            op.value,
            success
        );

        return returnData;
    }

    /**
     * @dev 原始执行（用于批量内部，不包含合规检查）
     */
    function _executeOperationRaw(
        IWalletCompliance.Operation memory op
    ) internal returns (bool success, bytes memory returnData) {
        if (op.value > 0 && address(this).balance < op.value) {
            return (false, "");
        }

        if (op.token != address(0) && op.tokenAmount > 0) {
            _syncAvailableBalance(op.token);
            if (availableBalances[op.token] < op.tokenAmount) {
                return (false, "");
            }
            availableBalances[op.token] -= op.tokenAmount;
        }

        (success, returnData) = op.target.call{value: op.value}(op.data);

        if (!success && op.token != address(0) && op.tokenAmount > 0) {
            availableBalances[op.token] += op.tokenAmount;
        }
    }

    // ============ Compliance Helpers ============

    function _preComplianceCheck(address user, IWalletCompliance.Operation memory op) internal {
        if (address(complianceEngine) == address(0)) return;

        try complianceEngine.preExecutionHook(user, op) {
            // pass
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("compliance blocked: ", reason)));
        } catch {
            revert("compliance check failed");
        }
    }

    function _postComplianceCheck(address user, IWalletCompliance.Operation memory op, bool success) internal {
        if (address(complianceEngine) == address(0)) return;

        try complianceEngine.postExecutionHook(user, op, success) {
            // pass
        } catch {
            // post hook 失败不影响执行结果
        }
    }

    function _enforcePolicy(IWalletCompliance.Operation memory op) internal view {
        // 检查最大交易额
        if (op.value > policy.maxTxValue) revert DailyEthLimitExceeded();

        if (op.token != address(0) && op.tokenAmount > policy.maxTokenTxAmount) {
            revert DailyTokenLimitExceeded();
        }

        // 检查日限额
        uint256 dayKey = block.timestamp / 1 days;
        if (op.value > 0 && dailyEthSpent[dayKey] + op.value > policy.dailyEthLimit) {
            revert DailyEthLimitExceeded();
        }

        if (op.token != address(0) && op.tokenAmount > 0) {
            if (dailyTokenSpent[op.token][dayKey] + op.tokenAmount > policy.dailyTokenLimit) {
                revert DailyTokenLimitExceeded();
            }
        }

        // 检查合约调用限制
        if (policy.blockContractCalls && op.opType == IWalletCompliance.OperationType.CONTRACT_CALL) {
            if (!whitelistedTargets[op.target]) {
                revert("Contract calls blocked");
            }
        }

        // 白名单要求
        if (policy.requireWhitelist && !whitelistedTargets[op.target]) {
            revert("Target not whitelisted");
        }
    }

    function _recordSpending(uint256 ethAmount, address token, uint256 tokenAmount) internal {
        uint256 dayKey = block.timestamp / 1 days;
        if (ethAmount > 0) {
            dailyEthSpent[dayKey] += ethAmount;
        }
        if (token != address(0) && tokenAmount > 0) {
            dailyTokenSpent[token][dayKey] += tokenAmount;
        }
    }

    function _refundSpending(uint256 ethAmount, address token, uint256 tokenAmount) internal {
        uint256 dayKey = block.timestamp / 1 days;
        if (ethAmount > 0 && dailyEthSpent[dayKey] >= ethAmount) {
            dailyEthSpent[dayKey] -= ethAmount;
        }
        if (token != address(0) && tokenAmount > 0 && dailyTokenSpent[token][dayKey] >= tokenAmount) {
            dailyTokenSpent[token][dayKey] -= tokenAmount;
        }
    }

    function _syncAvailableBalance(address token) internal {
        if (token == address(0)) {
            // ETH: balance - frozen
            uint256 frozen = frozenBalances[address(0)];
            if (address(this).balance >= frozen) {
                availableBalances[address(0)] = address(this).balance - frozen;
            } else {
                availableBalances[address(0)] = 0;
            }
        } else {
            uint256 bal;
            (bool ok, bytes memory data) = token.staticcall(
                abi.encodeWithSignature("balanceOf(address)", address(this))
            );
            if (ok && data.length >= 32) {
                bal = abi.decode(data, (uint256));
            }
            uint256 frozen = frozenBalances[token];
            if (bal >= frozen) {
                availableBalances[token] = bal - frozen;
            } else {
                availableBalances[token] = 0;
            }
        }
    }

    // ============ Admin Functions ============

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        pendingOwner = newOwner;
        emit OwnerChangeProposed(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert("Not pending owner");
        owner = pendingOwner;
        delete pendingOwner;
        emit OwnerChanged(owner);
    }

    function setComplianceEnabled(bool _enabled) external onlyOwner {
        complianceEnabled = _enabled;
    }

    function setAutoQuarantineEnabled(bool _enabled) external onlyOwner {
        autoQuarantineEnabled = _enabled;
    }

    function setQuarantineThreshold(uint256 _threshold) external onlyOwner {
        quarantineThreshold = _threshold;
    }

    function setQuarantineVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert InvalidAddress();
        if (_vault.code.length == 0) revert InvalidAddress();
        quarantineVault = QuarantineVault(payable(_vault));
        emit QuarantineVaultSet(_vault);
    }

    function whitelistTarget(address target) external onlyOwner {
        if (target == address(0)) revert InvalidAddress();
        whitelistedTargets[target] = true;
        emit TargetWhitelisted(target);
    }

    function removeFromWhitelist(address target) external onlyOwner {
        whitelistedTargets[target] = false;
        emit TargetRemovedFromWhitelist(target);
    }

    function emergencyPause() external onlyOperator {
        emergencyPaused = true;
        emit EmergencyPaused(msg.sender);
    }

    function emergencyUnpause() external onlyOwner {
        emergencyPaused = false;
        emit EmergencyUnpaused(msg.sender);
    }

    function proposeEngineChange(address newEngine) external onlyOwner {
        if (newEngine == address(0)) revert InvalidAddress();
        pendingComplianceEngine = newEngine;
        pendingEngineChangeTime = block.timestamp + ENGINE_CHANGE_TIMELOCK;
        emit EngineChangeProposed(newEngine, pendingEngineChangeTime);
    }

    function executeEngineChange() external onlyOwner {
        if (pendingComplianceEngine == address(0)) revert NoPendingChange();
        if (block.timestamp < pendingEngineChangeTime) revert TimelockNotExpired();
        complianceEngine = IWalletCompliance(pendingComplianceEngine);
        emit ComplianceEngineSet(pendingComplianceEngine);
        delete pendingComplianceEngine;
        delete pendingEngineChangeTime;
    }

    function setPolicy(IWalletCompliance.WalletPolicy calldata _policy) external onlyOwner {
        policy = _policy;
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) revert InvalidAddress();
        operator = _operator;
    }

    // ============ Quarantine Operations ============

    /**
     * @notice 手动隔离资产到隔离仓
     * @dev [C-28] 修复: ERC20 通过隔离仓 API 创建正式隔离记录，ETH 保持直接转账
     */
    function quarantineAssets(
        address token,
        uint256 amount,
        string calldata reason
    ) external onlyOperator nonReentrant returns (bytes32 recordId) {
        if (amount == 0) revert InvalidAddress();
        address qv = address(quarantineVault);
        if (qv == address(0)) revert QuarantineVaultNotSet();

        if (token == address(0)) {
            // ETH: 隔离仓无 ETH 隔离接口，保持直接转账
            recordId = keccak256(abi.encodePacked(
                block.timestamp,
                block.number,
                msg.sender,
                token,
                amount,
                operationNonce++
            ));
            uint256 avail = address(this).balance - frozenBalances[address(0)];
            if (avail < amount) revert InsufficientAvailableBalance();
            frozenBalances[address(0)] += amount;
            (bool ok, ) = qv.call{value: amount}("");
            if (!ok) {
                frozenBalances[address(0)] -= amount;
                revert EthTransferFailed();
            }
        } else {
            // ERC20: 通过隔离仓 API 创建正式隔离记录
            uint256 avail = availableBalances[token];
            if (avail < amount) revert InsufficientAvailableBalance();
            
            // 先 approve 隔离仓
            IERC20(token).forceApprove(qv, amount);
            
            // 调用隔离仓 API 创建记录并实际转账
            recordId = quarantineVault.quarantineFunds(address(this), token, amount, reason);
            
            frozenBalances[token] += amount;
            availableBalances[token] -= amount;
            quarantineRecordIds[token].push(recordId);
            // 记录隔离详情用于后续验证
            quarantineRecords[recordId] = QuarantineRecord({
                recordId: recordId,
                token: token,
                amount: amount,
                timestamp: block.timestamp
            });
        }

        emit BalanceFrozen(token, amount, reason);
        emit AutoQuarantineTriggered(token, amount, recordId, reason);
    }

    /**
     * @notice 释放被隔离的资产
     * @dev [C-28] 修复: 通过 recordId 调用隔离仓 releaseFunds 实际释放资产
     */
    function releaseQuarantinedAssets(
        address token,
        uint256 amount,
        bytes32 recordId
    ) external onlyOperator nonReentrant {
        if (amount == 0) revert InvalidAddress();

        // 验证 recordId 与 token/amount 匹配
        QuarantineRecord storage record = quarantineRecords[recordId];
        if (record.recordId == bytes32(0)) revert("Record not found");
        if (record.token != token) revert("Token mismatch");
        if (record.amount != amount) revert("Amount mismatch");

        if (frozenBalances[token] < amount) revert InsufficientAvailableBalance();

        // 调用隔离仓实际释放资金
        quarantineVault.releaseFunds(recordId);

        frozenBalances[token] -= amount;
        availableBalances[token] += amount;

        // 清理记录
        delete quarantineRecords[recordId];
        // P2 fix: 从 quarantineRecordIds 数组中移除，防止 gas 膨胀
        _removeQuarantineRecordId(token, recordId);

        emit BalanceReleased(token, amount);
    }

    /**
     * @dev P2 fix: 从 quarantineRecordIds 数组中移除指定 recordId，防止 gas 膨胀
     */
    function _removeQuarantineRecordId(address token, bytes32 recordId) internal {
        bytes32[] storage records = quarantineRecordIds[token];
        uint256 length = records.length;
        for (uint256 i = 0; i < length; i++) {
            if (records[i] == recordId) {
                records[i] = records[length - 1];
                records.pop();
                break;
            }
        }
    }

    // ============ View Functions ============

    function getAvailableBalance(address token) external view returns (uint256) {
        return availableBalances[token];
    }

    function getFrozenBalance(address token) external view returns (uint256) {
        return frozenBalances[token];
    }

    function getDailyEthSpent() external view returns (uint256) {
        return dailyEthSpent[block.timestamp / 1 days];
    }

    function getDailyTokenSpent(address token) external view returns (uint256) {
        return dailyTokenSpent[token][block.timestamp / 1 days];
    }

    /**
     * @notice M-07b FIX: Reset stale daily spending data for a given dayKey
     * @param dayKey The day key to reset (block.timestamp / 1 days)
     */
    function resetDailyEthSpent(uint256 dayKey) external onlyOwner {
        dailyEthSpent[dayKey] = 0;
    }

    /**
     * @notice M-07b FIX: Reset stale daily token spending data for a given dayKey
     * @param token The token address
     * @param dayKey The day key to reset (block.timestamp / 1 days)
     */
    function resetDailyTokenSpent(address token, uint256 dayKey) external onlyOwner {
        dailyTokenSpent[token][dayKey] = 0;
    }

    /**
     * @dev [H-29] 修复: fallback 支持 DeFi 协议回调（如 Uniswap、Aave 等）
     * 使用普通 call 将调用转发给目标合约，避免 delegatecall 导致的存储覆盖风险
     * 
     * ⚠️ 原实现使用 delegatecall，被攻击的协议可完全控制钱包 storage
     * 修复后使用 call，保持安全性同时支持协议回调
     */
    fallback() external payable nonReentrant {
        // H-03 FIX: Restrict fallback to whitelisted targets only. Owner removed to prevent
        // arbitrary calldata forwarding abuse if owner is a compromised or malicious contract.
        // Owner must whitelist their own contracts if they need callback support.
        if (!whitelistedTargets[msg.sender]) {
            revert("Fallback calls restricted to whitelisted targets");
        }
        
        address target = msg.sender;
        
        // M-08 FIX: Limit forwarded gas to prevent gas-griefing attacks
        uint256 _gasLimit = gasleft() > 100000 ? 100000 : gasleft();
        
        // 使用普通 call 而非 delegatecall，防止被攻击协议覆盖 storage
        (bool success, bytes memory returnData) = target.call{value: msg.value, gas: _gasLimit}(msg.data);
        if (!success) {
            assembly {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
        
        // 返回目标合约的返回值
        assembly {
            return(add(returnData, 0x20), mload(returnData))
        }
    }
}