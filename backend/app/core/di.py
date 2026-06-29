"""
FidesOrigin 依赖注入容器（重构版）
统一管理所有服务的生命周期和依赖关系
"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.logging import get_logger
from app.database import AsyncSessionLocal
from app.repositories.address_repository import AddressRepository
from app.repositories.rule_repository import RuleRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.alert_service import AlertService
from app.services.blockscout_service import BlockscoutService
from app.services.cache_service import CacheService
from app.services.risk_engine_service import RiskEngineService
from app.services.websocket_manager import WebSocketManager

logger = get_logger(__name__)
settings = get_settings()


class DIContainer:
    """
    依赖注入容器
    
    管理所有服务的单例实例和生命周期
    实现 Service Locator 模式
    """
    
    def __init__(self):
        self._cache: Optional[CacheService] = None
        self._blockscout: Optional[BlockscoutService] = None
        self._alert: Optional[AlertService] = None
        self._ws_manager: Optional[WebSocketManager] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """初始化所有单例服务"""
        if self._initialized:
            return
        
        logger.info("di_container_initializing")
        
        # 初始化缓存服务
        self._cache = CacheService()
        try:
            await self._cache.connect()
        except Exception as e:
            logger.warning("cache_connect_failed", error=str(e))
        
        # 初始化 Blockscout 服务
        self._blockscout = BlockscoutService()
        
        # 初始化告警服务
        self._alert = AlertService()
        
        # 初始化 WebSocket 管理器
        self._ws_manager = WebSocketManager()
        
        self._initialized = True
        logger.info("di_container_initialized")
    
    async def shutdown(self) -> None:
        """关闭所有服务"""
        logger.info("di_container_shutting_down")
        
        if self._cache:
            await self._cache.close()
            self._cache = None
        
        if self._blockscout:
            await self._blockscout.close()
            self._blockscout = None
        
        self._alert = None
        self._ws_manager = None
        self._initialized = False
        
        logger.info("di_container_shutdown_complete")
    
    @property
    def cache(self) -> CacheService:
        """获取缓存服务（懒加载）"""
        if not self._cache:
            self._cache = CacheService()
            # 在测试环境中不尝试连接 Redis
            if os.environ.get("TEST_DATABASE_URL"):
                logger.debug("test_mode_skip_redis")
            else:
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(self._cache.connect())
                except Exception:
                    pass
        return self._cache
    
    @property
    def blockscout(self) -> BlockscoutService:
        """获取 Blockscout 服务（懒加载）"""
        if not self._blockscout:
            self._blockscout = BlockscoutService()
        return self._blockscout
    
    @property
    def alert(self) -> AlertService:
        """获取告警服务（懒加载）"""
        if not self._alert:
            self._alert = AlertService()
        return self._alert
    
    @property
    def ws_manager(self) -> WebSocketManager:
        """获取 WebSocket 管理器（懒加载）"""
        if not self._ws_manager:
            self._ws_manager = WebSocketManager()
        return self._ws_manager
    
    # ==================== Repository 工厂方法 ====================
    
    def get_address_repository(self, db: AsyncSession) -> AddressRepository:
        """获取地址 Repository"""
        return AddressRepository(db)
    
    def get_transaction_repository(self, db: AsyncSession) -> TransactionRepository:
        """获取交易 Repository"""
        return TransactionRepository(db)
    
    def get_rule_repository(self, db: AsyncSession) -> RuleRepository:
        """获取规则 Repository"""
        return RuleRepository(db)
    
    # ==================== Service 工厂方法 ====================
    
    def get_risk_engine(self, db: AsyncSession) -> RiskEngineService:
        """获取风险引擎（每次请求创建新实例）"""
        return RiskEngineService(
            db=db,
            blockscout=self.blockscout,
            cache=self.cache,
            alert=self.alert,
            address_repo=self.get_address_repository(db),
            transaction_repo=self.get_transaction_repository(db),
            rule_repo=self.get_rule_repository(db)
        )


# 全局容器实例
_container: Optional[DIContainer] = None


def get_container() -> DIContainer:
    """获取全局 DI 容器"""
    global _container
    if _container is None:
        _container = DIContainer()
    return _container


async def init_container() -> None:
    """初始化容器"""
    container = get_container()
    # 测试环境中跳过 Redis 连接
    if os.environ.get("TEST_DATABASE_URL"):
        logger.debug("test_mode_skip_container_init")
        return
    await container.initialize()


async def shutdown_container() -> None:
    """关闭容器"""
    global _container
    if _container:
        await _container.shutdown()
        _container = None


# ==================== FastAPI 依赖函数 ====================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取数据库会话（FastAPI 依赖）
    
    使用 asynccontextmanager 确保会话正确关闭
    """
    from app.database import get_async_session_maker
    session = get_async_session_maker()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_risk_engine(
    db: AsyncSession = Depends(get_db)
) -> RiskEngineService:
    """获取风险引擎（FastAPI 依赖）"""
    return get_container().get_risk_engine(db)


async def get_ws_manager() -> WebSocketManager:
    """获取 WebSocket 管理器（FastAPI 依赖）"""
    return get_container().ws_manager
