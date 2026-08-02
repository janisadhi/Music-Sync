from sqlalchemy import select

import yt_dlp

from app.database.models import Song
from app.database.session import SessionLocal
from app.downloader.service import SongDownloader


def show_song(song: Song):
    print()
    print("=" * 60)
    print(f"Song ID:       {song.id}")
    print(f"Title:         {song.title}")
    print(f"Status:        {song.download_status}")
    print(f"Retry count:   {song.download_retry_count}")
    print(f"Next attempt:  {song.next_download_attempt}")
    print(f"Error:         {song.error_message}")
    print("=" * 60)


class FakeYoutubeDL:
    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def extract_info(self, *args, **kwargs):
        raise yt_dlp.utils.DownloadError(
            "CONTROLLED DOWNLOAD ERROR"
        )


def main():
    downloader = SongDownloader()

    with SessionLocal() as session:
        song = session.scalars(
            select(Song)
            .order_by(Song.id)
        ).first()

        if song is None:
            raise RuntimeError(
                "No songs exist in the database."
            )

        print("Using song:")
        print(f"  ID:    {song.id}")
        print(f"  Title: {song.title}")

        # Save original state so the test can restore it.
        original_status = song.download_status
        original_retry_count = song.download_retry_count
        original_next_attempt = song.next_download_attempt
        original_error = song.error_message
        original_file_path = song.file_path

        try:
            # -------------------------------------------------
            # TEST 1: DownloadError goes through retry logic
            # -------------------------------------------------

            print()
            print("=" * 60)
            print("TEST 1: Controlled DownloadError")
            print("=" * 60)

            song.download_status = "pending"
            song.download_retry_count = 0
            song.next_download_attempt = None
            song.error_message = None

            original_ytdlp = yt_dlp.YoutubeDL

            try:
                yt_dlp.YoutubeDL = FakeYoutubeDL

                result = downloader.download_song(song)

            finally:
                yt_dlp.YoutubeDL = original_ytdlp

            show_song(song)

            assert result is False

            assert song.download_status == "failed"

            assert song.download_retry_count == 1

            assert song.next_download_attempt is not None

            assert (
                song.error_message
                == "CONTROLLED DOWNLOAD ERROR"
            )

            print(
                "PASS: DownloadError triggered retry logic."
            )

            # -------------------------------------------------
            # TEST 2: ValueError does NOT retry
            # -------------------------------------------------

            print()
            print("=" * 60)
            print("TEST 2: Controlled ValueError")
            print("=" * 60)

            class FakeYoutubeDLValueError(
                FakeYoutubeDL
            ):
                def extract_info(
                    self,
                    *args,
                    **kwargs,
                ):
                    raise ValueError(
                        "CONTROLLED NON-RETRYABLE ERROR"
                    )

            song.download_status = "pending"
            song.download_retry_count = 0
            song.next_download_attempt = None
            song.error_message = None

            try:
                yt_dlp.YoutubeDL = (
                    FakeYoutubeDLValueError
                )

                result = downloader.download_song(song)

            finally:
                yt_dlp.YoutubeDL = original_ytdlp

            show_song(song)

            assert result is False

            assert song.download_status == "failed"

            assert song.download_retry_count == 0

            assert song.next_download_attempt is None

            assert (
                song.error_message
                == "CONTROLLED NON-RETRYABLE ERROR"
            )

            print(
                "PASS: ValueError did not trigger retry."
            )

            print()
            print("=" * 60)
            print(
                "DOWNLOAD FAILURE PATH TESTS PASSED"
            )
            print(
                "NO YOUTUBE DOWNLOAD WAS PERFORMED"
            )
            print("=" * 60)

        finally:
            # Restore original database state.
            song.download_status = original_status
            song.download_retry_count = (
                original_retry_count
            )
            song.next_download_attempt = (
                original_next_attempt
            )
            song.error_message = original_error
            song.file_path = original_file_path

            session.commit()

            print()
            print(
                "Original song state restored."
            )


if __name__ == "__main__":
    main()
