from datetime import datetime, timezone

from app.database.models import Song
from app.database.session import SessionLocal
from app.downloader.service import SongDownloader
from app.settings.service import SettingsService


def main():
    settings_service = SettingsService()
    downloader = SongDownloader()

    with SessionLocal() as session:
        song = session.query(Song).order_by(Song.id).first()

        if song is None:
            print("No songs found.")
            return

        print("Using song:")
        print(f"  ID:    {song.id}")
        print(f"  Title: {song.title}")

    original_settings = settings_service.get()

    original_max_retries = (
        original_settings.max_download_retries
    )
    original_retry_delay = (
        original_settings.download_retry_delay_seconds
    )

    try:
        print()
        print("=" * 60)
        print("TEST 1: Retry settings are loaded")
        print("=" * 60)

        settings_service.update(
            max_download_retries=3,
            download_retry_delay_seconds=10,
        )

        current = settings_service.get()

        assert current.max_download_retries == 3
        assert current.download_retry_delay_seconds == 10

        print("PASS: Max retries = 3")
        print("PASS: Retry delay = 10 seconds")

        print()
        print("=" * 60)
        print("TEST 2: Retry delay uses configured value")
        print("=" * 60)

        before = datetime.now(timezone.utc)

        retry_time = downloader._calculate_retry_time(
            retry_count=1,
            base_delay_seconds=10,
        )

        after = datetime.now(timezone.utc)

        minimum = (
            before.timestamp() + 10
        )
        maximum = (
            after.timestamp() + 10
        )

        retry_timestamp = retry_time.timestamp()

        assert minimum <= retry_timestamp <= maximum

        print(
            "PASS: First retry uses configured "
            "10-second delay."
        )

        print()
        print("=" * 60)
        print("TEST 3: Exponential backoff")
        print("=" * 60)

        retry_1 = downloader._calculate_retry_time(
            retry_count=1,
            base_delay_seconds=10,
        )

        retry_2 = downloader._calculate_retry_time(
            retry_count=2,
            base_delay_seconds=10,
        )

        retry_3 = downloader._calculate_retry_time(
            retry_count=3,
            base_delay_seconds=10,
        )

        delay_1 = retry_1.timestamp() - datetime.now(
            timezone.utc
        ).timestamp()

        delay_2 = retry_2.timestamp() - datetime.now(
            timezone.utc
        ).timestamp()

        delay_3 = retry_3.timestamp() - datetime.now(
            timezone.utc
        ).timestamp()

        assert 9 <= delay_1 <= 11
        assert 19 <= delay_2 <= 21
        assert 39 <= delay_3 <= 41

        print("PASS: Retry 1 ≈ 10 seconds")
        print("PASS: Retry 2 ≈ 20 seconds")
        print("PASS: Retry 3 ≈ 40 seconds")

        print()
        print("=" * 60)
        print("TEST 4: Settings are restored")
        print("=" * 60)

    finally:
        settings_service.update(
            max_download_retries=original_max_retries,
            download_retry_delay_seconds=original_retry_delay,
        )

        restored = settings_service.get()

        assert (
            restored.max_download_retries
            == original_max_retries
        )

        assert (
            restored.download_retry_delay_seconds
            == original_retry_delay
        )

        print(
            f"Restored max retries: "
            f"{restored.max_download_retries}"
        )

        print(
            f"Restored retry delay: "
            f"{restored.download_retry_delay_seconds}"
        )

    print()
    print("=" * 60)
    print("ALL RETRY SETTINGS TESTS PASSED")
    print("NO YOUTUBE DOWNLOAD WAS PERFORMED")
    print("=" * 60)


if __name__ == "__main__":
    main()
