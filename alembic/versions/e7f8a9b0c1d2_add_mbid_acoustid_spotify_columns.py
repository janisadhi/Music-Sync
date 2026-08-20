"""add mbid acoustid and spotify columns to downloaded_tracks and track_metadata_history

Revision ID: e7f8a9b0c1d2
Revises: c3d4e5f6a7b8
Create Date: 2026-08-20 12:51:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to downloaded_tracks
    op.add_column('downloaded_tracks', sa.Column('musicbrainz_recording_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('musicbrainz_artist_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('musicbrainz_release_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('musicbrainz_release_group_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('musicbrainz_track_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('acoustid_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('fingerprint', sa.Text(), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('spotify_track_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('spotify_artist_id', sa.String(length=100), nullable=True))
    op.add_column('downloaded_tracks', sa.Column('spotify_album_id', sa.String(length=100), nullable=True))

    op.create_index('ix_downloaded_tracks_musicbrainz_recording_id', 'downloaded_tracks', ['musicbrainz_recording_id'])
    op.create_index('ix_downloaded_tracks_acoustid_id', 'downloaded_tracks', ['acoustid_id'])

    # Add columns to track_metadata_history
    op.add_column('track_metadata_history', sa.Column('acoustid_id', sa.String(length=100), nullable=True))
    op.add_column('track_metadata_history', sa.Column('spotify_track_id', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('track_metadata_history', 'spotify_track_id')
    op.drop_column('track_metadata_history', 'acoustid_id')

    op.drop_index('ix_downloaded_tracks_acoustid_id', table_name='downloaded_tracks')
    op.drop_index('ix_downloaded_tracks_musicbrainz_recording_id', table_name='downloaded_tracks')

    op.drop_column('downloaded_tracks', 'spotify_album_id')
    op.drop_column('downloaded_tracks', 'spotify_artist_id')
    op.drop_column('downloaded_tracks', 'spotify_track_id')
    op.drop_column('downloaded_tracks', 'fingerprint')
    op.drop_column('downloaded_tracks', 'acoustid_id')
    op.drop_column('downloaded_tracks', 'musicbrainz_track_id')
    op.drop_column('downloaded_tracks', 'musicbrainz_release_group_id')
    op.drop_column('downloaded_tracks', 'musicbrainz_release_id')
    op.drop_column('downloaded_tracks', 'musicbrainz_artist_id')
    op.drop_column('downloaded_tracks', 'musicbrainz_recording_id')
