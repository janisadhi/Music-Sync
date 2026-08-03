"""add download directory setting

Revision ID: 8af1e62daed1
Revises: d3918d8857c7
Create Date: 2026-08-02 21:23:59.568938

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8af1e62daed1'
down_revision: Union[str, Sequence[str], None] = 'd3918d8857c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "download_directory",
            sa.String(),
            nullable=True,
        ),
    )

def downgrade() -> None:
    op.drop_column(
        "app_settings",
        "download_directory",
    )
