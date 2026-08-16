import os
import logging
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database.models import DownloadedTrack, Song
from metadata_service.config import DOWNLOADS_DIR

logger = logging.getLogger("metadata_service.scanner")

SUPPORTED_EXTENSIONS = {".opus", ".mp3", ".flac", ".m4a"}
IGNORE_EXTENSIONS = {".part", ".ytdl", ".tmp"}


from app.core.paths import resolve_file_path


class DirectoryScanner:
    """Scans physical downloads directory and correlates with database records."""

    def __init__(self, downloads_dir: Path = DOWNLOADS_DIR):
        self.downloads_dir = downloads_dir

    def scan_filesystem(self) -> list[str]:
        """Scans the music root directory for valid audio files."""
        audio_files = []
        if not self.downloads_dir.exists():
            logger.warning(f"Downloads directory does not exist: {self.downloads_dir}")
            return audio_files

        for root, _, files in os.walk(self.downloads_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in IGNORE_EXTENSIONS:
                    continue
                if ext in SUPPORTED_EXTENSIONS:
                    audio_files.append(os.path.join(root, file))

        return audio_files

    def get_tracks_for_enrichment(
        self,
        session: Session,
        force_reprocess: bool = False,
    ) -> list[DownloadedTrack]:
        """
        Returns list of DownloadedTrack records eligible for metadata enrichment.
        Safeguards:
        - Only tracks whose Song has download_status == "downloaded"
        - Filter by metadata_state == "raw" unless force_reprocess is True
        - Verify file exists and is not actively being written
        """
        query = (
            session.query(DownloadedTrack)
            .join(Song, DownloadedTrack.song_id == Song.id)
            .filter(Song.download_status == "downloaded")
        )

        if not force_reprocess:
            query = query.filter(DownloadedTrack.metadata_state.in_(["raw", "failed"]))

        tracks = query.all()
        valid_tracks = []

        for track in tracks:
            if not track.file_path:
                logger.warning(f"Track {track.id} has no file path in DB")
                continue

            resolved_path = str(resolve_file_path(track.file_path))
            if not os.path.exists(resolved_path):
                # Try relative path under downloads_dir
                rel_path = os.path.join(str(self.downloads_dir), track.file_path.lstrip("/"))
                if os.path.exists(rel_path):
                    resolved_path = rel_path
                else:
                    # Fallback: the lyrics service may have moved the file to
                    # no-lyrics/ and updated Song.file_path but not
                    # DownloadedTrack.file_path.  Check Song.file_path.
                    song = session.query(Song).filter(Song.id == track.song_id).first()
                    if song and song.file_path:
                        song_resolved = str(resolve_file_path(song.file_path))
                        if os.path.exists(song_resolved):
                            resolved_path = song_resolved
                            track.file_path = song_resolved
                            logger.info(
                                f"Track {track.id}: synced stale DT path to Song path: {song_resolved}"
                            )
                        else:
                            logger.warning(
                                f"Track {track.id} file path missing or not found on disk: {track.file_path}"
                            )
                            continue
                    else:
                        logger.warning(
                            f"Track {track.id} file path missing or not found on disk: {track.file_path}"
                        )
                        continue

            # Update file_path to resolved path if changed
            if track.file_path != resolved_path:
                track.file_path = resolved_path

            # Check extension safeguard
            ext = os.path.splitext(resolved_path)[1].lower()
            if ext in IGNORE_EXTENSIONS or ext not in SUPPORTED_EXTENSIONS:
                continue

            valid_tracks.append(track)

        return valid_tracks
