"""add download retry settings

Revision ID: d3918d8857c7
Revises: 96b5617a9d26
Create Date: 2026-08-02 13:48:37.160283

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3918d8857c7'
down_revision: Union[str, Sequence[str], None] = '96b5617a9d26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "app_settings",
        sa.Column(
            "max_download_retries",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
    )

    op.add_column(
        "app_settings",
        sa.Column(
            "download_retry_delay_seconds",
            sa.Integer(),
            nullable=False,
            server_default="60",
        ),
    )

def downgrade() -> None:
    op.drop_column(
        "app_settings",
        "download_retry_delay_seconds",
    )

    op.drop_column(
        "app_settings",
        "max_download_retries",
    )
