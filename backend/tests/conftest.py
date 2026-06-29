"""
FidesOrigin 测试配置
核心设计：确保 FastAPI 应用和测试固件共享同一个事件循环和数据库连接池
"""
import os

# 必须在导入任何应用模块之前设置测试环境变量
os.environ["TEST_DATABASE_URL"] = "postgresql+asyncpg://fidesorigin:fidesorigin@localhost:5432/fidesorigin_test"
os.environ["DB_PASSWORD"] = "fidesorigin"

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.database import get_db, Base

TEST_DATABASE_URL = os.environ["TEST_DATABASE_URL"]

# 创建测试专用引擎（使用NullPool避免连接池冲突）
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
)


# 使用 pytest-asyncio 推荐的配置方式替代自定义 event_loop fixture
# 在 pytest.ini 中已配置 asyncio_mode = auto 和 asyncio_default_fixture_loop_scope = session
# 不再需要使用自定义 event_loop fixture


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """设置测试数据库（会话级别，自动执行）"""
    # 创建所有表
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # 清理
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """创建测试数据库会话（函数级别）"""
    # 每个测试前清理数据
    async with test_engine.begin() as conn:
        # 获取所有表名并清空
        def get_tables(conn):
            from sqlalchemy import inspect
            inspector = inspect(conn)
            return inspector.get_table_names()
        
        tables = await conn.run_sync(get_tables)
        for table in tables:
            await conn.exec_driver_sql(f'TRUNCATE TABLE "{table}" CASCADE')
    
    # 创建新会话（使用测试引擎）
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """创建测试客户端 - 覆盖所有模块的 get_db 依赖"""
    from app.main import app
    from app.core.di import get_container
    import app.core.di as di_module
    
    # 保存原始的 get_db 函数
    original_get_db = di_module.get_db
    
    # 创建新的 get_db 函数，使用测试会话
    async def override_get_db():
        yield db_session
    
    # 替换所有模块中的 get_db 引用
    di_module.get_db = override_get_db
    
    # 同时更新 FastAPI 的依赖覆盖
    original_overrides = app.dependency_overrides.copy()
    app.dependency_overrides[original_get_db] = override_get_db
    
    # 覆盖 DI 容器中的数据库会话
    container = get_container()
    original_get_risk_engine = container.get_risk_engine
    
    def mock_get_risk_engine(db):
        from app.services.risk_engine_service import RiskEngineService
        return RiskEngineService(
            db=db_session,
            blockscout=container.blockscout,
            cache=container.cache,
            alert=container.alert,
            address_repo=container.get_address_repository(db_session),
            transaction_repo=container.get_transaction_repository(db_session),
            rule_repo=container.get_rule_repository(db_session)
        )
    
    container.get_risk_engine = mock_get_risk_engine
    
    # 覆盖 API Key 认证（测试环境跳过认证）
    from app.core.security import get_current_api_key
    original_get_current_api_key = get_current_api_key
    
    async def mock_get_current_api_key(*args, **kwargs):
        return "test-api-key"
    
    app.dependency_overrides[get_current_api_key] = mock_get_current_api_key
    
    # 覆盖请求签名中间件（测试环境跳过签名验证）
    import app.core.security as security_module
    original_request_signature_middleware = security_module.request_signature_middleware
    
    async def mock_request_signature_middleware(request, call_next):
        return await call_next(request)
    
    security_module.request_signature_middleware = mock_request_signature_middleware
    
    # 使用 LifespanManager 管理应用生命周期
    try:
        from asgi_lifespan import LifespanManager
        
        async with LifespanManager(app) as manager:
            transport = ASGITransport(app=manager.app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                yield client
    except ImportError:
        # 如果没有 asgi_lifespan，手动管理 lifespan
        @asynccontextmanager
        async def manual_lifespan():
            from app.main import lifespan
            async with lifespan(app):
                yield app
        
        async with manual_lifespan():
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                yield client
    
    # 恢复原始状态
    di_module.get_db = original_get_db
    app.dependency_overrides = original_overrides
    container.get_risk_engine = original_get_risk_engine
    security_module.request_signature_middleware = original_request_signature_middleware
    
    # 恢复 API Key 认证
    if get_current_api_key in app.dependency_overrides:
        del app.dependency_overrides[get_current_api_key]
