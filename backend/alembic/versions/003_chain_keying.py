"""Canonicalize the existing Sepolia dataset's chain keys.

Revision ID: 003
Revises: 002

Before this migration the project deployed contracts only to Sepolia, while the
backend stored those records under the misleading key ``ethereum``.  Chain-aware
queries now use ``sepolia`` so mainnet and testnet data cannot be mixed.
"""
from alembic import op


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None

_TABLES = ("address_risks", "transactions", "address_reports")


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"UPDATE {table} SET chain = 'sepolia' WHERE chain = 'ethereum'")
    # Empty, zero-score profiles carry no positive low-risk evidence.
    op.execute(
        "UPDATE address_risks SET risk_level = 'UNKNOWN' "
        "WHERE risk_score = 0 AND tags = '[]'::jsonb"
    )


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"UPDATE {table} SET chain = 'ethereum' WHERE chain = 'sepolia'")
