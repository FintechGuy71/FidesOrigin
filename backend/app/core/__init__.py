"""FidesOrigin core exports with lazy imports to prevent circular initialization."""
from importlib import import_module

_EXPORTS = {
    "DIContainer": "di",
    "get_container": "di",
    "DistributedLockManager": "lock_manager",
    "get_lock_manager": "lock_manager",
    "MessageQueue": "message_queue",
    "get_message_queue": "message_queue",
    "get_logger": "logging",
    "ErrorCode": "exceptions",
    "FidesException": "exceptions",
    "AuthenticationException": "exceptions",
    "NotFoundException": "exceptions",
    "ValidationException": "exceptions",
    "ConflictException": "exceptions",
    "RateLimitException": "exceptions",
    "DatabaseException": "exceptions",
    "RiskCalculationException": "exceptions",
    "HMACValidator": "security",
    "RateLimiter": "security",
    "get_hmac_validator": "security",
    "get_rate_limiter": "security",
    "verify_api_key": "security",
}
__all__ = list(_EXPORTS)


def __getattr__(name):
    if name not in _EXPORTS:
        raise AttributeError(name)
    module = import_module(f"app.core.{_EXPORTS[name]}")
    value = getattr(module, name)
    globals()[name] = value
    return value
