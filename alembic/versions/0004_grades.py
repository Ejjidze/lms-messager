"""add grades

Revision ID: 0004_grades
Revises: 0003_enrollments
Create Date: 2026-03-30 18:06:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_grades"
down_revision: Union[str, None] = "0003_enrollments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), sa.ForeignKey("submissions.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("max_score", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("graded_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_grades_id", "grades", ["id"])
    op.create_index("ix_grades_submission_id", "grades", ["submission_id"], unique=True)
    op.create_index("ix_grades_student_id", "grades", ["student_id"])
    op.create_index("ix_grades_teacher_id", "grades", ["teacher_id"])


def downgrade() -> None:
    op.drop_index("ix_grades_teacher_id", table_name="grades")
    op.drop_index("ix_grades_student_id", table_name="grades")
    op.drop_index("ix_grades_submission_id", table_name="grades")
    op.drop_index("ix_grades_id", table_name="grades")
    op.drop_table("grades")
