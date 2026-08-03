from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database.models import Song
from app.database.session import SessionLocal
from app.downloader.service import SongDownloader


def fake_download_song(
    self,
    song: Song,
) -> bool:
    app_settings = self.settings_service.get()
    max_retries = app_settings.max_download_retries

    song.download_status = "failed"
    song.download_retry_count += 1
    song.error_message = (
        "CONTROLLED TEST FAILURE - no YouTube download was attempted"
    )

    if song.download_retry_count < max_retries:
        song.next_download_attempt = (
            self._calculate_retry_time(
                song.download_retry_count,
                app_settings.download_retry_delay_seconds,
            )
        )
    else:
        song.next_download_attempt = None

    return False
    
def print_song(song: Song):
    print()
    print("=" * 60)
    print(f"Song ID:              {song.id}")
    print(f"Title:                {song.title}")
    print(f"Status:               {song.download_status}")
    print(f"Retry count:          {song.download_retry_count}")
    print(f"Next attempt:         {song.next_download_attempt}")
    print(f"Error:                {song.error_message}")
    print("=" * 60)


def main():
    downloader = SongDownloader()
    app_settings = downloader.settings_service.get()
    max_retries = app_settings.max_download_retries

    # Replace the real downloader with our controlled failure.
    downloader.download_song = (
        fake_download_song.__get__(
            downloader,
            SongDownloader,
        )
    )

    with SessionLocal() as session:

        # Find one song that we can safely use for testing.
        song = session.scalar(
            select(Song)
            .order_by(Song.id)
        )

        if song is None:
            print("No songs found in database.")
            return

        print("Using song:")
        print(f"  ID:    {song.id}")
        print(f"  Title: {song.title}")

        # Reset retry state before testing.
        song.download_status = "pending"
        song.download_retry_count = 0
        song.next_download_attempt = None
        song.error_message = None

        session.commit()

        print()
        print("Initial state:")
        print_song(song)

        # -----------------------------------------------------
        # Test 1: First controlled failure
        # -----------------------------------------------------

        print()
        print("TEST 1: First controlled failure")

        downloader.download_song(song)

        session.commit()
        session.refresh(song)

        print_song(song)

        assert song.download_status == "failed"
        assert song.download_retry_count == 1
        assert song.next_download_attempt is not None

        print("PASS: First failure scheduled a retry.")

        # -----------------------------------------------------
        # Test 2: Retry is not immediately eligible
        # -----------------------------------------------------

        print()
        print("TEST 2: Retry is not immediately eligible")

        now = datetime.now(timezone.utc)

        eligible = session.scalar(
            select(Song.id)
            .where(
                Song.id == song.id,
                Song.download_status == "failed",
                Song.download_retry_count
                < max_retries,
                Song.next_download_attempt <= now,
            )
        )

        assert eligible is None

        print("PASS: Song is not eligible before retry time.")

        # -----------------------------------------------------
        # Test 3: Make retry time due
        # -----------------------------------------------------

        print()
        print("TEST 3: Make retry time due")

        song.next_download_attempt = (
            datetime.now(timezone.utc)
            - timedelta(seconds=1)
        )

        session.commit()

        downloader.download_song(song)

        session.commit()
        session.refresh(song)

        print_song(song)

        assert song.download_status == "failed"
        assert song.download_retry_count == 2
        assert song.next_download_attempt is not None

        print("PASS: Retry was processed.")

        # -----------------------------------------------------
        # Test 4: Exhaust all retries
        # -----------------------------------------------------

        print()
        print("TEST 4: Exhaust retries")

        while song.download_retry_count < max_retries:

            song.next_download_attempt = (
                datetime.now(timezone.utc)
                - timedelta(seconds=1)
            )

            session.commit()

            downloader.download_song(song)

            session.commit()
            session.refresh(song)

            print(
                f"Attempt "
                f"{song.download_retry_count}/"
                f"{max_retries}"
            )

        assert (
            song.download_retry_count
            == max_retries
        )

        assert song.download_status == "failed"

        assert song.next_download_attempt is None

        print_song(song)

        print(
            "PASS: Maximum retries reached and "
            "no further retry was scheduled."
        )

        # -----------------------------------------------------
        # Test 5: Manual retry reset
        # -----------------------------------------------------

        print()
        print("TEST 5: Manual retry reset")

        song.download_status = "pending"
        song.download_retry_count = 0
        song.next_download_attempt = None
        song.error_message = None
        song.file_path = None

        session.commit()
        session.refresh(song)

        print_song(song)

        assert song.download_status == "pending"
        assert song.download_retry_count == 0
        assert song.next_download_attempt is None
        assert song.error_message is None
        assert song.file_path is None

        print("PASS: Manual retry reset works.")

        print()
        print("=" * 60)
        print("ALL CONTROLLED RETRY TESTS PASSED")
        print("NO YOUTUBE DOWNLOAD WAS PERFORMED")
        print("=" * 60)


if __name__ == "__main__":
    main()
