"""media attachments and submissions

Revision ID: 0002_media_submissions
Revises: 0001_initial
Create Date: 2026-03-30 17:46:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_media_submissions"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("attachment_name", sa.String(length=255), nullable=True))
    op.add_column("messages", sa.Column("attachment_url", sa.String(length=255), nullable=True))
    op.add_column("messages", sa.Column("attachment_mime_type", sa.String(length=120), nullable=True))

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("submitted_text", sa.Text(), nullable=True),
        sa.Column("submitted_file_name", sa.String(length=255), nullable=True),
        sa.Column("submitted_file_url", sa.String(length=255), nullable=True),
        sa.Column("submitted_file_mime_type", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="review"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_submissions_id", "submissions", ["id"])
    op.create_index("ix_submissions_assignment_id", "submissions", ["assignment_id"])
    op.create_index("ix_submissions_student_id", "submissions", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_submissions_student_id", table_name="submissions")
    op.drop_index("ix_submissions_assignment_id", table_name="submissions")
    op.drop_index("ix_submissions_id", table_name="submissions")
    op.drop_table("submissions")
    op.drop_column("messages", "attachment_mime_type")
    op.drop_column("messages", "attachment_url")
    op.drop_column("messages", "attachment_name")
