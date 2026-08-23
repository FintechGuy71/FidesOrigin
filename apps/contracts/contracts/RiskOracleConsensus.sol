// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RiskOracleStorage.sol";

/**
 * @title RiskOracleConsensus
 * @notice RiskOracle 共识层 — 多预言机投票、确认计数、响应管理
 * @dev 继承 RiskOracleStorage，暴露 internal 函数供 RiskOracle 门面调用
 */
abstract contract RiskOracleConsensus is RiskOracleStorage {

    // H-04 FIX: 手动实现重入保护（避免引入新的继承链）
    uint256 private _reentrancyStatus;

    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    constructor() {
        _reentrancyStatus = 1;
    }

    /// @notice M-10 FIX: 最大授权预言机数量，防止 _resetConfirmations 等遍历操作的 gas 膨胀
    uint256 public constant MAX_ORACLES = 50;

    /// @notice P2 FIX: 链特定最小质押金额映射（替代固定常数）
    mapping(uint256 => uint256) public minStakeByChain;
    /// @notice P2 FIX: 默认质押金额（当链未配置时使用）
    uint256 public constant DEFAULT_MIN_STAKE = 1 ether;

    /// @notice H-5 FIX: 预言机质押金额映射
    mapping(address => uint256) public oracleStakes;
    /// @notice H-04 FIX: 预言机质押时间映射（防闪电贷）
    mapping(address => uint256) public stakeTime;
    /// @notice H-04 FIX: 最小质押时长（1天）
    uint256 public constant MIN_STAKE_DURATION = 1 days;

    // ============ Events ============
    event OracleStaked(address indexed oracle, uint256 amount);
    event OracleUnstaked(address indexed oracle, uint256 amount);
    event MinStakeUpdated(uint256 indexed chainId, uint256 minStake);

    /**
     * @notice P2 FIX: 设置特定链的最小质押金额
     * @param chainId_ 目标链 ID
     * @param minStake 最小质押金额（wei）
     */
    function _setMinStakeForChain(uint256 chainId_, uint256 minStake) internal {
        minStakeByChain[chainId_] = minStake;
        emit MinStakeUpdated(chainId_, minStake);
    }

    /**
     * @dev P2 FIX: 获取当前链的最小质押金额
     */
    function _getMinStakeAmount() internal view returns (uint256) {
        uint256 configured = minStakeByChain[block.chainid];
        return configured > 0 ? configured : DEFAULT_MIN_STAKE;
    }

    /**
     * @notice 添加授权预言机
     * @dev M-10 FIX: 检查 MAX_ORACLES 上限，防止 oracleList 无限增长
     * @dev [M-3 FIX] 当授权预言机达到 3 个且当前阈值低于 3 时，自动提升
     *      requiredOracleConfirmations 至 3。原实现默认阈值恒为 1：单节点
     *      即可改写任意地址风险分，"多预言机共识"名存实亡。自动提升保证
     *      冗余一旦存在，共识立即真实生效（治理仍可显式调整阈值）。
     */
    function _addAuthorizedOracle(address oracle) internal {
        if (oracle == address(0)) revert InvalidAddress();
        if (authorizedOracles[oracle]) return;

        // M-10 FIX: 限制预言机总数
        require(oracleList.length < MAX_ORACLES, "Max oracles reached");

        authorizedOracles[oracle] = true;
        oracleList.push(oracle);

        // [M-3 FIX] 冗余达标时自动启用真实共识
        if (requiredOracleConfirmations < 3 && oracleList.length >= 3) {
            requiredOracleConfirmations = 3;
            emit RequiredConfirmationsAutoAdjusted(3);
        }

        emit OracleAuthorized(oracle);
    }

    /**
     * @notice 移除授权预言机 (H-4: 自动收敛 requiredOracleConfirmations)
     * @return removed 是否成功移除
     */
    function _removeAuthorizedOracle(address oracle) internal returns (bool removed) {
        if (!authorizedOracles[oracle]) return false;

        authorizedOracles[oracle] = false;
        removed = true;

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
    function _setRequiredConfirmations(uint256 confirmations) internal {
        require(confirmations > 0 && confirmations <= oracleList.length, "Invalid confirmation count");
        uint256 old = requiredOracleConfirmations;
        requiredOracleConfirmations = confirmations;
        emit RequiredConfirmationsUpdated(old, confirmations);
    }

    /**
     * @notice 设置智能合约白名单 (H-2: MEV 保护)
     */
    function _setSmartContractWhitelist(address contractAddr, bool whitelisted) internal {
        smartContractWhitelist[contractAddr] = whitelisted;
        emit SmartContractWhitelisted(contractAddr, whitelisted);
    }

    /**
     * @notice H-5 FIX: 预言机质押 ETH
     * @dev 质押金额用于防闪电贷保护，操作者必须质押至少 MIN_ORACLE_STAKE
     * @dev H-04 FIX: 记录质押时间，用于最小质押时长检查
     */
    function stake() external payable {
        if (oracleStakes[msg.sender] == 0) {
            stakeTime[msg.sender] = block.timestamp;
        }
        oracleStakes[msg.sender] += msg.value;
        emit OracleStaked(msg.sender, msg.value);
    }

    /**
     * @notice H-5 FIX: 预言机提取质押 ETH
     * @dev L-12 FIX: 使用 .call 替代 .transfer，避免智能合约接收方因 2300 gas 限制而失败
     * @param amount 提取金额
     */
    function unstake(uint256 amount) external nonReentrant {
        require(oracleStakes[msg.sender] >= amount, "Insufficient stake balance");
        oracleStakes[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ETH transfer failed");
        emit OracleUnstaked(msg.sender, amount);
    }

    /// @notice [L-13 FIX] 罚没金库（治理多签），默认未配置时禁止罚没
    /// @dev 管理入口见 RiskOracle 门面合约（setSlashTreasury / slashOracleStake，
    ///      ADMIN_ROLE + OZ onlyRole；本层无角色系统）
    address public slashTreasury;

    event SlashTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OracleStakeSlashed(address indexed oracle, uint256 amount, string reason);

    /**
     * @notice [L-13 FIX] 罚没预言机质押的内部执行（转入治理金库，而非销毁）
     * @dev 由 RiskOracle 门面的 slashOracleStake(ADMIN_ROLE) 调用；
     *      金额以当前质押余额为上限。
     */
    function _slashOracleStake(address oracle, uint256 amount, string calldata reason)
        internal nonReentrant
    {
        if (slashTreasury == address(0)) revert InvalidAddress();
        uint256 stakeBalance = oracleStakes[oracle];
        uint256 slashAmount = amount > stakeBalance ? stakeBalance : amount;
        if (slashAmount == 0) revert InvalidAddress();
        oracleStakes[oracle] = stakeBalance - slashAmount;
        (bool success, ) = payable(slashTreasury).call{value: slashAmount}("");
        require(success, "ETH transfer failed");
        emit OracleStakeSlashed(oracle, slashAmount, reason);
    }

    /**
     * @dev 修复 C-1: 防止同一预言机重复投票
     * @dev 修复 H-1: score 类型收紧为 uint8
     * @dev 修复 H-2: 真正的 MEV / 闪电贷保护
     * @dev 修复 M-2: 输入校验
     */
    function _submitOracleResponse(
        address account,
        uint8 score,
        uint8 tier,
        bool isSanctioned,
        uint256 deadline
    ) internal {
        // M-2: 输入校验
        if (account == address(0)) revert InvalidAddress();
        if (uint256(tier) > uint256(type(RiskRegistry.RiskTier).max)) revert InvalidTier(tier);

        // H-2: 强制 deadline 校验（不再允许 deadline == 0 跳过）
        if (block.timestamp > deadline) {
            revert DeadlineExpired(deadline, block.timestamp);
        }

        // H-5 FIX: 基于质押的防闪电贷机制 — 使用链特定质押金额
        uint256 minStake = _getMinStakeAmount();
        if (oracleStakes[msg.sender] < minStake) {
            revert InsufficientStake(msg.sender, oracleStakes[msg.sender], minStake);
        }

        // H-04 FIX: 检查最小质押时长，防止闪电贷后立即投票
        if (block.timestamp < stakeTime[msg.sender] + MIN_STAKE_DURATION) {
            revert InsufficientStake(msg.sender, block.timestamp - stakeTime[msg.sender], MIN_STAKE_DURATION);
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
            // H-02 FIX: Enforce updateCooldown before registry update
            if (lastUpdateTime[account] != 0 && block.timestamp - lastUpdateTime[account] < updateCooldown) {
                revert UpdateCooldownActive(account);
            }
            confirmedUpdates[account] = true;

            bytes32[] memory emptyTags = new bytes32[](0);
            // H-1: 不再截断，直接使用 uint8
            // [L-6 FIX] 以确认比例填充置信度（3/5 节点确认 → 60），
            // 替代 registry 内硬编码的 100
            uint8 confidence = uint8(
                (currentConfirmations * 100) / (oracleList.length == 0 ? 1 : oracleList.length)
            );
            riskRegistry.updateRiskProfileWithConfidence(
                account,
                score,
                RiskRegistry.RiskTier(tier),
                emptyTags,
                isSanctioned,
                confidence
            );

            lastUpdateTime[account] = block.timestamp;

            emit MultiOracleUpdateConfirmed(account, responseHash, currentConfirmations);
            emit RiskProfileUpdated(bytes32(0), account, score, tier, isSanctioned);
        }
    }

    /**
     * @notice 重置地址的确认状态
     * @dev C-2 修复: 彻底清理 responseConfirmations
     * @dev M-10 NOTE: 循环受 MAX_ORACLES (50) 上限保护，已在 _addAuthorizedOracle 中强制
     */
    function _resetConfirmations(address account) internal {
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
}
