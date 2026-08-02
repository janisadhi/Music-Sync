from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import select

from app.database.models import Song
from app.database.session import SessionLocal
from app.downloader.service import SongDownloader
from app.scheduler.service import MusicSyncScheduler


def fake_download_song(self, song: Song) -> bool:
    """
    Controlled downloader failure.

    The scheduler will execute the real SyncService and
    real download_pending() path, but this prevents yt-dlp
    from making a real YouTube request.
    """

    song.download_status = "failed"
    song.download_retry_count += 1
    song.error_message = (
        "SCHEDULER INTEGRATION TEST FAILURE"
    )

    app_settings = self.settings_service.get()
    max_retries = app_settings.max_download_retries

    if song.download_retry_count < max_retries:
        song.next_download_attempt = (
            datetime.now(timezone.utc)
            + timedelta(minutes=10)
        )
    else:
        song.next_download_attempt = None

    return False


def main():
    with SessionLocal() as session:

        song = session.scalar(
            select(Song)
            .order_by(Song.id)
        )

        if song is None:
            print("No songs found.")
            return

        print(
            f"Using song {song.id}: "
            f"{song.title}"
        )

        # -----------------------------------------------------
        # Prepare song for retry
        # -----------------------------------------------------

        song.download_status = "failed"
        song.download_retry_count = 1

        # Make retry immediately eligible.
        song.next_download_attempt = (
            datetime.now(timezone.utc)
            - timedelta(seconds=1)
        )

        song.error_message = "Integration test failure"

        session.commit()

        print()
        print("=" * 60)
        print("INITIAL STATE")
        print("=" * 60)
        print(f"Status:       {song.download_status}")
        print(f"Retry count:  {song.download_retry_count}")
        print(f"Next attempt: {song.next_download_attempt}")

    # ---------------------------------------------------------
    # Replace only the downloader's real network operation.
    # ---------------------------------------------------------

    with patch.object(
        SongDownloader,
        "download_song",
        fake_download_song,
    ):

        scheduler = MusicSyncScheduler()

        print()
        print("=" * 60)
        print("RUNNING REAL SCHEDULER SYNC")
        print("=" * 60)

        scheduler.run_sync()

        print()
        print("=" * 60)
        print("SCHEDULER STATUS")
        print("=" * 60)

        status = scheduler.get_status()

        print(
            f"Sync running: "
            f"{status['sync_running']}"
        )

        print(
            f"Last status: "
            f"{status['last_sync_status']}"
        )

        print(
            f"Last error: "
            f"{status['last_sync_error']}"
        )

    # ---------------------------------------------------------
    # Verify database state
    # ---------------------------------------------------------

    with SessionLocal() as session:

        song = session.get(
            Song,
            song.id,
        )

        print()
        print("=" * 60)
        print("FINAL SONG STATE")
        print("=" * 60)
        print(f"Status:       {song.download_status}")
        print(f"Retry count:  {song.download_retry_count}")
        print(f"Next attempt: {song.next_download_attempt}")
        print(f"Error:        {song.error_message}")

        assert song.download_status == "failed"

        assert song.download_retry_count == 2

        assert song.next_download_attempt is not None

        assert (
            song.error_message
            == "SCHEDULER INTEGRATION TEST FAILURE"
        )

        print()
        print("PASS: Scheduler triggered retry processing.")

        # -----------------------------------------------------
        # Verify scheduler bookkeeping
        # -----------------------------------------------------

        assert scheduler.last_sync_status == "success"

        assert scheduler.sync_running is False

        assert scheduler.last_sync_started_at is not None

        assert scheduler.last_sync_completed_at is not None

        assert len(scheduler.history) == 1

        print(
            "PASS: Scheduler bookkeeping is correct."
        )

        # -----------------------------------------------------
        # Cleanup
        # -----------------------------------------------------

        song.download_status = "pending"
        song.download_retry_count = 0
        song.next_download_attempt = None
        song.error_message = None
        song.file_path = None

        session.commit()

        print()
        print("=" * 60)
        print("DATABASE CLEANED UP")
        print("=" * 60)

        print()
        print("=" * 60)
        print("SCHEDULER RETRY INTEGRATION TEST PASSED")
        print("NO YOUTUBE DOWNLOAD WAS PERFORMED")
        print("=" * 60)


if __name__ == "__main__":
    main()
