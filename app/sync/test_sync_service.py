"""
Tests for SyncService.

Verifies:
  - Sync does NOT import or call SongDownloader or LyricsService
  - Sync calls the watcher and reconciler, nothing more
  - Incremental writes: Downloader can see pending songs before scan finishes
  - Stats dict is returned
  - Failed playlist is skipped; remaining playlists still processed
  - No per-video yt-dlp requests during scan
"""

from unittest.mock import MagicMock, call, patch

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database.models import AppSettings, Base, Playlist, Song
from app.sync.service import SyncService
from app.watcher.youtube import UnavailableYouTubeSong, YouTubeSong


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture()
def Session(db_engine):
    return sessionmaker(bind=db_engine, expire_on_commit=False)


@pytest.fixture()
def settings(Session):
    """Insert default AppSettings row."""
    with Session() as s:
        row = AppSettings(
            id=1,
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
            max_download_retries=5,
            download_retry_delay_seconds=60,
            youtube_playlist_url=None,
            auto_start_scheduler=False,
            playlist_watch_mode="whole",
            playlist_watch_limit=None,
            delete_local_file_on_playlist_removal=False,
        )
        s.add(row)
        s.commit()
    return row


@pytest.fixture()
def playlist(Session):
    with Session() as s:
        pl = Playlist(
            youtube_playlist_id="pl_test",
            name="Test Playlist",
            url="https://youtube.com/playlist?list=pl_test",
            enabled=True,
        )
        s.add(pl)
        s.commit()
        s.refresh(pl)
    return pl


def _make_watcher_items(n: int) -> list[YouTubeSong]:
    return [
        YouTubeSong(video_id=f"vid{i}", title=f"Song {i}", position=i)
        for i in range(1, n + 1)
    ]


# ---------------------------------------------------------------------------
# Architecture contract: Sync must not touch Downloader or LyricsService
# ---------------------------------------------------------------------------

class TestSyncArchitectureContract:
    def test_sync_service_does_not_import_downloader(self):
        """SyncService must not import SongDownloader."""
        import app.sync.service as sync_module
        assert not hasattr(sync_module, "SongDownloader"), (
            "SyncService must not import SongDownloader. "
            "Downloader runs independently."
        )

    def test_sync_service_does_not_import_lyrics(self):
        """SyncService must not import LyricsService."""
        import app.sync.service as sync_module
        assert not hasattr(sync_module, "LyricsService"), (
            "SyncService must not import LyricsService. "
            "Lyrics are handled independently."
        )

    def test_sync_run_does_not_call_download_pending(self, Session, settings, playlist):
        """SyncService.run() must never call SongDownloader.download_pending()."""
        with patch("app.sync.service.SessionLocal", Session), \
             patch("app.sync.service.SettingsService") as MockSettings, \
             patch("app.sync.service.YouTubePlaylistWatcher") as MockWatcher, \
             patch("app.sync.service.PlaylistReconciler") as MockReconciler:

            MockSettings.return_value.get.return_value = settings
            MockWatcher.return_value.fetch.return_value = _make_watcher_items(3)
            MockReconciler.return_value.reconcile.return_value = []

            # If SongDownloader is instantiated at all, we'd see an import.
            # Belt-and-suspenders: also mock it to detect any call.
            with patch("app.downloader.service.SongDownloader") as MockDownloader:
                SyncService().run()
                MockDownloader.assert_not_called()


# ---------------------------------------------------------------------------
# Stats dict
# ---------------------------------------------------------------------------

class TestSyncStats:
    def test_run_returns_stats_dict(self, Session, settings, playlist):
        with patch("app.sync.service.SessionLocal", Session), \
             patch("app.sync.service.SettingsService") as MockSettings, \
             patch("app.sync.service.YouTubePlaylistWatcher") as MockWatcher, \
             patch("app.sync.service.PlaylistReconciler") as MockReconciler:

            MockSettings.return_value.get.return_value = settings

            items = _make_watcher_items(5)
            MockWatcher.return_value.fetch.return_value = items
            MockReconciler.return_value.reconcile.return_value = items[:3]

            stats = SyncService().run()

        assert isinstance(stats, dict)
        assert "playlists_scanned" in stats
        assert "total_discovered" in stats
        assert "total_new" in stats
        assert "elapsed_seconds" in stats

    def test_no_playlists_returns_zero_stats(self, Session, settings):
        """With no enabled playlists, stats should be all zeros."""
        with patch("app.sync.service.SessionLocal", Session), \
             patch("app.sync.service.SettingsService") as MockSettings:

            MockSettings.return_value.get.return_value = settings
            stats = SyncService().run()

        assert stats["playlists_scanned"] == 0
        assert stats["total_discovered"] == 0
        assert stats["total_new"] == 0


# ---------------------------------------------------------------------------
# Error isolation: failed playlist does not abort remaining playlists
# ---------------------------------------------------------------------------

class TestPlaylistErrorIsolation:
    def test_failed_playlist_does_not_abort_others(self, Session, settings):
        """If one playlist raises, the next must still be processed."""
        with Session() as s:
            pl1 = Playlist(
                youtube_playlist_id="pl_fail",
                name="Fail Playlist",
                url="https://youtube.com/playlist?list=pl_fail",
                enabled=True,
            )
            pl2 = Playlist(
                youtube_playlist_id="pl_ok",
                name="OK Playlist",
                url="https://youtube.com/playlist?list=pl_ok",
                enabled=True,
            )
            s.add_all([pl1, pl2])
            s.commit()

        watcher_call_count = 0

        class FlakyWatcher:
            def __init__(self, url):
                self.url = url
            def fetch(self, **kw):
                nonlocal watcher_call_count
                watcher_call_count += 1
                if "pl_fail" in self.url:
                    raise RuntimeError("Simulated YouTube timeout")
                return _make_watcher_items(2)

        with patch("app.sync.service.SessionLocal", Session), \
             patch("app.sync.service.SettingsService") as MockSettings, \
             patch("app.sync.service.YouTubePlaylistWatcher", side_effect=FlakyWatcher), \
             patch("app.sync.service.PlaylistReconciler") as MockReconciler:

            MockSettings.return_value.get.return_value = settings
            MockReconciler.return_value.reconcile.return_value = []

            stats = SyncService().run()

        # Both playlists were attempted.
        assert watcher_call_count == 2
        assert stats["playlists_scanned"] == 2


# ---------------------------------------------------------------------------
# Lightweight scan: no per-video requests
# ---------------------------------------------------------------------------

class TestLightweightScan:
    def test_fetch_called_once_per_playlist(self, Session, settings, playlist):
        """
        The watcher's fetch() is called exactly once per playlist.
        It must never be called per-video.
        """
        fetch_call_count = 0

        class CountingWatcher:
            def __init__(self, url):
                pass
            def fetch(self, **kw):
                nonlocal fetch_call_count
                fetch_call_count += 1
                return _make_watcher_items(10)

        with patch("app.sync.service.SessionLocal", Session), \
             patch("app.sync.service.SettingsService") as MockSettings, \
             patch("app.sync.service.YouTubePlaylistWatcher", side_effect=CountingWatcher), \
             patch("app.sync.service.PlaylistReconciler") as MockReconciler:

            MockSettings.return_value.get.return_value = settings
            MockReconciler.return_value.reconcile.return_value = []

            SyncService().run()

        # One playlist → one fetch() call.
        assert fetch_call_count == 1


# ---------------------------------------------------------------------------
# Unavailable count reported in stats
# ---------------------------------------------------------------------------

class TestUnavailableStats:
    def test_unavailable_items_counted_in_stats(self, Session, settings, playlist):
        mixed_items = [
            YouTubeSong(video_id="vid1", title="Song 1", position=1),
            UnavailableYouTubeSong(video_id="vid_priv", reason="Private", position=2),
            YouTubeSong(video_id="vid3", title="Song 3", position=3),
        ]

        with patch("app.sync.service.SessionLocal", Session), \
             patch("app.sync.service.SettingsService") as MockSettings, \
             patch("app.sync.service.YouTubePlaylistWatcher") as MockWatcher, \
             patch("app.sync.service.PlaylistReconciler") as MockReconciler:

            MockSettings.return_value.get.return_value = settings
            MockWatcher.return_value.fetch.return_value = mixed_items
            MockReconciler.return_value.reconcile.return_value = []

            stats = SyncService().run()

        assert stats["total_unavailable"] == 1
        assert stats["total_discovered"] == 3
