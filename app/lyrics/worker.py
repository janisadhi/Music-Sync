"""
Lyrics Worker.

An independent background worker that continuously polls the Sync DB for
downloaded songs that still need lyrics and calls LyricsService.process_pending().

Architecture contract
---------------------
  SYNC DISCOVERS.  DOWNLOADER DOWNLOADS.  LYRICS PROCESSES.

This worker:
  ✓ Runs in a dedicated daemon thread (independent of Scheduler and Downloader)
  ✓ Polls the Sync DB using LyricsService.process_pending()
  ✓ Sleeps between polls when there is no work (avoids busy-looping)
  ✓ Uses the existing lyrics_limit setting for concurrency
  ✓ Survives individual lyrics failures without dying
  ✓ Supports graceful startup / shutdown
  ✓ Prevents duplicate worker instances

This worker does NOT:
  ✗ Import or call SyncService
  ✗ Import or call MusicSyncScheduler
  ✗ Import or call SongDownloader
  ✗ Download audio files
  ✗ Scan playlists
  ✗ Require the Scheduler or Downloader to be running

The worker starts unconditionally at application startup so that lyrics
are processed for any already-downloaded songs as well as new ones.
"""

import time
from datetime import datetime, timezone
from threading import Event, Lock, Thread

from app.lyrics.service import LyricsService
from app.settings.service import SettingsService


# How long to sleep between polls when the lyrics queue is empty (seconds).
_IDLE_POLL_INTERVAL = 10

# How long to sleep between polls when work was done last iteration.
_ACTIVE_POLL_INTERVAL = 2


class LyricsWorker:
    """
    Long-running background worker that drains the pending lyrics queue.

    Usage::

        worker = LyricsWorker()
        worker.start()   # non-blocking; runs in background thread
        ...
        worker.stop()    # signals the thread to exit and waits for it
    """

    def __init__(self):
        self.settings_service = SettingsService()
        # Overridable in tests to inject a mock service.
        self._service: LyricsService | None = None

        self._lock = Lock()
        self._stop_event = Event()
        self._thread: Thread | None = None

        # Status bookkeeping
        self.worker_running: bool = False
        self.last_poll_started_at: datetime | None = None
        self.last_poll_completed_at: datetime | None = None
        self.last_poll_status: str | None = None
        self.last_poll_error: str | None = None
        self.last_poll_processed: int = 0
        self.total_processed: int = 0

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
                print("Lyrics worker is already running.")
                return False

            self._stop_event.clear()
            self._thread = Thread(
                target=self._run_loop,
                name="lyrics-worker",
                daemon=True,
            )
            self._thread.start()

        print("=" * 60)
        print("Music Sync Lyrics worker started")
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
                print("Lyrics worker is already stopped.")
                return True

            thread = self._thread

        self._stop_event.set()
        thread.join(timeout=timeout)

        stopped = not thread.is_alive()
        if stopped:
            print("Lyrics worker stopped.")
        else:
            print(
                f"Lyrics worker did not stop within {timeout}s "
                "(thread may still be in a long lyrics fetch)."
            )
        return stopped

    @property
    def is_running(self) -> bool:
        with self._lock:
            return self._thread is not None and self._thread.is_alive()

    def _make_service(self) -> LyricsService:
        """Create or return the LyricsService instance. Overridable in tests."""
        if self._service is not None:
            return self._service
        return LyricsService()

    # ------------------------------------------------------------------
    # Internal polling loop
    # ------------------------------------------------------------------

    def _run_loop(self) -> None:
        """
        Main loop: poll → process lyrics → sleep → repeat.
        """
        with self._lock:
            self.worker_running = True

        print("Lyrics worker: polling loop started")

        service = self._make_service()

        while not self._stop_event.is_set():
            started_at = datetime.now(timezone.utc)

            with self._lock:
                self.last_poll_started_at = started_at

            try:
                app_settings = self.settings_service.get()
                concurrency = max(1, app_settings.lyrics_limit)

                processed = service.process_pending(limit=concurrency)

                with self._lock:
                    self.last_poll_processed = processed
                    self.total_processed += processed
                    self.last_poll_status = "success"
                    self.last_poll_error = None
                    self.last_poll_completed_at = datetime.now(timezone.utc)

                sleep_interval = (
                    _ACTIVE_POLL_INTERVAL if processed > 0
                    else _IDLE_POLL_INTERVAL
                )

            except Exception as exc:
                error_msg = str(exc)

                with self._lock:
                    self.last_poll_status = "error"
                    self.last_poll_error = error_msg
                    self.last_poll_completed_at = datetime.now(timezone.utc)

                print(f"Lyrics worker: unhandled exception in poll loop: {exc}")
                sleep_interval = _IDLE_POLL_INTERVAL

            self._stop_event.wait(timeout=sleep_interval)

        with self._lock:
            self.worker_running = False

        print("Lyrics worker: polling loop exited")

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
                "last_poll_processed": self.last_poll_processed,
                "total_processed": self.total_processed,
            }
