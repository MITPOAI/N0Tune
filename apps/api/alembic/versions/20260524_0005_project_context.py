"""Project context, sessions, and handoff capsules.

Revision ID: 20260524_0005
Revises: 20260519_0004
Create Date: 2026-05-24
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260524_0005"
down_revision: str | None = "20260519_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "app_id",
            sa.String(length=128),
            sa.ForeignKey("apps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("root_path_hash", sa.String(length=64), nullable=False),
        sa.Column("git_remote_hash", sa.String(length=64), nullable=True),
        sa.Column("fingerprint_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
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
        sa.UniqueConstraint("app_id", "root_path_hash", name="uq_projects_app_root_hash"),
    )
    op.create_index("ix_projects_app_id", "projects", ["app_id"], unique=False)
    op.create_index("ix_projects_root_path_hash", "projects", ["root_path_hash"], unique=False)
    op.create_index("ix_projects_git_remote_hash", "projects", ["git_remote_hash"], unique=False)

    op.create_table(
        "project_tools",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(length=64),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(length=64), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.UniqueConstraint("project_id", "tool_name", name="uq_project_tools_project_tool"),
    )
    op.create_index("ix_project_tools_project_id", "project_tools", ["project_id"], unique=False)
    op.create_index("ix_project_tools_tool_name", "project_tools", ["tool_name"], unique=False)

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(length=64),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(length=64), nullable=False),
        sa.Column("tool_session_id", sa.String(length=128), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("model", sa.String(length=255), nullable=True),
        sa.Column("context_tokens_estimated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("context_pressure", sa.String(length=32), nullable=False, server_default="healthy"),
        sa.Column("files_touched_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("commands_run_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("memories_created_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("docs_used_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("next_steps_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("created_handoff_id", sa.String(length=64), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("ix_sessions_project_id", "sessions", ["project_id"], unique=False)
    op.create_index("ix_sessions_tool_name", "sessions", ["tool_name"], unique=False)
    op.create_index("ix_sessions_status", "sessions", ["status"], unique=False)

    op.create_table(
        "handoff_capsules",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(length=64),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_tool", sa.String(length=64), nullable=False),
        sa.Column("target_tool", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("current_state", sa.Text(), nullable=False),
        sa.Column("decisions_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("files_changed_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("commands_run_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("errors_seen_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("tests_run_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("next_steps_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("open_questions_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("warnings_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("memory_refs_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("doc_refs_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
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
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_handoff_capsules_project_id", "handoff_capsules", ["project_id"], unique=False)
    op.create_index("ix_handoff_capsules_source_tool", "handoff_capsules", ["source_tool"], unique=False)
    op.create_index("ix_handoff_capsules_target_tool", "handoff_capsules", ["target_tool"], unique=False)

    op.add_column(
        "memories",
        sa.Column(
            "project_id",
            sa.String(length=64),
            sa.ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "memories",
        sa.Column(
            "session_id",
            sa.String(length=64),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "memories",
        sa.Column(
            "handoff_id",
            sa.String(length=64),
            sa.ForeignKey("handoff_capsules.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_memories_project_id", "memories", ["project_id"], unique=False)
    op.create_index("ix_memories_session_id", "memories", ["session_id"], unique=False)
    op.create_index("ix_memories_handoff_id", "memories", ["handoff_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_memories_handoff_id", table_name="memories")
    op.drop_index("ix_memories_session_id", table_name="memories")
    op.drop_index("ix_memories_project_id", table_name="memories")
    op.drop_column("memories", "handoff_id")
    op.drop_column("memories", "session_id")
    op.drop_column("memories", "project_id")

    op.drop_index("ix_handoff_capsules_target_tool", table_name="handoff_capsules")
    op.drop_index("ix_handoff_capsules_source_tool", table_name="handoff_capsules")
    op.drop_index("ix_handoff_capsules_project_id", table_name="handoff_capsules")
    op.drop_table("handoff_capsules")

    op.drop_index("ix_sessions_status", table_name="sessions")
    op.drop_index("ix_sessions_tool_name", table_name="sessions")
    op.drop_index("ix_sessions_project_id", table_name="sessions")
    op.drop_table("sessions")

    op.drop_index("ix_project_tools_tool_name", table_name="project_tools")
    op.drop_index("ix_project_tools_project_id", table_name="project_tools")
    op.drop_table("project_tools")

    op.drop_index("ix_projects_git_remote_hash", table_name="projects")
    op.drop_index("ix_projects_root_path_hash", table_name="projects")
    op.drop_index("ix_projects_app_id", table_name="projects")
    op.drop_table("projects")
