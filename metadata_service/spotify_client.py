import logging
import os
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("metadata_service.spotify_client")


@dataclass
class SpotifyEnrichmentResult:
    spotify_track_id: str | None = None
    spotify_artist_id: str | None = None
    spotify_album_id: str | None = None
    popularity: int | None = None
    artwork_url: str | None = None
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    release_year: int | None = None
    source: str = "spotify"


class SpotifyEnricher:
    """Provides optional metadata enrichment via Spotify Web API."""

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
    ):
        self.client_id = client_id or os.getenv("SPOTIFY_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("SPOTIFY_CLIENT_SECRET")
        self._sp_client = None

    def _get_client(self):
        if self._sp_client:
            return self._sp_client

        if not self.client_id or not self.client_secret:
            return None

        try:
            import spotipy
            from spotipy.oauth2 import SpotifyClientCredentials

            auth_manager = SpotifyClientCredentials(
                client_id=self.client_id,
                client_secret=self.client_secret,
            )
            self._sp_client = spotipy.Spotify(
                auth_manager=auth_manager,
                requests_timeout=10,
            )
            return self._sp_client
        except Exception as e:
            logger.warning(f"Failed to initialize Spotipy client: {e}")
            return None

    def search_track(
        self,
        title: str,
        artist: str | None = None,
        album: str | None = None,
    ) -> SpotifyEnrichmentResult:
        """Searches Spotify for track metadata enrichment."""
        res = SpotifyEnrichmentResult()

        if not title:
            return res

        sp = self._get_client()
        if not sp:
            logger.debug("Spotify credentials not configured or client initialization failed. Skipping enrichment.")
            return res

        try:
            query = f"track:{title}"
            if artist:
                query += f" artist:{artist}"

            search_res = sp.search(q=query, type="track", limit=1)
            tracks = search_res.get("tracks", {}).get("items", [])

            if not tracks and artist:
                # Fallback to broader query
                search_res = sp.search(q=f"{artist} {title}", type="track", limit=1)
                tracks = search_res.get("tracks", {}).get("items", [])

            if not tracks:
                logger.info(f"No Spotify match found for '{title}' by '{artist}'")
                return res

            track_data = tracks[0]
            res.spotify_track_id = track_data.get("id")
            res.title = track_data.get("name")
            res.popularity = track_data.get("popularity")

            artists = track_data.get("artists", [])
            if artists:
                res.artist = artists[0].get("name")
                res.spotify_artist_id = artists[0].get("id")

            album_data = track_data.get("album", {})
            if album_data:
                res.album = album_data.get("name")
                res.spotify_album_id = album_data.get("id")
                release_date = album_data.get("release_date", "")
                if release_date and len(release_date) >= 4:
                    try:
                        res.release_year = int(release_date[:4])
                    except ValueError:
                        pass

                images = album_data.get("images", [])
                if images:
                    # Choose highest resolution image URL
                    res.artwork_url = images[0].get("url")

            logger.info(
                f"Spotify enrichment matched: ID={res.spotify_track_id}, "
                f"Popularity={res.popularity}, Artwork='{res.artwork_url}'"
            )
        except Exception as e:
            logger.warning(f"Spotify enrichment search failed for '{title}': {e}")

        return res
