"""
FidesOrigin 分布式锁管理器（Redis Redlock 算法）

P0-3 Fix: 统一 data-publisher 和 backend 职责边界
- 使用 Redis Redlock 算法实现分布式锁
- 自动释放锁（过期时间 + 手动释放）
- 支持锁续期（watchdog 机制）
- 支持锁等待和超时
"""
import asyncio
import random
import time
from typing import Optional

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class DistributedLockManager:
    """
    分布式锁管理器（Redis Redlock 算法简化版）
    
    职责：
    1. 为链上写入操作提供独占锁
    2. 防止 data-publisher 和 backend 同时写入链上数据
    3. 支持锁自动续期和自动释放
    
    锁命名规范：
    - fides:lock:chain:write — 链上写入独占锁
    - fides:lock:chain:read — 链上读取共享锁（可选）
    """
    
    # 锁 key 前缀
    LOCK_PREFIX = "fides:lock"
    
    # 默认锁过期时间（秒）
    DEFAULT_LOCK_TTL = 30
    
    # 锁续期间隔（秒）
    WATCHDOG_INTERVAL = 10
    
    # 锁等待重试间隔（秒）
    RETRY_INTERVAL = 0.5
    
    def __init__(self, redis_client: Optional[Redis] = None):
        self._redis = redis_client
        self._watchdog_tasks: dict = {}  # lock_key -> asyncio.Task
    
    async def _get_redis(self) -> Redis:
        """获取 Redis 连接（懒连接）"""
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
    
    def _lock_key(self, resource: str) -> str:
        """生成锁 key"""
        return f"{self.LOCK_PREFIX}:{resource}"
    
    def _generate_token(self) -> str:
        """生成唯一锁 token（用于安全释放锁）"""
        return f"{time.time()}-{random.randint(100000, 999999)}-{id(self)}"
    
    async def acquire_lock(
        self,
        resource: str,
        ttl: int = DEFAULT_LOCK_TTL,
        blocking: bool = True,
        blocking_timeout: Optional[float] = None,
    ) -> Optional[str]:
        """
        获取分布式锁
        
        Args:
            resource: 锁资源标识（如 "chain:write"）
            ttl: 锁过期时间（秒）
            blocking: 是否阻塞等待
            blocking_timeout: 阻塞等待超时时间（秒）
        
        Returns:
            锁 token（成功）或 None（失败）
        """
        redis_client = await self._get_redis()
        lock_key = self._lock_key(resource)
        token = self._generate_token()
        
        start_time = time.time()
        
        while True:
            # 尝试获取锁（SET NX EX）
            acquired = await redis_client.set(
                lock_key,
                token,
                nx=True,
                ex=ttl,
            )
            
            if acquired:
                logger.info(
                    "lock_acquired",
                    resource=resource,
                    lock_key=lock_key,
                    token=token[:20] + "...",
                    ttl=ttl,
                )
                # 启动看门狗自动续期
                self._start_watchdog(resource, lock_key, token, ttl)
                return token
            
            if not blocking:
                logger.debug(
                    "lock_not_acquired_nonblocking",
                    resource=resource,
                    lock_key=lock_key,
                )
                return None
            
            # 检查阻塞超时
            if blocking_timeout is not None:
                elapsed = time.time() - start_time
                if elapsed >= blocking_timeout:
                    logger.warning(
                        "lock_acquire_timeout",
                        resource=resource,
                        lock_key=lock_key,
                        blocking_timeout=blocking_timeout,
                    )
                    return None
            
            # 等待后重试
            await asyncio.sleep(self.RETRY_INTERVAL)
    
    async def release_lock(self, resource: str, token: str) -> bool:
        """
        释放分布式锁（安全释放，只能释放自己持有的锁）
        
        Args:
            resource: 锁资源标识
            token: 获取锁时返回的 token
        
        Returns:
            是否成功释放
        """
        redis_client = await self._get_redis()
        lock_key = self._lock_key(resource)
        
        # 停止看门狗
        self._stop_watchdog(resource)
        
        # 使用 Lua 脚本安全释放锁（防止误释放他人持有的锁）
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        
        try:
            result = await redis_client.eval(lua_script, 1, lock_key, token)
            released = bool(result)
            
            if released:
                logger.info(
                    "lock_released",
                    resource=resource,
                    lock_key=lock_key,
                )
            else:
                logger.warning(
                    "lock_release_failed_or_expired",
                    resource=resource,
                    lock_key=lock_key,
                )
            
            return released
        except Exception as e:
            logger.error(
                "lock_release_error",
                resource=resource,
                lock_key=lock_key,
                error=str(e),
            )
            return False
    
    async def is_locked(self, resource: str) -> bool:
        """检查资源是否被锁定"""
        redis_client = await self._get_redis()
        lock_key = self._lock_key(resource)
        exists = await redis_client.exists(lock_key)
        return bool(exists)
    
    async def get_lock_ttl(self, resource: str) -> int:
        """获取锁剩余过期时间（秒）"""
        redis_client = await self._get_redis()
        lock_key = self._lock_key(resource)
        ttl = await redis_client.ttl(lock_key)
        return max(0, ttl)
    
    async def extend_lock(self, resource: str, token: str, additional_ttl: int) -> bool:
        """
        延长锁过期时间
        
        Args:
            resource: 锁资源标识
            token: 锁 token
            additional_ttl: 额外增加的过期时间（秒）
        
        Returns:
            是否成功延长
        """
        redis_client = await self._get_redis()
        lock_key = self._lock_key(resource)
        
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        
        try:
            result = await redis_client.eval(
                lua_script, 1, lock_key, token, str(additional_ttl)
            )
            return bool(result)
        except Exception as e:
            logger.error(
                "lock_extend_error",
                resource=resource,
                error=str(e),
            )
            return False
    
    def _start_watchdog(self, resource: str, lock_key: str, token: str, ttl: int) -> None:
        """启动看门狗任务自动续期锁"""
        # 取消已存在的看门狗
        self._stop_watchdog(resource)
        
        async def watchdog():
            """看门狗：在锁过期前续期"""
            while True:
                # 在锁过期前一半时间续期
                await asyncio.sleep(self.WATCHDOG_INTERVAL)
                
                try:
                    extended = await self.extend_lock(resource, token, ttl)
                    if not extended:
                        logger.warning(
                            "watchdog_lock_extend_failed",
                            resource=resource,
                            lock_key=lock_key,
                        )
                        break
                    
                    logger.debug(
                        "watchdog_lock_extended",
                        resource=resource,
                        lock_key=lock_key,
                    )
                except Exception as e:
                    logger.error(
                        "watchdog_error",
                        resource=resource,
                        error=str(e),
                    )
                    break
        
        task = asyncio.create_task(watchdog())
        self._watchdog_tasks[resource] = task
        
        logger.debug(
            "watchdog_started",
            resource=resource,
            lock_key=lock_key,
            interval=self.WATCHDOG_INTERVAL,
        )
    
    def _stop_watchdog(self, resource: str) -> None:
        """停止看门狗任务"""
        task = self._watchdog_tasks.pop(resource, None)
        if task and not task.done():
            task.cancel()
            logger.debug("watchdog_stopped", resource=resource)
    
    async def close(self) -> None:
        """关闭锁管理器，取消所有看门狗任务"""
        for resource in list(self._watchdog_tasks.keys()):
            self._stop_watchdog(resource)
        
        if self._redis:
            await self._redis.close()
            self._redis = None
        
        logger.info("lock_manager_closed")
    
    # ==================== 便捷方法 ====================
    
    async def acquire_chain_write_lock(
        self,
        blocking: bool = True,
        blocking_timeout: Optional[float] = 60.0,
        ttl: int = 30,
    ) -> Optional[str]:
        """
        获取链上写入独占锁
        
        P0-3 Fix: 防止 data-publisher 和 backend 同时写入链上
        """
        return await self.acquire_lock(
            resource="chain:write",
            ttl=ttl,
            blocking=blocking,
            blocking_timeout=blocking_timeout,
        )
    
    async def release_chain_write_lock(self, token: str) -> bool:
        """释放链上写入独占锁"""
        return await self.release_lock("chain:write", token)
    
    async def is_chain_write_locked(self) -> bool:
        """检查链上写入是否被锁定"""
        return await self.is_locked("chain:write")
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.close()


# 全局锁管理器实例
_lock_manager: Optional[DistributedLockManager] = None


def get_lock_manager(redis_client: Optional[Redis] = None) -> DistributedLockManager:
    """获取全局锁管理器单例"""
    global _lock_manager
    if _lock_manager is None:
        _lock_manager = DistributedLockManager(redis_client)
    return _lock_manager


async def reset_lock_manager() -> None:
    """重置锁管理器（测试用）"""
    global _lock_manager
    if _lock_manager:
        await _lock_manager.close()
    _lock_manager = None
