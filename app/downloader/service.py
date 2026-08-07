from datetime import datetime, timedelta, timezone
from pathlib import Path
import re

import yt_dlp
from sqlalchemy import select

from app.database.models import Song
from app.database.session import SessionLocal
from app.settings.service import SettingsService
from app.core.paths import get_playlist_music_root


class SongDownloader:
    def __init__(self):
        self.settings_service = SettingsService()

    # ---------------------------------------------------------
    # Retry handling
    # ---------------------------------------------------------

    def _calculate_retry_time(
        self,
        retry_count: int,
        base_delay_seconds: int,
    ) -> datetime:
        """
        Calculate the next retry time using exponential backoff.

        Retry 1 -> base delay
        Retry 2 -> 2x base delay
        Retry 3 -> 4x base delay
        Retry 4 -> 8x base delay
        Retry 5 -> 16x base delay
        """

        delay = (
            base_delay_seconds
            * (2 ** (retry_count - 1))
        )

        return datetime.now(timezone.utc) + timedelta(
            seconds=delay
        )

    def _is_retryable_error(
        self,
        exc: Exception,
    ) -> bool:
        if isinstance(exc, yt_dlp.utils.DownloadError):
            err_msg = str(exc).lower()
            unretryable_keywords = [
                "video unavailable",
                "this video is unavailable",
                "private video",
                "this video is private",
                "video has been removed",
                "this video has been removed",
                "deleted video",
                "members-only",
                "sign in to confirm your age",
            ]
            if any(kw in err_msg for kw in unretryable_keywords):
                return False

        return isinstance(
            exc,
            (
                yt_dlp.utils.DownloadError,
                yt_dlp.utils.PostProcessingError,
                OSError,
            ),
        )

    def _mark_permanent_failure(
        self,
        song: Song,
        message: str,
        max_retries: int,
    ) -> bool:
        song.download_status = "failed"
        song.download_retry_count = max_retries
        song.next_download_attempt = None
        song.error_message = message

        print(
            f"Download permanently failed: "
            f"{song.title}"
        )

        print(
            f"Error: {message}"
        )

        return False

    # ---------------------------------------------------------
    # yt-dlp options
    # ---------------------------------------------------------

    def _build_ydl_options(
        self,
        song: Song,
        playlist_music_root: Path,
    ) -> dict:
        output_template = str(
            playlist_music_root
            / "%(title)s.%(ext)s"
        )

        return {
            "format": "bestaudio/best",

            "outtmpl": output_template,

            "noplaylist": True,

            "quiet": False,
            "no_warnings": False,

            "writethumbnail": True,

            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "opus",
                    "preferredquality": "0",
                },
                {
                    "key": "EmbedThumbnail",
                },
            ],

            "addmetadata": True,

            "postprocessor_args": [
                "-metadata",
                f"title={song.title}",
                "-metadata",
                f"artist={song.artist or ''}",
                "-metadata",
                f"album={song.album or ''}",
                "-metadata",
                f"album_artist={song.artist or ''}",
            ],
        }

    # ---------------------------------------------------------
    # Download one song
    # ---------------------------------------------------------

    def download_song(
        self,
        song: Song,
    ) -> bool:
        app_settings = self.settings_service.get()

        max_retries = app_settings.max_download_retries

        retry_delay = (
            app_settings.download_retry_delay_seconds
        )

        if song.playlist is None:
            return self._mark_permanent_failure(
                song,
                "Cannot download song: playlist is missing",
                max_retries,
            )



        try:
            playlist_music_root = (
                get_playlist_music_root(
                    song.playlist.id
                )
            )

            video_url = (
                "https://www.youtube.com/watch?v="
                f"{song.youtube_video_id}"
            )

            ydl_opts = self._build_ydl_options(
                song,
                playlist_music_root,
            )

            song.download_status = "downloading"
            song.error_message = None

            with yt_dlp.YoutubeDL(
                ydl_opts
            ) as ydl:

                info = ydl.extract_info(
                    video_url,
                    download=True,
                )

                prepared = ydl.prepare_filename(
                    info
                )

                opus_path = Path(
                    prepared
                ).with_suffix(".opus")

            # -------------------------------------------------
            # Verify downloaded file
            # -------------------------------------------------

            if not opus_path.exists():
                raise FileNotFoundError(
                    "Downloaded file not found: "
                    f"{opus_path}"
                )

            # -------------------------------------------------
            # Save actual container path
            # -------------------------------------------------

            song.file_path = str(
                opus_path
            )

            # -------------------------------------------------
            # Mark successful
            # -------------------------------------------------

            song.download_status = "downloaded"

            song.download_retry_count = 0

            song.next_download_attempt = None

            song.error_message = None

            print(
                f"Downloaded: {song.title}"
            )

            print(
                f"Playlist: "
                f"{song.playlist.name}"
            )

            print(
                f"Artist: "
                f"{song.artist or 'Unknown'}"
            )

            print(
                f"Album: "
                f"{song.album or 'Unknown'}"
            )

            print(
                f"File: {opus_path}"
            )

            return True

        except Exception as exc:

            # Remove ANSI terminal escape sequences.
            song.error_message = re.sub(
                r"\x1B\[[0-?]*[ -/]*[@-~]",
                "",
                str(exc),
            )

            # -------------------------------------------------
            # Non-retryable error
            # -------------------------------------------------

            if not self._is_retryable_error(exc):

                song.download_status = "failed"

                song.next_download_attempt = None

                print(
                    f"Non-retryable download failure: "
                    f"{song.title}"
                )

                print(
                    f"Error: {song.error_message}"
                )

                return False

            # -------------------------------------------------
            # Retryable error
            # -------------------------------------------------

            song.download_retry_count += 1

            song.download_status = "failed"

            if (
                song.download_retry_count
                < max_retries
            ):

                song.next_download_attempt = (
                    self._calculate_retry_time(
                        song.download_retry_count,
                        retry_delay,
                    )
                )

                print(
                    f"Download failed: "
                    f"{song.title}"
                )

                print(
                    f"Retry attempt: "
                    f"{song.download_retry_count}/"
                    f"{max_retries}"
                )

                print(
                    f"Next retry: "
                    f"{song.next_download_attempt}"
                )

            else:

                song.next_download_attempt = None

                print(
                    f"Download permanently failed: "
                    f"{song.title}"
                )

                print(
                    f"Maximum retries reached: "
                    f"{max_retries}"
                )

            print(
                f"Error: {song.error_message}"
            )

            return False

    # ---------------------------------------------------------
    # Stale download recovery
    # ---------------------------------------------------------

    def recover_stale_downloads(self) -> int:
        """
        Recover songs stuck in 'downloading' state from crashes/restarts.

        If a non-empty audio file exists on disk for the song,
        mark download_status = 'downloaded'.
        Otherwise, reset download_status = 'pending'.
        """
        recovered_count = 0
        with SessionLocal() as session:
            stuck_songs = session.scalars(
                select(Song).where(
                    Song.download_status == "downloading"
                )
            ).all()

            if not stuck_songs:
                return 0

            print(
                f"Found {len(stuck_songs)} stuck downloads from previous runs. Recovering..."
            )
            for song in stuck_songs:
                if song.file_path:
                    fp = Path(song.file_path)
                    if fp.exists() and fp.stat().st_size > 0:
                        song.download_status = "downloaded"
                        song.next_download_attempt = None
                        song.error_message = None
                        recovered_count += 1
                        print(
                            f"Recovered as downloaded: {song.title}"
                        )
                        continue

                song.download_status = "pending"
                song.next_download_attempt = None
                recovered_count += 1
                print(
                    f"Reset stuck download to pending: {song.title}"
                )

            session.commit()
        return recovered_count

    # ---------------------------------------------------------
    # Thread task helper
    # ---------------------------------------------------------

    def _download_song_by_id(
        self,
        song_id: int,
    ) -> bool:
        with SessionLocal() as session:
            song = session.get(Song, song_id)
            if not song:
                return False

            try:
                success = self.download_song(song)
                session.commit()
                return success
            except Exception as exc:
                session.rollback()
                song.download_status = "failed"
                song.error_message = str(exc)
                try:
                    session.commit()
                except Exception:
                    session.rollback()
                print(
                    f"Unexpected downloader error: {song.title}"
                )
                print(f"Error: {exc}")
                return False

    # ---------------------------------------------------------
    # Download pending songs (Queue-Draining)
    # ---------------------------------------------------------

    def download_pending(
        self,
        limit: int = 1,
        batch_size: int = 50,
    ) -> int:
        """
        Drain the entire pending download queue.

        Parameter 'limit' is interpreted as 'concurrency' (max parallel workers).
        Songs are fetched in batches (batch_size) and processed until no eligible
        pending songs remain.
        """
        from concurrent.futures import ThreadPoolExecutor

        concurrency = max(1, limit)

        # Recover any stuck downloads from previous unexpected shutdowns first
        self.recover_stale_downloads()

        total_downloaded = 0
        total_processed = 0

        while True:
            now = datetime.now(timezone.utc)

            with SessionLocal() as session:
                pending_song_ids = session.scalars(
                    select(Song.id)
                    .where(
                        (Song.download_status == "pending")
                        | (
                            (Song.download_status == "failed")
                            & (Song.next_download_attempt <= now)
                        )
                    )
                    .order_by(Song.id)
                    .limit(batch_size)
                ).all()

            if not pending_song_ids:
                break

            print()
            print(
                f"Processing download queue batch: {len(pending_song_ids)} songs "
                f"(concurrency: {concurrency})"
            )

            batch_downloaded = 0

            if concurrency > 1:
                with ThreadPoolExecutor(
                    max_workers=concurrency
                ) as executor:
                    results = list(
                        executor.map(
                            self._download_song_by_id,
                            pending_song_ids,
                        )
                    )
                batch_downloaded = sum(
                    1 for r in results if r
                )
            else:
                for song_id in pending_song_ids:
                    if self._download_song_by_id(song_id):
                        batch_downloaded += 1

            total_downloaded += batch_downloaded
            total_processed += len(pending_song_ids)

        if total_processed > 0:
            print()
            print(
                f"Download queue drained: {total_downloaded}/{total_processed} succeeded."
            )
        else:
            print("No pending downloads in queue.")

        return total_downloaded
