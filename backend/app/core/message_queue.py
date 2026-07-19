"""
FidesOrigin 消息队列（Redis Pub/Sub）

P1-2 Fix: 引入消息队列，统一 backend 和 data-publisher 通信
- 使用 Redis Pub/Sub 作为轻量级消息队列（不引入新依赖）
- 支持消息确认机制（at-least-once delivery）
- 支持死信队列（处理失败的消息）
- backend 发布消息，publisher 订阅并处理

消息格式：
{
    "type": "risk_update",
    "payload": {"address": "0x...", "score": 85, "tier": "HIGH"},
    "timestamp": 1234567890,
    "source": "backend",  // 或 "publisher"
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
    Redis Pub/Sub 消息队列
    
    频道设计：
    - fides:mq:risk_updates — 风险更新主频道
    - fides:mq:ack — 消息确认频道
    - fides:mq:dlq — 死信队列
    """
    
    # 频道名称
    CHANNEL_RISK_UPDATES = "fides:mq:risk_updates"
    CHANNEL_ACK = "fides:mq:ack"
    
    # 死信队列 key（Redis List）
    DLQ_KEY = "fides:mq:dlq"
    
    # 消息处理中集合（用于 at-least-once）
    INFLIGHT_KEY = "fides:mq:inflight"
    
    # 最大重试次数
    MAX_RETRY_COUNT = 3
    
    # 消息处理超时（秒）
    MESSAGE_TIMEOUT = 60
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self._redis = redis_client
        self._pubsub: Optional[redis.client.PubSub] = None
        self._handlers: Dict[str, List[Callable]] = {}
        self._subscriber_task: Optional[asyncio.Task] = None
        self._running = False
    
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
    
    # ==================== 发布者 API ====================
    
    async def publish_risk_update(
        self,
        address: str,
        score: float,
        tier: str,
        source: str = "backend",
    ) -> str:
        """
        发布风险更新消息
        
        Args:
            address: 区块链地址
            score: 风险评分
            tier: 风险等级
            source: 消息来源（backend 或 publisher）
        
        Returns:
            消息 ID
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
        
        # 发布到主频道
        await redis_client.publish(
            self.CHANNEL_RISK_UPDATES,
            json.dumps(message.to_dict()),
        )
        
        # 同时存入 inflight 集合（用于确认机制）
        await redis_client.hset(
            self.INFLIGHT_KEY,
            message.message_id,
            json.dumps(message.to_dict()),
        )
        # 设置 inflight 过期时间
        await redis_client.expire(self.INFLIGHT_KEY, self.MESSAGE_TIMEOUT * 2)
        
        logger.info(
            "message_published",
            channel=self.CHANNEL_RISK_UPDATES,
            message_id=message.message_id,
            source=source,
            address=address,
            score=score,
            tier=tier,
        )
        
        return message.message_id
    
    async def publish_custom(
        self,
        message_type: str,
        payload: Dict[str, Any],
        source: str = "backend",
    ) -> str:
        """发布自定义类型消息"""
        import time
        
        message = MessageEnvelope(
            type=message_type,
            payload=payload,
            timestamp=int(time.time()),
            source=source,
            message_id=str(uuid.uuid4()),
        )
        
        redis_client = await self._get_redis()
        await redis_client.publish(
            self.CHANNEL_RISK_UPDATES,
            json.dumps(message.to_dict()),
        )
        
        logger.info(
            "message_published",
            channel=self.CHANNEL_RISK_UPDATES,
            message_id=message.message_id,
            type=message_type,
            source=source,
        )
        
        return message.message_id
    
    # ==================== 确认机制 ====================
    
    async def acknowledge_message(self, message_id: str) -> bool:
        """
        确认消息已处理
        
        Args:
            message_id: 消息 ID
        
        Returns:
            是否成功确认
        """
        redis_client = await self._get_redis()
        
        # 从 inflight 中移除
        result = await redis_client.hdel(self.INFLIGHT_KEY, message_id)
        
        if result:
            logger.debug("message_acknowledged", message_id=message_id)
        
        return bool(result)
    
    async def is_message_inflight(self, message_id: str) -> bool:
        """检查消息是否还在处理中"""
        redis_client = await self._get_redis()
        exists = await redis_client.hexists(self.INFLIGHT_KEY, message_id)
        return bool(exists)
    
    async def get_inflight_messages(self) -> List[Dict[str, Any]]:
        """获取所有正在处理中的消息"""
        redis_client = await self._get_redis()
        messages = await redis_client.hgetall(self.INFLIGHT_KEY)
        result = []
        for msg_data in messages.values():
            try:
                result.append(json.loads(msg_data))
            except json.JSONDecodeError:
                pass
        return result
    
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
        
        # 推入死信队列（Redis List）
        await redis_client.lpush(self.DLQ_KEY, json.dumps(dlq_entry))
        # 设置死信队列最大长度（保留最近 1000 条）
        await redis_client.ltrim(self.DLQ_KEY, 0, 999)
        
        logger.warning(
            "message_sent_to_dlq",
            message_id=message.message_id,
            reason=reason,
            retry_count=message.retry_count,
        )
    
    async def get_dlq_messages(self, limit: int = 100) -> List[Dict[str, Any]]:
        """获取死信队列消息"""
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
            新消息 ID（如果重试成功）
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
                    
                    await redis_client.publish(
                        self.CHANNEL_RISK_UPDATES,
                        json.dumps(message.to_dict()),
                    )
                    
                    logger.info(
                        "dlq_message_retried",
                        original_message_id=message_id,
                        new_message_id=message.message_id,
                    )
                    
                    return message.message_id
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
        """启动消息订阅者"""
        if self._running:
            return
        
        self._running = True
        redis_client = await self._get_redis()
        self._pubsub = redis_client.pubsub()
        await self._pubsub.subscribe(self.CHANNEL_RISK_UPDATES)
        
        self._subscriber_task = asyncio.create_task(self._message_loop())
        
        logger.info("message_subscriber_started", channel=self.CHANNEL_RISK_UPDATES)
    
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
        
        if self._pubsub:
            await self._pubsub.unsubscribe(self.CHANNEL_RISK_UPDATES)
            await self._pubsub.close()
            self._pubsub = None
        
        logger.info("message_subscriber_stopped")
    
    async def _message_loop(self) -> None:
        """消息循环"""
        while self._running:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                
                if message is None:
                    continue
                
                if message["type"] != "message":
                    continue
                
                # 解析消息
                try:
                    data = json.loads(message["data"])
                    envelope = MessageEnvelope.from_dict(data)
                except (json.JSONDecodeError, KeyError) as e:
                    logger.error("message_parse_failed", error=str(e), data=message.get("data"))
                    continue
                
                logger.debug(
                    "message_received",
                    message_id=envelope.message_id,
                    type=envelope.type,
                    source=envelope.source,
                )
                
                # 分发消息到处理器
                handlers = self._handlers.get(envelope.type, [])
                
                for handler in handlers:
                    try:
                        await handler(envelope)
                    except Exception as e:
                        logger.error(
                            "message_handler_failed",
                            message_id=envelope.message_id,
                            handler=handler.__name__,
                            error=str(e),
                        )
                        
                        # 超过重试次数，发送到死信队列
                        if envelope.retry_count >= self.MAX_RETRY_COUNT:
                            await self.send_to_dlq(envelope, str(e))
                        else:
                            # 重试：重新发布消息（增加 retry_count）
                            envelope.retry_count += 1
                            redis_client = await self._get_redis()
                            await redis_client.publish(
                                self.CHANNEL_RISK_UPDATES,
                                json.dumps(envelope.to_dict()),
                            )
                            
                            logger.info(
                                "message_queued_for_retry",
                                message_id=envelope.message_id,
                                retry_count=envelope.retry_count,
                            )
            
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
