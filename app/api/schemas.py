from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------
# Playlist
# ---------------------------------------------------------

class PlaylistCreate(BaseModel):
    url: str
    name: str | None = None
    enabled: bool = True


class PlaylistUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    enabled: bool | None = None


class PlaylistResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    youtube_playlist_id: str
    name: str
    url: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------
# Song
# ---------------------------------------------------------

class SongResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    playlist_id: int
    youtube_video_id: str
    title: str
    artist: str | None
    album: str | None
    duration: int | None
    position: int | None
    download_status: str
    lyrics_status: str
    file_path: str | None
    lyrics_path: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------
# Lyrics
# ---------------------------------------------------------

class LyricsResponse(BaseModel):
    song_id: int
    title: str
    lyrics_status: str
    lyrics: str | None