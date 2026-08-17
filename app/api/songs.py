
import re
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import (
    BatchRetryRequest,
    BatchRetryResponse,
    LyricsResponse,
    SongResponse,
)
from app.database.models import Song
from app.core.paths import (
    get_download_root as _get_download_root,
    get_playlist_music_root as _get_playlist_music_root,
    get_playlist_no_lyrics_root as _get_playlist_no_lyrics_root,
    resolve_file_path as _resolve_file_path,
)
from app.database.session import get_db
from app.core.config import settings

router = APIRouter(
    prefix="/songs",
    tags=["Songs"],
)


MUSIC_ROOT = Path(settings.music_root)


def resolve_file_path(file_path: str) -> Path:
    return _resolve_file_path(file_path)


def get_download_root() -> Path:
    return _get_download_root()


def get_playlist_music_root(song: Song) -> Path:
    if song.playlist is None:
        raise HTTPException(
            status_code=400,
            detail="Song playlist is missing",
        )

    return _get_playlist_music_root(
        song.playlist.name
    )


def get_playlist_no_lyrics_root(song: Song) -> Path:
    if song.playlist is None:
        raise HTTPException(
            status_code=400,
            detail="Song playlist is missing",
        )

    return _get_playlist_no_lyrics_root(
        song.playlist.name
    )

# ---------------------------------------------------------
# Songs
# ---------------------------------------------------------


def _extract_artist_fallback(title: str) -> str | None:
    clean_title = re.sub(
        r"\s*[\(\\[]?(?:official|music|video|audio|lyric|lyrics|hd|4k|remastered|remaster|live|acoustic|ft\.|feat\.).*?[\)\\]]?",
        "",
        title,
        flags=re.IGNORECASE,
    ).strip()
    if " - " in clean_title:
        return clean_title.split(" - ", 1)[0].strip()
    return None


def _to_song_response(song: Song) -> SongResponse:
    title = song.title
    raw_title = song.title
    artist = None
    album = None
    album_artist = None
    genre = None
    release_year = None
    track_number = None
    thumbnail_url = None
    duration_seconds = None
    beets_metadata_edited = False
    metadata_state = None
    downloaded_track_id = None
    file_path = song.file_path

    if song.downloaded_track:
        downloaded_track_id = song.downloaded_track.id
        if song.downloaded_track.title:
            title = song.downloaded_track.title
        if song.downloaded_track.artist:
            artist = song.downloaded_track.artist
        album = song.downloaded_track.album
        album_artist = song.downloaded_track.album_artist
        genre = song.downloaded_track.genre
        release_year = song.downloaded_track.release_year
        track_number = song.downloaded_track.track_number
        thumbnail_url = song.downloaded_track.thumbnail_url
        duration_seconds = song.downloaded_track.duration_seconds
        beets_metadata_edited = song.downloaded_track.beets_metadata_edited
        metadata_state = song.downloaded_track.metadata_state
        if song.downloaded_track.file_path:
            file_path = song.downloaded_track.file_path

    if not artist:
        artist = _extract_artist_fallback(raw_title)

    return SongResponse(
        id=song.id,
        playlist_id=song.playlist_id,
        youtube_video_id=song.youtube_video_id,
        title=title,
        raw_title=raw_title,
        position=song.position,
        download_status=song.download_status,
        lyrics_status=song.lyrics_status,
        file_path=file_path,
        lyrics_path=song.lyrics_path,
        error_message=song.error_message,
        artist=artist,
        album=album,
        album_artist=album_artist,
        genre=genre,
        release_year=release_year,
        track_number=track_number,
        thumbnail_url=thumbnail_url,
        duration_seconds=duration_seconds,
        beets_metadata_edited=beets_metadata_edited,
        metadata_state=metadata_state,
        downloaded_track_id=downloaded_track_id,
        created_at=song.created_at,
        updated_at=song.updated_at,
    )


@router.get("/artists", response_model=list[str])
def get_artists(
    db: Session = Depends(get_db),
):
    songs = db.scalars(select(Song)).all()
    artists_set = set()
    for song in songs:
        artist = None
        if song.downloaded_track and song.downloaded_track.artist:
            artist = song.downloaded_track.artist
        if not artist:
            artist = _extract_artist_fallback(song.title)
        if artist:
            artists_set.add(artist)

    return sorted(list(artists_set))


@router.get("/albums")
def get_albums(
    db: Session = Depends(get_db),
):
    songs = db.scalars(select(Song)).all()
    albums_dict = {}

    for song in songs:
        res = _to_song_response(song)
        album_name = res.album or "Unknown Album"
        if album_name not in albums_dict:
            albums_dict[album_name] = {
                "name": album_name,
                "artist": res.album_artist or res.artist or "Unknown Artist",
                "year": res.release_year,
                "thumbnail_url": res.thumbnail_url,
                "song_count": 0,
            }
        albums_dict[album_name]["song_count"] += 1
        if not albums_dict[album_name]["thumbnail_url"] and res.thumbnail_url:
            albums_dict[album_name]["thumbnail_url"] = res.thumbnail_url

    return sorted(list(albums_dict.values()), key=lambda a: a["name"])


@router.get("/genres")
def get_genres(
    db: Session = Depends(get_db),
):
    songs = db.scalars(select(Song)).all()
    genres_dict = {}

    for song in songs:
        res = _to_song_response(song)
        genre_name = res.genre or "Unknown Genre"
        if genre_name not in genres_dict:
            genres_dict[genre_name] = {
                "name": genre_name,
                "song_count": 0,
            }
        genres_dict[genre_name]["song_count"] += 1

    return sorted(list(genres_dict.values()), key=lambda g: g["name"])


@router.get("", response_model=list[SongResponse])
def get_songs(
    artist: str | None = None,
    album: str | None = None,
    genre: str | None = None,
    playlist_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Song)
    if playlist_id is not None:
        stmt = stmt.where(Song.playlist_id == playlist_id)

    stmt = stmt.order_by(
        Song.playlist_id,
        Song.position,
    )
    songs = db.scalars(stmt).all()
    responses = [_to_song_response(s) for s in songs]

    if artist and artist != "all":
        artist_lower = artist.lower()
        responses = [
            r for r in responses
            if r.artist and r.artist.lower() == artist_lower
        ]

    if album and album != "all":
        album_lower = album.lower()
        responses = [
            r for r in responses
            if r.album and r.album.lower() == album_lower
        ]

    if genre and genre != "all":
        genre_lower = genre.lower()
        responses = [
            r for r in responses
            if r.genre and r.genre.lower() == genre_lower
        ]

    return responses


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

    return _to_song_response(song)


# ---------------------------------------------------------
# Audio
# ---------------------------------------------------------


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

    audio_path = resolve_file_path(
        song.file_path
    )

    if not audio_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Audio file not found",
        )

    return FileResponse(
        path=audio_path,
        media_type="audio/ogg",
        filename=audio_path.name,
    )


# ---------------------------------------------------------
# Lyrics
# ---------------------------------------------------------


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


# ---------------------------------------------------------
# Batch Retry download & lyrics
# ---------------------------------------------------------


@router.post(
    "/retry-download",
    response_model=BatchRetryResponse,
)
def batch_retry_download(
    request: BatchRetryRequest,
    db: Session = Depends(get_db),
):
    if not request.song_ids:
        return BatchRetryResponse(queued=0, skipped=0, total=0)

    songs = db.scalars(
        select(Song).where(Song.id.in_(request.song_ids))
    ).all()

    found_ids = {s.id for s in songs}
    queued_count = 0
    skipped_count = len(request.song_ids) - len(found_ids)

    for song in songs:
        if song.download_status == "pending":
            skipped_count += 1
            continue

        song.download_status = "pending"
        song.download_retry_count = 0
        song.next_download_attempt = None
        song.error_message = None
        queued_count += 1

    db.commit()

    if queued_count > 0:
        try:
            from app.core.runtime import downloader_worker

            downloader_worker.wake()
        except Exception:
            pass

    return BatchRetryResponse(
        queued=queued_count,
        skipped=skipped_count,
        total=len(request.song_ids),
    )


@router.post(
    "/retry-lyrics",
    response_model=BatchRetryResponse,
)
def batch_retry_lyrics(
    request: BatchRetryRequest,
    db: Session = Depends(get_db),
):
    if not request.song_ids:
        return BatchRetryResponse(queued=0, skipped=0, total=0)

    songs = db.scalars(
        select(Song).where(Song.id.in_(request.song_ids))
    ).all()

    found_ids = {s.id for s in songs}
    queued_count = 0
    skipped_count = len(request.song_ids) - len(found_ids)

    for song in songs:
        if song.lyrics_status == "pending":
            skipped_count += 1
            continue

        if song.download_status != "downloaded":
            skipped_count += 1
            continue

        if song.file_path:
            try:
                current_path = resolve_file_path(song.file_path)
                if current_path.exists():
                    no_lyrics_root = get_playlist_no_lyrics_root(song)
                    music_root = get_playlist_music_root(song)
                    if current_path.parent == no_lyrics_root:
                        destination = music_root / current_path.name
                        shutil.copy2(current_path, destination)
                        current_path.unlink()
                        song.file_path = str(destination)
                        if song.downloaded_track:
                            song.downloaded_track.file_path = str(destination)
            except Exception:
                pass

        song.lyrics_status = "pending"
        song.error_message = None
        queued_count += 1

    db.commit()

    if queued_count > 0:
        try:
            from app.core.runtime import lyrics_worker

            lyrics_worker.wake()
        except Exception:
            pass

    return BatchRetryResponse(
        queued=queued_count,
        skipped=skipped_count,
        total=len(request.song_ids),
    )


# ---------------------------------------------------------
# Single Retry download
# ---------------------------------------------------------


@router.post(
    "/{song_id}/retry-download",
    response_model=SongResponse,
)
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
    song.download_retry_count = 0
    song.next_download_attempt = None
    song.error_message = None
    song.file_path = None

    db.commit()
    db.refresh(song)

    return song


# ---------------------------------------------------------
# Retry lyrics
# ---------------------------------------------------------


@router.post(
    "/{song_id}/retry-lyrics",
    response_model=SongResponse,
)
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
            detail=(
                "Song must be downloaded "
                "before retrying lyrics"
            ),
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

    current_path = resolve_file_path(
        song.file_path
    )

    if not current_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Song audio file not found",
        )

    music_root = get_playlist_music_root(
        song
    )

    no_lyrics_root = get_playlist_no_lyrics_root(
        song
    )

    # -----------------------------------------------------
    # If the song is currently in no-lyrics/,
    # move it back to music/.
    # -----------------------------------------------------

    if current_path.parent == no_lyrics_root:

        destination = (
            music_root
            / current_path.name
        )

        try:
            # music and no-lyrics are inside the same
            # Docker volume, but copy + unlink is safe
            # even if this changes later.

            shutil.copy2(
                current_path,
                destination,
            )

            current_path.unlink()

            song.file_path = str(
                destination
            )

            # Keep DownloadedTrack.file_path in sync
            if song.downloaded_track:
                song.downloaded_track.file_path = str(
                    destination
                )

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to restore audio file: "
                    f"{exc}"
                ),
            )

    # -----------------------------------------------------
    # Reset lyrics state
    # -----------------------------------------------------

    song.lyrics_status = "pending"
    song.lyrics_path = None
    song.error_message = None

    db.commit()
    db.refresh(song)

    return song


# ---------------------------------------------------------
# Delete song
# ---------------------------------------------------------


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
        audio_path = resolve_file_path(
            song.file_path
        )

        if audio_path.exists():
            audio_path.unlink()

    # Delete lyrics file if it exists.
    if song.lyrics_path:
        lyrics_path = resolve_file_path(
            song.lyrics_path
        )

        if lyrics_path.exists():
            lyrics_path.unlink()

    db.delete(song)
    db.commit()

    return {
        "message": "Song deleted successfully",
        "song_id": song_id,
    }
