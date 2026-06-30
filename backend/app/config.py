"""
FidesOrigin 配置管理（重构版）
集中管理所有环境变量，消除分散的 os.getenv 调用
"""
from functools import cached_property, lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    应用配置类
    
    所有配置项集中在此，通过环境变量或 .env 文件读取
    生产环境必须设置所有安全相关变量，不允许使用默认值
    """
    
    # ==================== 应用基本信息 ====================
    APP_NAME: str = Field(default="FidesOrigin", description="应用名称")
    APP_VERSION: str = Field(default="2.0.0", description="应用版本")
    APP_ENV: str = Field(default="development", description="运行环境")
    DEBUG: bool = Field(default=False, description="调试模式")
    LOG_LEVEL: str = Field(default="INFO", description="日志级别")
    
    # ==================== 数据库配置 ====================
    DB_HOST: str = Field(default="localhost", description="数据库主机")
    DB_PORT: int = Field(default=5432, description="数据库端口")
    DB_USER: str = Field(default="fidesorigin", description="数据库用户")
    DB_PASSWORD: str = Field(default="", description="数据库密码")
    DB_NAME: str = Field(default="fidesorigin", description="数据库名称")
    DB_POOL_SIZE: int = Field(default=20, description="连接池大小")
    DB_MAX_OVERFLOW: int = Field(default=10, description="连接池溢出")
    DB_POOL_TIMEOUT: int = Field(default=30, description="连接池超时")
    DB_POOL_RECYCLE: int = Field(default=3600, description="连接回收时间")
    
    # 同步数据库 URL（Alembic 迁移使用）
    DATABASE_URL_SYNC_VALUE: Optional[str] = Field(default=None, description="同步数据库URL")
    
    @cached_property
    def DATABASE_URL(self) -> str:
        """异步数据库 URL（首次访问后缓存）"""
        # 测试环境使用环境变量覆盖（必须在导入app.config前设置）
        import os
        test_url = os.environ.get("TEST_DATABASE_URL")
        if test_url:
            return test_url
        password = self.DB_PASSWORD or os.environ.get("DB_PASSWORD", "")
        if not password:
            # 无密码时使用无密码连接
            return f"postgresql+asyncpg://{self.DB_USER}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return f"postgresql+asyncpg://{self.DB_USER}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @cached_property
    def DATABASE_URL_SYNC(self) -> str:
        """同步数据库 URL（用于 Alembic，首次访问后缓存）"""
        if self.DATABASE_URL_SYNC_VALUE:
            return self.DATABASE_URL_SYNC_VALUE
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # ==================== Redis 配置 ====================
    REDIS_HOST: str = Field(default="localhost", description="Redis主机")
    REDIS_PORT: int = Field(default=6379, description="Redis端口")
    REDIS_PASSWORD: Optional[str] = Field(default=None, description="Redis密码")
    REDIS_DB: int = Field(default=0, description="Redis数据库")
    REDIS_SSL: bool = Field(default=False, description="Redis SSL")
    REDIS_POOL_SIZE: int = Field(default=50, description="Redis连接池大小")
    REDIS_POOL_TIMEOUT: int = Field(default=10, description="Redis连接池超时")
    
    # ==================== Blockscout 配置 ====================
    BLOCKSCOUT_BASE_URL: str = Field(
        default="https://eth.blockscout.com/api/v2",
        description="Blockscout API 基础 URL"
    )
    BLOCKSCOUT_API_KEY: Optional[str] = Field(default=None, description="Blockscout API Key")
    BLOCKSCOUT_TIMEOUT: int = Field(default=30, description="请求超时")
    BLOCKSCOUT_RATE_LIMIT: int = Field(default=5, description="并发请求限制")
    
    # ==================== CORS 配置 ====================
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "https://fidesorigin.com",
            "https://www.fidesorigin.com",
            "https://fidesorigin-demo.vercel.app",
            "http://localhost:3000",
            "http://localhost:5173",
        ],
        description="允许的 CORS 来源"
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="允许携带凭证")
    CORS_ALLOW_METHODS: List[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        description="允许的 HTTP 方法"
    )
    CORS_ALLOW_HEADERS: List[str] = Field(
        # [MEDIUM Fix #21] 将默认值从 ["*"] 改为具体的头列表
        default_factory=lambda: [
            "Accept",
            "Authorization",
            "Content-Type",
            "X-API-Key",
            "X-CSRF-Token",
            "X-Request-ID",
            "X-Request-Timestamp",
            "X-Request-Signature",
        ],
        description="允许的 HTTP 头"
    )
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def validate_cors_origins(cls, v):
        """验证 CORS 配置，生产环境禁止 *"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    # ==================== API Key / HMAC 配置 ====================
    # 生产环境必须设置强密钥，不允许使用默认值
    SECRET_KEY: str = Field(
        default="",
        description="应用密钥（用于 JWT 签名等）"
    )
    API_KEY: str = Field(
        default="",
        description="API 密钥"
    )
    HMAC_ENABLED: bool = Field(default=True, description="是否启用 HMAC 签名验证")
    HMAC_SECRET: str = Field(default="", description="HMAC 签名密钥")
    
    # ==================== 风险引擎配置 ====================
    RISK_CACHE_TTL: int = Field(default=300, description="风险缓存 TTL（秒）")
    RISK_ENGINE_TIMEOUT: int = Field(default=30, description="风险引擎超时")
    
    # ==================== 监控配置 ====================
    MONITOR_WS_PING_INTERVAL: int = Field(default=30, description="WebSocket ping 间隔")
    MONITOR_MAX_CONNECTIONS: int = Field(default=100, description="最大 WebSocket 连接数")
    
    # ==================== 告警配置 ====================
    ALERT_ENABLED: bool = Field(default=False, description="是否启用告警")
    ALERT_WEBHOOK_URL: Optional[str] = Field(default=None, description="告警 Webhook URL")
    ALERT_COOLDOWN_MINUTES: int = Field(default=5, description="告警冷却时间")
    
    # ==================== 速率限制配置 ====================
    RATE_LIMIT_ENABLED: bool = Field(default=True, description="是否启用速率限制")
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = Field(default=60, description="每分钟请求数限制")
    
    # ==================== 环境变量文件配置 ====================
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )
    
    # ==================== 安全验证 ====================
    @property
    def is_production(self) -> bool:
        """是否是生产环境"""
        return self.APP_ENV == "production"
    
    # [HIGH Fix #6] Admin 密码强度校验
    @staticmethod
    def validate_admin_password(password: str) -> None:
        """
        校验 Admin 密码强度
        - 最小长度 12 字符
        - 生产环境必须包含大小写字母、数字和特殊字符
        """
        if len(password) < 12:
            raise ValueError(
                "ADMIN_PASSWORD must be at least 12 characters long for security. "
                f"Current length: {len(password)}"
            )
        import re
        if not re.search(r"[A-Z]", password):
            raise ValueError("ADMIN_PASSWORD must contain at least one uppercase letter")
        if not re.search(r"[a-z]", password):
            raise ValueError("ADMIN_PASSWORD must contain at least one lowercase letter")
        if not re.search(r"\d", password):
            raise ValueError("ADMIN_PASSWORD must contain at least one digit")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\",\\.<>\/?]", password):
            raise ValueError("ADMIN_PASSWORD must contain at least one special character")
    
    def validate_security(self) -> None:
        """
        生产环境安全验证
        启动时调用，检查关键配置是否已设置
        """
        if self.APP_ENV == "production":
            missing = []
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                missing.append("SECRET_KEY (must be >= 32 chars)")
            if not self.DB_PASSWORD or self.DB_PASSWORD == "default_password":
                missing.append("DB_PASSWORD")
            if not self.API_KEY or self.API_KEY == "dev-api-key-change-in-production":
                missing.append("API_KEY")
            if self.CORS_ORIGINS == ["*"]:
                missing.append("CORS_ORIGINS (cannot be '*')")
            
            # [HIGH Fix #6] 生产环境校验 Admin 密码强度
            import os as _os
            admin_pwd = _os.environ.get("ADMIN_PASSWORD", "")
            if admin_pwd:
                self.validate_admin_password(admin_pwd)
            else:
                missing.append("ADMIN_PASSWORD")
            
            if missing:
                raise ValueError(
                    f"Production security validation failed. "
                    f"Missing or insecure settings: {', '.join(missing)}"
                )


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例（缓存）"""
    settings = Settings()
    settings.validate_security()
    return settings


def reset_settings():
    """重置配置缓存（用于测试）"""
    get_settings.cache_clear()
