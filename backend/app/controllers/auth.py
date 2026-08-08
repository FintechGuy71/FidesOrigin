"""
FidesOrigin 认证 Controller
提供 Admin Dashboard 登录端点
"""
import hashlib
import json
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
    create_refresh_token,
    decode_access_token,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# [CRITICAL Fix #3] Admin 密码哈希缓存，带 TTL（避免每次重新计算，同时允许热更新）
_admin_password_hash: Optional[bytes] = None
_admin_password_cache_time: float = 0.0
_ADMIN_PASSWORD_CACHE_TTL_SECONDS = 300  # 5 分钟 TTL

# [HIGH-2 FIX] 登录失败计数器已迁移至 Redis。
# 保留内存级 fallback 仅用于开发/单实例场景。
_login_attempts_fallback: Dict[str, Tuple[int, float, Optional[float]]] = {}

LOGIN_LOCKOUT_PREFIX = "fidesorigin:login_lockout"


def _get_lockout_key(username: str) -> str:
    """生成 Redis 登录锁定键"""
    return f"{LOGIN_LOCKOUT_PREFIX}:{username}"


async def _get_redis_client():
    """获取 Redis 客户端（如可用）"""
    try:
        from app.core.di import get_container
        return get_container().cache
    except Exception:
        return None


async def _check_account_lockout(username: str) -> Optional[str]:
    """
    [HIGH-2 FIX] 检查账户是否被锁定。
    使用 Redis 实现分布式锁定，多 worker 场景下共享状态。

    返回 None 表示未锁定，否则返回锁定原因消息。
    """
    _settings = get_settings()
    max_attempts = _settings.LOGIN_MAX_ATTEMPTS
    lockout_minutes = _settings.LOGIN_LOCKOUT_MINUTES
    lockout_seconds = lockout_minutes * 60
    now = time.time()

    redis = await _get_redis_client()
    if redis:
        try:
            key = _get_lockout_key(username)
            raw = await redis.get(key)
            if raw is None:
                return None

            data = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
            failed_count = data.get("failed_count", 0)
            locked_until = data.get("locked_until")

            # 检查是否仍在锁定期内
            if locked_until and now < locked_until:
                remaining = int(locked_until - now)
                return f"Account locked due to too many failed attempts. Try again in {remaining} seconds."

            # 锁定已过期但仍在窗口内：若失败次数未达上限，允许继续尝试
            if failed_count < max_attempts:
                return None

            # 失败次数已达上限但锁定已过期，重置
            await redis.delete(key)
            return None
        except Exception as e:
            logger.warning("login_lockout_redis_error", error=str(e), username=username[:16])
            # 降级到内存 fallback

    # 内存 fallback（开发/单实例）
    record = _login_attempts_fallback.get(username)
    if not record:
        return None

    failed_count, first_failure_time, locked_until = record

    if locked_until and now < locked_until:
        remaining = int(locked_until - now)
        return f"Account locked due to too many failed attempts. Try again in {remaining} seconds."

    if locked_until and now >= locked_until:
        _login_attempts_fallback.pop(username, None)
        return None

    return None


async def _record_login_failure(username: str):
    """
    [HIGH-2 FIX] 记录登录失败。
    使用 Redis 实现分布式计数，多 worker 场景下共享状态。
    """
    _settings = get_settings()
    max_attempts = _settings.LOGIN_MAX_ATTEMPTS
    lockout_minutes = _settings.LOGIN_LOCKOUT_MINUTES
    lockout_seconds = lockout_minutes * 60
    now = time.time()

    redis = await _get_redis_client()
    if redis:
        try:
            key = _get_lockout_key(username)
            raw = await redis.get(key)

            if raw is None:
                data = {"failed_count": 1, "first_failure_time": now, "locked_until": None}
                await redis.set(key, json.dumps(data), expire=lockout_seconds * 2)
                return

            data = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
            data["failed_count"] = data.get("failed_count", 0) + 1

            if data["failed_count"] >= max_attempts:
                data["locked_until"] = now + lockout_seconds
                logger.warning(
                    "account_locked",
                    username=username[:16],
                    failed_attempts=data["failed_count"],
                    lockout_minutes=lockout_minutes
                )

            await redis.set(key, json.dumps(data), expire=lockout_seconds * 2)
            return
        except Exception as e:
            logger.warning("login_failure_redis_error", error=str(e), username=username[:16])
            # 降级到内存 fallback

    # 内存 fallback
    record = _login_attempts_fallback.get(username)
    if not record:
        _login_attempts_fallback[username] = (1, now, None)
        return

    failed_count, first_failure_time, locked_until = record
    failed_count += 1

    if failed_count >= max_attempts:
        locked_until = now + lockout_seconds
        logger.warning(
            "account_locked",
            username=username[:16],
            failed_attempts=failed_count,
            lockout_minutes=lockout_minutes
        )

    _login_attempts_fallback[username] = (failed_count, first_failure_time, locked_until)


async def _record_login_success(username: str):
    """
    [HIGH-2 FIX] 登录成功后清除失败记录。
    """
    redis = await _get_redis_client()
    if redis:
        try:
            await redis.delete(_get_lockout_key(username))
            return
        except Exception as e:
            logger.warning("login_success_redis_error", error=str(e), username=username[:16])

    _login_attempts_fallback.pop(username, None)


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

    [HIGH-2 FIX] 支持分布式账户锁定：连续 N 次失败后将锁定 M 分钟。
    """
    # [F-20 FIX R2] 用户名不再提供默认值 "admin"（可预测用户名降低爆破成本）。
    # 未配置 ADMIN_USERNAME 时与密码未配置一样拒绝服务（fail-closed）。
    admin_username = os.environ.get("ADMIN_USERNAME", "")
    admin_password_hash = _get_admin_password_hash()

    if not admin_username:
        logger.error("ADMIN_USERNAME not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured",
        )

    if not admin_password_hash:
        logger.error("ADMIN_PASSWORD not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured",
        )

    # [HIGH-2 FIX] 检查账户是否被锁定（分布式 Redis）
    lockout_msg = await _check_account_lockout(body.username)
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
        # [HIGH-2 FIX] 记录失败（分布式）
        await _record_login_failure(body.username)

        # 获取当前失败次数（仅用于服务端日志）
        failed_count = 0
        redis = await _get_redis_client()
        if redis:
            try:
                raw = await redis.get(_get_lockout_key(body.username))
                if raw:
                    data = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode())
                    failed_count = data.get("failed_count", 0)
            except Exception:
                pass
        else:
            record = _login_attempts_fallback.get(body.username)
            if record:
                failed_count = record[0]

        _settings = get_settings()
        remaining = max(0, _settings.LOGIN_MAX_ATTEMPTS - failed_count)

        logger.warning("login_failed", username=body.username[:16], remaining_attempts=remaining)
        # [F-20 FIX R2] 响应不再泄露剩余尝试次数（OWASP ASVS 2.2.1：统一错误消息，
        # 防止攻击者校准爆破节奏）。剩余次数仅保留在服务端日志中。
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # [HIGH-2 FIX] 登录成功，清除失败记录（分布式）
    await _record_login_success(body.username)

    access_token = create_access_token(username=body.username, role="admin")
    refresh_token_data = await create_refresh_token(username=body.username)

    logger.info("login_success", username=body.username)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token_data["token"],
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
