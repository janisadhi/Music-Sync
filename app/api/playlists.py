from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import PlaylistResponse, SongResponse
from app.database.models import Playlist, Song
from app.database.session import get_db


router = APIRouter(
    prefix="/playlists",
    tags=["Playlists"],
)


@router.get(
    "",
    response_model=list[PlaylistResponse],
)
def get_playlists(
    db: Session = Depends(get_db),
):
    playlists = db.scalars(
        select(Playlist).order_by(Playlist.id)
    ).all()

    return playlists


@router.get(
    "/{playlist_id}",
    response_model=PlaylistResponse,
)
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    return playlist


@router.get(
    "/{playlist_id}/songs",
    response_model=list[SongResponse],
)
def get_playlist_songs(
    playlist_id: int,
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)

    if playlist is None:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    songs = db.scalars(
        select(Song)
        .where(Song.playlist_id == playlist_id)
        .order_by(Song.position)
    ).all()

    return songs

