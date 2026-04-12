"""add assignment material file fields

Revision ID: 0009_assignment_materials
Revises: 0008_quiz_deadline
Create Date: 2026-04-06 17:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009_assignment_materials"
down_revision: Union[str, None] = "0008_quiz_deadline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assignments", sa.Column("material_file_name", sa.String(length=255), nullable=True))
    op.add_column("assignments", sa.Column("material_file_url", sa.String(length=255), nullable=True))
    op.add_column("assignments", sa.Column("material_file_mime_type", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("assignments", "material_file_mime_type")
    op.drop_column("assignments", "material_file_url")
    op.drop_column("assignments", "material_file_name")
