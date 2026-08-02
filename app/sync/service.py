from sqlalchemy import select

from app.database.models import Playlist, Song
from app.database.session import SessionLocal
from app.downloader.service import SongDownloader
from app.lyrics.service import LyricsService
from app.reconciler.service import PlaylistReconciler
from app.settings.service import SettingsService
from app.watcher.youtube import YouTubePlaylistWatcher


class SyncService:
    def __init__(self):
        self.downloader = SongDownloader()
        self.lyrics = LyricsService()
        self.settings_service = SettingsService()

    def run(self):
        print("=" * 60)
        print("Music Sync")
        print("=" * 60)

        # ---------------------------------------------------------
        # Load application settings from database
        # ---------------------------------------------------------
        app_settings = self.settings_service.get()
        playlist_url = app_settings.youtube_playlist_url
        download_limit = app_settings.download_limit
        lyrics_limit = app_settings.lyrics_limit

        if not playlist_url:
            raise ValueError(
                "YouTube playlist URL is not configured"
            )

        print(
            f"Download limit: {download_limit}"
        )

        print(
            f"Lyrics limit: {lyrics_limit}"
        )

        # ---------------------------------------------------------
        # 1. Fetch YouTube playlist
        # ---------------------------------------------------------
        watcher = YouTubePlaylistWatcher(
            playlist_url
        )

        youtube_songs = watcher.fetch()

        print(
            f"Playlist songs discovered: "
            f"{len(youtube_songs)}"
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
                    Playlist.url == playlist_url
                )
            )

            if playlist:
                playlist_id = (
                    playlist.youtube_playlist_id
                )

                playlist_name = playlist.name

            else:
                playlist_id = (
                    self._extract_playlist_id(
                        playlist_url
                    )
                )

                playlist_name = "YouTube Playlist"

            reconciler = PlaylistReconciler(
                session
            )

            new_songs = reconciler.reconcile(
                playlist_url=playlist_url,
                youtube_playlist_id=playlist_id,
                playlist_name=playlist_name,
                songs=youtube_songs,
            )

            print(
                f"New songs added: "
                f"{len(new_songs)}"
            )

        # ---------------------------------------------------------
        # 3. Download pending songs
        # ---------------------------------------------------------
        self.downloader.download_pending(
            limit=download_limit
        )

        # ---------------------------------------------------------
        # 4. Fetch lyrics
        # ---------------------------------------------------------
        self.lyrics.process_pending(
            limit=lyrics_limit
        )

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

        from urllib.parse import (
            parse_qs,
            urlparse,
        )

        parsed = urlparse(url)

        playlist_id = parse_qs(
            parsed.query
        ).get(
            "list",
            [None],
        )[0]

        if not playlist_id:
            raise ValueError(
                f"Could not extract playlist ID from URL: {url}"
            )

        return playlist_id
