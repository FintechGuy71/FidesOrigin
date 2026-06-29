"""
FidesOrigin 认证 Controller
提供 Admin Dashboard 登录端点
"""
import os
import secrets as _secrets
from typing import Optional

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
    返回 JWT token，后续请求通过 `Authorization: Bearer <token>` 携带。
    """
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")

    if not admin_password:
        logger.error("ADMIN_PASSWORD not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication not configured",
        )

    # 常数时间比较防止时序攻击
    username_ok = _secrets.compare_digest(body.username, admin_username)
    password_ok = _secrets.compare_digest(body.password, admin_password)

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
