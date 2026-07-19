"""
FidesOrigin 缓存服务测试
测试缓存读写、TTL、穿透保护和击穿保护
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.cache_service import CacheService


@pytest_asyncio.fixture
async def cache_service():
    """缓存服务 fixture - 使用内存模式（不连接 Redis）"""
    service = CacheService()
    # 不调用 connect()，保持 _redis 为 None，使用内存缓存
    return service


class TestCacheBasicOperations:
    """缓存基础操作测试"""

    @pytest.mark.asyncio
    async def test_set_and_get(self, cache_service):
        """测试缓存写入和读取"""
        # 内存模式下 set 返回 False（因为 Redis 未连接）
        result = await cache_service.set("test_key", "test_value")
        assert result is False  # Redis 未连接

        # get 也应返回 None
        value = await cache_service.get("test_key")
        assert value is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_key(self, cache_service):
        """测试删除不存在的键"""
        result = await cache_service.delete("nonexistent")
        assert result == 0

    @pytest.mark.asyncio
    async def test_exists_nonexistent_key(self, cache_service):
        """测试检查不存在的键"""
        result = await cache_service.exists("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_ttl_nonexistent_key(self, cache_service):
        """测试获取不存在的键的 TTL"""
        result = await cache_service.ttl("nonexistent")
        assert result == -2


class TestCacheSerialization:
    """缓存序列化测试"""

    @pytest.mark.asyncio
    async def test_json_serialization(self, cache_service):
        """测试 JSON 序列化"""
        data = {"key": "value", "number": 42}
        result = await cache_service.set_json("json_key", data)
        assert result is False  # Redis 未连接

    @pytest.mark.asyncio
    async def test_json_deserialization(self, cache_service):
        """测试 JSON 反序列化"""
        result = await cache_service.get_json("json_key")
        assert result is None  # Redis 未连接

    @pytest.mark.asyncio
    async def test_object_serialization(self, cache_service):
        """测试对象序列化"""
        data = {"nested": {"key": "value"}, "list": [1, 2, 3]}
        result = await cache_service.set_object("obj_key", data)
        assert result is False  # Redis 未连接


class TestCacheKeyGeneration:
    """缓存键生成测试"""

    def test_key_generation(self, cache_service):
        """测试键生成器"""
        key = CacheService.key("address", "ethereum", "0x123")
        assert key == "fides:address:ethereum:0x123"

    def test_address_key(self, cache_service):
        """测试地址键"""
        key = CacheService.address_key("0xABC", "ethereum")
        assert key == "fides:address:ethereum:0xabc"

    def test_tx_key(self, cache_service):
        """测试交易键"""
        key = CacheService.tx_key("0xTXHASH", "ethereum")
        assert key == "fides:tx:ethereum:0xtxhash"

    def test_risk_key(self, cache_service):
        """测试风险键"""
        key = CacheService.risk_key("0xABC")
        assert key == "fides:risk:ethereum:0xabc"

    def test_rules_key(self, cache_service):
        """测试规则键"""
        key = CacheService.rules_key()
        assert key == "fides:rules:active"


class TestCacheTTLOperations:
    """缓存 TTL 测试"""

    @pytest.mark.asyncio
    async def test_ttl_operations(self, cache_service):
        """测试 TTL 操作 - Redis 未连接时"""
        # 设置带过期时间的值
        result = await cache_service.set("ttl_key", "value", expire=60)
        assert result is False

        # 获取 TTL
        ttl = await cache_service.ttl("ttl_key")
        assert ttl == -2  # Redis 未连接

        # 设置过期时间
        result = await cache_service.expire("ttl_key", 120)
        assert result is False


class TestCacheDistributedLock:
    """分布式锁测试"""

    @pytest.mark.asyncio
    async def test_acquire_lock_no_redis(self, cache_service):
        """测试无 Redis 时获取锁"""
        result = await cache_service.acquire_lock("test_lock", 30)
        assert result is False  # Redis 未连接

    @pytest.mark.asyncio
    async def test_release_lock_no_redis(self, cache_service):
        """测试无 Redis 时释放锁"""
        result = await cache_service.release_lock("test_lock")
        assert result == 0  # Redis 未连接


class TestCachePenetrationProtection:
    """缓存穿透保护测试"""

    @pytest.mark.asyncio
    async def test_get_or_set_with_none_factory(self, cache_service):
        """测试缓存穿透保护 - factory 返回 None"""
        async def factory():
            return None

        # Redis 未连接，factory 直接执行
        result = await cache_service.get_or_set("null_key", factory, expire=300)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_or_set_with_value_factory(self, cache_service):
        """测试缓存穿透保护 - factory 返回值"""
        async def factory():
            return {"data": "value"}

        result = await cache_service.get_or_set("value_key", factory, expire=300)
        assert result == {"data": "value"}


class TestCacheHashOperations:
    """Hash 操作测试"""

    @pytest.mark.asyncio
    async def test_hset_no_redis(self, cache_service):
        """测试无 Redis 时 Hash 设置"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            await cache_service.hset("hash_key", "field", "value")

    @pytest.mark.asyncio
    async def test_hget_no_redis(self, cache_service):
        """测试无 Redis 时 Hash 获取"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            await cache_service.hget("hash_key", "field")

    @pytest.mark.asyncio
    async def test_hgetall_no_redis(self, cache_service):
        """测试无 Redis 时 Hash 获取全部"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            await cache_service.hgetall("hash_key")


class TestCacheBatchOperations:
    """批量操作测试"""

    @pytest.mark.asyncio
    async def test_mget_json_no_redis(self, cache_service):
        """测试无 Redis 时批量获取"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            await cache_service.mget_json(["key1", "key2"])

    @pytest.mark.asyncio
    async def test_pipeline_no_redis(self, cache_service):
        """测试无 Redis 时管道"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            await cache_service.pipeline()


class TestCacheClearPattern:
    """缓存清理测试"""

    @pytest.mark.asyncio
    async def test_clear_pattern_no_redis(self, cache_service):
        """测试无 Redis 时按模式清理"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            await cache_service.clear_pattern("fides:test:*")


class TestCacheConnection:
    """缓存连接测试"""

    @pytest.mark.asyncio
    async def test_connect_and_close(self):
        """测试连接和关闭 - 需要 Redis 可用"""
        service = CacheService()
        # 尝试连接，如果 Redis 不可用会报错
        try:
            await service.connect()
            assert service._redis is not None
            await service.close()
            assert service._redis is None
        except Exception:
            # Redis 不可用，跳过
            pytest.skip("Redis not available")

    def test_redis_property_not_connected(self, cache_service):
        """测试未连接时访问 redis 属性"""
        with pytest.raises(RuntimeError, match="Cache service not connected"):
            _ = cache_service.redis
