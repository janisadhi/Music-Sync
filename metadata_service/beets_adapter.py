import logging
import os
import subprocess
import shutil
from pathlib import Path
from typing import Any

from metadata_service.config import BEETS_CONFIG_PATH, BEETS_DATA_DIR, DOWNLOADS_DIR

logger = logging.getLogger("metadata_service.beets_adapter")


class BeetsAdapter:
    """Wrapper around Beets autotagging CLI / library engine."""

    def __init__(
        self,
        config_path: Path = BEETS_CONFIG_PATH,
        data_dir: Path = BEETS_DATA_DIR,
        downloads_dir: Path = DOWNLOADS_DIR,
    ):
        self.config_path = config_path
        self.data_dir = data_dir
        self.downloads_dir = downloads_dir

    def _ensure_paths(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.config_path.exists():
            logger.warning(f"Beets config file not found at {self.config_path}")

    def run_beets_import(self, file_path: str) -> bool:
        """Runs Beets autotag import in singleton mode for a single audio file."""
        self._ensure_paths()

        if not os.path.exists(file_path):
            from app.core.paths import resolve_file_path
            resolved = str(resolve_file_path(file_path))
            if os.path.exists(resolved):
                file_path = resolved
            else:
                logger.error(f"File not found for Beets import: {file_path}")
                return False

        # Build custom config if needed to inject exact directory / library paths
        lib_db = self.data_dir / "library.db"

        cmd = [
            "beet",
            "-c", str(self.config_path),
            "-l", str(lib_db),
            "-d", str(self.downloads_dir),
            "import",
            "--singletons",
            "--quiet",
            file_path,
        ]

        logger.info(f"Executing Beets command: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
            )

            if result.returncode == 0:
                logger.info(f"Beets successfully processed {file_path}")
                return True
            else:
                logger.warning(
                    f"Beets import returned code {result.returncode} for {file_path}. "
                    f"Stderr: {result.stderr.strip()}"
                )
                return False
        except subprocess.TimeoutExpired:
            logger.error(f"Beets import timed out after 120s for {file_path}")
            return False
        except Exception as e:
            logger.exception(f"Unexpected error running Beets import on {file_path}: {e}")
            return False

    def extract_tags(self, file_path: str) -> dict[str, Any]:
        """Extracts audio tags from file using Mutagen (easy mode + fallback)."""
        tags: dict[str, Any] = {
            "title": None,
            "artist": None,
            "album": None,
            "album_artist": None,
            "genre": None,
            "track_number": None,
            "release_year": None,
            "artwork_embedded": False,
        }

        if not os.path.exists(file_path):
            return tags

        try:
            import mutagen
            from mutagen.easyid3 import EasyID3
            from mutagen.easymp4 import EasyMP4

            audio = mutagen.File(file_path)
            if audio is None:
                return tags

            # Extract embedded artwork status
            if hasattr(audio, "pictures") and audio.pictures:
                tags["artwork_embedded"] = True
            elif hasattr(audio, "tags") and audio.tags:
                # Check for APIC in ID3 or covr in MP4 or METADATA_BLOCK_PICTURE in Vorbis
                for key in audio.tags.keys():
                    if key.startswith("APIC") or key in ("covr", "METADATA_BLOCK_PICTURE"):
                        tags["artwork_embedded"] = True
                        break

            # Try easy tag extraction
            easy_audio = None
            try:
                easy_audio = mutagen.File(file_path, easy=True)
            except Exception:
                pass

            # Robust helper to fetch first non-empty string value from tag dictionary
            def fetch_tag(primary_keys: list[str]) -> str | None:
                # 1. Try easy_audio
                if easy_audio and hasattr(easy_audio, "get"):
                    for k in primary_keys:
                        val = easy_audio.get(k)
                        if val and isinstance(val, list) and len(val) > 0 and str(val[0]).strip():
                            return str(val[0]).strip()
                        elif val and isinstance(val, str) and val.strip():
                            return val.strip()

                # 2. Try raw audio object keys (case-insensitive)
                if hasattr(audio, "keys"):
                    audio_map = {str(k).lower(): k for k in audio.keys()}
                    for k in primary_keys:
                        k_lower = k.lower()
                        if k_lower in audio_map:
                            val = audio[audio_map[k_lower]]
                            if val and isinstance(val, list) and len(val) > 0 and str(val[0]).strip():
                                return str(val[0]).strip()
                            elif val and isinstance(val, str) and val.strip():
                                return val.strip()
                return None

            tags["title"] = fetch_tag(["title", "TIT2", "©nam"])
            tags["artist"] = fetch_tag(["artist", "TPE1", "©ART"])
            tags["album"] = fetch_tag(["album", "TALB", "©alb"])
            tags["album_artist"] = fetch_tag(["albumartist", "album artist", "performer", "TPE2", "aART"]) or tags["artist"]
            tags["genre"] = fetch_tag(["genre", "TCON", "©gen"])

            tags["musicbrainz_recording_id"] = fetch_tag(["musicbrainz_trackid", "UFID:http://musicbrainz.org", "MusicBrainz Track Id", "mbid"])
            tags["musicbrainz_artist_id"] = fetch_tag(["musicbrainz_artistid", "MusicBrainz Artist Id"])
            tags["musicbrainz_release_id"] = fetch_tag(["musicbrainz_albumid", "MusicBrainz Album Id"])
            tags["musicbrainz_release_group_id"] = fetch_tag(["musicbrainz_releasegroupid", "MusicBrainz Release Group Id"])
            tags["musicbrainz_track_id"] = fetch_tag(["musicbrainz_releasetrackid", "MusicBrainz Release Track Id"])
            tags["acoustid_id"] = fetch_tag(["acoustid_id", "Acoustid Id"])
            tags["spotify_track_id"] = fetch_tag(["spotify_track_id", "Spotify Track Id"])

            track_val = fetch_tag(["tracknumber", "TRCK", "trkn"])
            if track_val:
                try:
                    # tracknumber can be "1" or "1/12" or (1, 12)
                    track_str = str(track_val).strip("()[]")
                    tags["track_number"] = int(track_str.split("/")[0].split(",")[0])
                except (ValueError, AttributeError):
                    pass

            date_val = fetch_tag(["date", "year", "TDRC", "TDRL", "©day"])
            if date_val:
                try:
                    tags["release_year"] = int(str(date_val)[:4])
                except (ValueError, AttributeError):
                    pass

        except ImportError:
            logger.warning("Mutagen library not installed. Cannot extract audio file tags directly.")
        except Exception as e:
            logger.warning(f"Failed to extract tags from {file_path}: {e}")

        return tags
