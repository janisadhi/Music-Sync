from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Playlist
# ---------------------------------------------------------------------------

class PlaylistCreate(BaseModel):
    url: str
    name: str | None = None
    enabled: bool = True


class PlaylistUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    enabled: bool | None = None


class PlaylistResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    youtube_playlist_id: str
    name: str
    url: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Song  (Sync DB – lean record)
# ---------------------------------------------------------------------------

class SongResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    playlist_id: int
    youtube_video_id: str
    title: str
    position: int | None
    download_status: str
    lyrics_status: str
    file_path: str | None
    lyrics_path: str | None
    artist: str | None = None
    album: str | None = None
    thumbnail_url: str | None = None
    duration_seconds: int | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# DownloadedTrack  (Music Library DB – rich metadata)
# ---------------------------------------------------------------------------

class DownloadedTrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    song_id: int
    youtube_video_id: str
    file_path: str | None
    file_format: str | None
    file_size_bytes: int | None
    title: str | None
    artist: str | None
    album: str | None
    album_artist: str | None
    genre: str | None
    track_number: int | None
    duration_seconds: int | None
    release_year: int | None
    thumbnail_url: str | None
    artwork_path: str | None
    artwork_embedded: bool
    metadata_state: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Lyrics
# ---------------------------------------------------------------------------

class LyricsResponse(BaseModel):
    song_id: int
    title: str
    lyrics_status: str
    lyrics: str | None
