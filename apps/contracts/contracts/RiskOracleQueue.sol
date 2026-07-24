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
     * @dev P1 FIX: 使用 try/catch 逐笔隔离错误，单条失败不阻断整个批次
     */
    function _processPendingQueue() internal returns (uint256 count, uint256 gasUsed) {
        count = queueCount < batchSize ? queueCount : batchSize;
        if (count == 0) return (0, 0);

        uint256 gasStart = gasleft();
        uint256 successCount = 0;

        for (uint256 i = 0; i < count; i++) {
            uint256 idx = queueHead % maxQueueSize;
            PendingRiskUpdate storage upd = pendingRiskQueue[idx];

            // P1 FIX: try/catch 逐笔隔离，单条失败记录事件并跳过
            try riskRegistry.updateRiskProfile(
                upd.account,
                uint8(upd.score),
                RiskRegistry.RiskTier(upd.tier),
                upd.tags,
                upd.isSanctioned
            ) {
                emit RiskProfileUpdated(bytes32(0), upd.account, uint8(upd.score), upd.tier, upd.isSanctioned);
                successCount++;
            } catch Error(string memory reason) {
                emit BatchQueueItemSkipped(i, upd.account, reason);
            } catch (bytes memory /* lowLevelData */) {
                emit BatchQueueItemSkipped(i, upd.account, "unknown revert");
            }

            queueHead++;
            queueCount--;
        }

        gasUsed = gasStart - gasleft();
        emit BatchUpdateExecuted(successCount, gasUsed);
        count = successCount;
    }
}
