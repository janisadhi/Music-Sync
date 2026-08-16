"""add beets metadata edited column to downloaded tracks

Revision ID: e6f7a8b9c0d1
Revises: c2d3e4f5a6b7
Create Date: 2026-08-16 11:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'downloaded_tracks',
        sa.Column(
            'beets_metadata_edited',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        )
    )


def downgrade() -> None:
    op.drop_column('downloaded_tracks', 'beets_metadata_edited')
