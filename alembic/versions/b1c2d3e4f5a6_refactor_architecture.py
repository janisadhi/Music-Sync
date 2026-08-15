"""refactor architecture: lean songs table, downloaded_tracks, removal policy

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-14 00:00:00.000000

Changes:
- songs: drop artist, album, duration columns (moved to downloaded_tracks)
- songs: add composite unique constraint (playlist_id, youtube_video_id)
- songs: add indexes on download_status and lyrics_status for queue queries
- downloaded_tracks: new table (Music Library DB)
- app_settings: add delete_local_file_on_playlist_removal column
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # songs – remove metadata columns that belong in downloaded_tracks
    # ------------------------------------------------------------------
    op.drop_column("songs", "artist")
    op.drop_column("songs", "album")
    op.drop_column("songs", "duration")

    # ------------------------------------------------------------------
    # songs – composite unique constraint
    # One row per (playlist, video).  Prevents duplicates from
    # concurrent/repeated scans.
    # ------------------------------------------------------------------
    op.create_unique_constraint(
        "uq_songs_playlist_video",
        "songs",
        ["playlist_id", "youtube_video_id"],
    )

    # ------------------------------------------------------------------
    # songs – status indexes for efficient Downloader queue queries
    # ------------------------------------------------------------------
    op.create_index(
        "ix_songs_download_status",
        "songs",
        ["download_status"],
    )
    op.create_index(
        "ix_songs_lyrics_status",
        "songs",
        ["lyrics_status"],
    )

    # ------------------------------------------------------------------
    # downloaded_tracks – Music Library DB table
    # ------------------------------------------------------------------
    op.create_table(
        "downloaded_tracks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("song_id", sa.Integer(), nullable=False),
        sa.Column("youtube_video_id", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("file_format", sa.String(length=20), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("artist", sa.String(length=500), nullable=True),
        sa.Column("album", sa.String(length=500), nullable=True),
        sa.Column("album_artist", sa.String(length=500), nullable=True),
        sa.Column("genre", sa.String(length=255), nullable=True),
        sa.Column("track_number", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("release_year", sa.Integer(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("artwork_path", sa.Text(), nullable=True),
        sa.Column(
            "artwork_embedded",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "metadata_state",
            sa.String(length=50),
            nullable=False,
            server_default="raw",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["song_id"],
            ["songs.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("song_id", name="uq_downloaded_tracks_song_id"),
    )
    op.create_index(
        "ix_downloaded_tracks_song_id",
        "downloaded_tracks",
        ["song_id"],
    )
    op.create_index(
        "ix_downloaded_tracks_youtube_video_id",
        "downloaded_tracks",
        ["youtube_video_id"],
    )

    # ------------------------------------------------------------------
    # app_settings – playlist removal policy
    # ------------------------------------------------------------------
    op.add_column(
        "app_settings",
        sa.Column(
            "delete_local_file_on_playlist_removal",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    # Reverse order

    # app_settings
    op.drop_column("app_settings", "delete_local_file_on_playlist_removal")

    # downloaded_tracks
    op.drop_index("ix_downloaded_tracks_youtube_video_id", table_name="downloaded_tracks")
    op.drop_index("ix_downloaded_tracks_song_id", table_name="downloaded_tracks")
    op.drop_table("downloaded_tracks")

    # songs – status indexes
    op.drop_index("ix_songs_lyrics_status", table_name="songs")
    op.drop_index("ix_songs_download_status", table_name="songs")

    # songs – composite unique constraint
    op.drop_constraint("uq_songs_playlist_video", "songs", type_="unique")

    # songs – restore dropped columns
    op.add_column(
        "songs",
        sa.Column("duration", sa.Integer(), nullable=True),
    )
    op.add_column(
        "songs",
        sa.Column("album", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "songs",
        sa.Column("artist", sa.String(length=500), nullable=True),
    )
