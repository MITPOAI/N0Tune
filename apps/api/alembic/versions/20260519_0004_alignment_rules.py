"""Context Guard: alignment_rules table.

Adds the rule store for Phase CG-1's deterministic rule engine. See
``docs/alignment-checker.md`` for the schema rationale.

Revision ID: 20260519_0004
Revises: 20260518_0003
Create Date: 2026-05-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260519_0004"
down_revision: str | None = "20260518_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alignment_rules",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "app_id",
            sa.String(length=128),
            sa.ForeignKey("apps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rule_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("pattern", sa.Text(), nullable=True),
        sa.Column(
            "metadata_json",
            sa.JSON().with_variant(sa.JSON(), "sqlite"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_alignment_rules_app_id", "alignment_rules", ["app_id"], unique=False
    )
    op.create_index(
        "ix_alignment_rules_rule_type", "alignment_rules", ["rule_type"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_alignment_rules_rule_type", table_name="alignment_rules")
    op.drop_index("ix_alignment_rules_app_id", table_name="alignment_rules")
    op.drop_table("alignment_rules")
