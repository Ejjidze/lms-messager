"""add assignment creator teacher field

Revision ID: 0010_assignment_creator
Revises: 0009_assignment_materials
Create Date: 2026-04-12 12:25:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0010_assignment_creator"
down_revision: Union[str, None] = "0009_assignment_materials"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("assignments")}

    if "created_by_teacher_id" not in columns:
        op.add_column("assignments", sa.Column("created_by_teacher_id", sa.Integer(), nullable=True))

    indexes = {index["name"] for index in inspector.get_indexes("assignments")}
    if "ix_assignments_created_by_teacher_id" not in indexes:
        op.create_index("ix_assignments_created_by_teacher_id", "assignments", ["created_by_teacher_id"])

    if bind.dialect.name != "sqlite":
        fks = {fk["name"] for fk in inspector.get_foreign_keys("assignments")}
        if "fk_assignments_created_by_teacher_id_users" not in fks:
            op.create_foreign_key(
                "fk_assignments_created_by_teacher_id_users",
                "assignments",
                "users",
                ["created_by_teacher_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if bind.dialect.name != "sqlite":
        fks = {fk["name"] for fk in inspector.get_foreign_keys("assignments")}
        if "fk_assignments_created_by_teacher_id_users" in fks:
            op.drop_constraint("fk_assignments_created_by_teacher_id_users", "assignments", type_="foreignkey")

    indexes = {index["name"] for index in inspector.get_indexes("assignments")}
    if "ix_assignments_created_by_teacher_id" in indexes:
        op.drop_index("ix_assignments_created_by_teacher_id", table_name="assignments")

    columns = {column["name"] for column in inspector.get_columns("assignments")}
    if "created_by_teacher_id" in columns:
        op.drop_column("assignments", "created_by_teacher_id")
