"""admin controls and security tables

Revision ID: 0012_admin_controls
Revises: 0011_assignment_max_score
Create Date: 2026-04-12 20:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012_admin_controls"
down_revision: Union[str, None] = "0011_assignment_max_score"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}

    if "is_blocked" not in user_columns:
        op.add_column("users", sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.false()))
    if "blocked_until" not in user_columns:
        op.add_column("users", sa.Column("blocked_until", sa.DateTime(), nullable=True))
    if "session_revoked_at" not in user_columns:
        op.add_column("users", sa.Column("session_revoked_at", sa.DateTime(), nullable=True))
    if "last_login_at" not in user_columns:
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))

    tables = set(inspector.get_table_names())
    if "moderation_reports" not in tables:
        op.create_table(
            "moderation_reports",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("target_type", sa.String(length=40), nullable=False),
            sa.Column("target_id", sa.Integer(), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
            sa.Column("resolution_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_moderation_reports_id", "moderation_reports", ["id"])
        op.create_index("ix_moderation_reports_reporter_id", "moderation_reports", ["reporter_id"])
        op.create_index("ix_moderation_reports_target_type", "moderation_reports", ["target_type"])
        op.create_index("ix_moderation_reports_target_id", "moderation_reports", ["target_id"])

    if "security_events" not in tables:
        op.create_table(
            "security_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("event_type", sa.String(length=60), nullable=False),
            sa.Column("severity", sa.String(length=20), nullable=False, server_default="info"),
            sa.Column("details", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_security_events_id", "security_events", ["id"])
        op.create_index("ix_security_events_user_id", "security_events", ["user_id"])
        op.create_index("ix_security_events_event_type", "security_events", ["event_type"])

    if "platform_settings" not in tables:
        op.create_table(
            "platform_settings",
            sa.Column("key", sa.String(length=80), primary_key=True),
            sa.Column("value", sa.Text(), nullable=False, server_default=""),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "platform_settings" in tables:
        op.drop_table("platform_settings")
    if "security_events" in tables:
        op.drop_index("ix_security_events_event_type", table_name="security_events")
        op.drop_index("ix_security_events_user_id", table_name="security_events")
        op.drop_index("ix_security_events_id", table_name="security_events")
        op.drop_table("security_events")
    if "moderation_reports" in tables:
        op.drop_index("ix_moderation_reports_target_id", table_name="moderation_reports")
        op.drop_index("ix_moderation_reports_target_type", table_name="moderation_reports")
        op.drop_index("ix_moderation_reports_reporter_id", table_name="moderation_reports")
        op.drop_index("ix_moderation_reports_id", table_name="moderation_reports")
        op.drop_table("moderation_reports")

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "last_login_at" in user_columns:
        op.drop_column("users", "last_login_at")
    if "session_revoked_at" in user_columns:
        op.drop_column("users", "session_revoked_at")
    if "blocked_until" in user_columns:
        op.drop_column("users", "blocked_until")
    if "is_blocked" in user_columns:
        op.drop_column("users", "is_blocked")
