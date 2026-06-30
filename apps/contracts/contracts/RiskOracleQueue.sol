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
     * @dev M-1: 强制 maxQueueSize 检查
     */
    function _enqueueRiskUpdate(PendingRiskUpdate memory upd) internal {
        if (pendingRiskQueue.length >= maxQueueSize) revert QueueFull();
        pendingRiskQueue.push(upd);
        emit QueuedRiskUpdate(upd.account, upd.score);
    }

    /**
     * @notice 批量处理队列中的待更新项
     * @return count 处理数量
     * @return gasUsed 消耗的 gas
     */
    function _processPendingQueue() internal returns (uint256 count, uint256 gasUsed) {
        count = pendingRiskQueue.length < batchSize ? pendingRiskQueue.length : batchSize;
        if (count == 0) return (0, 0);

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

        // GAS-03: Shift remaining elements. For large queues, consider using a mapping-based circular buffer.
        // Current implementation is O(n) per batch, acceptable for batchSize <= 10.
        for (uint256 i = 0; i < pendingRiskQueue.length - count; i++) {
            pendingRiskQueue[i] = pendingRiskQueue[i + count];
        }
        for (uint256 i = 0; i < count; i++) {
            pendingRiskQueue.pop();
        }

        gasUsed = gasStart - gasleft();
        emit BatchUpdateExecuted(count, gasUsed);
    }
}
