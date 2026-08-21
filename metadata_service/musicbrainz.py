import json
import logging
import time
import threading
from pathlib import Path
from typing import Any
import httpx

from metadata_service.config import BEETS_DATA_DIR
from metadata_service.release_selector import ReleaseCandidate, ReleaseSelector

logger = logging.getLogger("metadata_service.musicbrainz")

MUSICBRAINZ_RECORDING_SEARCH_URL = "https://musicbrainz.org/ws/2/recording"
MUSICBRAINZ_RECORDING_LOOKUP_URL = "https://musicbrainz.org/ws/2/recording/"
CACHE_FILE_PATH = BEETS_DATA_DIR / "mb_cache.json"

# Global rate limit lock (MusicBrainz rule: max 1 request / second)
_MB_LOCK = threading.Lock()
_LAST_REQUEST_TIME = 0.0


class MusicBrainzClient:
    """Rate-limited, cached MusicBrainz REST API client with intelligent Release Group selection."""

    def __init__(self, cache_path: Path = CACHE_FILE_PATH):
        self.cache_path = cache_path
        self._cache: dict[str, Any] = self._load_cache()
        self.release_selector = ReleaseSelector()

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

    def _parse_release_candidates(self, item: dict[str, Any]) -> list[ReleaseCandidate]:
        """Extracts structured ReleaseCandidate objects from a MusicBrainz recording item."""
        release_candidates: list[ReleaseCandidate] = []
        releases = item.get("releases", [])

        for r in releases:
            rel_id = r.get("id")
            rel_title = r.get("title")
            rel_status = r.get("status")
            rel_date = r.get("date")
            rel_country = r.get("country")

            rel_year = None
            if rel_date and len(rel_date) >= 4:
                try:
                    rel_year = int(rel_date[:4])
                except ValueError:
                    pass

            # Extract release-group metadata
            rg = r.get("release-group", {})
            rg_id = rg.get("id")
            primary_type = rg.get("primary-type")
            secondary_types = rg.get("secondary-types", [])

            # Extract artist credit for release if present
            artist_credit = r.get("artist-credit") or item.get("artist-credit", [])
            rel_artist = (
                artist_credit[0].get("name") or artist_credit[0].get("artist", {}).get("name")
                if artist_credit
                else None
            )

            if rel_title:
                release_candidates.append(
                    ReleaseCandidate(
                        release_id=rel_id,
                        release_group_id=rg_id,
                        album_title=rel_title,
                        artist=rel_artist,
                        primary_type=primary_type,
                        secondary_types=secondary_types,
                        status=rel_status,
                        release_date=rel_date,
                        release_year=rel_year,
                        country=rel_country,
                    )
                )
        return release_candidates

    def search_recordings(
        self,
        title: str,
        artist: str | None = None,
        recording_id: str | None = None,
        target_album_context: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Searches MusicBrainz recordings and applies ReleaseSelector scoring for canonical album selection.
        """
        if not title and not recording_id:
            return []

        cache_key = f"rec::{recording_id or ''}::art::{artist or ''}::title::{title}::alb::{target_album_context or ''}".lower().strip()
        if cache_key in self._cache:
            logger.debug(f"MusicBrainz cache hit for '{cache_key}'")
            return self._cache[cache_key]

        headers = {
            "User-Agent": "Music-Sync/1.0.0 (https://github.com/janis/Music-Sync)",
            "Accept": "application/json",
        }

        candidates: list[dict[str, Any]] = []

        if recording_id:
            # Direct lookup by recording ID
            url = f"{MUSICBRAINZ_RECORDING_LOOKUP_URL}{recording_id}"
            params = {"inc": "releases+release-groups+artist-credits", "fmt": "json"}
            self._rate_limit()
            try:
                logger.info(f"Direct MusicBrainz recording lookup: {recording_id}")
                resp = httpx.get(url, params=params, headers=headers, timeout=15.0)
                if resp.status_code == 200:
                    data = resp.json()
                    parsed = self._process_recording_item(data, target_album_context)
                    if parsed:
                        candidates.append(parsed)
                        self._cache[cache_key] = candidates
                        self._save_cache()
                        return candidates
            except Exception as e:
                logger.warning(f"Failed direct lookup for MBID {recording_id}: {e}")

        # Search by recording title and artist
        query_parts = [f'recording:"{title}"']
        if artist:
            query_parts.append(f'artist:"{artist}"')
        lucene_query = " AND ".join(query_parts)

        max_retries = 3
        for attempt in range(1, max_retries + 1):
            self._rate_limit()
            try:
                logger.info(f"Querying MusicBrainz (attempt {attempt}): {lucene_query}")
                response = httpx.get(
                    MUSICBRAINZ_RECORDING_SEARCH_URL,
                    params={"query": lucene_query, "fmt": "json", "limit": limit, "inc": "releases+release-groups+artist-credits"},
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
                    parsed = self._process_recording_item(item, target_album_context)
                    if parsed:
                        candidates.append(parsed)

                self._cache[cache_key] = candidates
                self._save_cache()
                return candidates

            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.warning(f"MusicBrainz query error (attempt {attempt}): {e}")
                if attempt < max_retries:
                    time.sleep(attempt * 2)

        self._cache[cache_key] = []
        self._save_cache()
        return []

    def _process_recording_item(
        self,
        item: dict[str, Any],
        target_album_context: str | None = None,
    ) -> dict[str, Any] | None:
        """Processes a single recording item, scoring all attached releases to find canonical album."""
        rec_id = item.get("id")
        rec_title = item.get("title")
        if not rec_id or not rec_title:
            return None

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

        length_ms = item.get("length")
        duration_sec = int(length_ms / 1000) if length_ms else None

        # Build and score release candidates
        rel_candidates = self._parse_release_candidates(item)
        sel_result = self.release_selector.select_best_release(
            candidates=rel_candidates,
            identified_artist=rec_artist,
            target_album_context=target_album_context,
        )

        selected = sel_result.selected_candidate

        return {
            "recording_id": rec_id,
            "title": rec_title,
            "artist": rec_artist,
            "artist_id": artist_id,
            "album": sel_result.album,
            "release_year": sel_result.release_year,
            "release_id": sel_result.musicbrainz_release_id,
            "release_group_id": sel_result.musicbrainz_release_group_id,
            "duration_seconds": duration_sec,
            "release_selection_score": selected.score if selected else 0.0,
            "debug_log": sel_result.debug_log,
        }
