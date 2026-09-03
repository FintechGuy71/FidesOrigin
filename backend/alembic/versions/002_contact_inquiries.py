"""Contact inquiries table

Revision ID: 002
Revises: 001
Create Date: 2026-09-04 12:00:00.000000

[Contact Fix] 新增 contact_inquiries 表，用于官网联系表单收单。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建 contact_inquiries 表（字段与 app/models.py 的 ContactInquiry 对齐）
    op.create_table('contact_inquiries',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('company', sa.String(100), nullable=True),
        sa.Column('use_case', sa.String(50), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('ip', sa.String(45), nullable=True),
        sa.Column('status', sa.String(20), server_default='new', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 常用查询索引：按状态筛选、按创建时间倒序
    op.create_index('ix_contact_inquiries_status', 'contact_inquiries', ['status'])
    op.create_index('ix_contact_inquiries_created_at', 'contact_inquiries', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_contact_inquiries_created_at', table_name='contact_inquiries')
    op.drop_index('ix_contact_inquiries_status', table_name='contact_inquiries')
    op.drop_table('contact_inquiries')
