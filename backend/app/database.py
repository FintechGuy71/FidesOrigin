"""
FidesOrigin 数据库配置（重构版）
统一使用 Pydantic Settings 配置，消除 os.getenv 分散读取
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
import logging

from app.config import get_settings

# 注意：不能用 app.core.logging —— 它会触发 core.__init__ → core.di → database 的循环 import。
# 此处用标准库 logging。
logger = logging.getLogger(__name__)

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
            # [Audit Fix #12] Enable pool_pre_ping to verify connections before reuse
            pool_pre_ping=True,
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


class _LazyAsyncSessionLocal:
    """Lazy async session factory — defers engine creation until first use."""
    _factory = None

    def _ensure_factory(self):
        if self._factory is None:
            self._factory = get_async_session_maker()
        return self._factory

    def __call__(self, *args, **kwargs):
        return self._ensure_factory()(*args, **kwargs)


# 模块级别兼容 — 惰性初始化，导入时不创建引擎
AsyncSessionLocal = _LazyAsyncSessionLocal()
async_session_maker = AsyncSessionLocal

# 测试会话工厂
TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """初始化数据库（创建所有表 + 幂等 seed 默认规则）"""
    async with get_async_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # seed 失败绝不能阻断启动：规则缺失可后续补救，启动崩溃才是灾难（曾导致 Render update_failed）
    try:
        await ensure_default_rules()
    except Exception as e:
        logger.error("default_rules_seed_failed", error=str(e))


async def ensure_default_rules():
    """幂等 seed 引擎必需的内置规则。

    背景：风险引擎按 DB 里的 risk_rules 行驱动（rule.name → STRATEGIES 映射）。
    `sanctioned_list` 规则此前靠手工建、不在任何迁移里；新增 `scam_list` 规则
    （链上风险名单）同样需要一条规则行才能被引擎调用。故统一在此幂等确保，
    ON CONFLICT (name) DO NOTHING，不覆盖已存在的规则。
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    # 延迟导入 RiskRule，避免 database ↔ models 循环 import
    from app.models import RiskRule

    async with get_async_session_maker()() as session:
        rules = [
            {
                "name": "sanctioned_list",
                "description": "官方制裁名单在册（OFAC/SDN 等）",
                "rule_type": "PATTERN",
                "category": "compliance",
                "risk_weight": 1.0,
                "risk_score_impact": 100.0,
                "priority": 1,
                "tags": ["sanctions", "compliance"],
                "is_active": True,
            },
            {
                "name": "scam_list",
                "description": "链上风险名单在册（钓鱼/诈骗等风险情报）",
                "rule_type": "PATTERN",
                "category": "reputation",
                "risk_weight": 1.0,
                "risk_score_impact": 75.0,
                "priority": 2,
                "tags": ["scam", "phishing", "fraud"],
                "is_active": True,
            },
        ]
        for r in rules:
            # 用 ORM 对象而非裸 dict，让 SQLAlchemy 正确处理 native ENUM(rule_type) 的转换
            # （裸 dict + pg_insert 对 PG native enum 会因缺少显式 cast 而失败）
            exists = await session.execute(
                select(RiskRule).where(RiskRule.name == r["name"])
            )
            if exists.scalar_one_or_none() is not None:
                continue  # 已存在，跳过（幂等）
            session.add(RiskRule(**r))
        await session.commit()
        logger.info("default_rules_ensured", names=[r["name"] for r in rules])
