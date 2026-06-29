"""
FidesOrigin 日志配置（重构版）
结构化日志 + 请求追踪 + 性能指标
"""
import logging
import sys
import uuid
from typing import Any, Dict, Optional

import structlog
from fastapi import Request
from structlog.processors import TimeStamper
from structlog.stdlib import BoundLogger, LoggerFactory
from structlog.types import EventDict

from app.config import get_settings

settings = get_settings()


def add_request_id(
    logger: Any,
    method_name: str,
    event_dict: EventDict
) -> EventDict:
    """添加请求 ID 到日志"""
    # 从 contextvars 获取 request_id
    from contextvars import ContextVar
    
    request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
    request_id = request_id_var.get()
    if request_id:
        event_dict["request_id"] = request_id
    return event_dict


def add_service_info(
    logger: Any,
    method_name: str,
    event_dict: EventDict
) -> EventDict:
    """添加服务信息到日志"""
    event_dict["service"] = "fidesorigin"
    event_dict["version"] = settings.APP_VERSION
    event_dict["environment"] = settings.APP_ENV
    return event_dict


def setup_logging() -> None:
    """配置结构化日志"""
    
    # 配置标准库 logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    )
    
    # 配置 structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            TimeStamper(fmt="iso"),
            add_service_info,
            add_request_id,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=LoggerFactory(),
        wrapper_class=BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # 降低第三方库日志级别
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def configure_logging() -> None:
    """配置结构化日志（兼容入口）"""
    setup_logging()

def get_logger(name: str) -> BoundLogger:
    """获取结构化日志记录器"""
    return structlog.get_logger(name)


class RequestContext:
    """请求上下文管理器，自动设置/清除 request_id"""
    
    def __init__(self, request: Optional[Request] = None):
        self.request = request
        self.request_id: str = ""
    
    async def __aenter__(self) -> "RequestContext":
        # 生成或提取 request_id
        if self.request:
            # 从请求头获取
            self.request_id = self.request.headers.get("X-Request-ID", "")
        if not self.request_id:
            # 生成新的 request_id
            self.request_id = str(uuid.uuid4())[:8]
        
        # 设置到 contextvar
        from contextvars import ContextVar
        request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
        request_id_var.set(self.request_id)
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        # 清除 contextvar
        from contextvars import ContextVar
        request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
        request_id_var.set(None)
    
    def get_request_id(self) -> str:
        return self.request_id
