"""Memory lifecycle (state, last_used_at, last_confirmed_at, version,
replaced_by_memory_id) and memory scope.

Revision ID: 20260518_0003
Revises: 20260517_0002
Create Date: 2026-05-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260518_0003"
down_revision: str | None = "20260517_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("memories") as batch:
        batch.add_column(sa.Column("state", sa.String(length=32), nullable=False, server_default="active"))
        batch.add_column(sa.Column("scope", sa.String(length=32), nullable=False, server_default="user"))
        batch.add_column(sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("last_confirmed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("replaced_by_memory_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("memories") as batch:
        batch.drop_column("replaced_by_memory_id")
        batch.drop_column("version")
        batch.drop_column("last_confirmed_at")
        batch.drop_column("last_used_at")
        batch.drop_column("scope")
        batch.drop_column("state")
