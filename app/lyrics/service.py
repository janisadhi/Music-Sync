from dataclasses import dataclass
from pathlib import Path
import re
import shutil
import time

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.database.models import Song
from app.database.session import SessionLocal


@dataclass
class LyricsResult:
    status: str
    lyrics: str | None = None
    error: str | None = None


class LyricsService:
    SEARCH_URL = "https://lrclib.net/api/search"

    def __init__(self):
        self.music_root = Path(settings.music_root)
        self.no_lyrics_root = self.music_root.parent / "no-lyrics"

        self.music_root.mkdir(parents=True, exist_ok=True)
        self.no_lyrics_root.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------
    # Title helpers
    # ---------------------------------------------------------

    @staticmethod
    def _clean_title(title: str) -> str:
        cleaned = re.sub(
            r"\s*\((?:remastered|remaster|live|acoustic|radio edit)\)",
            "",
            title,
            flags=re.IGNORECASE,
        )

        cleaned = re.sub(
            r"\s*\[(?:remastered|remaster|live|acoustic|radio edit)\]",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )

        return cleaned.strip()

    @staticmethod
    def _title_matches(requested: str, result: str) -> bool:
        requested = requested.lower().strip()
        result = result.lower().strip()

        return (
            requested == result
            or requested in result
            or result in requested
        )

    # ---------------------------------------------------------
    # LRCLIB search
    # ---------------------------------------------------------

    def _search(self, query: str) -> list[dict]:
        max_attempts = 3

        for attempt in range(1, max_attempts + 1):
            try:
                response = httpx.get(
                    self.SEARCH_URL,
                    params={"q": query},
                    timeout=15,
                    headers={
                        "User-Agent": "music-sync/1.0",
                    },
                )

                response.raise_for_status()

                data = response.json()

                if not isinstance(data, list):
                    return []

                return data

            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code

                if (
                    status_code == 429
                    or status_code >= 500
                ):
                    if attempt < max_attempts:
                        delay = attempt * 2

                        print(
                            f"LRCLIB temporarily unavailable "
                            f"(attempt {attempt}/{max_attempts}). "
                            f"Retrying in {delay}s..."
                        )

                        time.sleep(delay)
                        continue

                raise

            except httpx.RequestError as exc:
                if attempt < max_attempts:
                    delay = attempt * 2

                    print(
                        f"LRCLIB request failed "
                        f"(attempt {attempt}/{max_attempts}). "
                        f"Retrying in {delay}s..."
                    )

                    time.sleep(delay)
                    continue

                raise exc

        return []

    # ---------------------------------------------------------
    # Find lyrics
    # ---------------------------------------------------------

    def _find_synced_lyrics(
        self,
        title: str,
        artist: str | None = None,
        album: str | None = None,
    ) -> LyricsResult:

        search_titles = [title]

        cleaned_title = self._clean_title(title)

        if cleaned_title.lower() != title.lower():
            search_titles.append(cleaned_title)

        try:
            for search_title in search_titles:
                results = self._search(search_title)

                if not results:
                    continue

                # -------------------------------------------------
                # 1. Exact/close title + artist
                # -------------------------------------------------

                for result in results:
                    synced_lyrics = result.get("syncedLyrics")

                    if not synced_lyrics:
                        continue

                    result_title = result.get("trackName") or ""
                    result_artist = result.get("artistName") or ""

                    title_match = self._title_matches(
                        search_title,
                        result_title,
                    )

                    artist_match = True

                    if artist:
                        artist_match = (
                            artist.lower() in result_artist.lower()
                            or result_artist.lower() in artist.lower()
                        )

                    if title_match and artist_match:
                        return LyricsResult(
                            status="available",
                            lyrics=synced_lyrics,
                        )

                # -------------------------------------------------
                # 2. Title match without artist
                # -------------------------------------------------

                for result in results:
                    synced_lyrics = result.get("syncedLyrics")

                    if not synced_lyrics:
                        continue

                    result_title = result.get("trackName") or ""

                    if self._title_matches(
                        search_title,
                        result_title,
                    ):
                        return LyricsResult(
                            status="available",
                            lyrics=synced_lyrics,
                        )

                # -------------------------------------------------
                # 3. First available synced result
                # -------------------------------------------------

                for result in results:
                    synced_lyrics = result.get("syncedLyrics")

                    if synced_lyrics:
                        return LyricsResult(
                            status="available",
                            lyrics=synced_lyrics,
                        )

            return LyricsResult(
                status="unavailable",
                error="No synchronized lyrics found",
            )

        # ---------------------------------------------------------
        # Temporary network/API failures
        # ---------------------------------------------------------

        except httpx.HTTPStatusError as exc:
            return LyricsResult(
                status="temporary",
                error=str(exc),
            )

        except httpx.RequestError as exc:
            return LyricsResult(
                status="temporary",
                error=str(exc),
            )

        # ---------------------------------------------------------
        # Unexpected failure
        # ---------------------------------------------------------

        except Exception as exc:
            return LyricsResult(
                status="failed",
                error=str(exc),
            )

    # ---------------------------------------------------------
    # File helpers
    # ---------------------------------------------------------

    def _lyrics_path(self, song: Song) -> Path:
        if not song.file_path:
            raise ValueError(
                f"Song {song.id} does not have a downloaded file"
            )

        return Path(song.file_path).with_suffix(".lrc")

    def _move_to_no_lyrics(self, song: Song) -> None:
        if not song.file_path:
            return

        source = Path(song.file_path)

        if not source.exists():
            return

        destination = self.no_lyrics_root / source.name

        # music and no-lyrics are separate Docker bind mounts.
        # Therefore rename() can fail with Errno 18.
        #
        # Copy first, then remove the original.
        shutil.copy2(source, destination)
        source.unlink()

        song.file_path = str(destination)

    # ---------------------------------------------------------
    # Process one song
    # ---------------------------------------------------------

    def process_song(self, song: Song) -> bool:

        if not song.file_path:
            song.lyrics_status = "failed"
            song.error_message = (
                "Cannot fetch lyrics: song has no file"
            )

            return False

        print(
            f"Searching lyrics for: "
            f"{song.title}"
        )

        result = self._find_synced_lyrics(
            title=song.title,
            artist=song.artist,
            album=song.album,
        )

        # ---------------------------------------------------------
        # Lyrics found
        # ---------------------------------------------------------

        if result.status == "available":

            lyrics_path = self._lyrics_path(song)

            lyrics_path.write_text(
                result.lyrics,
                encoding="utf-8",
            )

            song.lyrics_path = str(lyrics_path)
            song.lyrics_status = "downloaded"
            song.error_message = None

            print(
                f"Lyrics downloaded: {song.title}"
            )

            print(
                f"LRC: {lyrics_path}"
            )

            return True

        # ---------------------------------------------------------
        # No lyrics available
        # ---------------------------------------------------------

        if result.status == "unavailable":

            try:
                self._move_to_no_lyrics(song)

                song.lyrics_path = None
                song.lyrics_status = "unavailable"
                song.error_message = result.error

                print(
                    f"No synced lyrics: {song.title}"
                )

                return False

            except Exception as exc:
                # Do NOT mark unavailable if moving the file failed.
                # Keep it pending so the next sync cycle can retry.
                song.lyrics_status = "pending"
                song.error_message = (
                    f"Failed to move song to no-lyrics: {exc}"
                )

                print(
                    f"Failed to move song to no-lyrics: "
                    f"{song.title}"
                )

                print(
                    f"Error: {exc}"
                )

                return False

        # ---------------------------------------------------------
        # Temporary failure
        # ---------------------------------------------------------

        if result.status == "temporary":

            song.lyrics_status = "pending"
            song.error_message = result.error

            print(
                f"Lyrics lookup temporarily failed: "
                f"{song.title}"
            )

            print(
                f"Error: {result.error}"
            )

            print(
                "Will retry on the next sync cycle."
            )

            return False

        # ---------------------------------------------------------
        # Unexpected failure
        # ---------------------------------------------------------

        song.lyrics_status = "failed"
        song.error_message = result.error

        print(
            f"Lyrics lookup failed: {song.title}"
        )

        print(
            f"Error: {result.error}"
        )

        return False

    # ---------------------------------------------------------
    # Process pending songs
    # ---------------------------------------------------------

    def process_pending(self, limit: int = 1):

        with SessionLocal() as session:

            songs = session.scalars(
                select(Song)
                .where(
                    Song.download_status == "downloaded",
                    Song.lyrics_status == "pending",
                )
                .order_by(Song.position)
                .limit(limit)
            ).all()

            print(
                f"Songs waiting for lyrics: "
                f"{len(songs)}"
            )

            for song in songs:

                print(
                    f"Fetching lyrics: "
                    f"{song.position} - {song.title}"
                )

                try:
                    self.process_song(song)

                except Exception as exc:
                    # Never allow one song to abort the entire
                    # synchronization cycle.
                    song.lyrics_status = "pending"
                    song.error_message = str(exc)

                    print(
                        f"Lyrics processing failed: "
                        f"{song.title}"
                    )

                    print(
                        f"Error: {exc}"
                    )

            session.commit()