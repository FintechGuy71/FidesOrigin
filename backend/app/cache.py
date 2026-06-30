"""
FidesOrigin Redis 连接配置
缓存和消息队列
"""

import os
import uuid as _uuid
from typing import Optional, Any

import redis.asyncio as redis
from redis.asyncio import Redis

# ============================================
# Redis 配置
# ============================================

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_SSL = os.getenv("REDIS_SSL", "false").lower() == "true"

# 连接池配置
REDIS_POOL_SIZE = int(os.getenv("REDIS_POOL_SIZE", "50"))
REDIS_POOL_TIMEOUT = int(os.getenv("REDIS_POOL_TIMEOUT", "10"))

# ============================================
# 创建 Redis 连接池
# ============================================

redis_pool: Optional[redis.ConnectionPool] = None


def get_redis_pool() -> redis.ConnectionPool:
    """获取或创建 Redis 连接池"""
    global redis_pool
    if redis_pool is None:
        redis_pool = redis.ConnectionPool(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD,
            db=REDIS_DB,
            ssl=REDIS_SSL,
            max_connections=REDIS_POOL_SIZE,
            socket_connect_timeout=REDIS_POOL_TIMEOUT,
            socket_keepalive=True,
            health_check_interval=30,
        )
    return redis_pool


async def get_redis() -> Redis:
    """
    获取 Redis 客户端
    使用方式:
        redis = await get_redis()
        await redis.set("key", "value")
    """
    pool = get_redis_pool()
    return redis.Redis(connection_pool=pool)


async def close_redis():
    """关闭 Redis 连接池"""
    global redis_pool
    if redis_pool:
        await redis_pool.disconnect()
        redis_pool = None


# ============================================
# 缓存工具函数
# ============================================

class Cache:
    """缓存工具类"""
    
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    async def get(self, key: str) -> Optional[str]:
        """获取缓存值"""
        value = await self.redis.get(key)
        return value.decode() if value else None
    
    async def set(
        self,
        key: str,
        value: str,
        expire: Optional[int] = None,
        nx: bool = False
    ) -> bool:
        """
        设置缓存值
        :param expire: 过期时间（秒）
        :param nx: 仅当key不存在时才设置
        """
        return await self.redis.set(key, value, ex=expire, nx=nx)
    
    async def delete(self, key: str) -> int:
        """删除缓存"""
        return await self.redis.delete(key)
    
    async def exists(self, key: str) -> bool:
        """检查key是否存在"""
        return await self.redis.exists(key) > 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        """设置过期时间"""
        return await self.redis.expire(key, seconds)
    
    async def ttl(self, key: str) -> int:
        """获取剩余过期时间"""
        return await self.redis.ttl(key)
    
    # ============================================
    # Hash 操作
    # ============================================
    
    async def hget(self, key: str, field: str) -> Optional[str]:
        """获取Hash字段值"""
        value = await self.redis.hget(key, field)
        return value.decode() if value else None
    
    async def hset(self, key: str, field: str, value: str) -> int:
        """设置Hash字段值"""
        return await self.redis.hset(key, field, value)
    
    async def hgetall(self, key: str) -> dict:
        """获取所有Hash字段"""
        data = await self.redis.hgetall(key)
        return {k.decode(): v.decode() for k, v in data.items()}
    
    async def hdel(self, key: str, *fields) -> int:
        """删除Hash字段"""
        return await self.redis.hdel(key, *fields)
    
    # ============================================
    # List 操作
    # ============================================
    
    async def lpush(self, key: str, *values) -> int:
        """从左侧推入列表"""
        return await self.redis.lpush(key, *values)
    
    async def rpush(self, key: str, *values) -> int:
        """从右侧推入列表"""
        return await self.redis.rpush(key, *values)
    
    async def lpop(self, key: str) -> Optional[str]:
        """从左侧弹出"""
        value = await self.redis.lpop(key)
        return value.decode() if value else None
    
    async def rpop(self, key: str) -> Optional[str]:
        """从右侧弹出"""
        value = await self.redis.rpop(key)
        return value.decode() if value else None
    
    async def lrange(self, key: str, start: int, end: int) -> list:
        """获取列表范围"""
        values = await self.redis.lrange(key, start, end)
        return [v.decode() for v in values]
    
    # ============================================
    # Set 操作
    # ============================================
    
    async def sadd(self, key: str, *members) -> int:
        """添加集合成员"""
        return await self.redis.sadd(key, *members)
    
    async def srem(self, key: str, *members) -> int:
        """移除集合成员"""
        return await self.redis.srem(key, *members)
    
    async def smembers(self, key: str) -> set:
        """获取所有集合成员"""
        members = await self.redis.smembers(key)
        return {m.decode() for m in members}
    
    async def sismember(self, key: str, member: str) -> bool:
        """检查是否为集合成员"""
        return await self.redis.sismember(key, member)
    
    # ============================================
    # 分布式锁
    # ============================================
    
    async def lock(self, key: str, timeout: int = 30) -> Optional[str]:
        """
        获取分布式锁
        [MEDIUM Fix #18] 使用随机 token 确保锁所有权
        :param key: 锁的key
        :param timeout: 锁超时时间（秒）
        :return: 锁 token（用于安全释放），None 表示获取失败
        """
        token = _uuid.uuid4().hex
        success = await self.redis.set(
            f"lock:{key}",
            token,
            nx=True,
            ex=timeout
        )
        return token if success else None
    
    async def unlock(self, key: str, token: str = None) -> int:
        """
        释放分布式锁
        [MEDIUM Fix #18] 使用 Lua 脚本确保只有锁的持有者才能释放
        """
        lock_key = f"lock:{key}"
        if token is None:
            # 向后兼容：无 token 时直接删除
            return await self.redis.delete(lock_key)
        
        # Lua 脚本：仅当 value == token 时才删除
        _UNLOCK_SCRIPT = '''
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        '''
        result = await self.redis.eval(_UNLOCK_SCRIPT, 1, lock_key, token)
        return int(result)
    
    # ============================================
    # 批量操作
    # ============================================
    
    async def mget(self, keys: list) -> list:
        """批量获取"""
        values = await self.redis.mget(keys)
        return [v.decode() if v else None for v in values]
    
    async def pipeline(self):
        """获取管道对象用于批量操作"""
        return self.redis.pipeline()


# ============================================
# 常用缓存 Key 生成器
# ============================================

def cache_key(*parts: str) -> str:
    """
    生成缓存key
    使用方式:
        key = cache_key("address", "0x123", "risk_score")
        # 返回: "fides:address:0x123:risk_score"
    """
    return ":".join(["fides"] + list(parts))


def address_cache_key(address: str, chain: str) -> str:
    """地址信息缓存key"""
    return cache_key("address", chain.lower(), address.lower())


def tx_cache_key(tx_hash: str, chain: str) -> str:
    """交易信息缓存key"""
    return cache_key("tx", chain.lower(), tx_hash.lower())


def risk_score_cache_key(address: str, chain: str) -> str:
    """风险评分缓存key"""
    return cache_key("risk", chain.lower(), address.lower())
