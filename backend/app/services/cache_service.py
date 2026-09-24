"""
FidesOrigin 缓存服务(重构版)
Redis 连接池管理 + 多级缓存策略 + 缓存穿透保护
"""
import json
import json as _json_compat  # [LOW Fix #25] 使用 JSON 替代 pickle
from datetime import datetime, timezone
from typing import Any, List, Optional, TypeVar, Union

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
# settings = get_settings()  # 不再在模块级别缓存

T = TypeVar("T")


class CacheService:
    """
    缓存服务

    特性:
    - 连接池管理(自动复用连接)
    - 多级缓存:内存(L1)+ Redis(L2)
    - 缓存穿透保护:布隆过滤器 + 空值缓存
    - 序列化:仅 JSON（pickle 已移除，见 [AUDIT FIX 2026-09-22]）
    """

    def __init__(self):
        self._redis: Optional[Redis] = None
        self._local_cache: dict = {}  # L1 内存缓存
        self._local_ttl: dict = {}    # L1 TTL 记录

    async def connect(self) -> None:
        """建立 Redis 连接"""
        if self._redis is None:
            _settings = get_settings()
            # [LOW Fix #2] 启用 SSL 证书验证（如果配置了 SSL）
            # [Deploy Fix] 必须同时传 ssl=True——只设 ssl_cert_reqs 不会启用 TLS，
            # 明文直连 Upstash TLS 端口会在 AUTH 阶段被服务端断开（SERVER_CLOSED_CONNECTION_ERROR）
            ssl_kwargs = {}
            if _settings.REDIS_SSL:
                ssl_kwargs["ssl"] = True
                ssl_kwargs["ssl_cert_reqs"] = "required"
            
            # Redis 8.0+ 直接使用 Redis 类创建连接
            self._redis = redis.Redis(
                host=_settings.REDIS_HOST,
                port=_settings.REDIS_PORT,
                password=_settings.REDIS_PASSWORD,
                db=_settings.REDIS_DB,
                max_connections=_settings.REDIS_POOL_SIZE,
                socket_connect_timeout=_settings.REDIS_POOL_TIMEOUT,
                socket_keepalive=True,
                health_check_interval=30,
                decode_responses=True,
                **ssl_kwargs
            )
            logger.info("cache_service_connected", host=_settings.REDIS_HOST, port=_settings.REDIS_PORT)

    async def close(self) -> None:
        """关闭 Redis 连接"""
        if self._redis:
            await self._redis.aclose()
            self._redis = None
            logger.info("cache_service_disconnected")

    @property
    def redis(self) -> Redis:
        if self._redis is None:
            raise RuntimeError("Cache service not connected. Call connect() first.")
        return self._redis

    # [AUDIT FIX 2026-09-24 B2] 公开连接状态探测。
    # 背景：CacheService 在未连接时对 get/set/incr 等一律返回软默认值
    # （None/False/1）而非抛异常。这使 security.RateLimiter 与 auth 登录锁定
    # 等"异常→本地降级"的错误处理路径在 Redis 启动期未连接时永远不会触发，
    # 安全控制（限流/账户锁定）被静默禁用。调用方现在可以用该属性显式判断
    # 连接状态并走降级路径。
    @property
    def is_connected(self) -> bool:
        """是否已建立 Redis 连接（connect() 成功过且未被 close）"""
        return self._redis is not None

    # L1 内存缓存默认 TTL(秒),比 Redis 更短以平衡一致性和性能
    L1_DEFAULT_TTL = 60

    def _is_local_expired(self, key: str) -> bool:
        """检查 L1 内存缓存是否过期"""
        expire_at = self._local_ttl.get(key)
        if expire_at is None:
            return True
        return datetime.now(timezone.utc).timestamp() > expire_at

    def _set_local(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """写入 L1 内存缓存"""
        self._local_cache[key] = value
        self._local_ttl[key] = datetime.now(timezone.utc).timestamp() + (ttl or self.L1_DEFAULT_TTL)

    def _get_local(self, key: str) -> Any:
        """读取 L1 内存缓存,过期返回 None"""
        if self._is_local_expired(key):
            self._local_cache.pop(key, None)
            self._local_ttl.pop(key, None)
            return None
        return self._local_cache.get(key)

    def _delete_local(self, key: str) -> None:
        """删除 L1 内存缓存"""
        self._local_cache.pop(key, None)
        self._local_ttl.pop(key, None)

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
        """获取字符串缓存(L1 -> L2)"""
        # 1. 优先查 L1 内存缓存
        local_value = self._get_local(key)
        if local_value is not None:
            return local_value

        # 2. L1 未命中,查 Redis
        if self._redis is None:
            return None
        value = await self._redis.get(key)
        if value is not None:
            # decode_responses=True already returns str, no need for .decode()
            self._set_local(key, value)
            return value
        return None

    async def set(
        self,
        key: str,
        value: str,
        expire: Optional[int] = None,
        nx: bool = False
    ) -> bool:
        """设置字符串缓存(L1 + L2)"""
        # 写入 L1
        self._set_local(key, value, ttl=expire)

        # 写入 Redis
        if self._redis is None:
            return False
        return await self._redis.set(key, value, ex=expire, nx=nx)

    async def delete(self, key: str) -> int:
        """删除缓存(L1 + L2)"""
        self._delete_local(key)
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

    # ==================== Pickle 序列化(二进制对象) ====================
    # [LOW Fix #25] 安全警告:pickle 反序列化存在任意代码执行风险
    # 推荐使用 get_json/set_json 替代。以下方法保留向后兼容但标记为不安全。
    # 如果必须缓存二进制对象,建议使用 JSON 序列化替代方案。

    async def get_object(self, key: str) -> Optional[Any]:
        """获取对象缓存([LOW Fix #25] 仅 JSON 反序列化，pickle 反序列化已移除)"""
        if self._redis is None:
            return None
        # [AUDIT FIX 2026-09-24 B20] 把 redis.get 移入 try：decode_responses=True 时
        # 遗留的非 UTF-8 二进制数据（如历史 pickle 载荷）会在 redis 客户端解码阶段
        # 抛 UnicodeDecodeError——原位置在 try 之外，异常直接穿透本方法。
        try:
            value = await self._redis.get(key)
            if value is None:
                return None
            # [AUDIT FIX 2026-09-22] 移除 pickle.loads 回退：pickle 反序列化存在
            # 任意代码执行（RCE）风险——任何能写 Redis 的实体（含被攻破的内部服务）
            # 都可借此执行代码。get_object 无生产调用方，旧 pickle 数据已随
            # JSON 迁移废弃，安全优于向后兼容。
            if isinstance(value, bytes):
                value = value.decode()
            return _json_compat.loads(value)
        except (json.JSONDecodeError, UnicodeDecodeError, TypeError, ValueError) as e:
            logger.warning("cache_object_decode_failed", key=key, error=str(e))
            return None

    async def set_object(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """设置对象缓存([LOW Fix #25] 仅 JSON 序列化，pickle 回退已移除)"""
        if self._redis is None:
            return False
        # [AUDIT FIX 2026-09-22] 移除 pickle.dumps 回退，与 get_object 的 JSON-only
        # 语义保持一致；不可 JSON 序列化的对象如实报错并记日志，不再静默降级。
        # （不使用 default=str，避免把任意对象静默字符串化后再读回时发生类型突变。）
        try:
            return await self._redis.set(key, _json_compat.dumps(value), ex=expire)
        except (TypeError, ValueError) as e:
            logger.warning("cache_object_encode_failed", key=key, error=str(e))
            return False

    # ==================== Hash 操作 ====================

    async def hget(self, key: str, field: str) -> Optional[str]:
        value = await self.redis.hget(key, field)
        # decode_responses=True already returns str
        return value if value else None

    async def hset(self, key: str, field: str, value: str) -> int:
        return await self.redis.hset(key, field, value)

    async def hgetall(self, key: str) -> dict:
        data = await self.redis.hgetall(key)
        # decode_responses=True already returns str keys and values
        return dict(data)

    # ==================== 分布式锁 ====================

    async def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        """获取分布式锁"""
        if self._redis is None:
            return False
        try:
            return await self.redis.set(
                f"lock:{key}",
                "1",
                nx=True,
                ex=timeout
            )
        except Exception:
            return False

    async def release_lock(self, key: str) -> int:
        """释放分布式锁"""
        if self._redis is None:
            return 0
        try:
            return await self.redis.delete(f"lock:{key}")
        except Exception:
            return 0

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
        2. 缓存未命中,获取分布式锁
        3. 再次检查缓存(防止缓存击穿)
        4. 执行 factory 获取数据
        5. 数据为空时缓存空值(防止缓存穿透)
        """
        # 1. 先查缓存(L1 + L2)
        cached = await self.get_json(key)
        if cached is not None:
            if cached == "__NULL__":
                return None
            return cached

        # 2. 获取分布式锁
        lock_key = f"lock:{key}"
        locked = await self.acquire_lock(lock_key, timeout=10)

        if not locked:
            # [MEDIUM Fix #19] 改为 while 循环 + 最大重试次数,避免递归栈溢出
            import asyncio
            max_retries = 3
            for attempt in range(max_retries):
                await asyncio.sleep(0.1 * (attempt + 1))
                # 检查缓存是否已被其他进程填充
                cached = await self.get_json(key)
                if cached is not None:
                    return None if cached == "__NULL__" else cached
                # 再次尝试获取锁
                if await self.acquire_lock(lock_key, timeout=10):
                    break
            else:
                # 重试次数耗尽,最后尝试读缓存
                cached = await self.get_json(key)
                if cached is not None:
                    return None if cached == "__NULL__" else cached
                # 仍然获取不到锁,直接执行 factory
                value = await factory()
                if value is None:
                    await self.set_json(key, "__NULL__", expire=null_expire)
                else:
                    await self.set_json(key, value, expire=expire)
                return value

        try:
            # 3. 再次检查缓存
            cached = await self.get_json(key)
            if cached is not None:
                if cached == "__NULL__":
                    return None
                return cached

            # 4. 执行 factory
            value = await factory()

            # 5. 缓存结果(空值也缓存)
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
                    # decode_responses=True already returns str
                    result.append(json.loads(v))
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
