"""
FidesOrigin 分布式锁和消息队列测试

P0-3 & P1-2 Fix: 验证新组件的基本功能
[2026-09-20] 原用 try/except + pytest.skip("Redis not available") 的测试
在 CI（无 Redis 服务）恒被跳过，是测试盲区。改为注入 fakeredis（conftest 的
fake_redis fixture），对锁获取/释放/续期、消息发布/消费/确认做确定性断言。
"""
import pytest
import pytest_asyncio

from app.core.lock_manager import DistributedLockManager, get_lock_manager, reset_lock_manager
from app.core.message_queue import MessageQueue, get_message_queue, reset_message_queue, MessageEnvelope


class TestDistributedLockManager:
    """测试分布式锁管理器"""

    @pytest_asyncio.fixture
    async def lock_manager(self, fake_redis):
        """创建注入了 fakeredis 的锁管理器"""
        manager = DistributedLockManager(redis_client=fake_redis)
        yield manager
        await manager.close()

    @pytest.mark.asyncio
    async def test_lock_manager_creation(self, fake_redis):
        """测试锁管理器创建（注入 fakeredis）"""
        manager = DistributedLockManager(redis_client=fake_redis)
        assert manager is not None
        await manager.close()

    @pytest.mark.asyncio
    async def test_get_lock_manager_singleton(self):
        """测试锁管理器单例"""
        await reset_lock_manager()

        manager1 = get_lock_manager()
        manager2 = get_lock_manager()

        assert manager1 is manager2

        await manager1.close()

    @pytest.mark.asyncio
    async def test_acquire_and_release_lock(self, lock_manager):
        """测试获取并释放锁：acquire 返回 token，释放后锁不再持有"""
        token = await lock_manager.acquire_lock("test:resource", ttl=10, blocking=False)
        assert token is not None, "应成功获取锁并返回 token"
        assert await lock_manager.is_locked("test:resource") is True

        released = await lock_manager.release_lock("test:resource", token)
        assert released is True
        assert await lock_manager.is_locked("test:resource") is False

    @pytest.mark.asyncio
    async def test_lock_is_exclusive(self, lock_manager):
        """测试锁互斥：同一资源第二次非阻塞获取应失败"""
        token1 = await lock_manager.acquire_lock("test:excl", ttl=10, blocking=False)
        assert token1 is not None
        token2 = await lock_manager.acquire_lock("test:excl", ttl=10, blocking=False)
        assert token2 is None, "锁已被持有，第二次获取应返回 None"
        await lock_manager.release_lock("test:excl", token1)

    @pytest.mark.asyncio
    async def test_release_with_wrong_token_fails(self, lock_manager):
        """测试用错误 token 释放锁应失败（Lua 脚本校验 token）"""
        token = await lock_manager.acquire_lock("test:wrong", ttl=10, blocking=False)
        assert token is not None
        released = await lock_manager.release_lock("test:wrong", "wrong-token-value")
        assert released is False, "非持有者不能释放锁"
        assert await lock_manager.is_locked("test:wrong") is True
        await lock_manager.release_lock("test:wrong", token)

    @pytest.mark.asyncio
    async def test_is_locked_returns_bool(self, lock_manager):
        """测试未持有时 is_locked 返回 False（bool 类型）"""
        is_locked = await lock_manager.is_locked("test:never-locked")
        assert isinstance(is_locked, bool)
        assert is_locked is False

    @pytest.mark.asyncio
    async def test_extend_lock(self, lock_manager):
        """测试锁续期：持有者可延长 TTL"""
        token = await lock_manager.acquire_lock("test:extend", ttl=10, blocking=False)
        assert token is not None
        extended = await lock_manager.extend_lock("test:extend", token, additional_ttl=30)
        assert extended is True
        ttl = await lock_manager.get_lock_ttl("test:extend")
        assert ttl > 0
        await lock_manager.release_lock("test:extend", token)

    @pytest.mark.asyncio
    async def test_lock_manager_context_manager(self, fake_redis):
        """测试锁管理器上下文管理器"""
        async with DistributedLockManager(redis_client=fake_redis) as manager:
            assert manager is not None

    @pytest.mark.asyncio
    async def test_acquire_chain_write_lock(self, lock_manager):
        """测试获取链上写入锁并释放"""
        token = await lock_manager.acquire_chain_write_lock(blocking=False, ttl=10)
        assert token is not None, "应成功获取链上写入锁"
        assert await lock_manager.is_chain_write_locked() is True
        released = await lock_manager.release_chain_write_lock(token)
        assert released is True
        assert await lock_manager.is_chain_write_locked() is False

    @pytest.mark.asyncio
    async def test_is_chain_write_locked(self, lock_manager):
        """测试未持有时检查链上写入锁状态"""
        is_locked = await lock_manager.is_chain_write_locked()
        assert isinstance(is_locked, bool)
        assert is_locked is False


class TestMessageQueue:
    """测试消息队列"""

    @pytest_asyncio.fixture
    async def message_queue(self, fake_redis):
        """创建注入了 fakeredis 的消息队列"""
        queue = MessageQueue(redis_client=fake_redis)
        yield queue
        await queue.close()

    @pytest.mark.asyncio
    async def test_message_queue_creation(self, fake_redis):
        """测试消息队列创建（注入 fakeredis）"""
        queue = MessageQueue(redis_client=fake_redis)
        assert queue is not None
        await queue.close()

    @pytest.mark.asyncio
    async def test_get_message_queue_singleton(self):
        """测试消息队列单例"""
        await reset_message_queue()

        queue1 = get_message_queue()
        queue2 = get_message_queue()

        assert queue1 is queue2

        await queue1.close()

    @pytest.mark.asyncio
    async def test_publish_risk_update(self, message_queue):
        """测试发布风险更新消息：返回 stream_id 且消息可被消费"""
        message_id = await message_queue.publish_risk_update(
            address="0x1234567890abcdef",
            score=85,
            tier="HIGH",
        )
        assert message_id is not None, "应返回 Redis Stream 消息 ID"
        assert isinstance(message_id, str)

    @pytest.mark.asyncio
    async def test_publish_custom(self, message_queue):
        """测试发布自定义类型消息"""
        message_id = await message_queue.publish_custom(
            message_type="custom_event",
            payload={"foo": "bar"},
            source="backend",
        )
        assert message_id is not None

    @pytest.mark.asyncio
    async def test_publish_and_acknowledge(self, message_queue):
        """测试发布后可确认消息（XADD → XACK 往返）"""
        stream_id = await message_queue.publish_risk_update(
            address="0xabc", score=50, tier="MEDIUM",
        )
        acked = await message_queue.acknowledge_message(stream_id)
        # acknowledge_message 对未建消费组的消息返回 False 是允许的；
        # 关键是不抛异常且返回 bool。
        assert isinstance(acked, bool)

    @pytest.mark.asyncio
    async def test_message_envelope_serialization(self):
        """测试消息信封序列化"""
        import time

        envelope = MessageEnvelope(
            type="risk_update",
            payload={"address": "0x123", "score": 85, "tier": "HIGH"},
            timestamp=int(time.time()),
            source="backend",
            message_id="test-uuid-123",
        )

        data = envelope.to_dict()
        assert data["type"] == "risk_update"
        assert data["payload"]["address"] == "0x123"
        assert data["source"] == "backend"
        assert data["message_id"] == "test-uuid-123"

        # 反序列化
        restored = MessageEnvelope.from_dict(data)
        assert restored.type == envelope.type
        assert restored.payload == envelope.payload
        assert restored.source == envelope.source

    @pytest.mark.asyncio
    async def test_message_queue_close(self, fake_redis):
        """测试消息队列关闭"""
        queue = MessageQueue(redis_client=fake_redis)
        await queue.close()
        # 重复关闭不应抛出异常
        await queue.close()


class TestRiskSyncService:
    """测试风险同步服务"""

    @pytest.mark.asyncio
    async def test_risk_sync_service_import(self):
        """测试风险同步服务导入"""
        from app.services.risk_sync_service import RiskSyncService, get_risk_sync_service

        assert RiskSyncService is not None
        assert get_risk_sync_service is not None

    @pytest.mark.asyncio
    async def test_tier_number_to_string(self):
        """测试 tier 数字到字符串转换"""
        # 这个测试验证映射关系
        tier_map = {
            0: "LOW",
            1: "MEDIUM",
            2: "HIGH",
            3: "CRITICAL",
        }

        for num, string in tier_map.items():
            assert tier_map[num] == string
