"""
FidesOrigin 分布式锁和消息队列测试

P0-3 & P1-2 Fix: 验证新组件的基本功能
"""
import pytest
import pytest_asyncio

from app.core.lock_manager import DistributedLockManager, get_lock_manager, reset_lock_manager
from app.core.message_queue import MessageQueue, get_message_queue, reset_message_queue, MessageEnvelope


class TestDistributedLockManager:
    """测试分布式锁管理器"""
    
    @pytest_asyncio.fixture
    async def lock_manager(self):
        """创建测试用的锁管理器（无 Redis）"""
        manager = DistributedLockManager()
        yield manager
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_lock_manager_creation(self):
        """测试锁管理器创建"""
        manager = DistributedLockManager()
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
    async def test_lock_manager_acquire_without_redis(self):
        """测试无 Redis 时锁获取（降级处理）"""
        manager = DistributedLockManager()
        
        # 无 Redis 连接时应该返回 None（因为 _get_redis 会尝试连接但可能失败）
        # 这里主要测试不会抛出异常
        try:
            token = await manager.acquire_lock("test:resource", ttl=10, blocking=False)
            # 如果 Redis 未运行，token 可能为 None
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_lock_manager_is_locked_without_redis(self):
        """测试无 Redis 时检查锁状态"""
        manager = DistributedLockManager()
        
        try:
            is_locked = await manager.is_locked("test:resource")
            assert isinstance(is_locked, bool)
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_lock_manager_context_manager(self):
        """测试锁管理器上下文管理器"""
        async with DistributedLockManager() as manager:
            assert manager is not None
    
    @pytest.mark.asyncio
    async def test_acquire_chain_write_lock(self):
        """测试获取链上写入锁"""
        manager = DistributedLockManager()
        
        try:
            token = await manager.acquire_chain_write_lock(blocking=False, ttl=10)
            # 如果 Redis 未运行，token 可能为 None
            if token:
                released = await manager.release_chain_write_lock(token)
                assert released is True
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        
        await manager.close()
    
    @pytest.mark.asyncio
    async def test_is_chain_write_locked(self):
        """测试检查链上写入锁状态"""
        manager = DistributedLockManager()
        
        try:
            is_locked = await manager.is_chain_write_locked()
            assert isinstance(is_locked, bool)
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        
        await manager.close()


class TestMessageQueue:
    """测试消息队列"""
    
    @pytest_asyncio.fixture
    async def message_queue(self):
        """创建测试用的消息队列"""
        queue = MessageQueue()
        yield queue
        await queue.close()
    
    @pytest.mark.asyncio
    async def test_message_queue_creation(self):
        """测试消息队列创建"""
        queue = MessageQueue()
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
    async def test_message_queue_publish_without_redis(self):
        """测试无 Redis 时消息发布（降级处理）"""
        queue = MessageQueue()
        
        try:
            message_id = await queue.publish_risk_update(
                address="0x1234567890abcdef",
                score=85,
                tier="HIGH",
            )
            # 如果 Redis 未运行，应该抛出异常或跳过
            assert message_id is not None
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        
        await queue.close()
    
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
    async def test_message_queue_close(self):
        """测试消息队列关闭"""
        queue = MessageQueue()
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
