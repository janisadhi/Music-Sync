from datetime import datetime, timedelta, timezone
from pathlib import Path
import re

import yt_dlp
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.database.models import Song
from app.database.session import SessionLocal
from app.settings.service import SettingsService

class SongDownloader:
    def __init__(self):
        self.music_root = Path(settings.music_root)
        self.music_root.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.settings_service = SettingsService()

    def _playlist_music_root(
        self,
        playlist_id: int,
    ) -> Path:
        """
        Return the music directory for a playlist.

        Example:
        /app/data/music/1/music
        """

        path = (
            self.music_root
            / str(playlist_id)
            / "music"
        )

        path.mkdir(
            parents=True,
            exist_ok=True,
        )

        return path

    def _calculate_retry_time(
        self,
        retry_count: int,
        base_delay_seconds: int,
    ) -> datetime:
        """
        Calculate the next retry time using exponential backoff.

        Retry 1 -> 1 minute
        Retry 2 -> 2 minutes
        Retry 3 -> 4 minutes
        Retry 4 -> 8 minutes
        Retry 5 -> 16 minutes
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
            )

        playlist_music_root = (
            self._playlist_music_root(
                song.playlist.id
            )
        )

        output_template = str(
            playlist_music_root
            / "%(title)s.%(ext)s"
        )

        video_url = (
            "https://www.youtube.com/watch?v="
            f"{song.youtube_video_id}"
        )

        ydl_opts = {
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

        try:
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

            if not opus_path.exists():
                raise FileNotFoundError(
                    "Downloaded file not found: "
                    f"{opus_path}"
                )

            song.file_path = str(
                opus_path
            )

            song.download_status = "downloaded"

            # Successful download resets retry state.
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

            song.error_message = re.sub(
                r"\x1B\[[0-?]*[ -/]*[@-~]",
                "",
                str(exc),
            )

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

            song.download_retry_count += 1
            song.download_status = "failed"

            if (
                song.download_retry_count < max_retries
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
    def download_pending(
        self,
        limit: int = 1,
    ):
        app_settings = self.settings_service.get()
        max_retries = app_settings.max_download_retries
        now = datetime.now(timezone.utc)

        with SessionLocal() as session:

            songs = session.scalars(
                select(Song)
                .options(
                    joinedload(Song.playlist)
                )
                .where(
                    Song.download_status.in_(
                        [
                            "pending",
                            "failed",
                        ]
                    ),
                    (
                        (Song.download_status == "pending")
                        | (
                            (Song.download_status == "failed")
                            & (
                                Song.next_download_attempt.is_(None)
                                | (Song.next_download_attempt <= now)
                            )
                        )
                    ),
                        Song.download_retry_count
                        < max_retries
                )
                .order_by(
                    Song.playlist_id,
                    Song.position,
                )
                .limit(limit)
            ).all()

            print(
                "Songs selected for download: "
                f"{len(songs)}"
            )

            for song in songs:

                print(
                    f"Downloading: "
                    f"{song.position} - "
                    f"{song.title} "
                    f"({song.youtube_video_id})"
                )

                self.download_song(song)

            session.commit()