"""
FidesOrigin 后端应用 - 重构后入口
分层架构: Controller → Service → Repository → Model
"""

__version__ = "2.0.0"
__all__ = ["app"]

# 延迟导入 app 避免循环依赖
def get_app():
    from app.main import app
    return app
