from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ScanRequest(BaseModel):
    force_reprocess: bool = False


class ScanJobStatus(BaseModel):
    job_id: str
    status: str  # "started", "running", "completed", "failed"
    started_at: datetime
    finished_at: datetime | None = None
    total_tracks: int = 0
    processed_tracks: int = 0
    enriched_tracks: int = 0
    failed_tracks: int = 0
    error: str | None = None


class LibraryMetrics(BaseModel):
    total_files: int = 0
    raw_files: int = 0
    processing_files: int = 0
    enriched_files: int = 0
    low_confidence_files: int = 0
    failed_files: int = 0
    skipped_files: int = 0
    beets_edited_count: int = 0


class MetadataStatusResponse(BaseModel):
    is_scanning: bool = False
    current_job: ScanJobStatus | None = None
    metrics: LibraryMetrics


class TrackMetadataItem(BaseModel):
    id: int
    song_id: int
    youtube_video_id: str
    file_path: str | None = None
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    album_artist: str | None = None
    genre: str | None = None
    track_number: int | None = None
    duration_seconds: int | None = None
    release_year: int | None = None
    musicbrainz_recording_id: str | None = None
    musicbrainz_artist_id: str | None = None
    musicbrainz_release_id: str | None = None
    musicbrainz_release_group_id: str | None = None
    acoustid_id: str | None = None
    fingerprint: str | None = None
    spotify_track_id: str | None = None
    spotify_artist_id: str | None = None
    spotify_album_id: str | None = None
    metadata_state: str
    beets_metadata_edited: bool
    updated_at: datetime


class TrackResultsResponse(BaseModel):
    items: list[TrackMetadataItem]
    total: int
    page: int
    limit: int


class EnrichTrackResponse(BaseModel):
    success: bool
    message: str
    track: TrackMetadataItem | None = None


class MetadataHistoryItem(BaseModel):
    id: int
    action: str
    previous_metadata: dict[str, Any] | None = None
    new_metadata: dict[str, Any] | None = None
    previous_filename: str | None = None
    new_filename: str | None = None
    previous_lyrics_filename: str | None = None
    new_lyrics_filename: str | None = None
    match_source: str | None = None
    match_confidence: str | None = None
    musicbrainz_recording_id: str | None = None
    musicbrainz_artist_id: str | None = None
    acoustid_id: str | None = None
    spotify_track_id: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime


class TrackDetailResponse(BaseModel):
    track: TrackMetadataItem
    lyrics_path: str | None = None
    parsed_artist: str | None = None
    parsed_title: str | None = None
    history: list[MetadataHistoryItem] = []
