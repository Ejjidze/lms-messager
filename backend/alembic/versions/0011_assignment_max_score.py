"""add assignment max score

Revision ID: 0011_assignment_max_score
Revises: 0010_assignment_creator
Create Date: 2026-04-12 13:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0011_assignment_max_score"
down_revision: Union[str, None] = "0010_assignment_creator"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("assignments")}
    if "max_score" in columns:
        return
    op.add_column(
        "assignments",
        sa.Column("max_score", sa.Integer(), nullable=False, server_default=sa.text("100")),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("assignments")}
    if "max_score" in columns:
        op.drop_column("assignments", "max_score")
