"""add progress history

Revision ID: 0005_progress_history
Revises: 0004_grades
Create Date: 2026-03-30 18:07:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_progress_history"
down_revision: Union[str, None] = "0004_grades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "progress_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("lessons.id"), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False, server_default="lesson_completed"),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_progress_history_id", "progress_history", ["id"])
    op.create_index("ix_progress_history_student_id", "progress_history", ["student_id"])
    op.create_index("ix_progress_history_course_id", "progress_history", ["course_id"])
    op.create_index("ix_progress_history_lesson_id", "progress_history", ["lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_progress_history_lesson_id", table_name="progress_history")
    op.drop_index("ix_progress_history_course_id", table_name="progress_history")
    op.drop_index("ix_progress_history_student_id", table_name="progress_history")
    op.drop_index("ix_progress_history_id", table_name="progress_history")
    op.drop_table("progress_history")
