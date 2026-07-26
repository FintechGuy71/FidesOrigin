"""
FidesOrigin 认证 Controller
提供 Admin Dashboard 登录端点
"""
import hashlib
import os
import secrets as _secrets
import time
from typing import Dict, Optional, Tuple

import bcrypt

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.exceptions import AuthenticationException
from app.core.logging import get_logger
from app.core.security import (
    JWT_EXPIRE_MINUTES,
    Token,
    create_access_token,
    decode_access_token,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# [CRITICAL Fix #3] Admin 密码哈希缓存，带 TTL（避免每次重新计算，同时允许热更新）
_admin_password_hash: Optional[bytes] = None
_admin_password_cache_time: float = 0.0
_ADMIN_PASSWORD_CACHE_TTL_SECONDS = 300  # 5 分钟 TTL

# [CRITICAL Fix #4] 登录失败计数器（内存级，生产环境应使用 Redis）
# 格式: {username: (failed_count, first_failure_time, locked_until)}
_login_attempts: Dict[str, Tuple[int, float, Optional[float]]] = {}


def _get_admin_password_hash() -> bytes:
    """
    [CRITICAL Fix #3] 获取 Admin 密码的 bcrypt 哈希，带 TTL 缓存。
    
    如果环境变量 ADMIN_PASSWORD 是明文，则自动哈希并缓存。
    如果已经是 bcrypt 哈希（以 $2 开头），直接使用。
    每 5 分钟重新读取环境变量，支持热更新。
    返回空 bytes 表示未配置。
    """
    global _admin_password_hash, _admin_password_cache_time
    
    now = time.time()
    if (_admin_password_hash is not None and 
        (now - _admin_password_cache_time) < _ADMIN_PASSWORD_CACHE_TTL_SECONDS):
        return _admin_password_hash
    
    pwd = os.environ.get("ADMIN_PASSWORD", "")
    if not pwd:
        _admin_password_hash = b""
        _admin_password_cache_time = now
        return b""
    
    # 检测是否已是 bcrypt 哈希
    if pwd.startswith(("$2a$", "$2b$", "$2x$", "$2y$")):
        _admin_password_hash = pwd.encode()
    else:
        # 明文密码：哈希后缓存，并发出安全警告
        _admin_password_hash = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt())
        logger.warning(
            "admin_password_plaintext_detected",
            message="ADMIN_PASSWORD is stored in plaintext. "
                    "Please set a bcrypt-hashed password (e.g. generated via 'python -c \"import bcrypt; print(bcrypt.hashpw(b\\\"yourpassword\\\", bcrypt.gensalt()).decode())\"')"
        )
    
    _admin_password_cache_time = now
    return _admin_password_hash


def _check_account_lockout(username: str) -> Optional[str]:
    """
    [CRITICAL Fix #4] 检查账户是否被锁定。
    
    返回 None 表示未锁定，否则返回锁定原因消息。
    """
    _settings = get_settings()
    max_attempts = _settings.LOGIN_MAX_ATTEMPTS
    lockout_minutes = _settings.LOGIN_LOCKOUT_MINUTES
    
    record = _login_attempts.get(username)
    if not record:
        return None
    
    failed_count, first_failure_time, locked_until = record
    now = time.time()
    
    # 检查是否仍在锁定期内
    if locked_until and now < locked_until:
        remaining = int(locked_until - now)
        return f"Account locked due to too many failed attempts. Try again in {remaining} seconds."
    
    # 锁定已过期，重置
    if locked_until and now >= locked_until:
        _login_attempts.pop(username, None)
        return None
    
    return None


def _record_login_failure(username: str):
    """
    [CRITICAL Fix #4] 记录登录失败。
    """
    _settings = get_settings()
    max_attempts = _settings.LOGIN_MAX_ATTEMPTS
    lockout_minutes = _settings.LOGIN_LOCKOUT_MINUTES
    
    now = time.time()
    record = _login_attempts.get(username)
    
    if not record:
        _login_attempts[username] = (1, now, None)
        return
    
    failed_count, first_failure_time, locked_until = record
    failed_count += 1
    
    # 超过最大尝试次数，锁定账户
    if failed_count >= max_attempts:
        lockout_seconds = lockout_minutes * 60
        locked_until = now + lockout_seconds
        logger.warning(
            "account_locked",
            username=username[:16],
            failed_attempts=failed_count,
            lockout_minutes=lockout_minutes
        )
    
    _login_attempts[username] = (failed_count, first_failure_time, locked_until)


def _record_login_success(username: str):
    """
    [CRITICAL Fix #4] 登录成功后清除失败记录。
    """
    _login_attempts.pop(username, None)


def _prehash_password_for_bcrypt(password: str) -> bytes:
    """
    [MEDIUM Fix #3] bcrypt 最大输入长度为 72 字节。
    对长密码先进行 SHA-256 哈希，再传给 bcrypt，避免截断导致碰撞。
    """
    # 如果密码较短（<= 72 字节），直接返回原始字节
    password_bytes = password.encode("utf-8")
    if len(password_bytes) <= 72:
        return password_bytes
    # 长密码：先 SHA-256 哈希，再传给 bcrypt
    return hashlib.sha256(password_bytes).digest()


class LoginRequest(BaseModel):
    """登录请求模型"""
    username: str = Field(..., min_length=1, max_length=64, description="用户名")
    password: str = Field(..., min_length=1, max_length=128, description="密码")


class UserInfo(BaseModel):
    """用户信息响应"""
    username: str
    role: str
    token_type: str = "bearer"
    expires_in: int = JWT_EXPIRE_MINUTES * 60


@router.post(
    "/login",
    response_model=Token,
    summary="Admin 登录",
    description="管理员登录，获取 JWT access token",
    responses={
        200: {"description": "登录成功"},
        401: {"description": "用户名或密码错误"},
        423: {"description": "账户已锁定"},
    }
)
async def login(body: LoginRequest):
    """
    管理员登录

    使用环境变量 ADMIN_USERNAME / ADMIN_PASSWORD 验证。
    ADMIN_PASSWORD 支持 bcrypt 哈希格式（推荐）或明文（会发出警告）。
    返回 JWT token，后续请求通过 `Authorization: Bearer <token>` 携带。
    
    [CRITICAL Fix #4] 支持账户锁定：连续 N 次失败后将锁定 M 分钟。
    """
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password_hash = _get_admin_password_hash()

    if not admin_password_hash:
        logger.error("ADMIN_PASSWORD not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured",
        )

    # [CRITICAL Fix #4] 检查账户是否被锁定
    lockout_msg = _check_account_lockout(body.username)
    if lockout_msg:
        logger.warning("login_rejected_locked", username=body.username[:16])
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=lockout_msg,
            headers={"WWW-Authenticate": "Bearer", "Retry-After": "900"},
        )

    # 常数时间比较用户名（防止时序攻击）
    username_ok = _secrets.compare_digest(body.username, admin_username)
    
    # [MEDIUM Fix #3] 对长密码预哈希后再传给 bcrypt
    password_bytes = _prehash_password_for_bcrypt(body.password)
    password_ok = bcrypt.checkpw(password_bytes, admin_password_hash)

    if not (username_ok and password_ok):
        # [CRITICAL Fix #4] 记录失败
        _record_login_failure(body.username)
        failed_count, _, _ = _login_attempts.get(body.username, (0, 0, None))
        _settings = get_settings()
        remaining = max(0, _settings.LOGIN_MAX_ATTEMPTS - failed_count)
        
        logger.warning("login_failed", username=body.username[:16], remaining_attempts=remaining)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect username or password. {remaining} attempts remaining.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # [CRITICAL Fix #4] 登录成功，清除失败记录
    _record_login_success(body.username)
    
    access_token = create_access_token(username=body.username, role="admin")

    logger.info("login_success", username=body.username)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=JWT_EXPIRE_MINUTES * 60,
    )


@router.get(
    "/me",
    response_model=UserInfo,
    summary="获取当前用户信息",
    description="验证 JWT token 并返回当前登录用户信息",
    responses={
        200: {"description": "成功"},
        401: {"description": "未认证"},
    }
)
async def get_me(token: Optional[str] = Depends(_oauth2_scheme)):
    """获取当前登录用户信息"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    data = decode_access_token(token)
    return UserInfo(username=data.username, role=data.role)
