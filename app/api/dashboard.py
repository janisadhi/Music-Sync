from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.runtime import scheduler
from app.database.models import Playlist, Song
from app.database.session import SessionLocal

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get("")
def get_dashboard():
    with SessionLocal() as session:
        playlists = session.scalars(
            select(Playlist).order_by(Playlist.id)
        ).all()

        total_songs = session.scalar(
            select(func.count(Song.id))
        ) or 0

        pending_downloads = session.scalar(
            select(func.count(Song.id)).where(
                Song.download_status == "pending"
            )
        ) or 0

        downloaded_songs = session.scalar(
            select(func.count(Song.id)).where(
                Song.download_status == "completed"
            )
        ) or 0

        failed_downloads = session.scalar(
            select(func.count(Song.id)).where(
                Song.download_status == "failed"
            )
        ) or 0

        pending_lyrics = session.scalar(
            select(func.count(Song.id)).where(
                Song.lyrics_status == "pending"
            )
        ) or 0

        completed_lyrics = session.scalar(
            select(func.count(Song.id)).where(
                Song.lyrics_status == "completed"
            )
        ) or 0

        failed_lyrics = session.scalar(
            select(func.count(Song.id)).where(
                Song.lyrics_status == "failed"
            )
        ) or 0

        playlist_data = [
            {
                "id": playlist.id,
                "name": playlist.name,
                "youtube_playlist_id": playlist.youtube_playlist_id,
                "url": playlist.url,
                "enabled": playlist.enabled,
                "song_count": len(playlist.songs),
                "created_at": playlist.created_at,
                "updated_at": playlist.updated_at,
            }
            for playlist in playlists
        ]

    status = scheduler.get_status()

    return {
        "playlist": playlist_data,
        "stats": {
            "total_songs": total_songs,
            "pending_downloads": pending_downloads,
            "downloaded_songs": downloaded_songs,
            "failed_downloads": failed_downloads,
            "pending_lyrics": pending_lyrics,
            "completed_lyrics": completed_lyrics,
            "failed_lyrics": failed_lyrics,
        },
        "scheduler": {
            "running": status["scheduler_running"],
            "sync_running": status["sync_running"],
            "interval_seconds": status["interval_seconds"],
            "interval_minutes": status["interval_minutes"],
        },
        "last_sync": {
            "status": status["last_sync_status"],
            "started_at": status["last_sync_started_at"],
            "completed_at": status["last_sync_completed_at"],
            "error": status["last_sync_error"],
        },
        "recent_syncs": scheduler.get_history()[:10],
    }
