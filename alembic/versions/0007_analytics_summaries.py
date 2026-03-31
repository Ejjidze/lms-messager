"""add analytics summary tables

Revision ID: 0007_analytics_summaries
Revises: 0006_quizzes_attempts
Create Date: 2026-03-30 18:50:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_analytics_summaries"
down_revision: Union[str, None] = "0006_quizzes_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_analytics_summaries",
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), primary_key=True),
        sa.Column("enrolled_students_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("submissions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("graded_submissions_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_grade", sa.Float(), nullable=True),
        sa.Column("average_progress", sa.Float(), nullable=True),
        sa.Column("completed_students_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("active_last_7_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active_last_30_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retention_rate_7_days", sa.Float(), nullable=False, server_default="0"),
        sa.Column("retention_rate_30_days", sa.Float(), nullable=False, server_default="0"),
        sa.Column("refreshed_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "student_course_summaries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("average_grade", sa.Float(), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_lessons", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("passed_quizzes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_at", sa.DateTime(), nullable=True),
        sa.Column("refreshed_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("course_id", "student_id", name="uq_student_course_summary"),
    )
    op.create_index("ix_student_course_summaries_id", "student_course_summaries", ["id"])
    op.create_index("ix_student_course_summaries_course_id", "student_course_summaries", ["course_id"])
    op.create_index("ix_student_course_summaries_student_id", "student_course_summaries", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_student_course_summaries_student_id", table_name="student_course_summaries")
    op.drop_index("ix_student_course_summaries_course_id", table_name="student_course_summaries")
    op.drop_index("ix_student_course_summaries_id", table_name="student_course_summaries")
    op.drop_table("student_course_summaries")
    op.drop_table("course_analytics_summaries")
