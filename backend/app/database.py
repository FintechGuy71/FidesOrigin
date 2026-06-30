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

# [LOW Fix #23] 改为 lazy initialization，避免模块级导入时立即创建引擎
# 模块级引擎初始化会在 import 时就创建连接池，即使只是导入也消耗资源
_async_engine = None


def get_async_engine():
    """获取或创建异步数据库引擎（lazy initialization）"""
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
# [LOW Fix #23] 不再模块级初始化，改为 None；需要时调用 get_async_engine()
async_engine = None

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


# [LOW Fix #22] get_db 已在 di.py 中定义，此处仅 re-export 以保持向后兼容
# 不再重复定义，避免与 di.py 中的版本产生不一致
from app.core.di import get_db as get_db  # noqa: F401, E402


async def init_db():
    """初始化数据库（创建所有表）"""
    async with get_async_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
