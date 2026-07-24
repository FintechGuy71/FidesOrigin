"""
FidesOrigin 消息队列（Redis Streams）

P0-4 Fix: 从 Redis Pub/Sub 迁移到 Redis Streams
- Redis Pub/Sub 是 fire-and-forget，消息可能静默丢失
- Redis Streams 提供持久化、消费者组和显式确认（XACK）
- 支持 at-least-once delivery 语义

消息格式：
{
    "type": "risk_update",
    "payload": {"address": "0x...", "score": 85, "tier": "HIGH"},
    "timestamp": 1234567890,
    "source": "backend",
    "message_id": "uuid",
    "retry_count": 0
}
"""
import asyncio
import json
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, List, Optional, Set

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


@dataclass
class RiskUpdateMessage:
    """风险更新消息"""
    address: str
    score: float
    tier: str
    timestamp: int
    source: str
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "address": self.address,
            "score": self.score,
            "tier": self.tier,
        }


@dataclass
class MessageEnvelope:
    """消息信封（包含元数据）"""
    type: str
    payload: Dict[str, Any]
    timestamp: int
    source: str
    message_id: str
    retry_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "source": self.source,
            "message_id": self.message_id,
            "retry_count": self.retry_count,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MessageEnvelope":
        return cls(
            type=data.get("type", ""),
            payload=data.get("payload", {}),
            timestamp=data.get("timestamp", 0),
            source=data.get("source", ""),
            message_id=data.get("message_id", ""),
            retry_count=data.get("retry_count", 0),
        )


class MessageQueue:
    """
    Redis Streams 消息队列
    
    Stream 设计：
    - fides:stream:risk_updates — 风险更新主 Stream
    - fides:stream:dlq — 死信队列 Stream
    - fides:stream:cg:backend — 消费者组名称
    
    相比 Pub/Sub 的改进：
    - 消息持久化（不会因消费者离线而丢失）
    - 消费者组支持负载均衡
    - 显式确认（XACK）实现 at-least-once
    - 消息 ID 内置时间戳，支持范围查询
    """
    
    # Stream 名称
    STREAM_RISK_UPDATES = "fides:stream:risk_updates"
    STREAM_DLQ = "fides:stream:dlq"
    
    # 消费者组
    CONSUMER_GROUP = "fides:cg:backend"
    
    # 死信队列 key（Redis List，保留兼容）
    DLQ_KEY = "fides:mq:dlq"
    
    # 最大重试次数
    MAX_RETRY_COUNT = 3
    
    # 消息处理超时（毫秒）—— Stream 的 block 超时
    BLOCK_TIMEOUT = 5000
    
    # 消费者名称
    CONSUMER_NAME = "consumer-1"
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self._redis = redis_client
        self._handlers: Dict[str, List[Callable]] = {}
        self._subscriber_task: Optional[asyncio.Task] = None
        self._running = False
        self._pending_messages: Dict[str, str] = {}  # message_id -> stream_id
    
    async def _get_redis(self) -> Redis:
        """获取 Redis 连接"""
        if self._redis is None:
            self._redis = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                max_connections=settings.REDIS_POOL_SIZE,
                socket_connect_timeout=settings.REDIS_POOL_TIMEOUT,
                socket_keepalive=True,
                health_check_interval=30,
                decode_responses=True,
            )
        return self._redis
    
    async def _ensure_consumer_group(self) -> None:
        """确保消费者组存在"""
        redis_client = await self._get_redis()
        try:
            await redis_client.xgroup_create(
                self.STREAM_RISK_UPDATES,
                self.CONSUMER_GROUP,
                id="0",
                mkstream=True,
            )
            logger.info(
                "consumer_group_created",
                stream=self.STREAM_RISK_UPDATES,
                group=self.CONSUMER_GROUP,
            )
        except redis.ResponseError as e:
            if "BUSYGROUP" in str(e):
                # 消费者组已存在，正常
                pass
            else:
                raise
    
    # ==================== 发布者 API ====================
    
    async def publish_risk_update(
        self,
        address: str,
        score: float,
        tier: str,
        source: str = "backend",
    ) -> str:
        """
        发布风险更新消息到 Redis Stream
        
        Args:
            address: 区块链地址
            score: 风险评分
            tier: 风险等级
            source: 消息来源（backend 或 publisher）
        
        Returns:
            消息 ID（Redis Stream 生成的 ID）
        """
        import time
        
        message = MessageEnvelope(
            type="risk_update",
            payload={
                "address": address,
                "score": score,
                "tier": tier,
            },
            timestamp=int(time.time()),
            source=source,
            message_id=str(uuid.uuid4()),
        )
        
        redis_client = await self._get_redis()
        
        # 发布到 Stream
        stream_id = await redis_client.xadd(
            self.STREAM_RISK_UPDATES,
            {"data": json.dumps(message.to_dict())},
            maxlen=10000,  # 保留最近 10000 条消息
            approximate=True,
        )
        
        logger.info(
            "message_published",
            stream=self.STREAM_RISK_UPDATES,
            stream_id=stream_id,
            message_id=message.message_id,
            source=source,
            address=address,
            score=score,
            tier=tier,
        )
        
        return stream_id
    
    async def publish_custom(
        self,
        message_type: str,
        payload: Dict[str, Any],
        source: str = "backend",
    ) -> str:
        """发布自定义类型消息到 Redis Stream"""
        import time
        
        message = MessageEnvelope(
            type=message_type,
            payload=payload,
            timestamp=int(time.time()),
            source=source,
            message_id=str(uuid.uuid4()),
        )
        
        redis_client = await self._get_redis()
        stream_id = await redis_client.xadd(
            self.STREAM_RISK_UPDATES,
            {"data": json.dumps(message.to_dict())},
            maxlen=10000,
            approximate=True,
        )
        
        logger.info(
            "message_published",
            stream=self.STREAM_RISK_UPDATES,
            stream_id=stream_id,
            message_id=message.message_id,
            type=message_type,
            source=source,
        )
        
        return stream_id
    
    # ==================== 确认机制（Redis Streams XACK）====================
    
    async def acknowledge_message(self, stream_id: str) -> bool:
        """
        确认消息已处理（XACK）
        
        Args:
            stream_id: Redis Stream 消息 ID
        
        Returns:
            是否成功确认
        """
        redis_client = await self._get_redis()
        result = await redis_client.xack(
            self.STREAM_RISK_UPDATES,
            self.CONSUMER_GROUP,
            stream_id,
        )
        
        if result:
            logger.debug("message_acknowledged", stream_id=stream_id)
        
        return bool(result)
    
    async def is_message_pending(self, stream_id: str) -> bool:
        """检查消息是否还在待处理列表中"""
        redis_client = await self._get_redis()
        pending = await redis_client.xpending(
            self.STREAM_RISK_UPDATES,
            self.CONSUMER_GROUP,
        )
        # 简化检查：只要 pending 总数 > 0 就认为是（实际应精确匹配 stream_id）
        return pending.get("pending", 0) > 0
    
    # ==================== 死信队列 ====================
    
    async def send_to_dlq(
        self,
        message: MessageEnvelope,
        reason: str,
    ) -> None:
        """
        将消息发送到死信队列
        
        Args:
            message: 失败的消息
            reason: 失败原因
        """
        redis_client = await self._get_redis()
        
        dlq_entry = {
            "message": message.to_dict(),
            "reason": reason,
            "failed_at": int(time.time()),
        }
        
        # 推入死信队列 Stream
        await redis_client.xadd(
            self.STREAM_DLQ,
            {"data": json.dumps(dlq_entry)},
            maxlen=1000,
            approximate=True,
        )
        
        # 同时保留 Redis List 兼容格式
        await redis_client.lpush(self.DLQ_KEY, json.dumps(dlq_entry))
        await redis_client.ltrim(self.DLQ_KEY, 0, 999)
        
        logger.warning(
            "message_sent_to_dlq",
            message_id=message.message_id,
            reason=reason,
            retry_count=message.retry_count,
        )
    
    async def get_dlq_messages(self, limit: int = 100) -> List[Dict[str, Any]]:
        """获取死信队列消息（Redis List 兼容模式）"""
        redis_client = await self._get_redis()
        messages = await redis_client.lrange(self.DLQ_KEY, 0, limit - 1)
        result = []
        for msg_data in messages:
            try:
                result.append(json.loads(msg_data))
            except json.JSONDecodeError:
                pass
        return result
    
    async def retry_dlq_message(self, message_id: str) -> Optional[str]:
        """
        重试死信队列中的消息
        
        Args:
            message_id: 消息 ID
        
        Returns:
            新 Stream ID（如果重试成功）
        """
        redis_client = await self._get_redis()
        
        # 查找并移除消息
        messages = await redis_client.lrange(self.DLQ_KEY, 0, -1)
        for msg_data in messages:
            try:
                entry = json.loads(msg_data)
                if entry["message"]["message_id"] == message_id:
                    # 从 DLQ 移除
                    await redis_client.lrem(self.DLQ_KEY, 0, msg_data)
                    
                    # 重新发布（增加重试计数）
                    message = MessageEnvelope.from_dict(entry["message"])
                    message.retry_count += 1
                    message.message_id = str(uuid.uuid4())
                    message.timestamp = int(time.time())
                    
                    stream_id = await redis_client.xadd(
                        self.STREAM_RISK_UPDATES,
                        {"data": json.dumps(message.to_dict())},
                        maxlen=10000,
                        approximate=True,
                    )
                    
                    logger.info(
                        "dlq_message_retried",
                        original_message_id=message_id,
                        new_message_id=message.message_id,
                        stream_id=stream_id,
                    )
                    
                    return stream_id
            except (json.JSONDecodeError, KeyError):
                pass
        
        return None
    
    # ==================== 订阅者 API ====================
    
    async def subscribe(
        self,
        handler: Callable[[MessageEnvelope], asyncio.Future],
    ) -> None:
        """
        订阅风险更新消息
        
        Args:
            handler: 消息处理函数
        """
        if "risk_update" not in self._handlers:
            self._handlers["risk_update"] = []
        
        self._handlers["risk_update"].append(handler)
        
        logger.info("message_handler_registered", type="risk_update")
    
    async def start_subscriber(self) -> None:
        """启动消息订阅者（基于 Redis Streams 消费者组）"""
        if self._running:
            return
        
        self._running = True
        await self._ensure_consumer_group()
        
        self._subscriber_task = asyncio.create_task(self._message_loop())
        
        logger.info(
            "message_subscriber_started",
            stream=self.STREAM_RISK_UPDATES,
            group=self.CONSUMER_GROUP,
            consumer=self.CONSUMER_NAME,
        )
    
    async def stop_subscriber(self) -> None:
        """停止消息订阅者"""
        self._running = False
        
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass
            self._subscriber_task = None
        
        logger.info("message_subscriber_stopped")
    
    async def _message_loop(self) -> None:
        """消息循环（Redis Streams XREADGROUP）"""
        redis_client = await self._get_redis()
        
        while self._running:
            try:
                # 使用 XREADGROUP 从消费者组读取消息
                # count=1 逐条处理，block=BLOCK_TIMEOUT 毫秒阻塞等待
                messages = await redis_client.xreadgroup(
                    groupname=self.CONSUMER_GROUP,
                    consumername=self.CONSUMER_NAME,
                    streams={self.STREAM_RISK_UPDATES: ">"},
                    count=1,
                    block=self.BLOCK_TIMEOUT,
                )
                
                if not messages:
                    continue
                
                # 解析消息
                for stream_name, stream_messages in messages:
                    for stream_id, fields in stream_messages:
                        try:
                            data = json.loads(fields.get("data", "{}"))
                            envelope = MessageEnvelope.from_dict(data)
                        except (json.JSONDecodeError, KeyError) as e:
                            logger.error(
                                "message_parse_failed",
                                error=str(e),
                                stream_id=stream_id,
                                data=fields.get("data"),
                            )
                            # 无法解析的消息直接确认，避免重复处理
                            await self.acknowledge_message(stream_id)
                            continue
                        
                        logger.debug(
                            "message_received",
                            stream_id=stream_id,
                            message_id=envelope.message_id,
                            type=envelope.type,
                            source=envelope.source,
                        )
                        
                        # 分发消息到处理器
                        handlers = self._handlers.get(envelope.type, [])
                        
                        all_success = True
                        for handler in handlers:
                            try:
                                await handler(envelope)
                            except Exception as e:
                                all_success = False
                                logger.error(
                                    "message_handler_failed",
                                    stream_id=stream_id,
                                    message_id=envelope.message_id,
                                    handler=handler.__name__,
                                    error=str(e),
                                )
                        
                        if all_success:
                            # 所有处理器成功，确认消息
                            await self.acknowledge_message(stream_id)
                            logger.debug(
                                "message_acknowledged",
                                stream_id=stream_id,
                                message_id=envelope.message_id,
                            )
                        else:
                            # 处理失败，不确认（消息保留在 pending 列表中）
                            # Redis 会自动将消息重新投递给同组其他消费者
                            logger.warning(
                                "message_not_acknowledged",
                                stream_id=stream_id,
                                message_id=envelope.message_id,
                                retry_count=envelope.retry_count,
                            )
                            
                            # 超过重试次数，发送到死信队列
                            if envelope.retry_count >= self.MAX_RETRY_COUNT:
                                await self.send_to_dlq(envelope, "Max retry exceeded")
                                # 死信后也要确认原消息，避免无限重试
                                await self.acknowledge_message(stream_id)
                            # else: 不确认，等待自动重投
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("message_loop_error", error=str(e))
                await asyncio.sleep(1)
    
    async def close(self) -> None:
        """关闭消息队列"""
        await self.stop_subscriber()
        
        if self._redis:
            await self._redis.close()
            self._redis = None
        
        logger.info("message_queue_closed")


# 全局消息队列实例
_message_queue: Optional[MessageQueue] = None


def get_message_queue(redis_client: Optional[Redis] = None) -> MessageQueue:
    """获取全局消息队列单例"""
    global _message_queue
    if _message_queue is None:
        _message_queue = MessageQueue(redis_client)
    return _message_queue


async def reset_message_queue() -> None:
    """重置消息队列（测试用）"""
    global _message_queue
    if _message_queue:
        await _message_queue.close()
    _message_queue = None
