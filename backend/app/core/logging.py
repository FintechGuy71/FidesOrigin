"""
FidesOrigin 日志配置（重构版）
结构化日志 + 请求追踪 + 性能指标 + 敏感信息自动脱敏
"""
import logging
import re
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

# [P2-4 Fix] 敏感字段列表 — 日志中遇到这些键时自动脱敏
_SENSITIVE_FIELDS = frozenset({
    "password", "secret", "token", "api_key", "apikey", "api-key",
    "authorization", "auth", "cookie", "session", "credit_card",
    "cvv", "ssn", "private_key", "mnemonic", "seed",
    "db_password", "redis_password", "hmac_secret", "bearer",
    "refresh_token", "access_token", "apikey", "x-api-key",
})

# [P2-4 Fix] 敏感值正则模式 — 用于检测值中的敏感信息
_SENSITIVE_VALUE_PATTERNS = [
    re.compile(r"(0x[a-fA-F0-9]{64})"),              # 以太坊私钥（不要求整串匹配）
    re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]+"),     # Bearer token
    re.compile(r"(Basic\s+)[a-zA-Z0-9+/=]+"),        # Basic auth
]


def _is_sensitive_key(key: str) -> bool:
    """检查键名是否为敏感字段"""
    key_lower = key.lower().replace("-", "_").replace(" ", "_")
    return any(s in key_lower for s in _SENSITIVE_FIELDS)


def _mask_value(value: Any) -> Any:
    """对敏感值进行脱敏处理"""
    if not isinstance(value, str):
        return value
    if len(value) <= 4:
        return "***"
    # 保留首尾各2字符，中间用 *** 替代
    return f"{value[:2]}***{value[-2:]}"


def _recurse_mask(data: Any) -> Any:
    """递归脱敏数据结构中的敏感信息"""
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            if _is_sensitive_key(k):
                masked[k] = _mask_value(v) if isinstance(v, str) else "***"
            elif isinstance(v, (dict, list)):
                masked[k] = _recurse_mask(v)
            else:
                # 检查值本身是否匹配敏感模式
                if isinstance(v, str):
                    for pattern in _SENSITIVE_VALUE_PATTERNS:
                        if pattern.match(v):
                            masked[k] = _mask_value(v)
                            break
                    else:
                        masked[k] = v
                else:
                    masked[k] = v
        return masked
    elif isinstance(data, list):
        return [_recurse_mask(item) for item in data]
    elif isinstance(data, str):
        for pattern in _SENSITIVE_VALUE_PATTERNS:
            if pattern.match(data):
                return _mask_value(data)
        return data
    return data


def sanitize_event_dict(
    logger: Any,
    method_name: str,
    event_dict: EventDict
) -> EventDict:
    """
    [P2-4 Fix] structlog processor: 自动脱敏日志事件中的敏感信息
    
    在日志输出前递归扫描 event_dict，对敏感键和敏感值进行脱敏。
    """
    # 保留原始 event 消息
    event_msg = event_dict.get("event", "")
    if isinstance(event_msg, str):
        # 对 event 消息也进行简单的脱敏处理
        for pattern in _SENSITIVE_VALUE_PATTERNS:
            event_msg = pattern.sub(lambda m: _mask_value(m.group(0)), event_msg)
        event_dict["event"] = event_msg

    # 递归脱敏所有字段（排除 structlog 内部字段）
    for key in list(event_dict.keys()):
        if key in ("event", "timestamp", "logger", "level"):
            continue
        # [P2-4 Fix] 如果键名本身是敏感字段，直接脱敏值
        if _is_sensitive_key(key):
            value = event_dict[key]
            event_dict[key] = _mask_value(value) if isinstance(value, str) else "***"
        else:
            event_dict[key] = _recurse_mask(event_dict[key])

    return event_dict


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
    # [P2-4 Fix] 添加 sanitize_event_dict processor 在 JSONRenderer 之前
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
            # [P2-4 Fix] 敏感信息自动脱敏 — 必须在 UnicodeDecoder 和 JSONRenderer 之前
            sanitize_event_dict,
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
