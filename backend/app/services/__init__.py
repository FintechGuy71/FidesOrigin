"""FidesOrigin services with lazy imports to avoid circular package initialization."""
from importlib import import_module

_EXPORTS = {
    "AlertService": "alert_service",
    "BlockscoutService": "blockscout_service",
    "CacheService": "cache_service",
    "RiskEngineService": "risk_engine_service",
    "RiskSyncService": "risk_sync_service",
    "WebSocketManager": "websocket_manager",
}
__all__ = list(_EXPORTS)


def __getattr__(name):
    if name not in _EXPORTS:
        raise AttributeError(name)
    module = import_module(f"app.services.{_EXPORTS[name]}")
    value = getattr(module, name)
    globals()[name] = value
    return value
