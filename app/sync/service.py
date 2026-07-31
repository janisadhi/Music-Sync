
from sqlalchemy import select

from app.core.config import settings
from app.database.models import Playlist, Song
from app.database.session import SessionLocal
from app.downloader.service import SongDownloader
from app.lyrics.service import LyricsService
from app.reconciler.service import PlaylistReconciler
from app.watcher.youtube import YouTubePlaylistWatcher


class SyncService:
    def __init__(self):
        self.downloader = SongDownloader()
        self.lyrics = LyricsService()

    def run(self):
        print("=" * 60)
        print("Music Sync")
        print("=" * 60)

        if not settings.youtube_playlist_url:
            raise ValueError(
                "YOUTUBE_PLAYLIST_URL is not configured"
            )

        # ---------------------------------------------------------
        # 1. Fetch YouTube playlist
        # ---------------------------------------------------------
        watcher = YouTubePlaylistWatcher(
            settings.youtube_playlist_url
        )

        youtube_songs = watcher.fetch()

        print(
            f"Playlist songs discovered: {len(youtube_songs)}"
        )

        if not youtube_songs:
            print("No songs found in playlist.")
            return

        # ---------------------------------------------------------
        # 2. Reconcile playlist with database
        # ---------------------------------------------------------
        with SessionLocal() as session:
            playlist = session.scalar(
                select(Playlist).where(
                    Playlist.url == settings.youtube_playlist_url
                )
            )

            if playlist:
                playlist_id = playlist.youtube_playlist_id
                playlist_name = playlist.name
            else:
                playlist_id = self._extract_playlist_id(
                    settings.youtube_playlist_url
                )
                playlist_name = "YouTube Playlist"

            reconciler = PlaylistReconciler(session)

            new_songs = reconciler.reconcile(
                playlist_url=settings.youtube_playlist_url,
                youtube_playlist_id=playlist_id,
                playlist_name=playlist_name,
                songs=youtube_songs,
            )

            print(
                f"New songs added: {len(new_songs)}"
            )

        # ---------------------------------------------------------
        # 3. Download one pending song
        # ---------------------------------------------------------
        self.downloader.download_pending(limit=1)

        # ---------------------------------------------------------
        # 4. Fetch lyrics for one downloaded song
        # ---------------------------------------------------------
        self.lyrics.process_pending(limit=1)

        print("=" * 60)
        print("Sync cycle completed")
        print("=" * 60)

    @staticmethod
    def _extract_playlist_id(url: str) -> str:
        """
        Extract the YouTube playlist ID.

        Example:
        https://www.youtube.com/playlist?list=PL123
        -> PL123
        """
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(url)
        playlist_id = parse_qs(
            parsed.query
        ).get("list", [None])[0]

        if not playlist_id:
            raise ValueError(
                f"Could not extract playlist ID from URL: {url}"
            )

        return playlist_id

