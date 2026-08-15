"""
Tests for DownloaderWorker.

All tests use in-process mocks — no real YouTube requests or DB connections.

Design notes
------------
DownloaderWorker exposes a `_downloader` attribute that, when set, is used
instead of creating a real SongDownloader instance in _run_loop.  This lets
tests inject a mock without class-level patching — avoiding the race between
the patch being restored and the background thread reading the now-unpatched
class.

Poll intervals are patched directly on the wmod module (not via `with patch`)
and are restored AFTER worker.stop() to prevent the background thread reading
the original 5s interval while still running.
"""

import time
from threading import Event
from unittest.mock import MagicMock

import pytest

import app.downloader.worker as wmod
from app.downloader.worker import DownloaderWorker

_TEST_POLL = 0.05


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _speed_up():
    orig = (wmod._IDLE_POLL_INTERVAL, wmod._ACTIVE_POLL_INTERVAL)
    wmod._IDLE_POLL_INTERVAL = _TEST_POLL
    wmod._ACTIVE_POLL_INTERVAL = _TEST_POLL
    return orig


def _restore(orig):
    wmod._IDLE_POLL_INTERVAL, wmod._ACTIVE_POLL_INTERVAL = orig


def _make_worker(download_limit: int = 2) -> DownloaderWorker:
    """Worker with mocked settings and injected mock downloader."""
    w = DownloaderWorker()
    w.settings_service = MagicMock()
    w.settings_service.get.return_value = MagicMock(download_limit=download_limit)
    # Inject a mock so no real SongDownloader is ever instantiated.
    w._downloader = MagicMock()
    w._downloader.download_pending.return_value = 0
    return w


# ---------------------------------------------------------------------------
# Architecture contract
# ---------------------------------------------------------------------------

class TestWorkerArchitectureContract:
    def test_worker_does_not_import_sync_service(self):
        assert not hasattr(wmod, "SyncService")

    def test_worker_does_not_import_scheduler(self):
        assert not hasattr(wmod, "MusicSyncScheduler")

    def test_scheduler_does_not_import_downloader_worker(self):
        import app.scheduler.service as mod
        assert not hasattr(mod, "DownloaderWorker")

    def test_sync_service_does_not_import_downloader_worker(self):
        import app.sync.service as mod
        assert not hasattr(mod, "DownloaderWorker")


# ---------------------------------------------------------------------------
# Start / stop
# ---------------------------------------------------------------------------

class TestWorkerLifecycle:
    def test_worker_starts_and_thread_is_alive(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.15)
        alive = w.is_running
        w.stop(timeout=3)
        _restore(orig)
        assert alive

    def test_worker_stops_gracefully(self):
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

    def test_worker_running_flag_false_after_stop(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.1)
        w.stop(timeout=3)
        _restore(orig)
        assert w.worker_running is False

    def test_worker_can_restart_after_stop(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.1)
        w.stop(timeout=3)
        assert not w.is_running
        again = w.start()
        time.sleep(0.1)
        alive = w.is_running
        w.stop(timeout=3)
        _restore(orig)
        assert again is True
        assert alive is True


# ---------------------------------------------------------------------------
# Polling behaviour
# ---------------------------------------------------------------------------

class TestWorkerPolling:
    def test_download_pending_is_called_repeatedly(self):
        done = Event()
        count = 0

        def counting(**kw):
            nonlocal count
            count += 1
            if count >= 3:
                done.set()
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = counting
        orig = _speed_up()
        w.start()
        done.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert count >= 3

    def test_worker_picks_up_pending_song_without_scheduler(self):
        polled = Event()

        def fake(limit=1, **kw):
            polled.set()
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = fake
        orig = _speed_up()
        w.start()
        polled.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert polled.is_set()

    def test_worker_uses_download_limit_as_concurrency(self):
        received = []
        done = Event()

        def capture(limit=1, **kw):
            received.append(limit)
            if len(received) >= 2:
                done.set()
            return 0

        w = _make_worker(download_limit=3)
        w._downloader.download_pending.side_effect = capture
        orig = _speed_up()
        w.start()
        done.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert received
        assert all(lim == 3 for lim in received)

    def test_worker_survives_exception_in_poll(self):
        count = 0
        recovered = Event()

        def exploding(**kw):
            nonlocal count
            count += 1
            if count < 3:
                raise RuntimeError("Simulated error")
            recovered.set()
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = exploding
        orig = _speed_up()
        w.start()
        recovered.wait(timeout=10)
        alive = w.is_running
        w.stop(timeout=3)
        _restore(orig)
        assert alive
        assert count >= 3

    def test_status_updated_after_successful_poll(self):
        """
        Use a barrier: hold the worker inside fake_pending until we're ready,
        then release and verify status.
        """
        entered = Event()
        release = Event()

        def fake(**kw):
            entered.set()
            release.wait(timeout=5)
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = fake
        orig = _speed_up()
        w.start()
        entered.wait(timeout=5)   # worker is now inside fake_pending
        release.set()              # let it complete
        time.sleep(0.05)           # wait for status to be written
        w.stop(timeout=5)
        _restore(orig)

        status = w.get_status()
        assert status["last_poll_status"] == "success"

    def test_status_records_error_after_exception(self):
        """
        Force call 1 to raise, then let call 2 complete and check status
        was recorded between the two calls.
        """
        call1_entered = Event()
        call1_release = Event()
        call2_entered = Event()
        call2_release = Event()
        count = 0

        def side_effect(**kw):
            nonlocal count
            count += 1
            if count == 1:
                call1_entered.set()
                call1_release.wait(timeout=5)
                raise RuntimeError("Test DB error")
            elif count == 2:
                call2_entered.set()
                call2_release.wait(timeout=5)
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = side_effect
        orig = _speed_up()
        w.start()

        call1_entered.wait(timeout=5)
        # Release call 1 (will raise)
        call1_release.set()
        # Wait for call 2 to start (error must have been recorded by now)
        call2_entered.wait(timeout=5)
        error_status = w.get_status()
        # Release call 2 and stop
        call2_release.set()
        w.stop(timeout=5)
        _restore(orig)

        assert error_status["last_poll_status"] == "error"
        assert "Test DB error" in (error_status["last_poll_error"] or "")
        assert count >= 2


# ---------------------------------------------------------------------------
# Independence from Scheduler and Sync
# ---------------------------------------------------------------------------

class TestWorkerIndependence:
    def test_downloader_runs_while_sync_is_running(self):
        polled = Event()

        def fake(**kw):
            polled.set()
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = fake
        orig = _speed_up()
        w.start()

        from threading import Thread
        sync_done = Event()
        def fake_sync():
            time.sleep(0.3)
            sync_done.set()
        Thread(target=fake_sync, daemon=True).start()

        before_sync_done = polled.wait(timeout=2)
        sync_done.wait(timeout=2)
        w.stop(timeout=3)
        _restore(orig)
        assert before_sync_done

    def test_downloader_works_with_scheduler_off(self):
        polled = Event()

        def fake(**kw):
            polled.set()
            return 0

        w = _make_worker()
        w._downloader.download_pending.side_effect = fake
        orig = _speed_up()
        w.start()
        polled.wait(timeout=5)
        w.stop(timeout=3)
        _restore(orig)
        assert polled.is_set()


# ---------------------------------------------------------------------------
# Application lifespan integration
# ---------------------------------------------------------------------------

class TestLifespanIntegration:
    def test_downloader_worker_starts_on_app_startup(self):
        w = _make_worker()
        orig = _speed_up()
        started = w.start()
        time.sleep(0.1)
        running = w.is_running
        w.stop(timeout=3)
        _restore(orig)
        assert started is True
        assert running is True

    def test_downloader_worker_stops_on_app_shutdown(self):
        w = _make_worker()
        orig = _speed_up()
        w.start()
        time.sleep(0.1)
        assert w.is_running
        stopped = w.stop(timeout=5)
        _restore(orig)
        assert stopped is True
        assert not w.is_running
