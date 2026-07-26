"""
FidesOrigin 安全中间件
认证、授权、速率限制、请求追踪、CSRF保护、会话管理
"""
import asyncio
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

import jwt
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPBearer, OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.di import get_db
from app.core.exceptions import AuthenticationException, RateLimitException
from app.core.logging import get_logger
from app.models import APIKey

logger = get_logger(__name__)
# [CRITICAL Fix #1] 不缓存 settings 单例在模块级别，每次通过 get_settings() 获取（已缓存）
# settings = get_settings()  # REMOVED - 防止导入时即初始化且被篡改

# 安全 Header
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# ==================== JWT 认证 ====================

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 30  # [K3 Fix] Shortened from 480 to 30 minutes
JWT_REFRESH_EXPIRE_MINUTES = 10080  # 7 days


class TokenData(BaseModel):
    """JWT Token 中携带的用户数据"""
    username: str
    role: str = "admin"


class Token(BaseModel):
    """登录响应模型"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = JWT_EXPIRE_MINUTES * 60


import uuid

# [MEDIUM-1 FIX] Refresh Token 旋转配置
REFRESH_TOKEN_FAMILY_PREFIX = "fidesorigin:refresh_family:"
REFRESH_TOKEN_JTI_PREFIX = "fidesorigin:refresh_jti:"


def _hash_jti(jti: str, secret: str) -> str:
    """
    [CRITICAL Fix #2] 使用 HMAC-SHA256 哈希 JTI，避免在 Redis 中存储明文 JTI。
    Redis key 本身变为哈希值，防止 JTI 泄露。
    """
    return hmac.new(secret.encode(), jti.encode(), hashlib.sha256).hexdigest()


def _get_redis_refresh_client():
    """获取 Redis 连接用于 refresh token 管理"""
    try:
        from app.core.di import get_container
        cache = get_container().cache
        return cache
    except Exception:
        return None


async def create_refresh_token(username: str, family_id: str = None) -> dict:
    """
    生成 JWT refresh token（支持旋转）
    
    [MEDIUM-1 FIX] 实现 refresh token 旋转：
    - 每个 refresh token 有唯一的 jti 和 family_id
    - 刷新时使旧 jti 失效，生成新的 jti
    - 检测 token 重放攻击（旧 token 被再次使用）
    
    Returns:
        dict: {token: str, family_id: str, jti: str}
    """
    _settings = get_settings()
    secret = _settings.SECRET_KEY
    if not secret:
        raise RuntimeError("SECRET_KEY is not configured")
    
    jti = str(uuid.uuid4())
    family = family_id or str(uuid.uuid4())
    
    payload = {
        "sub": username,
        "type": "refresh",
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_REFRESH_EXPIRE_MINUTES * 60,
        "jti": jti,
        "family": family,
    }
    token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)
    
    # [CRITICAL Fix #2] 将 jti 的 HMAC 哈希存入 Redis 白名单，不存储明文 JTI
    redis = _get_redis_refresh_client()
    if redis:
        try:
            jti_hash = _hash_jti(jti, secret)
            await redis.set(
                f"{REFRESH_TOKEN_JTI_PREFIX}{jti_hash}",
                family,
                expire=JWT_REFRESH_EXPIRE_MINUTES * 60
            )
        except Exception:
            pass  # Redis 不可用时降级（token 仍然有效但不支持旋转检测）
    
    return {"token": token, "family_id": family, "jti": jti}


async def rotate_refresh_token(old_token: str) -> dict:
    """
    旋转 refresh token
    
    [MEDIUM-1 FIX] 验证旧 token，使旧 jti 失效，返回新 token。
    如果旧 token 已被使用过（重放攻击），则撤销整个 token family。
    
    Returns:
        dict: {token: str, family_id: str, jti: str}
    
    Raises:
        AuthenticationException: token 无效或已被撤销
    """
    _settings = get_settings()
    secret = _settings.SECRET_KEY
    if not secret:
        raise AuthenticationException("SECRET_KEY is not configured")
    
    try:
        payload = jwt.decode(old_token, secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthenticationException("Refresh token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationException("Invalid refresh token")
    
    username = payload.get("sub")
    old_jti = payload.get("jti")
    family = payload.get("family")
    
    if not username or not old_jti or not family:
        raise AuthenticationException("Invalid refresh token format")
    
    # [CRITICAL Fix #2] 检查旧 jti 的 HMAC 哈希是否在白名单中
    redis = _get_redis_refresh_client()
    if redis:
        try:
            old_jti_hash = _hash_jti(old_jti, secret)
            jti_key = f"{REFRESH_TOKEN_JTI_PREFIX}{old_jti_hash}"
            stored_family = await redis.get(jti_key)
            
            if stored_family is None:
                # 旧 token 已被使用过或已过期 — 可能是重放攻击
                # 撤销整个 token family
                await redis.delete(f"{REFRESH_TOKEN_FAMILY_PREFIX}{family}")
                raise AuthenticationException(
                    "Refresh token reuse detected. Token family revoked."
                )
            
            # 验证 family 匹配
            if stored_family != family:
                raise AuthenticationException("Refresh token family mismatch")
            
            # 使旧 jti 失效
            await redis.delete(jti_key)
        except AuthenticationException:
            raise
        except Exception:
            pass  # Redis 不可用时降级
    
    # 生成新的 refresh token（保持同一个 family）
    return await create_refresh_token(username, family)


# 向后兼容：create_refresh_token 返回字符串


def create_access_token(username: str, role: str = "admin") -> str:
    """生成 JWT access token"""
    # [CRITICAL Fix #2] 移除硬编码 fallback secret，secret 为空时直接报错
    _settings = get_settings()
    secret = _settings.SECRET_KEY
    if not secret:
        raise RuntimeError(
            "SECRET_KEY is not configured. Set it via environment variable or .env file. "
            "JWT token generation is disabled until a proper secret is provided."
        )
    payload = {
        "sub": username,
        "role": role,
        "type": "access",
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRE_MINUTES * 60,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> TokenData:
    """解码并验证 JWT token"""
    # [CRITICAL Fix #2] 移除硬编码 fallback secret
    _settings = get_settings()
    secret = _settings.SECRET_KEY
    if not secret:
        raise AuthenticationException("SECRET_KEY is not configured")
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "admin")
        if username is None:
            raise AuthenticationException("Invalid token: missing subject")
        return TokenData(username=username, role=role)
    except jwt.ExpiredSignatureError:
        raise AuthenticationException("Token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationException("Invalid token")


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    获取当前认证用户（JWT 或 API Key 双模式）

    优先使用 JWT Bearer token，其次使用 X-API-Key。
    返回用户名（JWT）或 API Key 字符串。
    """
    # 模式 1: JWT Bearer Token
    if token:
        token_data = decode_access_token(token)
        return token_data.username

    # 模式 2: API Key
    if api_key:
        if not await verify_api_key(api_key, db):
            raise AuthenticationException("Invalid or expired API key")
        return api_key

    raise AuthenticationException("Authentication required: provide JWT token or API key")

# ==================== CSRF 保护 ====================

CSRF_TOKEN_COOKIE = "csrf_token"
CSRF_TOKEN_HEADER = "X-CSRF-Token"


def generate_csrf_token() -> str:
    """生成 CSRF Token（带旋转机制）"""
    return secrets.token_urlsafe(32)


async def rotate_csrf_token(request: Request, response) -> str:
    """
    旋转 CSRF Token
    
    [HIGH Fix #2] 仅在需要时旋转 Token（如登录后、会话创建时），
    不在每个状态改变请求后旋转，避免竞态条件。
    """
    new_token = generate_csrf_token()
    _settings = get_settings()
    response.set_cookie(
        CSRF_TOKEN_COOKIE,
        new_token,
        httponly=False,  # 需要 JS 读取
        secure=_settings.is_production,
        samesite="strict",
        max_age=86400  # 24小时
    )
    return new_token


async def csrf_protection_middleware(
    request: Request,
    call_next: Callable
):
    """
    CSRF 保护中间件（双重 Cookie 模式）
    
    [HIGH Fix #2] 使用会话级 CSRF Token，不在每个请求后旋转，
    避免并发请求导致的 Token 竞态失效。
    
    对状态改变请求（POST/PUT/PATCH/DELETE）验证 CSRF Token
    安全请求（GET/HEAD/OPTIONS）设置新的 CSRF Token Cookie
    """
    _settings = get_settings()
    
    # 安全方法：设置 CSRF Cookie（如果还没有的话）
    if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
        response = await call_next(request)
        # 如果请求没有 CSRF Cookie，设置一个
        if not request.cookies.get(CSRF_TOKEN_COOKIE):
            csrf_token = generate_csrf_token()
            response.set_cookie(
                CSRF_TOKEN_COOKIE,
                csrf_token,
                httponly=False,  # 需要 JS 读取
                secure=_settings.is_production,
                samesite="strict",
                max_age=86400  # 24小时
            )
        return response
    
    # 状态改变方法：验证 CSRF Token
    # [HIGH Fix #7] 仅对携带 Authorization header（API Key / Bearer token 模式）的请求跳过 CSRF
    # JWT cookie 请求仍需 CSRF 检查
    # X-API-Key header 也视为 API Key 模式，跳过 CSRF
    if request.headers.get("authorization") or request.headers.get("x-api-key"):
        response = await call_next(request)
        return response
    
    # 验证 CSRF Token
    cookie_token = request.cookies.get(CSRF_TOKEN_COOKIE)
    header_token = request.headers.get(CSRF_TOKEN_HEADER)
    
    if not cookie_token or not header_token:
        logger.warning("csrf_token_missing", path=request.url.path, method=request.method)
        # 返回 401 响应而不是抛出异常
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=401,
            content={"error": {"code": "UNAUTHORIZED", "message": "CSRF token missing"}}
        )
    
    # 常数时间比较防止时序攻击
    if not secrets.compare_digest(cookie_token, header_token):
        logger.warning("csrf_token_mismatch", path=request.url.path, method=request.method)
        raise AuthenticationException("CSRF token mismatch")
    
    # [HIGH Fix #2] 验证通过，继续处理请求 — 不再每个请求后旋转 Token
    # Token 只在会话创建/登录时旋转一次，避免竞态条件
    response = await call_next(request)
    return response


# ==================== 会话超时管理 ====================

SESSION_MAX_AGE_MINUTES = 30  # 会话最大存活时间
SESSION_INACTIVITY_MINUTES = 15  # 不活动超时


class SessionManager:
    """会话管理器 - 支持 Redis 和内存两种模式"""
    # [K3 Fix] 生产环境使用 Redis 存储会话，内存模式仅用于开发/单实例
    MAX_SESSIONS = 10000
    
    def __init__(self, redis_url: Optional[str] = None):
        self._sessions: dict = {}  # 内存模式 fallback
        self._redis = None
        _settings = get_settings()
        self._redis_url = redis_url or _settings.REDIS_URL
        if self._redis_url:
            try:
                # [MEDIUM Fix #5] 使用 redis.asyncio 替代已弃用的 aioredis
                import redis.asyncio as redis_async
                self._redis = redis_async.from_url(self._redis_url, decode_responses=True)
                logger.info("session_manager_redis_enabled", redis_url=self._redis_url)
            except Exception as e:
                logger.warning("session_manager_redis_fallback", error=str(e), 
                              message="Redis not available, falling back to in-memory sessions. "
                                      "This is NOT recommended for production multi-instance deployments.")
    
    async def _get_redis(self):
        """获取 Redis 连接"""
        if self._redis:
            return self._redis
        return None
    
    def _session_key(self, session_id: str) -> str:
        """生成 Redis 会话键"""
        return f"session:{session_id}"
    
    async def create_session(self, session_id: str, data: dict = None) -> dict:
        """创建新会话"""
        now = datetime.now(timezone.utc)
        session = {
            "created_at": now.isoformat(),
            "last_activity": now.isoformat(),
            "data": data or {}
        }
        
        redis = await self._get_redis()
        if redis:
            await redis.hset(self._session_key(session_id), mapping={
                "created_at": session["created_at"],
                "last_activity": session["last_activity"],
                "data": json.dumps(session["data"])
            })
            await redis.expire(self._session_key(session_id), SESSION_MAX_AGE_MINUTES * 60)
        else:
            # 内存模式：检查最大会话数
            if len(self._sessions) >= self.MAX_SESSIONS:
                self.cleanup_expired()
                if len(self._sessions) >= self.MAX_SESSIONS:
                    raise RuntimeError("Maximum session limit reached")
            self._sessions[session_id] = session
        
        return session
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """获取会话，同时检查是否过期"""
        redis = await self._get_redis()
        if redis:
            session_data = await redis.hgetall(self._session_key(session_id))
            if not session_data:
                return None
            
            now = datetime.now(timezone.utc)
            created_at = datetime.fromisoformat(session_data.get("created_at", "1970-01-01T00:00:00+00:00"))
            last_activity = datetime.fromisoformat(session_data.get("last_activity", "1970-01-01T00:00:00+00:00"))
            
            max_age = timedelta(minutes=SESSION_MAX_AGE_MINUTES)
            inactivity = timedelta(minutes=SESSION_INACTIVITY_MINUTES)
            
            if now - created_at > max_age or now - last_activity > inactivity:
                await self.destroy_session(session_id)
                return None
            
            # 更新最后活动时间
            await redis.hset(self._session_key(session_id), "last_activity", now.isoformat())
            await redis.expire(self._session_key(session_id), SESSION_MAX_AGE_MINUTES * 60)
            
            return {
                "created_at": created_at,
                "last_activity": now,
                "data": json.loads(session_data.get("data", "{}"))
            }
        else:
            # 内存模式
            session = self._sessions.get(session_id)
            if not session:
                return None
            
            now = datetime.now(timezone.utc)
            max_age = timedelta(minutes=SESSION_MAX_AGE_MINUTES)
            inactivity = timedelta(minutes=SESSION_INACTIVITY_MINUTES)
            
            if (now - session["created_at"] > max_age or
                now - session["last_activity"] > inactivity):
                self.destroy_session(session_id)
                return None
            
            session["last_activity"] = now
            return session
    
    async def destroy_session(self, session_id: str):
        """销毁会话"""
        redis = await self._get_redis()
        if redis:
            await redis.delete(self._session_key(session_id))
        else:
            self._sessions.pop(session_id, None)
    
    def cleanup_expired(self):
        """清理过期会话（仅内存模式）"""
        now = datetime.now(timezone.utc)
        expired = []
        for sid, session in self._sessions.items():
            max_age = timedelta(minutes=SESSION_MAX_AGE_MINUTES)
            inactivity = timedelta(minutes=SESSION_INACTIVITY_MINUTES)
            if (now - session["created_at"] > max_age or
                now - session["last_activity"] > inactivity):
                expired.append(sid)
        for sid in expired:
            self.destroy_session(sid)


# 全局会话管理器
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """获取会话管理器"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager


async def session_timeout_middleware(
    request: Request,
    call_next: Callable
):
    """
    会话超时中间件
    
    检查会话是否过期，更新最后活动时间
    """
    # 仅对需要会话的路径检查
    session_id = request.cookies.get("session_id")
    
    if session_id:
        manager = get_session_manager()
        session = await manager.get_session(session_id)
        
        if session is None:
            # 会话已过期，清除 Cookie
            response = await call_next(request)
            response.delete_cookie("session_id")
            logger.info("session_expired", session_id=session_id[:8])
            return response
    
    response = await call_next(request)
    return response


# ==================== 请求签名验证 ====================

class RequestSigner:
    """请求签名验证器"""
    
    def __init__(self, secret: str):
        self.secret = secret.encode()
    
    def sign_request(
        self,
        method: str,
        path: str,
        timestamp: str,
        body: str = ""
    ) -> str:
        """生成请求签名"""
        message = f"{method}\n{path}\n{timestamp}\n{body}"
        signature = hmac.new(
            self.secret,
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def verify(
        self,
        method: str,
        path: str,
        timestamp: str,
        signature: str,
        body: str = "",
        max_age_seconds: int = 300  # 5分钟有效期
    ) -> bool:
        """
        验证请求签名
        
        同时检查时间戳防止重放攻击
        """
        # 检查时间戳
        try:
            ts = int(timestamp)
            now = int(time.time())
            if abs(now - ts) > max_age_seconds:
                logger.warning("request_signature_timestamp_expired",
                           timestamp=timestamp, now=now)
                return False
        except ValueError:
            logger.warning("request_signature_invalid_timestamp", timestamp=timestamp)
            return False
        
        # 验证签名
        expected = self.sign_request(method, path, timestamp, body)
        return secrets.compare_digest(expected, signature)


def get_request_signer() -> RequestSigner:
    """获取请求签名验证器"""
    _settings = get_settings()
    return RequestSigner(_settings.HMAC_SECRET or _settings.SECRET_KEY)


async def request_signature_middleware(
    request: Request,
    call_next: Callable
):
    """
    请求签名验证中间件
    
    [M-6 Fix] 扩展保护范围：所有写操作端点（POST/PUT/PATCH/DELETE）到 /api/v1/* 路径
    以及原有敏感端点，均需验证请求签名以防止重放攻击
    """
    # 对 /api/v1/ 下的所有写操作端点验证签名
    is_api_write = (
        request.url.path.startswith("/api/v1/") and
        request.method in ("POST", "PUT", "PATCH", "DELETE")
    )
    # 保留原有的敏感端点列表（读操作也需要保护）
    sensitive_paths = ["/api/v1/address/report", "/api/v1/rules"]
    is_sensitive_path = any(request.url.path.startswith(p) for p in sensitive_paths)
    
    if (is_api_write or is_sensitive_path) and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        timestamp = request.headers.get("X-Request-Timestamp")
        signature = request.headers.get("X-Request-Signature")
        
        if not timestamp or not signature:
            logger.warning("request_signature_missing", path=request.url.path, method=request.method)
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={"error": {"code": "UNAUTHORIZED", "message": "Request signature required"}}
            )
        
        # 读取请求体
        body = ""
        try:
            body_bytes = await request.body()
            body = body_bytes.decode("utf-8")
        except Exception:
            pass
        
        signer = get_request_signer()
        if not signer.verify(request.method, request.url.path, timestamp, signature, body):
            logger.warning("request_signature_invalid", path=request.url.path, method=request.method)
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={"error": {"code": "UNAUTHORIZED", "message": "Invalid request signature"}}
            )
    
    response = await call_next(request)
    return response


# ==================== 日志脱敏 ====================

SENSITIVE_FIELDS = frozenset({
    "password", "secret", "token", "api_key", "apikey", "api-key",
    "authorization", "auth", "cookie", "session", "credit_card",
    "cvv", "ssn", "private_key", "mnemonic", "seed",
    "db_password", "redis_password", "hmac_secret", "bearer",
    "refresh_token", "access_token", "x-api-key",
})

SENSITIVE_PATTERNS = [
    r"(password|secret|token|api_key)\s*[=:]\s*[^\s&]+",
    r"(0x[a-fA-F0-9]{64})",  # 私钥格式
    r"(Bearer\s+)[a-zA-Z0-9_\-\.]+",
]


def mask_sensitive_data(data: dict) -> dict:
    """
    递归脱敏敏感数据
    
    [MEDIUM Fix #4] 使用精确键名匹配，避免子串匹配导致的误脱敏。
    例如 "user_password" 匹配 "password" 是合理的，但 "api" 不应匹配 "api_key"。
    """
    if not isinstance(data, dict):
        return data
    
    masked = {}
    for key, value in data.items():
        key_lower = key.lower().replace("-", "_")
        
        # [MEDIUM Fix #4] 精确键名匹配：键名本身或下划线分隔的部分匹配敏感字段
        is_sensitive = key_lower in SENSITIVE_FIELDS
        if not is_sensitive:
            # 也检查下划线前缀/后缀形式，如 user_password、api_key_value
            parts = key_lower.split("_")
            is_sensitive = any(part in SENSITIVE_FIELDS for part in parts)
        
        if is_sensitive:
            if isinstance(value, str) and len(value) > 4:
                masked[key] = value[:2] + "***" + value[-2:]
            else:
                masked[key] = "***"
        elif isinstance(value, dict):
            masked[key] = mask_sensitive_data(value)
        elif isinstance(value, list):
            masked[key] = [
                mask_sensitive_data(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            masked[key] = value
    
    return masked


def sanitize_log_message(message: str) -> str:
    """清理日志消息中的敏感信息"""
    import re
    
    # 替换敏感模式
    for pattern in SENSITIVE_PATTERNS:
        message = re.sub(pattern, r"\1***", message, flags=re.IGNORECASE)
    
    return message


# ==================== 速率限制器 ====================


class RateLimiter:
    """
    速率限制器（基于 Redis）
    
    实现滑动窗口计数器算法
    """
    
    def __init__(self):
        _settings = get_settings()
        self.requests_per_minute = _settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        self._local_cache: dict = {}  # 本地缓存（Redis 不可用时降级）
        # [MEDIUM-2 FIX] 记录上次全局清理时间，防止攻击者用大量唯一 key 撑爆内存
        self._last_local_cleanup: int = 0
        self._local_cleanup_interval: int = 60  # 每 60 秒触发一次全局清理
    
    async def is_allowed(self, key: str) -> bool:
        """
        检查是否允许请求

        [HIGH-1 FIX] 使用原子化 INCR 替代 GET+INCR 两步操作，消除竞态条件。
        并发场景下，旧代码可能让 ~2x 配置速率的请求通过。

        Args:
            key: 限流键（IP + API Key 或用户 ID）

        Returns:
            bool: 是否允许
        """
        try:
            from app.core.di import get_container
            cache = get_container().cache

            # [HIGH-1 FIX] 添加服务前缀防止多服务共享 Redis 时的 key 碰撞
            cache_key = f"fidesorigin:rate_limit:{key}"

            # [HIGH-1 FIX] 原子化 INCR：先递增，再根据返回值判断
            count = await cache.incr(cache_key)
            if count == 1:
                # 首次请求，设置窗口过期时间
                await cache.expire(cache_key, 60)

            if count > self.requests_per_minute:
                return False
            return True

        except Exception as e:
            # Redis 不可用时降级到本地内存
            logger.warning("rate_limit_redis_fallback", error=str(e))
            now = int(time.time())
            window_start = now - 60
            return self._local_check(key, now, window_start)
    
    def _cleanup_local_cache(self, now: int, window_start: int):
        """[MEDIUM-2 FIX] 全局清理本地缓存中所有过期条目"""
        expired_keys = []
        for k, timestamps in self._local_cache.items():
            self._local_cache[k] = [ts for ts in timestamps if ts > window_start]
            if not self._local_cache[k]:
                expired_keys.append(k)
        for k in expired_keys:
            del self._local_cache[k]
        self._last_local_cleanup = now
    
    def _local_check(self, key: str, now: int, window_start: int) -> bool:
        """本地内存限流（降级方案）"""
        # [MEDIUM-2 FIX] 周期性全局清理，防止攻击者用大量唯一 key 撑爆内存
        if now - self._last_local_cleanup > self._local_cleanup_interval:
            self._cleanup_local_cache(now, window_start)
        
        if key not in self._local_cache:
            self._local_cache[key] = []
        
        # 清理过期记录（防止内存泄漏）
        self._local_cache[key] = [
            ts for ts in self._local_cache[key] if ts > window_start
        ]
        
        # 清理空键
        if not self._local_cache[key]:
            del self._local_cache[key]
            return True
        
        if len(self._local_cache[key]) >= self.requests_per_minute:
            return False
        
        self._local_cache[key].append(now)
        return True
    
    def cleanup_local_cache(self):
        """清理本地缓存中的过期记录"""
        now = int(time.time())
        window_start = now - 60
        expired_keys = []
        
        for key, timestamps in self._local_cache.items():
            self._local_cache[key] = [
                ts for ts in timestamps if ts > window_start
            ]
            if not self._local_cache[key]:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self._local_cache[key]
    
    async def get_remaining(self, key: str) -> int:
        """获取剩余请求次数"""
        try:
            from app.core.di import get_container
            cache = get_container().cache
            
            # [MEDIUM-3 FIX] 添加服务前缀防止多服务共享 Redis 时的 key 碰撞
            cache_key = f"fidesorigin:rate_limit:{key}"
            count = await cache.get(cache_key)
            
            if count is None:
                return self.requests_per_minute
            
            return max(0, self.requests_per_minute - int(count))
            
        except Exception:
            # 降级
            now = int(time.time())
            window_start = now - 60
            
            if key in self._local_cache:
                count = len([ts for ts in self._local_cache[key] if ts > window_start])
                return max(0, self.requests_per_minute - count)
            
            return self.requests_per_minute


# 全局速率限制器实例
_rate_limiter: Optional[RateLimiter] = None

# 会话清理锁
_session_cleanup_lock = asyncio.Lock()


def get_rate_limiter() -> RateLimiter:
    """获取速率限制器"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def cleanup_expired_sessions():
    """定期清理过期会话"""
    manager = get_session_manager()
    async with _session_cleanup_lock:
        manager.cleanup_expired()


async def start_session_cleanup_task():
    """启动会话清理后台任务"""
    while True:
        await asyncio.sleep(300)  # 每5分钟清理一次
        try:
            await cleanup_expired_sessions()
        except Exception as e:
            logger.error("session_cleanup_error", error=str(e))


async def verify_api_key(
    api_key: str,
    db: AsyncSession
) -> bool:
    """
    验证 API Key
    
    [CRITICAL Fix #5] 使用 HMAC-SHA256(pepper + key) 作为查找哈希，
    替代无盐 SHA-256，防止彩虹表攻击。
    
    [HIGH Fix #5] 使用 secrets.compare_digest() 进行常数时间比较，
    防止时序攻击。
    """
    if not api_key:
        return False
    
    _settings = get_settings()
    pepper = _settings.API_KEY_PEPPER or _settings.SECRET_KEY
    if not pepper:
        logger.error("api_key_pepper_not_configured")
        return False
    
    try:
        # [CRITICAL Fix #5] 计算 HMAC-SHA256(pepper, api_key) 作为查找哈希
        key_lookup_hash = hmac.new(
            pepper.encode(),
            api_key.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # 查询数据库：使用 key_lookup_hash 查找
        result = await db.execute(
            select(APIKey).where(
                APIKey.key_lookup_hash == key_lookup_hash,
                APIKey.is_active == True
            )
        )
        key_record = result.scalar_one_or_none()
        
        if not key_record:
            logger.warning("api_key_invalid", api_key_prefix=api_key[:8] if len(api_key) > 8 else "")
            return False
        
        # [MEDIUM-1 FIX] key_hash 已废弃（原 unsalted SHA-256 存在安全风险），
        # 仅保留 key_lookup_hash（HMAC-SHA256）进行安全查找。
        # 不再对 key_hash 做二次验证。

        # 检查是否过期
        if key_record.expires_at and key_record.expires_at < datetime.now(timezone.utc):
            logger.warning("api_key_expired", api_key_id=str(key_record.id))
            return False
        
        # 更新最后使用时间
        key_record.last_used_at = datetime.now(timezone.utc)
        await db.commit()
        
        logger.info("api_key_verified", api_key_id=str(key_record.id))
        return True
        
    except Exception as e:
        logger.error("api_key_verification_error", error=str(e))
        return False


async def get_current_api_key(
    api_key: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> str:
    """
    获取当前 API Key（依赖注入）
    
    用于需要认证的端点
    """
    if not api_key:
        raise AuthenticationException("Missing API key")
    
    if not await verify_api_key(api_key, db):
        raise AuthenticationException("Invalid or expired API key")
    
    return api_key


def _get_client_ip(request: Request) -> str:
    """
    [HIGH Fix #1] 安全获取客户端真实 IP，防止 X-Forwarded-For 伪造。
    
    1. 如果配置了 TRUSTED_PROXIES，只信任这些代理发送的 X-Forwarded-For。
    2. 从 X-Forwarded-For 链中取最右侧的不可信代理之前的 IP 作为真实客户端 IP。
    3. 无代理或无信任配置时，直接返回 request.client.host。
    """
    _settings = get_settings()
    trusted_proxies = set(_settings.TRUSTED_PROXIES)
    direct_ip = request.client.host if request.client else "unknown"
    
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if not forwarded_for:
        return direct_ip
    
    # 如果没有配置可信代理，不信任 X-Forwarded-For，防止伪造
    if not trusted_proxies:
        return direct_ip
    
    # 解析 X-Forwarded-For 链（从左到右：客户端 -> 最近代理）
    ips = [ip.strip() for ip in forwarded_for.split(",")]
    
    # 从右向左扫描，找到第一个不在可信代理列表中的 IP（真实客户端）
    # 如果所有 IP 都是可信代理，返回最左侧的（最原始客户端）
    for ip in reversed(ips):
        if ip not in trusted_proxies:
            return ip
    
    # 全是可信代理，返回最左侧（最原始的）
    return ips[0] if ips else direct_ip


async def rate_limit_middleware(
    request: Request,
    call_next: Callable
):
    """
    速率限制中间件
    
    基于客户端 IP 和 API Key 的组合限流
    跳过健康检查端点
    """
    # 跳过健康检查端点
    if request.url.path in ("/health", "/ready", "/"):
        return await call_next(request)
    
    # [HIGH Fix #1] 安全获取客户端 IP，防止 X-Forwarded-For 伪造
    client_ip = _get_client_ip(request)
    
    api_key = request.headers.get("X-API-Key", "")
    
    # 构建限流键 - 对匿名用户更严格
    if api_key:
        rate_key = f"api:{api_key[:16]}"
    else:
        rate_key = f"ip:{client_ip}"
    
    limiter = get_rate_limiter()
    
    # 检查限流
    if not await limiter.is_allowed(rate_key):
        remaining = await limiter.get_remaining(rate_key)
        
        logger.warning(
            "rate_limit_exceeded",
            client_ip=client_ip,
            api_key_prefix=api_key[:8] if api_key else None,
            path=request.url.path
        )
        
        raise RateLimitException(
            message="Rate limit exceeded",
            retry_after=60
        )
    
    # 继续处理请求
    response = await call_next(request)
    
    # 添加限流响应头
    remaining = await limiter.get_remaining(rate_key)
    _settings = get_settings()
    response.headers["X-RateLimit-Limit"] = str(_settings.RATE_LIMIT_REQUESTS_PER_MINUTE)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    
    return response


async def request_tracing_middleware(
    request: Request,
    call_next: Callable
):
    """
    请求追踪中间件
    
    为每个请求生成唯一追踪 ID，并记录请求/响应信息
    注意：不记录敏感信息（API Key、密码等）
    """
    import uuid
    
    # 生成或复用追踪 ID
    trace_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.trace_id = trace_id
    
    # 记录请求开始 - 安全地记录信息，不泄露敏感数据
    start_time = time.time()
    
    # 安全地获取 user agent，限制长度
    user_agent = request.headers.get("User-Agent", "")[:200]
    
    # 脱敏：不记录 API Key、Authorization 等敏感头
    safe_headers = dict(request.headers)
    for sensitive_header in ["authorization", "x-api-key", "cookie", "x-csrf-token", "x-request-signature"]:
        if sensitive_header in safe_headers:
            safe_headers[sensitive_header] = "***"
    
    # 脱敏 URL 查询参数
    safe_url = str(request.url)
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
    parsed = urlsplit(safe_url)
    query_params = parse_qsl(parsed.query)
    safe_params = []
    for param_name, param_value in query_params:
        if any(s in param_name.lower() for s in ["api_key", "token", "secret", "password", "key"]):
            safe_params.append((param_name, "***"))
        else:
            safe_params.append((param_name, param_value))
    safe_query = urlencode(safe_params)
    safe_url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, safe_query, parsed.fragment))
    
    logger.info(
        "request_started",
        trace_id=trace_id,
        method=request.method,
        path=request.url.path,
        query=safe_query,
        client_ip=request.client.host if request.client else "unknown",
        user_agent=user_agent
    )
    
    # 处理请求
    try:
        response = await call_next(request)
        
        # 计算耗时
        duration_ms = (time.time() - start_time) * 1000
        
        # 记录请求完成
        logger.info(
            "request_completed",
            trace_id=trace_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2)
        )
        
        # 添加追踪 ID 到响应头
        response.headers["X-Request-ID"] = trace_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        return response
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        
        # 使用脱敏函数处理错误信息
        error_msg = sanitize_log_message(str(e))
        
        # 不记录异常的具体内容到日志，避免泄露敏感信息
        logger.error(
            "request_failed",
            trace_id=trace_id,
            method=request.method,
            path=request.url.path,
            error_type=type(e).__name__,
            duration_ms=round(duration_ms, 2)
        )
        
        raise


async def security_headers_middleware(
    request: Request,
    call_next: Callable
):
    """
    安全响应头中间件
    
    添加安全相关的 HTTP 响应头
    """
    response = await call_next(request)
    
    # 安全响应头
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.fidesorigin.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    
    return response


class HMACValidator:
    """
    HMAC 签名验证器
    
    用于 Webhook 和敏感 API 的签名验证
    """
    
    def __init__(self, secret: str):
        self.secret = secret.encode()
    
    def generate_signature(self, payload: str, timestamp: str) -> str:
        """生成 HMAC 签名"""
        message = f"{timestamp}.{payload}"
        signature = hmac.new(
            self.secret,
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def verify(self, payload: str, timestamp: str, signature: str) -> bool:
        """
        验证 HMAC 签名
        
        使用 secrets.compare_digest 防止时序攻击
        """
        expected = self.generate_signature(payload, timestamp)
        return secrets.compare_digest(expected, signature)


def get_hmac_validator() -> HMACValidator:
    """获取 HMAC 验证器"""
    return HMACValidator(settings.SECRET_KEY)
