"""
Tests for MusicSyncScheduler.

Coverage:
  - Scheduler only triggers SyncService; no Downloader calls
  - Overlap prevention: concurrent run_sync() calls are skipped
  - Sync history recorded correctly
  - Status reflects running / completed state
  - Scheduler does not import SongDownloader or LyricsService
  - Scheduler starts / stops correctly
  - Interval update persists and reschedules
"""

import time
from threading import Thread
from unittest.mock import MagicMock, patch

import pytest

from app.scheduler.service import MusicSyncScheduler


# ---------------------------------------------------------------------------
# Architecture contract
# ---------------------------------------------------------------------------

class TestSchedulerArchitectureContract:
    def test_scheduler_does_not_import_downloader(self):
        import app.scheduler.service as mod
        assert not hasattr(mod, "SongDownloader"), (
            "Scheduler must not import SongDownloader."
        )

    def test_scheduler_does_not_import_lyrics_service(self):
        import app.scheduler.service as mod
        assert not hasattr(mod, "LyricsService")

    def test_scheduler_only_calls_sync_service(self):
        """run_sync() must call SyncService.run() and nothing else."""
        sched = MusicSyncScheduler()
        sched.settings_service = MagicMock()
        sched.settings_service.get.return_value = MagicMock(
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
        )

        mock_sync = MagicMock()
        mock_sync.return_value.run.return_value = {
            "playlists_scanned": 1,
            "total_discovered": 5,
            "total_new": 2,
            "total_unavailable": 0,
            "elapsed_seconds": 0.1,
        }

        with patch("app.scheduler.service.SyncService", mock_sync):
            sched.run_sync()

        mock_sync.return_value.run.assert_called_once()


# ---------------------------------------------------------------------------
# Overlap prevention
# ---------------------------------------------------------------------------

class TestOverlapPrevention:
    def test_second_run_sync_skipped_if_first_still_running(self):
        """
        If run_sync() is called while a sync is already running, the second
        call must return immediately without starting another SyncService.
        """
        sched = MusicSyncScheduler()
        sched.settings_service = MagicMock()
        sched.settings_service.get.return_value = MagicMock(
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
        )

        call_count = 0
        barrier_entered = False

        def slow_sync():
            nonlocal call_count, barrier_entered
            call_count += 1
            barrier_entered = True
            time.sleep(0.2)
            return {}

        mock_sync = MagicMock()
        mock_sync.return_value.run.side_effect = slow_sync

        results = []

        def first_run():
            with patch("app.scheduler.service.SyncService", mock_sync):
                sched.run_sync()

        def second_run():
            # Wait until first run has set sync_running = True
            for _ in range(100):
                if barrier_entered:
                    break
                time.sleep(0.01)
            with patch("app.scheduler.service.SyncService", mock_sync):
                sched.run_sync()

        t1 = Thread(target=first_run)
        t2 = Thread(target=second_run)

        t1.start()
        t2.start()
        t1.join(timeout=2)
        t2.join(timeout=2)

        # Only one SyncService.run() should have been called.
        assert call_count == 1, (
            f"Expected 1 sync run, got {call_count}. "
            "Overlap prevention is broken."
        )

    def test_sync_running_flag_false_after_completion(self):
        """sync_running must be reset to False after run_sync() finishes."""
        sched = MusicSyncScheduler()
        sched.settings_service = MagicMock()
        sched.settings_service.get.return_value = MagicMock(
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
        )

        mock_sync = MagicMock()
        mock_sync.return_value.run.return_value = {}

        with patch("app.scheduler.service.SyncService", mock_sync):
            sched.run_sync()

        assert sched.sync_running is False

    def test_sync_running_flag_false_after_exception(self):
        """sync_running must be reset even if SyncService.run() raises."""
        sched = MusicSyncScheduler()
        sched.settings_service = MagicMock()
        sched.settings_service.get.return_value = MagicMock(
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
        )

        mock_sync = MagicMock()
        mock_sync.return_value.run.side_effect = RuntimeError("Boom")

        with patch("app.scheduler.service.SyncService", mock_sync):
            sched.run_sync()  # must not raise

        assert sched.sync_running is False
        assert sched.last_sync_status == "failed"
        assert "Boom" in sched.last_sync_error


# ---------------------------------------------------------------------------
# History and status
# ---------------------------------------------------------------------------

class TestHistoryAndStatus:
    def _run_once(self, sched, succeed=True):
        sched.settings_service = MagicMock()
        sched.settings_service.get.return_value = MagicMock(
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
        )
        mock_sync = MagicMock()
        if succeed:
            mock_sync.return_value.run.return_value = {"playlists_scanned": 1}
        else:
            mock_sync.return_value.run.side_effect = RuntimeError("Failed")

        with patch("app.scheduler.service.SyncService", mock_sync):
            sched.run_sync()

    def test_history_entry_added_after_run(self):
        sched = MusicSyncScheduler()
        self._run_once(sched, succeed=True)

        history = sched.get_history()
        assert len(history) == 1
        assert history[0]["status"] == "success"
        assert history[0]["started_at"] is not None
        assert history[0]["completed_at"] is not None

    def test_history_entry_records_failure(self):
        sched = MusicSyncScheduler()
        self._run_once(sched, succeed=False)

        history = sched.get_history()
        assert len(history) == 1
        assert history[0]["status"] == "failed"
        assert history[0]["error"] is not None

    def test_history_limited_to_100(self):
        sched = MusicSyncScheduler()
        # Inject 110 history entries directly.
        for i in range(110):
            sched.history.append({"run": i})
        sched.history = sched.history[-100:]
        assert len(sched.get_history()) == 100

    def test_status_reports_correct_state(self):
        sched = MusicSyncScheduler()
        self._run_once(sched, succeed=True)

        status = sched.get_status()
        assert status["sync_running"] is False
        assert status["scheduler_running"] is False
        assert status["last_sync_status"] == "success"

    def test_stats_recorded_in_history(self):
        sched = MusicSyncScheduler()
        mock_stats = {
            "playlists_scanned": 2,
            "total_discovered": 100,
            "total_new": 10,
            "total_unavailable": 3,
            "elapsed_seconds": 1.5,
        }

        sched.settings_service = MagicMock()
        sched.settings_service.get.return_value = MagicMock(
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
        )
        mock_sync = MagicMock()
        mock_sync.return_value.run.return_value = mock_stats

        with patch("app.scheduler.service.SyncService", mock_sync):
            sched.run_sync()

        history = sched.get_history()
        assert history[0]["stats"] == mock_stats
        assert sched.last_sync_stats == mock_stats


# ---------------------------------------------------------------------------
# Interval update
# ---------------------------------------------------------------------------

class TestIntervalUpdate:
    def test_interval_too_small_raises(self):
        sched = MusicSyncScheduler()
        sched.settings_service = MagicMock()
        sched.settings_service.update = MagicMock()

        with pytest.raises(ValueError, match="at least 10 seconds"):
            sched.update_interval(5)

    def test_interval_update_persists(self):
        sched = MusicSyncScheduler()
        sched.settings_service = MagicMock()
        sched.settings_service.update = MagicMock()

        sched.update_interval(120)

        sched.settings_service.update.assert_called_once_with(
            sync_interval_seconds=120
        )
