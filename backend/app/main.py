"""
FidesOrigin 主入口（重构版）
使用 lifespan 管理应用生命周期
"""
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import get_settings
from app.core.di import get_container, init_container, shutdown_container
from app.core.exceptions import FidesException
from app.core.logging import get_logger, setup_logging
from app.core.middleware import (
    rate_limit_middleware,
    request_tracing_middleware,
    security_headers_middleware,
    csrf_protection_middleware,
    session_timeout_middleware,
    request_signature_middleware,
)
from app.core.security import get_hmac_validator, get_current_user
from app.database import init_db

# 配置日志
setup_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    
    启动：初始化数据库、DI 容器、缓存连接
    关闭：清理资源、关闭连接
    """
    # 启动
    logger.info("application_starting", version=__version__, env=settings.APP_ENV)
    
    # 检查是否在测试环境中（通过环境变量）
    is_testing = os.environ.get("TEST_DATABASE_URL") is not None
    
    try:
        # 初始化数据库（测试环境中跳过，由测试固件管理）
        if not is_testing:
            await init_db()
            logger.info("database_initialized")
        
        # 初始化 DI 容器
        await init_container()
        logger.info("di_container_initialized")
        
        # 验证配置
        settings.validate_security()
        
        logger.info("application_started")
        
    except Exception as e:
        logger.error("application_startup_failed", error=str(e))
        raise
    
    yield
    
    # 关闭
    logger.info("application_shutting_down")
    
    try:
        await shutdown_container()
        logger.info("di_container_shutdown")
    except Exception as e:
        logger.error("application_shutdown_error", error=str(e))
    
    logger.info("application_shutdown_complete")


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    version=__version__,
    description="FidesOrigin - 区块链地址风险检测与合规协议",
    docs_url="/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/redoc" if settings.APP_ENV == "development" else None,
    openapi_url="/openapi.json" if settings.APP_ENV == "development" else None,
    lifespan=lifespan,
)

# ==================== 安全中间件（按优先级排序） ====================

# 1. 受信任主机中间件（生产环境）
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["fidesorigin.com", "www.fidesorigin.com", "api.fidesorigin.com"]
    )

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
    max_age=600,
)

# 3. 安全响应头
@app.middleware("http")
async def security_headers(request, call_next):
    return await security_headers_middleware(request, call_next)

# 4. 请求追踪
@app.middleware("http")
async def request_tracing(request, call_next):
    return await request_tracing_middleware(request, call_next)

# 5. 速率限制
@app.middleware("http")
async def rate_limit(request, call_next):
    return await rate_limit_middleware(request, call_next)

# 6. CSRF 保护
@app.middleware("http")
async def csrf_protection(request, call_next):
    return await csrf_protection_middleware(request, call_next)

# 7. 会话超时管理
@app.middleware("http")
async def session_timeout(request, call_next):
    return await session_timeout_middleware(request, call_next)

# 8. 请求签名验证（敏感端点）
@app.middleware("http")
async def request_signature(request, call_next):
    return await request_signature_middleware(request, call_next)


# ==================== 全局异常处理 ====================

@app.exception_handler(FidesException)
async def fides_exception_handler(request, exc: FidesException):
    """统一异常处理"""
    logger.warning(
        "api_exception",
        path=request.url.path,
        error_code=exc.error_code,
        message=exc.message,
        trace_id=getattr(request.state, "trace_id", "unknown")
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
                "trace_id": getattr(request.state, "trace_id", "unknown")
            }
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """通用异常处理 - 生产环境不暴露内部错误详情"""
    import traceback
    
    # 生成追踪 ID
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    # 记录完整错误（仅服务端）
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        error_type=type(exc).__name__,
        trace_id=trace_id,
        # 仅在调试模式记录完整堆栈
        traceback=traceback.format_exc() if settings.DEBUG else None
    )
    
    # 返回给客户端的信息 - 生产环境隐藏具体错误
    if settings.is_production:
        message = "Internal server error"
    else:
        message = str(exc) if settings.DEBUG else "Internal server error"
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": message,
                "trace_id": trace_id
            }
        }
    )


# ==================== 路由注册（API 版本控制） ====================

# 导入 Controller
from app.controllers import addresses, auth, monitor, rules, transactions

# API v1 路由
api_v1_prefix = "/api/v1"

app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(addresses.router, prefix=api_v1_prefix)
app.include_router(transactions.router, prefix=api_v1_prefix)
app.include_router(rules.router, prefix=api_v1_prefix)
app.include_router(monitor.router, prefix=api_v1_prefix)

# 版本信息端点
@app.get("/api/version", tags=["版本信息"])
async def api_version(
    # [LOW Fix #24] 生产环境对信息端点添加认证
    _: str = Depends(get_current_user) if settings.is_production else None,
):
    """获取 API 版本信息"""
    return {
        "version": "v1",
        "app_version": __version__,
        "deprecated": False,
        "endpoints": {
            "v1": "/api/v1"
        }
    }


# ==================== 请求大小限制 ====================

@app.middleware("http")
async def request_size_limit(request, call_next):
    """请求大小限制中间件"""
    MAX_BODY_SIZE = 10 * 1024 * 1024  # 10MB
    
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
            if size > MAX_BODY_SIZE:
                logger.warning("request_too_large", 
                             path=request.url.path, 
                             size=size, 
                             max_size=MAX_BODY_SIZE)
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "REQUEST_TOO_LARGE",
                            "message": f"Request body too large. Max size: {MAX_BODY_SIZE} bytes"
                        }
                    }
                )
        except ValueError:
            pass
    
    return await call_next(request)


# ==================== SQL 查询超时 ====================

@app.middleware("http")
async def sql_query_timeout(request, call_next):
    """SQL 查询超时中间件"""
    import asyncio
    
    # 设置查询超时（秒）
    QUERY_TIMEOUT = 30
    
    try:
        response = await asyncio.wait_for(call_next(request), timeout=QUERY_TIMEOUT)
        return response
    except asyncio.TimeoutError:
        logger.error("request_timeout", 
                    path=request.url.path, 
                    method=request.method,
                    timeout=QUERY_TIMEOUT)
        return JSONResponse(
            status_code=504,
            content={
                "error": {
                    "code": "REQUEST_TIMEOUT",
                    "message": f"Request timed out after {QUERY_TIMEOUT} seconds"
                }
            }
        )


# ==================== 根路由 ====================
@app.get("/")
async def root(
    # [LOW Fix #24] 生产环境对根端点添加认证
    _: str = Depends(get_current_user) if settings.is_production else None,
):
    """根端点 - API 信息"""
    return {
        "name": "FidesOrigin",
        "version": __version__,
        "description": "区块链地址风险检测与合规协议",
        "endpoints": {
            "health": "/health",
            "ready": "/ready",
            "docs": "/docs",
            "api_v1": "/api/v1"
        }
    }


# ==================== 健康检查 ====================

@app.get("/health", tags=["健康检查"])
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "version": __version__,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/ready", tags=["健康检查"])
async def readiness_check():
    """就绪检查端点"""
    try:
        container = get_container()
        # 检查缓存连接
        await container.cache.get("health_check")
        return {"status": "ready"}
    except Exception as e:
        logger.warning("readiness_check_failed", error_type=type(e).__name__)
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready"}
        )


# ==================== 启动入口 ====================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.APP_ENV == "development",
        log_level="info"
    )
