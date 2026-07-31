from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import LyricsResponse, SongResponse
from app.database.models import Song
from app.database.session import get_db


router = APIRouter(
    prefix="/songs",
    tags=["Songs"],
)


MUSIC_ROOT = Path("/app/data/music")
NO_LYRICS_ROOT = Path("/app/data/no-lyrics")


def resolve_file_path(file_path: str) -> Path:
    path = Path(file_path)

    if path.is_absolute():
        return path

    return Path("/app") / path


@router.get("", response_model=list[SongResponse])
def get_songs(
    db: Session = Depends(get_db),
):
    songs = db.scalars(
        select(Song).order_by(Song.position)
    ).all()

    return songs


@router.get("/{song_id}", response_model=SongResponse)
def get_song(
    song_id: int,
    db: Session = Depends(get_db),
):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Song not found",
        )

    return song


@router.get("/{song_id}/audio")
def get_song_audio(
    song_id: int,
    db: Session = Depends(get_db),
):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Song not found",
        )

    if song.download_status != "downloaded":
        raise HTTPException(
            status_code=404,
            detail="Song has not been downloaded",
        )

    if not song.file_path:
        raise HTTPException(
            status_code=404,
            detail="Audio file path not available",
        )

    audio_path = resolve_file_path(song.file_path)

    if not audio_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Audio file not found",
        )

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=audio_path.name,
    )


@router.get(
    "/{song_id}/lyrics",
    response_model=LyricsResponse,
)
def get_song_lyrics(
    song_id: int,
    db: Session = Depends(get_db),
):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Song not found",
        )

    lyrics = None

    if song.lyrics_path:
        lyrics_path = resolve_file_path(song.lyrics_path)

        if lyrics_path.exists():
            lyrics = lyrics_path.read_text(
                encoding="utf-8"
            )

    return LyricsResponse(
        song_id=song.id,
        title=song.title,
        lyrics_status=song.lyrics_status,
        lyrics=lyrics,
    )