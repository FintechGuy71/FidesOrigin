"""
FidesOrigin 认证 Controller
提供 Admin Dashboard 登录端点
"""
import os
import secrets as _secrets
from typing import Optional

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
settings = get_settings()

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# [P0-3 Fix] Admin 密码哈希缓存（避免每次重新计算）
_admin_password_hash: Optional[bytes] = None


def _get_admin_password_hash() -> bytes:
    """
    [P0-3 Fix] 获取 Admin 密码的 bcrypt 哈希。
    
    如果环境变量 ADMIN_PASSWORD 是明文，则自动哈希并缓存。
    如果已经是 bcrypt 哈希（以 $2 开头），直接使用。
    返回空 bytes 表示未配置。
    """
    global _admin_password_hash
    if _admin_password_hash is not None:
        return _admin_password_hash
    
    pwd = os.environ.get("ADMIN_PASSWORD", "")
    if not pwd:
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
    
    return _admin_password_hash


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
    }
)
async def login(body: LoginRequest):
    """
    管理员登录

    使用环境变量 ADMIN_USERNAME / ADMIN_PASSWORD 验证。
    ADMIN_PASSWORD 支持 bcrypt 哈希格式（推荐）或明文（会发出警告）。
    返回 JWT token，后续请求通过 `Authorization: Bearer <token>` 携带。
    """
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password_hash = _get_admin_password_hash()

    if not admin_password_hash:
        logger.error("ADMIN_PASSWORD not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured",
        )

    # 常数时间比较用户名（防止时序攻击）
    username_ok = _secrets.compare_digest(body.username, admin_username)
    # [P0-3 Fix] 使用 bcrypt 进行密码哈希比较
    password_ok = bcrypt.checkpw(body.password.encode(), admin_password_hash)

    if not (username_ok and password_ok):
        logger.warning("login_failed", username=body.username[:16])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
