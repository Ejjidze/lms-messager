"""add deadline to quizzes

Revision ID: 0008_quiz_deadline
Revises: 0007_analytics_summaries
Create Date: 2026-03-31 11:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_quiz_deadline"
down_revision: Union[str, None] = "0007_analytics_summaries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quizzes", sa.Column("deadline", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("quizzes", "deadline")
