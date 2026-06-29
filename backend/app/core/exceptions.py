"""
FidesOrigin 核心异常体系
统一错误处理，支持结构化日志和 HTTP 状态码映射
"""
from enum import Enum
from typing import Any, Dict, Optional

from fastapi import HTTPException, status


class ErrorCode(str, Enum):
    """错误码枚举"""
    # 通用错误
    UNKNOWN = "UNKNOWN"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    FORBIDDEN = "FORBIDDEN"
    UNAUTHORIZED = "UNAUTHORIZED"
    RATE_LIMITED = "RATE_LIMITED"
    
    # 业务错误
    ADDRESS_INVALID = "ADDRESS_INVALID"
    TX_HASH_INVALID = "TX_HASH_INVALID"
    RISK_CALCULATION_FAILED = "RISK_CALCULATION_FAILED"
    BLOCKSCOUT_API_ERROR = "BLOCKSCOUT_API_ERROR"
    CACHE_ERROR = "CACHE_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    RULE_DUPLICATE = "RULE_DUPLICATE"
    RULE_NOT_FOUND = "RULE_NOT_FOUND"
    WEBSOCKET_ERROR = "WEBSOCKET_ERROR"
    
    # 安全错误
    API_KEY_INVALID = "API_KEY_INVALID"
    HMAC_INVALID = "HMAC_INVALID"
    PERMISSION_DENIED = "PERMISSION_DENIED"


class FidesException(Exception):
    """
    基础异常类
    所有业务异常都继承此类，确保统一的错误处理流程
    """
    
    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.UNKNOWN,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        self.headers = headers
        super().__init__(self.message)
    
    @property
    def error_code(self) -> str:
        """获取错误码（兼容属性访问）"""
        return self.code.value
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式（用于 JSON 响应）"""
        return {
            "error": self.code.value,
            "message": self.message,
            "details": self.details,
            "status_code": self.status_code,
        }
    
    def to_http_exception(self) -> HTTPException:
        """转换为 FastAPI HTTPException"""
        return HTTPException(
            status_code=self.status_code,
            detail=self.to_dict(),
            headers=self.headers
        )


class ValidationException(FidesException):
    """输入验证异常"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None, field: Optional[str] = None):
        if field and not details:
            details = {"field": field}
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )


class NotFoundException(FidesException):
    """资源未找到异常"""
    
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found: {identifier}",
            code=ErrorCode.NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND,
            details={"resource": resource, "identifier": identifier}
        )


class ConflictException(FidesException):
    """资源冲突异常"""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code=ErrorCode.CONFLICT,
            status_code=status.HTTP_409_CONFLICT,
            details=details
        )


class AuthenticationException(FidesException):
    """认证异常"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            code=ErrorCode.UNAUTHORIZED,
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Bearer"}
        )


class AuthorizationException(FidesException):
    """授权异常（权限不足）"""
    
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code=ErrorCode.PERMISSION_DENIED,
            status_code=status.HTTP_403_FORBIDDEN
        )


class RateLimitException(FidesException):
    """速率限制异常"""
    
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Rate limit exceeded",
            code=ErrorCode.RATE_LIMITED,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            headers={"Retry-After": str(retry_after)}
        )


class BlockscoutAPIException(FidesException):
    """Blockscout API 异常"""
    
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(
            message=message,
            code=ErrorCode.BLOCKSCOUT_API_ERROR,
            status_code=status_code
        )


class RiskCalculationException(FidesException):
    """风险计算异常"""
    
    def __init__(self, message: str, address: Optional[str] = None):
        super().__init__(
            message=message,
            code=ErrorCode.RISK_CALCULATION_FAILED,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"address": address} if address else None
        )


class DatabaseException(FidesException):
    """数据库操作异常"""
    
    def __init__(self, message: str, operation: Optional[str] = None):
        super().__init__(
            message=message,
            code=ErrorCode.DATABASE_ERROR,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"operation": operation} if operation else None
        )


class ServiceUnavailableException(FidesException):
    """服务不可用异常"""
    
    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__(
            message=message,
            code=ErrorCode.UNKNOWN,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
