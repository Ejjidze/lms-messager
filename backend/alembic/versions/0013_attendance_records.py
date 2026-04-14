"""add attendance records

Revision ID: 0013_attendance_records
Revises: 0012_admin_controls
Create Date: 2026-04-14 10:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_attendance_records"
down_revision: Union[str, None] = "0012_admin_controls"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "attendance_records" in tables:
        return

    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="NB"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("teacher_id", "student_id", "attendance_date", name="uq_attendance_teacher_student_date"),
    )
    op.create_index("ix_attendance_records_id", "attendance_records", ["id"])
    op.create_index("ix_attendance_records_teacher_id", "attendance_records", ["teacher_id"])
    op.create_index("ix_attendance_records_student_id", "attendance_records", ["student_id"])
    op.create_index("ix_attendance_records_attendance_date", "attendance_records", ["attendance_date"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "attendance_records" not in tables:
        return

    op.drop_index("ix_attendance_records_attendance_date", table_name="attendance_records")
    op.drop_index("ix_attendance_records_student_id", table_name="attendance_records")
    op.drop_index("ix_attendance_records_teacher_id", table_name="attendance_records")
    op.drop_index("ix_attendance_records_id", table_name="attendance_records")
    op.drop_table("attendance_records")
