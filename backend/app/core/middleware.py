"""
FidesOrigin 中间件集合
"""
from fastapi import Request
from typing import Callable

from app.core.logging import get_logger

logger = get_logger(__name__)


async def rate_limit_middleware(request: Request, call_next: Callable):
    """速率限制中间件（由 security.py 实现）"""
    from app.core.security import rate_limit_middleware as _rate_limit
    return await _rate_limit(request, call_next)


async def request_tracing_middleware(request: Request, call_next: Callable):
    """请求追踪中间件（由 security.py 实现）"""
    from app.core.security import request_tracing_middleware as _tracing
    return await _tracing(request, call_next)


async def security_headers_middleware(request: Request, call_next: Callable):
    """安全响应头中间件（由 security.py 实现）"""
    from app.core.security import security_headers_middleware as _security
    return await _security(request, call_next)


async def csrf_protection_middleware(request: Request, call_next: Callable):
    """CSRF 保护中间件（由 security.py 实现）"""
    from app.core.security import csrf_protection_middleware as _csrf
    return await _csrf(request, call_next)


async def session_timeout_middleware(request: Request, call_next: Callable):
    """会话超时中间件（由 security.py 实现）"""
    from app.core.security import session_timeout_middleware as _session
    return await _session(request, call_next)


async def request_signature_middleware(request: Request, call_next: Callable):
    """请求签名验证中间件（由 security.py 实现）"""
    from app.core.security import request_signature_middleware as _signature
    return await _signature(request, call_next)
