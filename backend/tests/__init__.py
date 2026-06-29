"""
FidesOrigin 测试入口模块
在导入任何应用模块之前设置测试环境
"""
import os
import sys

# 必须在导入任何应用模块之前设置测试数据库
os.environ["TEST_DATABASE_URL"] = "postgresql+asyncpg://fidesorigin:fidesorigin@localhost:5432/fidesorigin_test"
os.environ["DB_PASSWORD"] = "fidesorigin"

# 确保测试目录在路径中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 现在可以安全导入应用模块
from app.config import get_settings

# 验证配置
settings = get_settings()
print(f"Test database URL: {settings.DATABASE_URL}")
