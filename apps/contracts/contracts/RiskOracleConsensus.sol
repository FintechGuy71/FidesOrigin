// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RiskOracleStorage.sol";

/**
 * @title RiskOracleConsensus
 * @notice RiskOracle 共识层 — 多预言机投票、确认计数、响应管理
 * @dev 继承 RiskOracleStorage，暴露 internal 函数供 RiskOracle 门面调用
 */
abstract contract RiskOracleConsensus is RiskOracleStorage {

    /**
     * @notice 添加授权预言机
     */
    function _addAuthorizedOracle(address oracle) internal {
        if (oracle == address(0)) revert InvalidAddress();
        if (authorizedOracles[oracle]) return;

        authorizedOracles[oracle] = true;
        oracleList.push(oracle);

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
     * @notice 提交预言机响应（多预言机冗余）
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
            // H-02 FIX: Enforce updateCooldown before registry update
            if (lastUpdateTime[account] != 0 && block.timestamp - lastUpdateTime[account] < updateCooldown) {
                revert UpdateCooldownActive(account);
            }
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
