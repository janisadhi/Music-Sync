"""
Downloader Worker.

An independent background worker that continuously polls the Sync DB for
pending/retryable songs and calls SongDownloader.download_pending().

Architecture contract
---------------------
  SYNC DISCOVERS.  DOWNLOADER DOWNLOADS.  SCHEDULER TRIGGERS.

This worker:
  ✓ Runs in a dedicated daemon thread (independent of Scheduler)
  ✓ Polls the Sync DB using SongDownloader.download_pending()
  ✓ Sleeps between polls when there is no work (avoids busy-looping)
  ✓ Uses the existing download_limit setting for concurrency
  ✓ Recovers stale 'downloading' rows on startup
  ✓ Survives individual download exceptions without dying
  ✓ Supports graceful startup / shutdown
  ✓ Prevents duplicate worker instances

This worker does NOT:
  ✗ Import or call SyncService
  ✗ Import or call MusicSyncScheduler
  ✗ Know anything about playlist scanning
  ✗ Require the Scheduler to be running
"""

import time
from datetime import datetime, timezone
from threading import Event, Lock, Thread

from app.downloader.service import SongDownloader
from app.settings.service import SettingsService


# How long to sleep between polls when the queue is empty (seconds).
_IDLE_POLL_INTERVAL = 5

# How long to sleep between polls when work was done last iteration.
# Keeps the worker responsive without hammering the DB.
_ACTIVE_POLL_INTERVAL = 1


class DownloaderWorker:
    """
    Long-running background worker that drains the pending download queue.

    Usage::

        worker = DownloaderWorker()
        worker.start()   # non-blocking; runs in background thread
        ...
        worker.stop()    # signals the thread to exit and waits for it
    """

    def __init__(self):
        self.settings_service = SettingsService()
        # Overridable in tests to inject a mock downloader.
        self._downloader: SongDownloader | None = None

        self._lock = Lock()
        self._stop_event = Event()
        self._wake_event = Event()
        self._thread: Thread | None = None

        # Status bookkeeping (mirrors the Scheduler pattern)
        self.worker_running: bool = False
        self.last_poll_started_at: datetime | None = None
        self.last_poll_completed_at: datetime | None = None
        self.last_poll_status: str | None = None
        self.last_poll_error: str | None = None
        self.last_poll_downloaded: int = 0
        self.total_downloaded: int = 0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """
        Start the background polling thread.

        Returns False if the worker is already running, True otherwise.
        """
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                print("Downloader worker is already running.")
                return False

            self._stop_event.clear()
            self._thread = Thread(
                target=self._run_loop,
                name="downloader-worker",
                daemon=True,
            )
            self._thread.start()

        print("=" * 60)
        print("Music Sync Downloader worker started")
        print(f"Idle poll interval: {_IDLE_POLL_INTERVAL}s")
        print("=" * 60)
        return True

    def stop(self, timeout: float = 30.0) -> bool:
        """
        Signal the worker to stop and wait for it to exit.

        Returns True if the thread stopped within *timeout* seconds.
        """
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                print("Downloader worker is already stopped.")
                return True

            thread = self._thread

        self._stop_event.set()
        thread.join(timeout=timeout)

        stopped = not thread.is_alive()
        if stopped:
            print("Downloader worker stopped.")
        else:
            print(
                f"Downloader worker did not stop within {timeout}s "
                "(thread may still be in a long download)."
            )
        return stopped

    def wake(self) -> None:
        """Wake up the worker immediately if it is sleeping in idle poll."""
        self._wake_event.set()

    @property
    def is_running(self) -> bool:
        with self._lock:
            return self._thread is not None and self._thread.is_alive()

    def _make_downloader(self) -> SongDownloader:
        """Create or return the SongDownloader instance. Overridable in tests."""
        if self._downloader is not None:
            return self._downloader
        return SongDownloader()

    # ------------------------------------------------------------------
    # Internal polling loop
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        """
        Main loop: poll → download → sleep → repeat until stop is signalled.
        """
        with self._lock:
            self.worker_running = True

        print("Downloader worker: polling loop started")

        downloader = self._make_downloader()

        while not self._stop_event.is_set():
            self._wake_event.clear()
            started_at = datetime.now(timezone.utc)

            with self._lock:
                self.last_poll_started_at = started_at

            try:
                app_settings = self.settings_service.get()
                concurrency = max(1, app_settings.download_limit)

                downloaded = downloader.download_pending(limit=concurrency)

                with self._lock:
                    self.last_poll_downloaded = downloaded
                    self.total_downloaded += downloaded
                    self.last_poll_status = "success"
                    self.last_poll_error = None
                    self.last_poll_completed_at = datetime.now(timezone.utc)

                # Sleep shorter if work was found (more may have arrived).
                sleep_interval = (
                    _ACTIVE_POLL_INTERVAL if downloaded > 0
                    else _IDLE_POLL_INTERVAL
                )

            except Exception as exc:
                error_msg = str(exc)

                with self._lock:
                    self.last_poll_status = "error"
                    self.last_poll_error = error_msg
                    self.last_poll_completed_at = datetime.now(timezone.utc)

                print(f"Downloader worker: unhandled exception in poll loop: {exc}")
                # Back off on errors to avoid log-spam from a persistent issue.
                sleep_interval = _IDLE_POLL_INTERVAL

            # Interruptible sleep: wake immediately if stop or wake is requested.
            if not self._stop_event.is_set() and not self._wake_event.is_set():
                self._wake_event.wait(timeout=sleep_interval)
                self._wake_event.clear()

        with self._lock:
            self.worker_running = False

        print("Downloader worker: polling loop exited")

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        with self._lock:
            thread_alive = self._thread is not None and self._thread.is_alive()
            return {
                "worker_running": thread_alive,
                "last_poll_started_at": self.last_poll_started_at,
                "last_poll_completed_at": self.last_poll_completed_at,
                "last_poll_status": self.last_poll_status,
                "last_poll_error": self.last_poll_error,
                "last_poll_downloaded": self.last_poll_downloaded,
                "total_downloaded": self.total_downloaded,
            }
