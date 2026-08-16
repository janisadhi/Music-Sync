"""
Architecture tests for non-blocking event-triggered scheduler workflow.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.scheduler.service import MusicSyncScheduler
from app.downloader.worker import DownloaderWorker
from app.lyrics.worker import LyricsWorker


def test_scheduler_trigger_sync_nonblocking():
    scheduler = MusicSyncScheduler()
    with patch.object(scheduler, "run_sync") as mock_run_sync:
        res = scheduler.trigger_sync()
        assert res["status"] == "started"
        assert res["message"] == "Synchronization started."


def test_scheduler_overlap_prevention_on_trigger():
    scheduler = MusicSyncScheduler()
    scheduler.sync_running = True

    res = scheduler.trigger_sync()
    assert res["status"] == "already_running"


def test_downloader_worker_wake_event():
    worker = DownloaderWorker()
    assert not worker._wake_event.is_set()
    worker.wake()
    assert worker._wake_event.is_set()


def test_lyrics_worker_wake_event():
    worker = LyricsWorker()
    assert not worker._wake_event.is_set()
    worker.wake()
    assert worker._wake_event.is_set()


from app.database.models import AppSettings, Base, Playlist, Song
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture()
def db_engine():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    return engine

@pytest.fixture()
def Session(db_engine):
    return sessionmaker(bind=db_engine, expire_on_commit=False)

def test_sync_service_wakes_downloader_worker(Session):
    from app.sync.service import SyncService

    with Session() as s:
        p = Playlist(id=1, name="Test", url="https://youtube.com/playlist?list=123", youtube_playlist_id="123", enabled=True)
        s.add(p)
        s.commit()

    sync_service = SyncService()
    mock_settings = AppSettings(
        playlist_watch_mode="whole",
        playlist_watch_limit=None,
        delete_local_file_on_playlist_removal=False,
        auto_scan_metadata_enabled=True,
    )

    with patch.object(sync_service.settings_service, "get", return_value=mock_settings), \
         patch("app.sync.service.SessionLocal", Session), \
         patch("app.sync.service.YouTubePlaylistWatcher") as mock_watcher, \
         patch("app.core.runtime.downloader_worker.wake") as mock_wake, \
         patch("app.core.events.trigger_metadata_scan_async") as mock_meta_trigger:

        mock_watcher.return_value.fetch.return_value = []

        stats = sync_service.run()
        assert stats["playlists_scanned"] == 1
        mock_wake.assert_called_once()
        mock_meta_trigger.assert_called_once()
