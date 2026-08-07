
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
        import time
        start_time = time.time()

        print("=" * 60)
        print("Music Sync")
        print("=" * 60)

        # ---------------------------------------------------------
        # Load application settings
        # ---------------------------------------------------------
        app_settings = self.settings_service.get()

        download_limit = app_settings.download_limit
        lyrics_limit = app_settings.lyrics_limit

        print(
            f"Download concurrency: {download_limit}"
        )

        print(
            f"Lyrics concurrency: {lyrics_limit}"
        )

        # ---------------------------------------------------------
        # Load enabled playlists
        # ---------------------------------------------------------
        with SessionLocal() as session:
            playlists = session.scalars(
                select(Playlist)
                .where(
                    Playlist.enabled.is_(True)
                )
                .order_by(Playlist.id)
            ).all()

        print(
            f"Enabled playlists: {len(playlists)}"
        )

        if not playlists:
            print(
                "No enabled playlists configured."
            )

            print("=" * 60)
            print("Sync cycle completed")
            print("=" * 60)

            return

        total_discovered = 0
        total_new = 0

        # ---------------------------------------------------------
        # Process each playlist (Scan Phase - Once per sync)
        # ---------------------------------------------------------
        for playlist in playlists:

            print()
            print("-" * 60)
            print(
                f"Playlist: {playlist.name}"
            )
            print(
                f"URL: {playlist.url}"
            )
            print("-" * 60)

            try:
                discovered, new_count = self._sync_playlist(
                    playlist_id=playlist.id,
                    playlist_url=playlist.url,
                    youtube_playlist_id=(
                        playlist.youtube_playlist_id
                    ),
                    playlist_name=playlist.name,
                )
                total_discovered += discovered
                total_new += new_count

            except Exception as exc:
                print(
                    f"Playlist sync failed: "
                    f"{playlist.name}"
                )

                print(
                    f"Error: {exc}"
                )

                # Continue with the next playlist.
                continue

        # ---------------------------------------------------------
        # Drain pending download queue
        # ---------------------------------------------------------
        downloads_completed = self.downloader.download_pending(
            limit=download_limit
        )

        # ---------------------------------------------------------
        # Drain pending lyrics queue
        # ---------------------------------------------------------
        lyrics_completed = self.lyrics.process_pending(
            limit=lyrics_limit
        )

        elapsed = time.time() - start_time

        print("=" * 60)
        print("Sync Statistics")
        print("=" * 60)
        print(f"Playlists scanned:          {len(playlists)}")
        print(f"Playlist entries discovered: {total_discovered}")
        print(f"New songs added:            {total_new}")
        print(f"Downloads completed:        {downloads_completed}")
        print(f"Lyrics completed:           {lyrics_completed}")
        print(f"Duration:                   {elapsed:.2f} seconds")
        print("=" * 60)
        print("Sync cycle completed")
        print("=" * 60)

    def _sync_playlist(
        self,
        playlist_id: int,
        playlist_url: str,
        youtube_playlist_id: str,
        playlist_name: str,
    ) -> tuple[int, int]:
        # ---------------------------------------------------------
        # Fetch YouTube playlist
        # ---------------------------------------------------------
        watcher = YouTubePlaylistWatcher(
            playlist_url
        )

        youtube_songs = watcher.fetch()

        print(
            f"Playlist songs discovered: "
            f"{len(youtube_songs)}"
        )
        print("Playlist scan completed")

        if not youtube_songs:
            print(
                "No songs found in playlist."
            )

            return 0, 0

        # ---------------------------------------------------------
        # Reconcile playlist with database
        # ---------------------------------------------------------
        with SessionLocal() as session:

            playlist = session.get(
                Playlist,
                playlist_id,
            )

            if playlist is None:
                raise ValueError(
                    f"Playlist {playlist_id} "
                    "no longer exists"
                )

            reconciler = PlaylistReconciler(
                session
            )

            new_songs = reconciler.reconcile(
                playlist_url=playlist_url,
                youtube_playlist_id=(
                    youtube_playlist_id
                ),
                playlist_name=playlist_name,
                songs=youtube_songs,
            )

            print(
                f"New songs added: "
                f"{len(new_songs)}"
            )

            return len(youtube_songs), len(new_songs)
