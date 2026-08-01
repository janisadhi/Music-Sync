import shutil
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

@router.post("/{song_id}/retry-lyrics")
def retry_song_lyrics(
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
            status_code=400,
            detail="Song must be downloaded before retrying lyrics",
        )

    if song.lyrics_status not in {
        "unavailable",
        "failed",
    }:
        raise HTTPException(
            status_code=400,
            detail="Lyrics do not need to be retried",
        )

    if not song.file_path:
        raise HTTPException(
            status_code=400,
            detail="Song file path not available",
        )

    current_path = Path(song.file_path)

    if not current_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Song audio file not found",
        )

    # ---------------------------------------------------------
    # Move song back from no-lyrics/ to music/
    # ---------------------------------------------------------

    if current_path.parent == NO_LYRICS_ROOT:

        destination = MUSIC_ROOT / current_path.name

        try:
            # music and no-lyrics may be separate Docker
            # bind mounts, so use copy + unlink instead
            # of rename().
            shutil.copy2(
                current_path,
                destination,
            )

            current_path.unlink()

            song.file_path = str(destination)

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Failed to restore audio file: {exc}"
                ),
            )

    # ---------------------------------------------------------
    # Reset lyrics state
    # ---------------------------------------------------------

    song.lyrics_status = "pending"
    song.lyrics_path = None
    song.error_message = None

    db.commit()
    db.refresh(song)

    return {
        "message": "Lyrics retry scheduled",
        "song_id": song.id,
        "lyrics_status": song.lyrics_status,
    }

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

    # No lyrics file registered
    if not song.lyrics_path:
        return LyricsResponse(
            song_id=song.id,
            title=song.title,
            lyrics_status="unavailable",
            lyrics=None,
        )

    lyrics_path = resolve_file_path(
        song.lyrics_path
    )

    # Database says lyrics exist, but the actual
    # file is missing.
    if not lyrics_path.exists():
        return LyricsResponse(
            song_id=song.id,
            title=song.title,
            lyrics_status="unavailable",
            lyrics=None,
        )

    try:
        lyrics = lyrics_path.read_text(
            encoding="utf-8"
        )
    except OSError as exc:
        print(
            f"Failed to read lyrics file "
            f"for song {song.id}: {exc}"
        )

        return LyricsResponse(
            song_id=song.id,
            title=song.title,
            lyrics_status="unavailable",
            lyrics=None,
        )

    return LyricsResponse(
        song_id=song.id,
        title=song.title,
        lyrics_status="completed",
        lyrics=lyrics,
    )
@router.post("/{song_id}/retry-download", response_model=SongResponse)
def retry_download(
    song_id: int,
    db: Session = Depends(get_db),
):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Song not found",
        )

    song.download_status = "pending"
    song.error_message = None
    song.file_path = None

    db.commit()
    db.refresh(song)

    return song


@router.post("/{song_id}/retry-lyrics", response_model=SongResponse)
def retry_lyrics(
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
            status_code=400,
            detail="Song must be downloaded before retrying lyrics",
        )

    song.lyrics_status = "pending"
    song.lyrics_path = None
    song.error_message = None

    db.commit()
    db.refresh(song)

    return song


@router.delete("/{song_id}")
def delete_song(
    song_id: int,
    db: Session = Depends(get_db),
):
    song = db.get(Song, song_id)

    if song is None:
        raise HTTPException(
            status_code=404,
            detail="Song not found",
        )

    # Delete audio file if it exists.
    if song.file_path:
        audio_path = resolve_file_path(song.file_path)

        if audio_path.exists():
            audio_path.unlink()

    # Delete lyrics file if it exists.
    if song.lyrics_path:
        lyrics_path = resolve_file_path(song.lyrics_path)

        if lyrics_path.exists():
            lyrics_path.unlink()

    db.delete(song)
    db.commit()

    return {
        "message": "Song deleted successfully",
        "song_id": song_id,
    }