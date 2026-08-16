"""add musicbrainz ids to track_metadata_history

Revision ID: b2c3d4e5f6a7
Revises: f7a8b9c0d1e2
Create Date: 2026-08-16 12:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('track_metadata_history', sa.Column('musicbrainz_recording_id', sa.String(length=100), nullable=True))
    op.add_column('track_metadata_history', sa.Column('musicbrainz_artist_id', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('track_metadata_history', 'musicbrainz_artist_id')
    op.drop_column('track_metadata_history', 'musicbrainz_recording_id')
