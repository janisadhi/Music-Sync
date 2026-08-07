"""add auto_start_scheduler setting

Revision ID: e51922c09d1a
Revises: 8af1e62daed1
Create Date: 2026-08-07 23:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e51922c09d1a'
down_revision: Union[str, Sequence[str], None] = '8af1e62daed1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "auto_start_scheduler",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "app_settings",
        "auto_start_scheduler",
    )
