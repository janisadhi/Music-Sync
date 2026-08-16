"""create track_metadata_history table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-08-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'track_metadata_history',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('downloaded_track_id', sa.Integer(), sa.ForeignKey('downloaded_tracks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('previous_metadata', sa.Text(), nullable=True),
        sa.Column('new_metadata', sa.Text(), nullable=True),
        sa.Column('previous_filename', sa.Text(), nullable=True),
        sa.Column('new_filename', sa.Text(), nullable=True),
        sa.Column('previous_lyrics_filename', sa.Text(), nullable=True),
        sa.Column('new_lyrics_filename', sa.Text(), nullable=True),
        sa.Column('match_source', sa.String(length=100), nullable=True),
        sa.Column('match_confidence', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='success', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index(op.f('ix_track_metadata_history_downloaded_track_id'), 'track_metadata_history', ['downloaded_track_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_track_metadata_history_downloaded_track_id'), table_name='track_metadata_history')
    op.drop_table('track_metadata_history')
