// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RiskOracleStorage.sol";

/**
 * @title RiskOracleQueue
 * @notice RiskOracle 队列管理层 — 风险更新入队与批量处理
 * @dev 继承 RiskOracleStorage，暴露 internal 函数供 RiskOracle 门面调用
 */
abstract contract RiskOracleQueue is RiskOracleStorage {

    /**
     * @notice 入队风险更新（带边界检查）
     * @dev M-1: 强制 maxQueueSize 检查，使用环形缓冲区避免 O(n) shift
     */
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

    /**
     * @notice 批量处理队列中的待更新项
     * @return count 处理数量
     * @return gasUsed 消耗的 gas
     * @dev M-1: 使用环形缓冲区，避免 O(n) shift
     */
    function _processPendingQueue() internal returns (uint256 count, uint256 gasUsed) {
        count = queueCount < batchSize ? queueCount : batchSize;
        if (count == 0) return (0, 0);

        uint256 gasStart = gasleft();
        for (uint256 i = 0; i < count; i++) {
            uint256 idx = queueHead % maxQueueSize;
            PendingRiskUpdate storage upd = pendingRiskQueue[idx];
            bytes32[] memory tags = upd.tags;
            riskRegistry.updateRiskProfile(
                upd.account,
                uint8(upd.score),
                RiskRegistry.RiskTier(upd.tier),
                tags,
                upd.isSanctioned
            );
            emit RiskProfileUpdated(bytes32(0), upd.account, uint8(upd.score), upd.tier, upd.isSanctioned);
            queueHead++;
            queueCount--;
        }

        gasUsed = gasStart - gasleft();
        emit BatchUpdateExecuted(count, gasUsed);
    }
}
