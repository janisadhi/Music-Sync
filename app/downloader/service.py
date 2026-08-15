"""
Song Downloader.

Responsibility: download audio for songs that the Sync DB marks as pending.

Architecture contract
---------------------
  SYNC DISCOVERS.  DOWNLOADER DOWNLOADS.  SCHEDULER TRIGGERS.

This service:
  ✓ Polls the Sync DB for songs with download_status='pending' (or retryable
    'failed' rows whose next_download_attempt is due)
  ✓ Downloads audio using yt-dlp
  ✓ Embeds thumbnail / artwork
  ✓ Writes a DownloadedTrack record with rich metadata after a successful
    download (populating the Music Library DB)
  ✓ Updates Song.download_status in the Sync DB
  ✓ Implements exponential-backoff retry for transient failures
  ✓ Recovers songs stuck in 'downloading' from crashes/restarts

This service does NOT:
  ✗ Scan playlists
  ✗ Import or call SyncService
  ✗ Import or call the Scheduler
  ✗ Decide which playlists to watch

Sync and Downloader communicate exclusively through the Sync DB.
The Downloader can run concurrently with Sync scanning.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import re

import yt_dlp
from sqlalchemy import select

from app.database.models import DownloadedTrack, Song
from app.database.session import SessionLocal
from app.settings.service import SettingsService
from app.core.paths import get_playlist_music_root


class SongDownloader:
    def __init__(self):
        self.settings_service = SettingsService()

    # ------------------------------------------------------------------
    # Retry helpers
    # ------------------------------------------------------------------

    def _calculate_retry_time(
        self,
        retry_count: int,
        base_delay_seconds: int,
    ) -> datetime:
        """
        Exponential backoff:
          retry 1 → base_delay
          retry 2 → 2 × base_delay
          retry 3 → 4 × base_delay
          …
        """
        delay = base_delay_seconds * (2 ** (retry_count - 1))
        return datetime.now(timezone.utc) + timedelta(seconds=delay)

    def _is_retryable_error(self, exc: Exception) -> bool:
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
        print(f"Download permanently failed: {song.title}")
        print(f"Error: {message}")
        return False

    # ------------------------------------------------------------------
    # yt-dlp options
    # ------------------------------------------------------------------

    def _build_ydl_options(
        self,
        song: Song,
        playlist_music_root: Path,
    ) -> dict:
        output_template = str(playlist_music_root / "%(title)s.%(ext)s")

        return {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "noplaylist": True,
            "quiet": False,
            "no_warnings": False,
            # Download and embed video thumbnail as album art
            "writethumbnail": True,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "opus",
                    "preferredquality": "0",
                },
                {
                    # Embeds the downloaded thumbnail into the audio file
                    "key": "EmbedThumbnail",
                },
                {
                    # Write available metadata (title, artist, album, etc.)
                    # from the yt-dlp info dict into the container tags
                    "key": "FFmpegMetadata",
                    "add_metadata": True,
                },
            ],
        }

    # ------------------------------------------------------------------
    # Download one song
    # ------------------------------------------------------------------

    def download_song(self, song: Song) -> bool:
        """
        Download audio for *song*, embed artwork, write DownloadedTrack.

        Returns True on success, False on failure.
        Song.download_status is updated in-place; the caller commits.
        """
        app_settings = self.settings_service.get()
        max_retries = app_settings.max_download_retries
        retry_delay = app_settings.download_retry_delay_seconds

        if song.playlist is None:
            return self._mark_permanent_failure(
                song,
                "Cannot download song: playlist is missing",
                max_retries,
            )

        try:
            playlist_music_root = get_playlist_music_root(song.playlist.name)
            video_url = f"https://www.youtube.com/watch?v={song.youtube_video_id}"

            ydl_opts = self._build_ydl_options(song, playlist_music_root)

            song.download_status = "downloading"
            song.error_message = None

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                prepared = ydl.prepare_filename(info)
                opus_path = Path(prepared).with_suffix(".opus")

            # ----------------------------------------------------------
            # Verify the output file exists
            # ----------------------------------------------------------
            if not opus_path.exists():
                raise FileNotFoundError(
                    f"Downloaded file not found: {opus_path}"
                )

            # ----------------------------------------------------------
            # Update Sync DB (Song)
            # ----------------------------------------------------------
            song.file_path = str(opus_path)
            song.download_status = "downloaded"
            song.download_retry_count = 0
            song.next_download_attempt = None
            song.error_message = None

            # ----------------------------------------------------------
            # Write / update Music Library DB (DownloadedTrack)
            # Rich metadata comes from yt-dlp info dict – fetched here
            # during download, NOT during playlist scanning.
            # ----------------------------------------------------------
            self._upsert_downloaded_track(song, info, opus_path)

            print(f"Downloaded: {song.title} ({song.youtube_video_id})")
            print(f"File: {opus_path}")

            return True

        except Exception as exc:
            # Strip ANSI escape codes from yt-dlp error output.
            song.error_message = re.sub(
                r"\x1B\[[0-?]*[ -/]*[@-~]",
                "",
                str(exc),
            )

            # ----------------------------------------------------------
            # Non-retryable error (unavailable, private, deleted, …)
            # ----------------------------------------------------------
            if not self._is_retryable_error(exc):
                song.download_status = "failed"
                song.next_download_attempt = None
                print(f"Non-retryable download failure: {song.title}")
                print(f"Error: {song.error_message}")
                return False

            # ----------------------------------------------------------
            # Retryable error – apply exponential backoff
            # ----------------------------------------------------------
            song.download_retry_count += 1
            song.download_status = "failed"

            if song.download_retry_count < max_retries:
                song.next_download_attempt = self._calculate_retry_time(
                    song.download_retry_count, retry_delay
                )
                print(f"Download failed (retryable): {song.title}")
                print(
                    f"Retry {song.download_retry_count}/{max_retries} "
                    f"at {song.next_download_attempt}"
                )
            else:
                song.next_download_attempt = None
                print(f"Download permanently failed (max retries): {song.title}")
                print(f"Max retries: {max_retries}")

            print(f"Error: {song.error_message}")
            return False

    # ------------------------------------------------------------------
    # Music Library DB – DownloadedTrack upsert
    # ------------------------------------------------------------------

    def _upsert_downloaded_track(
        self,
        song: Song,
        info: dict,
        opus_path: Path,
    ) -> None:
        """
        Create or update the DownloadedTrack record after a successful
        download.  This is where rich metadata enters the Music Library DB.
        """
        try:
            file_size = opus_path.stat().st_size if opus_path.exists() else None
        except OSError:
            file_size = None

        # Thumbnail URL: yt-dlp may provide a list or a single URL.
        thumbnail = info.get("thumbnail")
        if isinstance(thumbnail, list) and thumbnail:
            thumbnail = thumbnail[0].get("url") if isinstance(thumbnail[0], dict) else str(thumbnail[0])

        # Release year from upload date (YYYYMMDD) or release_year field.
        release_year: int | None = info.get("release_year")
        if release_year is None:
            upload_date: str | None = info.get("upload_date")
            if upload_date and len(upload_date) >= 4:
                try:
                    release_year = int(upload_date[:4])
                except ValueError:
                    pass

        # The session that owns the Song must be used here.
        # DownloadedTrack is linked via song.downloaded_track relationship.
        track = song.downloaded_track

        if track is None:
            track = DownloadedTrack(
                song_id=song.id,
                youtube_video_id=song.youtube_video_id,
            )
            song.downloaded_track = track

        track.youtube_video_id = song.youtube_video_id
        track.file_path = str(opus_path)
        track.file_format = "opus"
        track.file_size_bytes = file_size
        track.title = info.get("title") or song.title
        track.artist = info.get("artist") or info.get("uploader")
        track.album = info.get("album")
        track.album_artist = info.get("album_artist") or info.get("artist") or info.get("uploader")
        track.genre = info.get("genre")
        track.track_number = info.get("track_number")
        track.duration_seconds = info.get("duration")
        track.release_year = release_year
        track.thumbnail_url = thumbnail
        track.artwork_embedded = True  # EmbedThumbnail post-processor ran
        track.metadata_state = "raw"   # Ready for future Beets enrichment

        print(
            f"DownloadedTrack record written for: "
            f"{track.title or song.youtube_video_id}"
        )

    # ------------------------------------------------------------------
    # Stale download recovery
    # ------------------------------------------------------------------

    def recover_stale_downloads(self) -> int:
        """
        Recover songs stuck in 'downloading' state from crashes/restarts.

        If a non-empty audio file exists on disk → mark downloaded.
        Otherwise → reset to pending.
        """
        recovered_count = 0

        with SessionLocal() as session:
            stuck_songs = session.scalars(
                select(Song).where(Song.download_status == "downloading")
            ).all()

            if not stuck_songs:
                return 0

            print(
                f"Found {len(stuck_songs)} stuck downloads. Recovering…"
            )

            for song in stuck_songs:
                if song.file_path:
                    fp = Path(song.file_path)
                    if fp.exists() and fp.stat().st_size > 0:
                        song.download_status = "downloaded"
                        song.next_download_attempt = None
                        song.error_message = None
                        recovered_count += 1
                        print(f"Recovered as downloaded: {song.title}")
                        continue

                song.download_status = "pending"
                song.next_download_attempt = None
                recovered_count += 1
                print(f"Reset stuck download to pending: {song.title}")

            session.commit()

        return recovered_count

    # ------------------------------------------------------------------
    # Thread task helper
    # ------------------------------------------------------------------

    def _download_song_by_id(self, song_id: int) -> bool:
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
                print(f"Unexpected downloader error: {song.title}")
                print(f"Error: {exc}")
                return False

    # ------------------------------------------------------------------
    # Queue draining (called by Scheduler / background worker)
    # ------------------------------------------------------------------

    def download_pending(
        self,
        limit: int = 1,
        batch_size: int = 50,
    ) -> int:
        """
        Drain the pending download queue.

        'limit' = max parallel workers (concurrency).
        Songs are fetched in batches of 'batch_size' and processed until no
        eligible pending songs remain.

        Eligible songs:
          download_status = 'pending'
          OR download_status = 'failed' AND next_download_attempt <= now
        """
        from concurrent.futures import ThreadPoolExecutor

        concurrency = max(1, limit)

        # Recover any crash-stuck songs first.
        self.recover_stale_downloads()

        total_downloaded = 0
        total_processed = 0

        while True:
            now = datetime.now(timezone.utc)

            with SessionLocal() as session:
                pending_ids = session.scalars(
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

            if not pending_ids:
                break

            print()
            print(
                f"Processing download batch: {len(pending_ids)} songs "
                f"(concurrency: {concurrency})"
            )

            if concurrency > 1:
                with ThreadPoolExecutor(max_workers=concurrency) as executor:
                    results = list(
                        executor.map(self._download_song_by_id, pending_ids)
                    )
                batch_downloaded = sum(1 for r in results if r)
            else:
                batch_downloaded = 0
                for song_id in pending_ids:
                    if self._download_song_by_id(song_id):
                        batch_downloaded += 1

            total_downloaded += batch_downloaded
            total_processed += len(pending_ids)

        if total_processed > 0:
            print()
            print(
                f"Download queue drained: "
                f"{total_downloaded}/{total_processed} succeeded."
            )
        else:
            print("No pending downloads.")

        return total_downloaded
