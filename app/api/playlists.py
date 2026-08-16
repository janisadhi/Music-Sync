from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import (
    PlaylistCreate,
    PlaylistResponse,
    PlaylistUpdate,
    SongResponse,
)
from app.database.models import Playlist, Song
from app.database.session import get_db
from app.watcher.youtube import YouTubePlaylistWatcher


router = APIRouter(
    prefix="/playlists",
    tags=["Playlists"],
)


def extract_playlist_id(url: str) -> str:
    from urllib.parse import parse_qs, urlparse

    parsed = urlparse(url)

    playlist_id = parse_qs(
        parsed.query
    ).get(
        "list",
        [None],
    )[0]

    if not playlist_id:
        raise ValueError(
            "Could not extract playlist ID from URL"
        )

    return playlist_id


@router.get(
    "",
    response_model=list[PlaylistResponse],
)
def get_playlists(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Playlist).order_by(Playlist.id)
    ).all()


@router.post(
    "",
    response_model=PlaylistResponse,
    status_code=201,
)
def create_playlist(
    request: PlaylistCreate,
    db: Session = Depends(get_db),
):
    try:
        youtube_playlist_id = extract_playlist_id(
            request.url
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    existing = db.scalar(
        select(Playlist).where(
            Playlist.youtube_playlist_id
            == youtube_playlist_id
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Playlist already exists",
        )

    name = request.name

    if not name:
        try:
            watcher = YouTubePlaylistWatcher(
                request.url
            )

            info = watcher.fetch_playlist_metadata()

            name = info["name"]

        except Exception:
            name = "YouTube Playlist"

    playlist = Playlist(
        youtube_playlist_id=youtube_playlist_id,
        name=name,
        url=request.url,
        enabled=request.enabled,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return playlist


@router.get(
    "/{playlist_id}",
    response_model=PlaylistResponse,
)
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.get(
        Playlist,
        playlist_id,
    )

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    return playlist


@router.patch(
    "/{playlist_id}",
    response_model=PlaylistResponse,
)
def update_playlist(
    playlist_id: int,
    request: PlaylistUpdate,
    db: Session = Depends(get_db),
):
    playlist = db.get(
        Playlist,
        playlist_id,
    )

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    if request.url is not None:
        try:
            youtube_playlist_id = extract_playlist_id(
                request.url
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )

        existing = db.scalar(
            select(Playlist).where(
                Playlist.youtube_playlist_id
                == youtube_playlist_id,
                Playlist.id != playlist_id,
            )
        )

        if existing:
            raise HTTPException(
                status_code=409,
                detail="Playlist already exists",
            )

        playlist.youtube_playlist_id = (
            youtube_playlist_id
        )
        playlist.url = request.url

    if request.name is not None:
        playlist.name = request.name

    if request.enabled is not None:
        playlist.enabled = request.enabled

    db.commit()
    db.refresh(playlist)

    return playlist


@router.delete(
    "/{playlist_id}",
)
def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.get(
        Playlist,
        playlist_id,
    )

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    db.delete(playlist)
    db.commit()

    return {
        "message": "Playlist deleted successfully",
        "playlist_id": playlist_id,
    }


@router.get(
    "/{playlist_id}/songs",
    response_model=list[SongResponse],
)
def get_playlist_songs(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.get(
        Playlist,
        playlist_id,
    )

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    songs = db.scalars(
        select(Song)
        .where(
            Song.playlist_id == playlist_id
        )
        .order_by(Song.position)
    ).all()
    from app.api.songs import _to_song_response
    return [_to_song_response(s) for s in songs]


@router.post(
    "/{playlist_id}/sync",
)
def sync_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.get(
        Playlist,
        playlist_id,
    )

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    from app.sync.service import SyncService

    try:
        sync_service = SyncService()
        result = sync_service.sync_single_playlist(playlist_id)
        return {
            "message": f"Playlist '{playlist.name}' synced successfully",
            "stats": result,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(exc)}",
        )