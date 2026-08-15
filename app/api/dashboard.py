from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.runtime import downloader_worker, lyrics_worker, scheduler
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
                Song.download_status == "downloaded"
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
                Song.lyrics_status == "downloaded"
            )
        ) or 0
        
        unavailable_lyrics = session.scalar(
            select(func.count(Song.id)).where(
                Song.lyrics_status == "unavailable"
            )
        ) or 0
        
        unavailable_songs = session.scalar(
            select(func.count(Song.id)).where(
                Song.download_status == "unavailable"
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
    dl_status = downloader_worker.get_status()
    lrc_status = lyrics_worker.get_status()

    return {
        "playlist": playlist_data,
        "stats": {
            "total_songs": total_songs,
            "pending_downloads": pending_downloads,
            "downloaded_songs": downloaded_songs,
            "failed_downloads": failed_downloads,
            "unavailable_songs": unavailable_songs,
            "pending_lyrics": pending_lyrics,
            "completed_lyrics": completed_lyrics,
            "unavailable_lyrics": unavailable_lyrics,
            "failed_lyrics": failed_lyrics,
        },
        "scheduler": {
            "running": status["scheduler_running"],
            "sync_running": status["sync_running"],
            "interval_seconds": status["interval_seconds"],
            "interval_minutes": status["interval_minutes"],
        },
        "downloader": {
            "running": dl_status["worker_running"],
            "last_poll_started_at": dl_status["last_poll_started_at"],
            "last_poll_completed_at": dl_status["last_poll_completed_at"],
            "last_poll_status": dl_status["last_poll_status"],
            "last_poll_error": dl_status["last_poll_error"],
            "last_poll_downloaded": dl_status["last_poll_downloaded"],
            "total_downloaded": dl_status["total_downloaded"],
        },
        "lyrics": {
            "running": lrc_status["worker_running"],
            "last_poll_completed_at": lrc_status["last_poll_completed_at"],
            "last_poll_status": lrc_status["last_poll_status"],
            "last_poll_error": lrc_status["last_poll_error"],
            "total_processed": lrc_status["total_processed"],
        },
        "last_sync": {
            "status": status["last_sync_status"],
            "started_at": status["last_sync_started_at"],
            "completed_at": status["last_sync_completed_at"],
            "error": status["last_sync_error"],
            "stats": status.get("last_sync_stats"),
        },
        "recent_syncs": scheduler.get_history()[:10],
    }
