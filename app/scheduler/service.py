"""
Music Sync Scheduler.

Responsibility: schedule and trigger SyncService at a configured interval.

Architecture contract
---------------------
  SCHEDULER TRIGGERS.  SYNC DISCOVERS.  DOWNLOADER DOWNLOADS.

This service:
  ✓ Runs SyncService on a configurable interval
  ✓ Prevents overlapping sync jobs (sync_running guard)
  ✓ Records sync history and exposes status

This service does NOT:
  ✗ Download music
  ✗ Fetch metadata
  ✗ Process lyrics
  ✗ Manage files
  ✗ Directly control SongDownloader

After Sync writes pending Song rows to the DB, the Downloader picks them up
independently.  The Scheduler does not need to know about that.
"""

from datetime import datetime, timezone
from threading import Lock

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler

from app.settings.service import SettingsService
from app.sync.service import SyncService


class MusicSyncScheduler:
    def __init__(self):
        self.scheduler: BackgroundScheduler | None = None
        self.lock = Lock()

        # Overlap-prevention flag.  Guarded by self.lock for writes;
        # reads outside the lock are intentionally racy (read-only checks).
        self.sync_running = False

        self.last_sync_started_at: datetime | None = None
        self.last_sync_completed_at: datetime | None = None
        self.last_sync_status: str | None = None
        self.last_sync_error: str | None = None
        self.last_sync_stats: dict | None = None

        self.history: list[dict] = []

        self.settings_service = SettingsService()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _create_scheduler(self) -> None:
        self.scheduler = BackgroundScheduler()

    def _get_interval(self) -> int:
        return self.settings_service.get().sync_interval_seconds

    # ------------------------------------------------------------------
    # Sync execution
    # ------------------------------------------------------------------

    def trigger_sync(self) -> dict:
        """
        Trigger a non-blocking sync cycle.

        Unified entry point for both scheduled APScheduler triggers and manual API triggers.
        Returns immediately with status dict {"status": "started" | "already_running"}.
        """
        with self.lock:
            if self.sync_running:
                print("Sync already running – skipping this trigger.")
                return {
                    "status": "already_running",
                    "message": "Synchronization is already running.",
                }

        from threading import Thread
        thread = Thread(target=self.run_sync, daemon=True, name="sync-executor")
        thread.start()

        return {
            "status": "started",
            "message": "Synchronization started.",
        }

    def run_sync(self) -> None:
        """
        Execute one sync cycle synchronously in the current thread.

        Skips silently if a sync is already running (overlap prevention).
        Called internally by trigger_sync (via Thread) or explicitly in synchronous contexts/tests.
        """
        with self.lock:
            if self.sync_running:
                print(
                    "Sync already running – skipping this trigger."
                )
                return

            self.sync_running = True
            self.last_sync_started_at = datetime.now(timezone.utc)
            self.last_sync_status = "running"
            self.last_sync_error = None
            started_at = self.last_sync_started_at

        print("=" * 60)
        print("Scheduler: starting sync cycle")
        print("=" * 60)

        status = "success"
        error: str | None = None
        stats: dict = {}

        try:
            sync_service = SyncService()
            stats = sync_service.run()

            with self.lock:
                self.last_sync_status = "success"
                self.last_sync_stats = stats

        except Exception as exc:
            status = "failed"
            error = str(exc)

            with self.lock:
                self.last_sync_status = "failed"
                self.last_sync_error = error

            print(f"Sync cycle failed: {exc}")

        finally:
            completed_at = datetime.now(timezone.utc)

            with self.lock:
                self.sync_running = False
                self.last_sync_completed_at = completed_at

                self.history.append(
                    {
                        "started_at": started_at,
                        "completed_at": completed_at,
                        "status": status,
                        "error": error,
                        "stats": stats,
                    }
                )
                # Keep last 100 history entries.
                self.history = self.history[-100:]

        print("=" * 60)
        print("Scheduler: sync cycle completed")
        print("=" * 60)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self, run_immediately: bool = False) -> bool:
        with self.lock:
            if self.scheduler is not None and self.scheduler.running:
                print("Scheduler is already running.")
                return False

            self._create_scheduler()
            interval = self._get_interval()

            # max_instances=1 + coalesce=True: APScheduler-level guard
            # (in addition to our sync_running flag).
            self.scheduler.add_job(
                self.trigger_sync,
                "interval",
                seconds=interval,
                id="music-sync",
                replace_existing=True,
                max_instances=1,
                coalesce=True,
            )

            self.scheduler.start()

        print("=" * 60)
        print("Music Sync Scheduler started")
        print(f"Interval: {interval}s ({interval / 60:.1f} min)")
        print("=" * 60)

        if run_immediately:
            self.run_sync()

        return True

    def stop(self) -> bool:
        with self.lock:
            if self.scheduler is None or not self.scheduler.running:
                print("Scheduler is already stopped.")
                return False

            try:
                self.scheduler.remove_job("music-sync")
            except JobLookupError:
                pass

            self.scheduler.shutdown(wait=False)
            self.scheduler = None

        print("Scheduler stopped.")
        return True

    def update_interval(self, seconds: int) -> int:
        if seconds < 10:
            raise ValueError(
                "Interval must be at least 10 seconds."
            )

        # Persist to DB.
        self.settings_service.update(sync_interval_seconds=seconds)

        with self.lock:
            if self.scheduler is not None and self.scheduler.running:
                try:
                    self.scheduler.remove_job("music-sync")
                except JobLookupError:
                    pass

                self.scheduler.add_job(
                    self.trigger_sync,
                    "interval",
                    seconds=seconds,
                    id="music-sync",
                    replace_existing=True,
                    max_instances=1,
                    coalesce=True,
                )

        print(f"Scheduler interval updated to {seconds}s.")
        return seconds

    # ------------------------------------------------------------------
    # Status / history
    # ------------------------------------------------------------------

    def get_history(self) -> list[dict]:
        with self.lock:
            return list(reversed(self.history))

    def get_status(self) -> dict:
        with self.lock:
            app_settings = self.settings_service.get()
            scheduler_running = (
                self.scheduler is not None and self.scheduler.running
            )
            return {
                "scheduler_running": scheduler_running,
                "sync_running": self.sync_running,
                "interval_seconds": app_settings.sync_interval_seconds,
                "interval_minutes": app_settings.sync_interval_seconds / 60,
                "download_limit": app_settings.download_limit,
                "lyrics_limit": app_settings.lyrics_limit,
                "last_sync_started_at": self.last_sync_started_at,
                "last_sync_completed_at": self.last_sync_completed_at,
                "last_sync_status": self.last_sync_status,
                "last_sync_error": self.last_sync_error,
                "last_sync_stats": self.last_sync_stats,
            }
