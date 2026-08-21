"""
Database models.

Two logical databases share one SQLAlchemy Base / PostgreSQL connection but
are kept conceptually separate:

Sync DB
-------
  playlists   – playlists being watched/synced
  songs       – per-video sync state (download_status, lyrics_status, …)
                Contains ONLY metadata required for synchronisation.
                No artist/album/genre/artwork metadata here.

Downloaded / Music Library DB
------------------------------
  downloaded_tracks – rich metadata for actually-downloaded music files.
                      Created by the Downloader after a successful download.
                      Will later be used by Beets and library management.

app_settings / users – shared configuration / auth tables.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


# ---------------------------------------------------------------------------
# Sync DB – Playlists
# ---------------------------------------------------------------------------

class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(primary_key=True)

    youtube_playlist_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    songs: Mapped[list["Song"]] = relationship(
        back_populates="playlist",
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------------------------
# Sync DB – Songs
#
# Intentionally lean.  Only fields required to track synchronisation state.
# Rich metadata (artist, album, genre, artwork, …) lives in DownloadedTrack.
# ---------------------------------------------------------------------------

class Song(Base):
    __tablename__ = "songs"

    # Composite unique index: one row per (playlist, video).
    __table_args__ = (
        UniqueConstraint(
            "playlist_id",
            "youtube_video_id",
            name="uq_songs_playlist_video",
        ),
        # Fast lookup by status for the Downloader queue.
        Index("ix_songs_download_status", "download_status"),
        Index("ix_songs_lyrics_status", "lyrics_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    playlist_id: Mapped[int] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    youtube_video_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # Title is cheap to obtain from flat playlist extraction.
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    # Playlist position/ordering – obtained during flat scan.
    position: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Download state
    #
    # Valid states:
    #   pending      – not yet downloaded; Downloader should process
    #   downloading  – actively being downloaded (or crashed mid-download)
    #   downloaded   – audio file exists on disk
    #   failed       – retryable download failure; see retry fields
    #   unavailable  – video is permanently unavailable / private / deleted;
    #                  do not retry unless manually reset
    # ------------------------------------------------------------------
    download_status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    download_retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    next_download_attempt: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Lyrics state
    #
    # Valid states:
    #   pending      – not yet attempted
    #   downloaded   – .lrc file written
    #   unavailable  – no synced lyrics found; file moved to no-lyrics/
    #   failed       – permanent failure
    # ------------------------------------------------------------------
    lyrics_status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
    )

    # Path to the downloaded audio file.
    file_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Path to the .lrc lyrics file.
    lyrics_path: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Last error message for debugging.
    error_message = Column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    playlist: Mapped["Playlist"] = relationship(
        back_populates="songs",
    )

    # One-to-one link to the Downloaded / Music Library DB record.
    downloaded_track: Mapped["DownloadedTrack | None"] = relationship(
        back_populates="song",
        cascade="all, delete-orphan",
        uselist=False,
    )


# ---------------------------------------------------------------------------
# Downloaded / Music Library DB – DownloadedTrack
#
# Created by the Downloader after a successful download.
# Contains rich metadata suitable for library management, Beets, etc.
# Beets and future metadata workers should read/write THIS table, not Song.
# ---------------------------------------------------------------------------

class DownloadedTrack(Base):
    __tablename__ = "downloaded_tracks"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Link back to the Sync DB record.
    song_id: Mapped[int] = mapped_column(
        ForeignKey("songs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # YouTube video ID duplicated here for lookups independent of songs table.
    youtube_video_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    # ------------------------------------------------------------------
    # File information
    # ------------------------------------------------------------------
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_format: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g. "opus", "mp3"
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ------------------------------------------------------------------
    # Rich music metadata (populated by Downloader; later enriched by Beets)
    # ------------------------------------------------------------------
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    artist: Mapped[str | None] = mapped_column(String(500), nullable=True)
    album: Mapped[str | None] = mapped_column(String(500), nullable=True)
    album_artist: Mapped[str | None] = mapped_column(String(500), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(255), nullable=True)
    track_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    release_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ------------------------------------------------------------------
    # Artwork
    # ------------------------------------------------------------------
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    artwork_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    artwork_embedded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ------------------------------------------------------------------
    # Authoritative MusicBrainz & AcoustID Identifiers
    # ------------------------------------------------------------------
    musicbrainz_recording_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    musicbrainz_artist_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    musicbrainz_release_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    musicbrainz_release_group_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    musicbrainz_track_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    acoustid_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    fingerprint: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Spotify Metadata Enrichment Identifiers
    # ------------------------------------------------------------------
    spotify_track_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    spotify_artist_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    spotify_album_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ------------------------------------------------------------------
    # Metadata processing state
    # Ready for future Beets integration:
    #   raw       – freshly downloaded, metadata not yet enriched
    #   enriched  – Beets (or similar) has processed this track
    #   failed    – metadata enrichment failed
    # ------------------------------------------------------------------
    metadata_state: Mapped[str] = mapped_column(
        String(50),
        default="raw",
        nullable=False,
    )

    beets_metadata_edited: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    song: Mapped["Song"] = relationship(
        back_populates="downloaded_track",
    )

    history_entries: Mapped[list["TrackMetadataHistory"]] = relationship(
        back_populates="downloaded_track",
        cascade="all, delete-orphan",
        order_by="TrackMetadataHistory.created_at.desc()",
    )


# ---------------------------------------------------------------------------
# Downloaded / Music Library DB – TrackMetadataHistory
#
# Records history of metadata changes, Beets autotagging, and file renames.
# ---------------------------------------------------------------------------

class TrackMetadataHistory(Base):
    __tablename__ = "track_metadata_history"

    id: Mapped[int] = mapped_column(primary_key=True)

    downloaded_track_id: Mapped[int] = mapped_column(
        ForeignKey("downloaded_tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(String(100), nullable=False)
    previous_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_lyrics_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_lyrics_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    match_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    match_confidence: Mapped[str | None] = mapped_column(String(50), nullable=True)
    musicbrainz_recording_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    musicbrainz_artist_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    acoustid_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    spotify_track_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="success", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    downloaded_track: Mapped["DownloadedTrack"] = relationship(
        back_populates="history_entries",
    )


# ---------------------------------------------------------------------------
# Application Settings
# ---------------------------------------------------------------------------

class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        default=1,
    )

    sync_interval_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )

    download_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    lyrics_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    max_download_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    download_retry_delay_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )

    youtube_playlist_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    auto_start_scheduler: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    playlist_watch_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="whole",
    )

    playlist_watch_limit: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    # ------------------------------------------------------------------
    # Playlist removal policy
    #
    # When True:  removing a song from the YouTube playlist causes the
    #             Reconciler to also delete the local audio file and the
    #             DownloadedTrack record.
    # When False: the local file is kept; only the playlist relationship
    #             / Sync DB record is removed.
    # ------------------------------------------------------------------
    delete_local_file_on_playlist_removal: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Optional YouTube Cookies (sensitive credential, plain Netscape format)
    # ------------------------------------------------------------------
    youtube_cookies: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    # ------------------------------------------------------------------
    # Metadata & Enrichment Service Settings
    # ------------------------------------------------------------------
    auto_scan_metadata_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    auto_rename_files: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    min_confidence_threshold: Mapped[str] = mapped_column(
        String(20),
        default="MEDIUM",
        server_default="MEDIUM",
        nullable=False,
    )

    clean_youtube_titles: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    username: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    must_change_password: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
