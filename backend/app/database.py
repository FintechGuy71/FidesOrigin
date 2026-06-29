"""
FidesOrigin 数据库配置（重构版）
统一使用 Pydantic Settings 配置，消除 os.getenv 分散读取
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

# 创建基类（用于 Alembic 和模型定义）
Base = declarative_base()

# 数据库引擎（延迟初始化）
_async_engine = None

def get_async_engine():
    """获取或创建异步数据库引擎"""
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            settings.DATABASE_URL,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            echo=settings.DEBUG,
            future=True,
        )
    return _async_engine

# 为了兼容现有代码，提供模块级别的引擎引用
# 注意：这会在首次访问时初始化
async_engine = get_async_engine()

# 测试环境使用 NullPool（避免连接池问题）
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    poolclass=NullPool,
    connect_args={"check_same_thread": False},
)

# 创建会话工厂 - 使用函数以便在测试时可以被覆盖
_AsyncSessionLocal = None

def get_async_session_maker():
    """获取或创建异步会话工厂"""
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _AsyncSessionLocal

# 模块级别兼容
AsyncSessionLocal = get_async_session_maker()

# 别名，用于依赖注入
async_session_maker = AsyncSessionLocal

# 测试会话工厂
TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """
    FastAPI 依赖注入用数据库会话生成器
    """
    session = get_async_session_maker()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def init_db():
    """初始化数据库（创建所有表）"""
    async with get_async_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
