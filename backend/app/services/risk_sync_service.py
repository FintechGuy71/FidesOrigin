"""
FidesOrigin 风险同步服务（Risk Sync Service）

P0-3 Fix: 统一 data-publisher 和 backend 职责边界
- backend 负责计算风险评分，通过消息队列通知 publisher
- 只有在 publisher 不可用时，backend 才直接写入链上（降级模式）
- 使用分布式锁防止与 publisher 同时写入链上

P1-2 Fix: 引入消息队列
- backend 发布 risk_update 消息到 Redis Pub/Sub
- publisher 订阅并处理消息
- 消息确认机制确保 at-least-once delivery
"""
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import redis.asyncio as redis
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.exceptions import RiskCalculationException
from app.core.lock_manager import DistributedLockManager, get_lock_manager
from app.core.logging import get_logger
from app.core.message_queue import MessageQueue, get_message_queue
from app.models import AddressRisk, RiskLevel
from app.repositories.address_repository import AddressRepository
from app.services.alert_service import AlertService
from app.services.cache_service import CacheService

logger = get_logger(__name__)
settings = get_settings()


class RiskSyncService:
    """
    风险同步服务
    
    职责：
    1. 将 backend 计算的风险评分同步到链上
    2. 优先使用消息队列通知 publisher 写入
    3. 当 publisher 不可用时，使用分布式锁降级直接写入
    4. 只读模式：当 publisher 正在写入时，backend 只读取链上数据
    
    使用场景：
    - 高风险地址需要立即上链
    - publisher 离线时的降级写入
    - 批量同步地址风险数据
    """
    
    def __init__(
        self,
        db: AsyncSession,
        cache: CacheService,
        alert: AlertService,
        address_repo: AddressRepository,
        lock_manager: Optional[DistributedLockManager] = None,
        message_queue: Optional[MessageQueue] = None,
    ):
        self.db = db
        self.cache = cache
        self.alert = alert
        self.address_repo = address_repo
        self.lock_manager = lock_manager or get_lock_manager()
        self.message_queue = message_queue or get_message_queue()
    
    async def sync_risk_to_chain(
        self,
        address: str,
        score: float,
        tier: RiskLevel,
        force_direct: bool = False,
    ) -> Dict[str, Any]:
        """
        同步单个地址风险到链上
        
        P0-3 Fix: 优先使用消息队列，避免直接写入链上
        P1-2 Fix: 通过消息队列通知 publisher 处理
        
        Args:
            address: 区块链地址
            score: 风险评分
            tier: 风险等级
            force_direct: 是否强制直接写入（降级模式）
        
        Returns:
            同步结果
        """
        result = {
            "address": address,
            "score": score,
            "tier": tier.value,
            "method": "queue",
            "success": True,
            "message_id": None,
            "error": None,
        }
        
        if not force_direct:
            # P1-2 Fix: 优先使用消息队列
            try:
                message_id = await self.message_queue.publish_risk_update(
                    address=address,
                    score=score,
                    tier=tier.value,
                    source="backend",
                )
                
                result["message_id"] = message_id
                result["method"] = "queue"
                
                logger.info(
                    "risk_update_queued",
                    address=address,
                    score=score,
                    tier=tier.value,
                    message_id=message_id,
                )
                
                return result
            
            except Exception as e:
                logger.warning(
                    "queue_publish_failed",
                    address=address,
                    error=str(e),
                    fallback="direct_write",
                )
                # 消息队列失败，降级到直接写入
        
        # P0-3 Fix: 降级直接写入链上，使用分布式锁
        return await self._direct_write_to_chain(address, score, tier)
    
    async def _direct_write_to_chain(
        self,
        address: str,
        score: float,
        tier: RiskLevel,
    ) -> Dict[str, Any]:
        """
        直接写入链上（降级模式）
        
        P0-3 Fix: 使用分布式锁确保独占写入
        - 如果 publisher 正在写入，backend 等待或跳过
        - 锁过期后自动释放，防止死锁
        """
        result = {
            "address": address,
            "score": score,
            "tier": tier.value,
            "method": "direct_write",
            "success": False,
            "lock_acquired": False,
            "error": None,
        }
        
        # 尝试获取链上写入锁
        lock_token = await self.lock_manager.acquire_chain_write_lock(
            blocking=True,
            blocking_timeout=30.0,
            ttl=30,
        )
        
        if not lock_token:
            # 获取锁失败，publisher 正在写入
            result["error"] = "Chain write lock not acquired — publisher is writing. Skipping direct write."
            logger.warning(
                "direct_write_skipped_locked",
                address=address,
                reason="publisher_is_writing",
            )
            
            # 发送告警通知
            await self.alert.send_alert(
                alert_type="chain_write_skipped",
                message=f"链上写入被跳过：publisher 正在写入",
                details={"address": address, "score": score, "tier": tier.value},
            )
            
            return result
        
        result["lock_acquired"] = True
        
        try:
            # P0-3 Fix: 持有锁期间执行链上写入
            # 注意：这里是一个模拟实现，实际链上写入需要 Web3 连接
            # 在实际环境中，这里会调用合约的 updateRiskProfile 方法
            
            logger.info(
                "direct_write_start",
                address=address,
                score=score,
                tier=tier.value,
                lock_token=lock_token[:20] + "...",
            )
            
            # 模拟链上写入（实际项目中替换为真实合约调用）
            # tx_hash = await self._call_contract_update(address, score, tier)
            
            await asyncio.sleep(0.1)  # 模拟链上写入耗时
            
            result["success"] = True
            result["tx_hash"] = "simulated_tx_hash"  # 实际替换为真实交易哈希
            
            logger.info(
                "direct_write_complete",
                address=address,
                score=score,
                tier=tier.value,
            )
            
        except Exception as e:
            result["error"] = str(e)
            result["success"] = False
            
            logger.error(
                "direct_write_failed",
                address=address,
                score=score,
                tier=tier.value,
                error=str(e),
            )
            
            await self.alert.send_alert(
                alert_type="chain_write_failed",
                message=f"链上写入失败: {address}",
                details={"address": address, "score": score, "tier": tier.value},
                exc=e,
            )
        
        finally:
            # P0-3 Fix: 确保锁被释放（即使写入失败）
            released = await self.lock_manager.release_chain_write_lock(lock_token)
            if not released:
                logger.warning(
                    "lock_release_failed_or_expired",
                    address=address,
                )
        
        return result
    
    async def sync_batch_to_chain(
        self,
        addresses: List[Tuple[str, float, RiskLevel]],
        force_direct: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        批量同步地址风险到链上
        
        Args:
            addresses: [(address, score, tier), ...]
            force_direct: 是否强制直接写入
        
        Returns:
            每个地址的同步结果
        """
        results = []
        
        for address, score, tier in addresses:
            try:
                result = await self.sync_risk_to_chain(address, score, tier, force_direct)
                results.append(result)
            except Exception as e:
                logger.error(
                    "batch_sync_item_failed",
                    address=address,
                    error=str(e),
                )
                results.append({
                    "address": address,
                    "score": score,
                    "tier": tier.value,
                    "success": False,
                    "error": str(e),
                })
            
            #  rate limiting between items
            await asyncio.sleep(0.1)
        
        return results
    
    async def check_chain_sync_status(
        self,
        address: str,
    ) -> Dict[str, Any]:
        """
        检查地址的链上同步状态
        
        P0-3 Fix: 只读模式检查
        - 当 publisher 正在写入时，backend 只读取链上数据
        - 不获取锁，只检查链上状态
        """
        result = {
            "address": address,
            "chain_synced": False,
            "chain_score": None,
            "chain_tier": None,
            "last_synced_at": None,
            "publisher_writing": False,
        }
        
        # 检查 publisher 是否正在写入
        is_locked = await self.lock_manager.is_chain_write_locked()
        result["publisher_writing"] = is_locked
        
        if is_locked:
            logger.info(
                "chain_status_read_only",
                address=address,
                reason="publisher_is_writing",
            )
        
        # 读取链上数据（只读，不获取锁）
        # 注意：这里是一个模拟实现，实际项目中替换为真实合约调用
        # chain_data = await self._call_contract_get_profile(address)
        
        # 模拟链上数据
        result["chain_score"] = None
        result["chain_tier"] = None
        result["last_synced_at"] = None
        
        return result
    
    async def get_pending_sync_count(self) -> int:
        """获取待同步的地址数量"""
        # 查询数据库中需要同步的高风险地址
        # 实际实现根据业务逻辑调整
        return 0
    
    async def handle_message_queue_update(
        self,
        address: str,
        score: float,
        tier: str,
    ) -> None:
        """
        处理消息队列中的风险更新确认
        
        P1-2 Fix: 当 publisher 处理完消息后，backend 更新本地状态
        """
        logger.info(
            "message_queue_update_confirmed",
            address=address,
            score=score,
            tier=tier,
        )
        
        # 更新本地数据库状态
        await self.address_repo.create_or_update(
            address=address,
            chain="ethereum",
            risk_score=score,
            risk_level=tier,
        )
        
        # 清除缓存
        cache_key = self.cache.risk_key(address, "ethereum")
        await self.cache.delete(cache_key)
        
        logger.info(
            "local_state_updated_after_queue_sync",
            address=address,
            score=score,
            tier=tier,
        )
    
    async def close(self) -> None:
        """关闭服务"""
        await self.lock_manager.close()
        await self.message_queue.close()
        logger.info("risk_sync_service_closed")


# 工厂函数
def get_risk_sync_service(
    db: AsyncSession,
    cache: CacheService,
    alert: AlertService,
    address_repo: AddressRepository,
) -> RiskSyncService:
    """获取风险同步服务实例"""
    return RiskSyncService(
        db=db,
        cache=cache,
        alert=alert,
        address_repo=address_repo,
    )
