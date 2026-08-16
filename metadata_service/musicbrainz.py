import json
import logging
import time
import threading
from pathlib import Path
from typing import Any
import httpx

from metadata_service.config import BEETS_DATA_DIR

logger = logging.getLogger("metadata_service.musicbrainz")

MUSICBRAINZ_API_URL = "https://musicbrainz.org/ws/2/recording"
CACHE_FILE_PATH = BEETS_DATA_DIR / "mb_cache.json"

# Global rate limit lock (MusicBrainz rule: max 1 request / second)
_MB_LOCK = threading.Lock()
_LAST_REQUEST_TIME = 0.0


class MusicBrainzClient:
    """Rate-limited, cached MusicBrainz REST API client."""

    def __init__(self, cache_path: Path = CACHE_FILE_PATH):
        self.cache_path = cache_path
        self._cache: dict[str, Any] = self._load_cache()

    def _load_cache(self) -> dict[str, Any]:
        """Loads query cache from disk."""
        if self.cache_path.exists():
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load MusicBrainz cache: {e}")
        return {}

    def _save_cache(self):
        """Persists query cache to disk."""
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_path, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save MusicBrainz cache: {e}")

    def _rate_limit(self):
        """Enforces 1 request/sec delay for MusicBrainz API etiquette."""
        global _LAST_REQUEST_TIME
        with _MB_LOCK:
            now = time.time()
            elapsed = now - _LAST_REQUEST_TIME
            if elapsed < 1.0:
                time.sleep(1.0 - elapsed)
            _LAST_REQUEST_TIME = time.time()

    def search_recordings(
        self,
        title: str,
        artist: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Searches MusicBrainz recordings matching title and optional artist.
        Returns list of structured candidate dicts:
        {
           "recording_id": str,
           "title": str,
           "artist": str,
           "artist_id": str,
           "album": str,
           "release_year": int,
           "duration_seconds": int,
        }
        """
        if not title:
            return []

        cache_key = f"{artist or ''}:::{title}".lower().strip()
        if cache_key in self._cache:
            logger.debug(f"MusicBrainz cache hit for '{cache_key}'")
            return self._cache[cache_key]

        # Build lucene query
        query_parts = [f'recording:"{title}"']
        if artist:
            query_parts.append(f'artist:"{artist}"')
        lucene_query = " AND ".join(query_parts)

        headers = {
            "User-Agent": "Music-Sync/1.0.0 (https://github.com/janis/Music-Sync)",
            "Accept": "application/json",
        }

        candidates: list[dict[str, Any]] = []
        max_retries = 3

        for attempt in range(1, max_retries + 1):
            self._rate_limit()
            try:
                logger.info(f"Querying MusicBrainz (attempt {attempt}): {lucene_query}")
                response = httpx.get(
                    MUSICBRAINZ_API_URL,
                    params={"query": lucene_query, "fmt": "json", "limit": limit},
                    headers=headers,
                    timeout=15.0,
                )

                if response.status_code == 429:
                    logger.warning("MusicBrainz rate limited (429). Retrying after delay...")
                    time.sleep(attempt * 2)
                    continue

                response.raise_for_status()
                data = response.json()

                for item in data.get("recordings", []):
                    rec_id = item.get("id")
                    rec_title = item.get("title")

                    # Extract artist credit
                    artist_credit = item.get("artist-credit", [])
                    rec_artist = (
                        artist_credit[0].get("name") or artist_credit[0].get("artist", {}).get("name")
                        if artist_credit
                        else None
                    )
                    artist_id = (
                        artist_credit[0].get("artist", {}).get("id")
                        if artist_credit and "artist" in artist_credit[0]
                        else None
                    )

                    # Extract release info
                    releases = item.get("releases", [])
                    rec_album = releases[0].get("title") if releases else None
                    date_str = releases[0].get("date") if releases else None
                    rec_year = None
                    if date_str and len(date_str) >= 4:
                        try:
                            rec_year = int(date_str[:4])
                        except ValueError:
                            pass

                    # Extract length in ms -> seconds
                    length_ms = item.get("length")
                    duration_sec = int(length_ms / 1000) if length_ms else None

                    candidates.append({
                        "recording_id": rec_id,
                        "title": rec_title,
                        "artist": rec_artist,
                        "artist_id": artist_id,
                        "album": rec_album,
                        "release_year": rec_year,
                        "duration_seconds": duration_sec,
                    })

                # Cache and return
                self._cache[cache_key] = candidates
                self._save_cache()
                return candidates

            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.warning(f"MusicBrainz query error (attempt {attempt}): {e}")
                if attempt < max_retries:
                    time.sleep(attempt * 2)
                else:
                    logger.error(f"MusicBrainz search failed after {max_retries} attempts")

        # Cache empty list on failure to prevent hammering
        self._cache[cache_key] = []
        self._save_cache()
        return []
