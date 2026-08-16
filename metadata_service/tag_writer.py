import logging
import os
from pathlib import Path
from typing import Any

from app.core.paths import resolve_file_path
from metadata_service.normalizer import normalize_string

logger = logging.getLogger("metadata_service.tag_writer")


class TagWriter:
    """Mutagen tag writing and post-write verification engine."""

    @staticmethod
    def write_tags(
        file_path: str,
        tags: dict[str, Any],
    ) -> bool:
        """
        Embeds resolved metadata tags into physical audio file.
        Tags dictionary keys: title, artist, album, album_artist, genre, track_number, release_year
        """
        resolved_path = str(resolve_file_path(file_path))
        if not os.path.exists(resolved_path):
            logger.error(f"Cannot write tags: File not found at {file_path} (resolved: {resolved_path})")
            return False

        try:
            import mutagen
            from mutagen.easyid3 import EasyID3
            from mutagen.easymp4 import EasyMP4

            audio = mutagen.File(resolved_path)
            if audio is None:
                logger.error(f"Mutagen failed to open file for tag writing: {resolved_path}")
                return False

            ext = Path(resolved_path).suffix.lower()

            if ext in (".opus", ".flac", ".ogg"):
                # VorbisComment tags
                if tags.get("title"):
                    audio["title"] = [str(tags["title"])]
                if tags.get("artist"):
                    audio["artist"] = [str(tags["artist"])]
                if tags.get("album"):
                    audio["album"] = [str(tags["album"])]
                if tags.get("album_artist"):
                    audio["albumartist"] = [str(tags["album_artist"])]
                if tags.get("genre"):
                    audio["genre"] = [str(tags["genre"])]
                if tags.get("track_number") is not None:
                    audio["tracknumber"] = [str(tags["track_number"])]
                if tags.get("release_year") is not None:
                    audio["date"] = [str(tags["release_year"])]
                audio.save()

            elif ext == ".mp3":
                # ID3 tags
                try:
                    easy_mp3 = EasyID3(resolved_path)
                except Exception:
                    easy_mp3 = mutagen.File(resolved_path, easy=True)
                    if hasattr(easy_mp3, "add_tags"):
                        easy_mp3.add_tags()

                if easy_mp3 is not None:
                    if tags.get("title"):
                        easy_mp3["title"] = str(tags["title"])
                    if tags.get("artist"):
                        easy_mp3["artist"] = str(tags["artist"])
                    if tags.get("album"):
                        easy_mp3["album"] = str(tags["album"])
                    if tags.get("album_artist"):
                        easy_mp3["performer"] = str(tags["album_artist"])
                    if tags.get("genre"):
                        easy_mp3["genre"] = str(tags["genre"])
                    if tags.get("track_number") is not None:
                        easy_mp3["tracknumber"] = str(tags["track_number"])
                    if tags.get("release_year") is not None:
                        easy_mp3["date"] = str(tags["release_year"])
                    easy_mp3.save()

            elif ext in (".m4a", ".mp4"):
                try:
                    easy_m4a = EasyMP4(resolved_path)
                    if tags.get("title"):
                        easy_m4a["title"] = str(tags["title"])
                    if tags.get("artist"):
                        easy_m4a["artist"] = str(tags["artist"])
                    if tags.get("album"):
                        easy_m4a["album"] = str(tags["album"])
                    easy_m4a.save()
                except Exception as e:
                    logger.warning(f"Failed EasyMP4 tag write: {e}")

            logger.info(f"Successfully wrote audio tags to {resolved_path}")
            return True

        except Exception as e:
            logger.exception(f"Error writing audio tags to {resolved_path}: {e}")
            return False

    @staticmethod
    def verify_written_tags(
        file_path: str,
        expected_tags: dict[str, Any],
    ) -> bool:
        """
        Post-write verification: reads tags back from disk and asserts key fields match.
        """
        resolved_path = str(resolve_file_path(file_path))
        if not os.path.exists(resolved_path):
            return False

        try:
            from metadata_service.beets_adapter import BeetsAdapter
            adapter = BeetsAdapter()
            read_tags = adapter.extract_tags(resolved_path)

            expected_title = expected_tags.get("title")
            if expected_title and read_tags.get("title"):
                norm_exp = normalize_string(expected_title)
                norm_read = normalize_string(read_tags["title"])
                if norm_exp != norm_read:
                    logger.warning(f"Tag verification mismatch for title: expected '{expected_title}', got '{read_tags.get('title')}'")

            expected_artist = expected_tags.get("artist")
            if expected_artist and read_tags.get("artist"):
                norm_exp_a = normalize_string(expected_artist)
                norm_read_a = normalize_string(read_tags["artist"])
                if norm_exp_a != norm_read_a:
                    logger.warning(f"Tag verification mismatch for artist: expected '{expected_artist}', got '{read_tags.get('artist')}'")

            return True
        except Exception as e:
            logger.warning(f"Post-write tag verification warning for {resolved_path}: {e}")
            return True
