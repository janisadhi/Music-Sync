"""
Tests for LyricsWorker.

All tests use in-process mocks — no real LRCLIB requests or DB connections.

Coverage:
  - Worker starts and stops cleanly
  - Worker polls process_pending() repeatedly
  - Worker uses lyrics_limit setting as concurrency
  - Worker survives exceptions without dying
  - Worker does not import SyncService, Scheduler, or SongDownloader
  - Worker is independent of Scheduler and Downloader
  - process_pending() is called even without Scheduler running
"""

import time
from threading import Event
from unittest.mock import MagicMock

import pytest

import app.lyrics.worker as wmod
from app.lyrics.worker import LyricsWorker

_TEST_POLL = 0.05


def _speed_up():
    orig = (wmod._IDLE_POLL_INTERVAL, wmod._ACTIVE_POLL_INTERVAL)
    wmod._IDLE_POLL_INTERVAL = _TEST_POLL
    wmod._ACTIVE_POLL_INTERVAL = _TEST_POLL
    return orig


def _restore(orig):
    wmod._IDLE_POLL_INTERVAL, wmod._ACTIVE_POLL_INTERVAL = orig


def _make_worker(lyrics_limit: int = 1) -> LyricsWorker:
    w = LyricsWorker()
    w.settings_service = MagicMock()
    w.settings_service.get.return_value = MagicMock(lyrics_limit=lyrics_limit)
    # Inject a mock service so no real LyricsService is instantiated.
    w._service = MagicMock()
    w._service.process_pending.return_value = 0
    return w


# ---------------------------------------------------------------------------
# Architecture contract
# ---------------------------------------------------------------------------

class TestLyricsWorkerArchitectureContract:
    def test_worker_does_not_import_sync_service(self):
        assert not hasattr(wmod, "SyncService")

    def test_worker_does_not_import_scheduler(self):
        assert not hasattr(wmod, "MusicSyncScheduler")

    def test_worker_does_not_import_song_downloader(self):
        assert not hasattr(wmod, "SongDownloader")

    def test_scheduler_does_not_import_lyrics_worker(self):
        import app.scheduler.service as mod
        assert not hasattr(mod, "LyricsWorker")

    def test_downloader_worker_does_not_import_lyrics_worker(self):
        import app.downloader.worker as mod
        assert not hasattr(mod, "LyricsWorker")

    def test_sync_service_does_not_import_lyrics_worker(self):
        import app.sync.service as mod
        assert not hasattr(mod, "LyricsWorker")


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

class TestLyricsWorkerLifecycle:
    def test_starts_and_thread_is_alive(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.15)
        alive = w.is_running
        w.stop(timeout=3)
        _restore(orig)
        assert alive

    def test_stops_gracefully(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.1)
        stopped = w.stop(timeout=3)
        _restore(orig)
        assert stopped is True
        assert not w.is_running

    def test_start_returns_false_if_already_running(self):
        w = _make_worker()
        orig = _speed_up()
        first = w.start()
        second = w.start()
        w.stop(timeout=3)
        _restore(orig)
        assert first is True
        assert second is False

    def test_stop_returns_true_if_already_stopped(self):
        w = _make_worker()
        assert w.stop(timeout=1) is True

    def test_running_flag_false_after_stop(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.1)
        w.stop(timeout=3)
        _restore(orig)
        assert w.worker_running is False


# ---------------------------------------------------------------------------
# Polling
# ---------------------------------------------------------------------------

class TestLyricsWorkerPolling:
    def test_process_pending_called_repeatedly(self):
        count = 0
        done = Event()

        def counting(**kw):
            nonlocal count
            count += 1
            if count >= 3:
                done.set()
            return 0

        w = _make_worker()
        w._service.process_pending.side_effect = counting
        orig = _speed_up()
        w.start()
        done.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert count >= 3

    def test_uses_lyrics_limit_as_concurrency(self):
        received = []
        done = Event()

        def capture(limit=1, **kw):
            received.append(limit)
            if len(received) >= 2:
                done.set()
            return 0

        w = _make_worker(lyrics_limit=4)
        w._service.process_pending.side_effect = capture
        orig = _speed_up()
        w.start()
        done.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert received
        assert all(lim == 4 for lim in received)

    def test_survives_exception_in_poll(self):
        count = 0
        recovered = Event()

        def exploding(**kw):
            nonlocal count
            count += 1
            if count < 3:
                raise RuntimeError("Simulated LRCLIB error")
            recovered.set()
            return 0

        w = _make_worker()
        w._service.process_pending.side_effect = exploding
        orig = _speed_up()
        w.start()
        recovered.wait(timeout=10)
        alive = w.is_running
        w.stop(timeout=3)
        _restore(orig)
        assert alive
        assert count >= 3

    def test_status_records_success(self):
        entered = Event()
        release = Event()

        def fake(**kw):
            entered.set()
            release.wait(timeout=5)
            return 3

        w = _make_worker()
        w._service.process_pending.side_effect = fake
        orig = _speed_up()
        w.start()
        entered.wait(timeout=5)
        release.set()
        time.sleep(0.05)
        w.stop(timeout=3)
        _restore(orig)

        status = w.get_status()
        assert status["last_poll_status"] == "success"


# ---------------------------------------------------------------------------
# Independence
# ---------------------------------------------------------------------------

class TestLyricsWorkerIndependence:
    def test_runs_without_scheduler(self):
        polled = Event()

        def fake(**kw):
            polled.set()
            return 0

        w = _make_worker()
        w._service.process_pending.side_effect = fake
        orig = _speed_up()
        w.start()
        polled.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert polled.is_set()

    def test_runs_concurrently_with_downloader(self):
        """Lyrics worker must poll while a simulated downloader is running."""
        polled = Event()

        def fake(**kw):
            polled.set()
            return 0

        w = _make_worker()
        w._service.process_pending.side_effect = fake
        orig = _speed_up()
        w.start()

        from threading import Thread
        dl_done = Event()
        def fake_downloader():
            time.sleep(0.3)
            dl_done.set()
        Thread(target=fake_downloader, daemon=True).start()

        polled_before = polled.wait(timeout=2)
        dl_done.wait(timeout=2)
        w.stop(timeout=3)
        _restore(orig)
        assert polled_before
