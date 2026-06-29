"""
FidesOrigin Controller 包初始化
"""
from app.controllers.addresses import router as address_router
from app.controllers.auth import router as auth_router
from app.controllers.monitor import router as monitor_router
from app.controllers.rules import router as rules_router
from app.controllers.transactions import router as transaction_router

__all__ = [
    "auth_router",
    "address_router",
    "transaction_router",
    "rules_router",
    "monitor_router",
]
