"""
Sync Service.

Responsibility: discover what exists in YouTube playlists and write the
minimum synchronisation state to the Sync DB.

Architecture contract
---------------------
  SYNC DISCOVERS.  DOWNLOADER DOWNLOADS.  SCHEDULER TRIGGERS.

This service:
  ✓ Loads enabled playlists
  ✓ Runs a lightweight flat scan per playlist (no per-video requests)
  ✓ Writes new/updated/unavailable Song rows to the Sync DB
  ✓ Commits after each song so the Downloader can start immediately

This service does NOT:
  ✗ Import or call SongDownloader
  ✗ Import or call LyricsService
  ✗ Fetch artist / album / artwork metadata
  ✗ Download audio
  ✗ Process lyrics
  ✗ Accumulate the entire playlist in memory before writing

The Downloader runs independently, continuously polling the Sync DB for
rows with download_status='pending'.  It is started and managed externally
(e.g. via the Scheduler or the API).  Sync and Downloader communicate
exclusively through the database.
"""

import time

from sqlalchemy import select

from app.database.models import Playlist
from app.database.session import SessionLocal
from app.reconciler.service import PlaylistReconciler
from app.settings.service import SettingsService
from app.watcher.youtube import YouTubePlaylistWatcher


class SyncService:
    def __init__(self):
        self.settings_service = SettingsService()

    def run(self) -> dict:
        """
        Execute one full sync cycle.

        Returns a statistics dict that the Scheduler can log.
        """
        start_time = time.time()

        print("=" * 60)
        print("Music Sync — playlist discovery")
        print("=" * 60)

        # ----------------------------------------------------------
        # Load settings
        # ----------------------------------------------------------
        app_settings = self.settings_service.get()

        watch_mode = app_settings.playlist_watch_mode
        watch_limit = app_settings.playlist_watch_limit
        delete_local = app_settings.delete_local_file_on_playlist_removal

        print(f"Watch mode: {watch_mode}"
              + (f" (limit: {watch_limit})" if watch_mode == "last_n" else ""))
        print(f"Delete local file on removal: {delete_local}")

        # ----------------------------------------------------------
        # Load enabled playlists
        # ----------------------------------------------------------
        with SessionLocal() as session:
            playlists = session.scalars(
                select(Playlist)
                .where(Playlist.enabled.is_(True))
                .order_by(Playlist.id)
            ).all()

        print(f"Enabled playlists: {len(playlists)}")

        if not playlists:
            print("No enabled playlists configured.")
            print("=" * 60)
            print("Sync cycle completed (nothing to do)")
            print("=" * 60)
            return {
                "playlists_scanned": 0,
                "total_discovered": 0,
                "total_new": 0,
                "total_unavailable": 0,
                "elapsed_seconds": round(time.time() - start_time, 2),
            }

        total_discovered = 0
        total_new = 0
        total_unavailable = 0

        # ----------------------------------------------------------
        # Scan each playlist
        # ----------------------------------------------------------
        for playlist in playlists:
            print()
            print("-" * 60)
            print(f"Playlist: {playlist.name}")
            print(f"URL: {playlist.url}")
            print("-" * 60)

            try:
                discovered, new_count, unavail_count = self._sync_playlist(
                    playlist_id=playlist.id,
                    playlist_url=playlist.url,
                    youtube_playlist_id=playlist.youtube_playlist_id,
                    playlist_name=playlist.name,
                    watch_mode=watch_mode,
                    watch_limit=watch_limit,
                    delete_local_on_removal=delete_local,
                )
                total_discovered += discovered
                total_new += new_count
                total_unavailable += unavail_count

            except Exception as exc:
                print(f"Playlist sync failed: {playlist.name}")
                print(f"Error: {exc}")
                # Continue scanning remaining playlists.
                continue

        elapsed = time.time() - start_time

        print()
        print("=" * 60)
        print("Sync Statistics")
        print("=" * 60)
        print(f"Playlists scanned:            {len(playlists)}")
        print(f"Playlist entries discovered:  {total_discovered}")
        print(f"New songs queued:             {total_new}")
        print(f"Unavailable videos:           {total_unavailable}")
        print(f"Duration:                     {elapsed:.2f} seconds")
        print("=" * 60)
        print("Sync cycle completed")
        print("=" * 60)

        return {
            "playlists_scanned": len(playlists),
            "total_discovered": total_discovered,
            "total_new": total_new,
            "total_unavailable": total_unavailable,
            "elapsed_seconds": round(elapsed, 2),
        }

    # ------------------------------------------------------------------
    # Per-playlist sync
    # ------------------------------------------------------------------

    def _sync_playlist(
        self,
        playlist_id: int,
        playlist_url: str,
        youtube_playlist_id: str,
        playlist_name: str,
        watch_mode: str = "whole",
        watch_limit: int | None = None,
        delete_local_on_removal: bool = False,
    ) -> tuple[int, int, int]:
        """
        Scan one playlist and reconcile it with the Sync DB.

        Returns (discovered, new_songs, unavailable_count).
        """
        # ----------------------------------------------------------
        # Step 1: lightweight flat scan (no per-video requests)
        # ----------------------------------------------------------
        watcher = YouTubePlaylistWatcher(playlist_url)

        items = watcher.fetch(
            watch_mode=watch_mode,
            watch_limit=watch_limit,
        )

        from app.watcher.youtube import UnavailableYouTubeSong
        available_count = sum(
            1 for i in items
            if not isinstance(i, UnavailableYouTubeSong)
        )
        unavail_count = len(items) - available_count

        print(f"Entries discovered: {len(items)} "
              f"({available_count} accessible, {unavail_count} unavailable)")

        if not items:
            print("No entries found in playlist.")
            return 0, 0, 0

        # ----------------------------------------------------------
        # Step 2: reconcile with Sync DB
        #
        # PlaylistReconciler commits after each item so the Downloader
        # can pick up new songs immediately.
        # ----------------------------------------------------------
        with SessionLocal() as session:
            playlist = session.get(Playlist, playlist_id)

            if playlist is None:
                raise ValueError(
                    f"Playlist {playlist_id} no longer exists"
                )

            reconciler = PlaylistReconciler(session)

            new_songs = reconciler.reconcile(
                playlist_url=playlist_url,
                youtube_playlist_id=youtube_playlist_id,
                playlist_name=playlist_name,
                songs=items,
                skip_deletions=(watch_mode == "last_n"),
                delete_local_file_on_removal=delete_local_on_removal,
            )

        print(f"New songs queued for download: {len(new_songs)}")
        print(f"Unavailable videos marked: {unavail_count}")
        print("Playlist scan complete")

        return len(items), len(new_songs), unavail_count
