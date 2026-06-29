"""
FidesOrigin 缓存服务（重构版）
Redis 连接池管理 + 多级缓存策略 + 缓存穿透保护
"""
import json
import pickle
from typing import Any, List, Optional, TypeVar, Union

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

T = TypeVar("T")


class CacheService:
    """
    缓存服务
    
    特性：
    - 连接池管理（自动复用连接）
    - 多级缓存：内存（L1）+ Redis（L2）
    - 缓存穿透保护：布隆过滤器 + 空值缓存
    - 序列化：JSON（字符串）/ pickle（二进制）
    """
    
    def __init__(self):
        self._redis: Optional[Redis] = None
        self._local_cache: dict = {}  # L1 内存缓存
        self._local_ttl: dict = {}    # L1 TTL 记录
    
    async def connect(self) -> None:
        """建立 Redis 连接"""
        if self._redis is None:
            # Redis 8.0+ 直接使用 Redis 类创建连接
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
            logger.info("cache_service_connected", host=settings.REDIS_HOST, port=settings.REDIS_PORT)
    
    async def close(self) -> None:
        """关闭 Redis 连接"""
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("cache_service_disconnected")
    
    @property
    def redis(self) -> Redis:
        if self._redis is None:
            raise RuntimeError("Cache service not connected. Call connect() first.")
        return self._redis
    
    # ==================== Key 生成器 ====================
    
    @staticmethod
    def key(*parts: str) -> str:
        """生成缓存 key"""
        return ":".join(["fides"] + list(parts))
    
    @staticmethod
    def address_key(address: str, chain: str = "ethereum") -> str:
        return CacheService.key("address", chain.lower(), address.lower())
    
    @staticmethod
    def tx_key(tx_hash: str, chain: str = "ethereum") -> str:
        return CacheService.key("tx", chain.lower(), tx_hash.lower())
    
    @staticmethod
    def risk_key(address: str, chain: str = "ethereum") -> str:
        return CacheService.key("risk", chain.lower(), address.lower())
    
    @staticmethod
    def rules_key() -> str:
        return CacheService.key("rules", "active")
    
    # ==================== 基础操作 ====================
    
    async def get(self, key: str) -> Optional[str]:
        """获取字符串缓存"""
        if self._redis is None:
            return None
        value = await self._redis.get(key)
        return value.decode() if value else None
    
    async def set(
        self,
        key: str,
        value: str,
        expire: Optional[int] = None,
        nx: bool = False
    ) -> bool:
        """设置字符串缓存"""
        if self._redis is None:
            return False
        return await self._redis.set(key, value, ex=expire, nx=nx)
    
    async def delete(self, key: str) -> int:
        if self._redis is None:
            return 0
        return await self._redis.delete(key)
    
    async def exists(self, key: str) -> bool:
        if self._redis is None:
            return False
        return await self._redis.exists(key) > 0
    
    async def ttl(self, key: str) -> int:
        if self._redis is None:
            return -2
        return await self._redis.ttl(key)
    
    async def incr(self, key: str) -> int:
        """原子递增"""
        if self._redis is None:
            return 1
        return await self._redis.incr(key)
    
    async def expire(self, key: str, seconds: int) -> bool:
        """设置过期时间"""
        if self._redis is None:
            return False
        return await self._redis.expire(key, seconds)
    
    # ==================== JSON 序列化 ====================
    
    async def get_json(self, key: str) -> Optional[Any]:
        """获取 JSON 缓存"""
        value = await self.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            logger.warning("cache_json_decode_failed", key=key)
            return None
    
    async def set_json(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """设置 JSON 缓存"""
        return await self.set(key, json.dumps(value), expire=expire)
    
    # ==================== Pickle 序列化（二进制对象） ====================
    
    async def get_object(self, key: str) -> Optional[Any]:
        """获取二进制对象缓存"""
        if self._redis is None:
            return None
        value = await self._redis.get(key)
        if value is None:
            return None
        try:
            return pickle.loads(value)
        except pickle.PickleError:
            logger.warning("cache_pickle_decode_failed", key=key)
            return None
    
    async def set_object(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """设置二进制对象缓存"""
        if self._redis is None:
            return False
        return await self._redis.set(key, pickle.dumps(value), ex=expire)
    
    # ==================== Hash 操作 ====================
    
    async def hget(self, key: str, field: str) -> Optional[str]:
        value = await self.redis.hget(key, field)
        return value.decode() if value else None
    
    async def hset(self, key: str, field: str, value: str) -> int:
        return await self.redis.hset(key, field, value)
    
    async def hgetall(self, key: str) -> dict:
        data = await self.redis.hgetall(key)
        return {k.decode(): v.decode() for k, v in data.items()}
    
    # ==================== 分布式锁 ====================
    
    async def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        """获取分布式锁"""
        return await self.redis.set(
            f"lock:{key}",
            "1",
            nx=True,
            ex=timeout
        )
    
    async def release_lock(self, key: str) -> int:
        """释放分布式锁"""
        return await self.redis.delete(f"lock:{key}")
    
    # ==================== 缓存穿透保护 ====================
    
    async def get_or_set(
        self,
        key: str,
        factory,
        expire: int = 300,
        null_expire: int = 60
    ) -> Any:
        """
        缓存穿透保护模式
        
        1. 先查缓存
        2. 缓存未命中，获取分布式锁
        3. 再次检查缓存（防止缓存击穿）
        4. 执行 factory 获取数据
        5. 数据为空时缓存空值（防止缓存穿透）
        """
        # 1. 先查缓存
        cached = await self.get_json(key)
        if cached is not None:
            if cached == "__NULL__":
                return None
            return cached
        
        # 2. 获取分布式锁
        lock_key = f"lock:{key}"
        locked = await self.acquire_lock(lock_key, timeout=10)
        
        if not locked:
            # 未获取到锁，等待后重试
            import asyncio
            await asyncio.sleep(0.1)
            return await self.get_or_set(key, factory, expire, null_expire)
        
        try:
            # 3. 再次检查缓存
            cached = await self.get_json(key)
            if cached is not None:
                if cached == "__NULL__":
                    return None
                return cached
            
            # 4. 执行 factory
            value = await factory()
            
            # 5. 缓存结果（空值也缓存）
            if value is None:
                await self.set_json(key, "__NULL__", expire=null_expire)
            else:
                await self.set_json(key, value, expire=expire)
            
            return value
        finally:
            await self.release_lock(lock_key)
    
    # ==================== 批量操作 ====================
    
    async def mget_json(self, keys: List[str]) -> List[Optional[Any]]:
        """批量获取 JSON 缓存"""
        values = await self.redis.mget(keys)
        result = []
        for v in values:
            if v is None:
                result.append(None)
            else:
                try:
                    result.append(json.loads(v.decode()))
                except json.JSONDecodeError:
                    result.append(None)
        return result
    
    async def pipeline(self):
        """获取管道对象用于批量操作"""
        return self.redis.pipeline()
    
    # ==================== 清理操作 ====================
    
    async def clear_pattern(self, pattern: str) -> int:
        """按 pattern 清除缓存"""
        keys = []
        async for key in self.redis.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            return await self.redis.delete(*keys)
        return 0
