from datetime import datetime
from threading import Lock

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError

from app.core.config import settings
from app.sync.service import SyncService


class MusicSyncScheduler:
    def __init__(self):
        self.scheduler: BackgroundScheduler | None = None

        self.lock = Lock()

        self.sync_running = False

        self.last_sync_started_at: datetime | None = None
        self.last_sync_completed_at: datetime | None = None
        self.last_sync_status: str | None = None
        self.last_sync_error: str | None = None

        self.history: list[dict] = []

    def _create_scheduler(self):
        """
        Create a fresh APScheduler instance.

        A BackgroundScheduler cannot be reused after shutdown(),
        so a new instance must be created when starting again.
        """
        self.scheduler = BackgroundScheduler()

    def run_sync(self):
        with self.lock:
            if self.sync_running:
                print("Sync already running. Skipping this cycle.")
                return

            self.sync_running = True
            self.last_sync_started_at = datetime.now()
            self.last_sync_status = "running"
            self.last_sync_error = None

            started_at = self.last_sync_started_at

        print("=" * 60)
        print("Starting scheduled sync")
        print("=" * 60)

        status = "success"
        error = None

        try:
            sync_service = SyncService()
            sync_service.run()

            with self.lock:
                self.last_sync_status = "success"

        except Exception as exc:
            status = "failed"
            error = str(exc)

            with self.lock:
                self.last_sync_status = "failed"
                self.last_sync_error = error

            print(f"Sync cycle failed: {exc}")

        finally:
            completed_at = datetime.now()

            with self.lock:
                self.sync_running = False
                self.last_sync_completed_at = completed_at

                self.history.append(
                    {
                        "started_at": started_at,
                        "completed_at": completed_at,
                        "status": status,
                        "error": error,
                    }
                )

                self.history = self.history[-100:]

            print("=" * 60)
            print("Scheduled sync completed")
            print("=" * 60)

    def start(self, run_immediately: bool = True) -> bool:
        """
        Start the scheduler.

        Returns:
            True  -> scheduler was started
            False -> scheduler was already running
        """

        with self.lock:
            if self.scheduler is not None and self.scheduler.running:
                print("Scheduler is already running.")
                return False

            # IMPORTANT:
            # Always create a fresh scheduler after shutdown.
            self._create_scheduler()

            interval = settings.sync_interval_seconds

            self.scheduler.add_job(
                self.run_sync,
                "interval",
                seconds=interval,
                id="music-sync",
                replace_existing=True,
                max_instances=1,
                coalesce=True,
            )

            self.scheduler.start()

        print("=" * 60)
        print("Music Sync Scheduler")
        print("=" * 60)
        print(f"Interval: {interval} seconds")
        print(f"Interval: {interval / 60:.1f} minutes")
        print("=" * 60)
        print("Scheduler started.")

        if run_immediately:
            self.run_sync()

        return True

    def stop(self) -> bool:
        """
        Stop the scheduler.

        The scheduler instance is discarded after shutdown.
        A new instance will be created on the next start().
        """

        with self.lock:
            if self.scheduler is None or not self.scheduler.running:
                print("Scheduler is already stopped.")
                return False

            try:
                self.scheduler.remove_job("music-sync")
            except JobLookupError:
                pass

            self.scheduler.shutdown(wait=False)

            # Do not reuse this instance.
            self.scheduler = None

        print("Scheduler stopped.")

        return True

    def update_interval(self, seconds: int) -> int:
        """
        Update the scheduler interval.

        If the scheduler is running, recreate its job using
        the new interval.
        """

        if seconds < 10:
            raise ValueError(
                "Interval must be at least 10 seconds."
            )

        with self.lock:
            settings.sync_interval_seconds = seconds

            scheduler_running = (
                self.scheduler is not None
                and self.scheduler.running
            )

            if scheduler_running:
                try:
                    self.scheduler.remove_job("music-sync")
                except JobLookupError:
                    pass

                self.scheduler.add_job(
                    self.run_sync,
                    "interval",
                    seconds=seconds,
                    id="music-sync",
                    replace_existing=True,
                    max_instances=1,
                    coalesce=True,
                )

        print(
            f"Scheduler interval updated to {seconds} seconds."
        )

        return seconds

    def get_history(self) -> list[dict]:
        """
        Return synchronization history.
        """

        with self.lock:
            return list(reversed(self.history))

    def get_status(self):
        with self.lock:
            interval = settings.sync_interval_seconds

            scheduler_running = (
                self.scheduler is not None
                and self.scheduler.running
            )

            return {
                "scheduler_running": scheduler_running,
                "sync_running": self.sync_running,
                "interval_seconds": interval,
                "interval_minutes": interval / 60,
                "last_sync_started_at": (
                    self.last_sync_started_at
                ),
                "last_sync_completed_at": (
                    self.last_sync_completed_at
                ),
                "last_sync_status": (
                    self.last_sync_status
                ),
                "last_sync_error": (
                    self.last_sync_error
                ),
            }