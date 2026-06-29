"""
FidesOrigin 数据库迁移脚本

使用说明:
1. 创建新迁移: alembic revision --autogenerate -m "描述"
2. 升级数据库: alembic upgrade head
3. 降级数据库: alembic downgrade -1
4. 查看历史: alembic history
5. 当前版本: alembic current
"""

revision = "000000000000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """初始迁移 - 数据库结构已通过 init-db.sql 创建"""
    pass


def downgrade():
    """回滚 - 无操作"""
    pass
