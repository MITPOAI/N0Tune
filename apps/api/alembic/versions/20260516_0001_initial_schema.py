"""Initial N0Tune schema.

Revision ID: 20260516_0001
Revises:
Create Date: 2026-05-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

revision: str = "20260516_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    embedding_type = Vector(384) if is_postgres else sa.JSON()

    op.create_table(
        "apps",
        sa.Column("id", sa.String(length=128), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("api_key_hash", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("external_user_id", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("app_id", "external_user_id", name="uq_users_app_external"),
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("conversation_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "memories",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("source_message_id", sa.String(length=64), nullable=True),
        sa.Column("embedding", embedding_type, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "style_profiles",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("profile_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("app_id", "user_id", name="uq_style_profiles_app_user"),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=512), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", embedding_type, nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("injection_risk_score", sa.Float(), nullable=False),
        sa.Column("injection_risk_reasons_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "semantic_cache",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column("input_embedding", embedding_type, nullable=True),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("depends_on_json", sa.JSON(), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("context_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "context_runs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("cache_hit", sa.Boolean(), nullable=False),
        sa.Column("prompt_tokens_estimated", sa.Integer(), nullable=False),
        sa.Column("prompt_tokens_saved_estimated", sa.Integer(), nullable=False),
        sa.Column("selected_memories_json", sa.JSON(), nullable=False),
        sa.Column("selected_chunks_json", sa.JSON(), nullable=False),
        sa.Column("selected_style_json", sa.JSON(), nullable=False),
        sa.Column("context_trace_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "feedback_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("app_id", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("message_id", sa.String(length=64), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
    )

    for table in [
        "users",
        "conversations",
        "messages",
        "memories",
        "style_profiles",
        "documents",
        "document_chunks",
        "semantic_cache",
        "context_runs",
        "feedback_events",
    ]:
        op.create_index(f"ix_{table}_app_id", table, ["app_id"])

    op.create_index("ix_memories_app_user_deleted", "memories", ["app_id", "user_id", "deleted_at"])
    op.create_index("ix_documents_app_deleted", "documents", ["app_id", "deleted_at"])
    op.create_index("ix_semantic_cache_app_user", "semantic_cache", ["app_id", "user_id"])


def downgrade() -> None:
    for table in [
        "feedback_events",
        "context_runs",
        "semantic_cache",
        "document_chunks",
        "documents",
        "style_profiles",
        "memories",
        "messages",
        "conversations",
        "users",
        "apps",
    ]:
        op.drop_table(table)
