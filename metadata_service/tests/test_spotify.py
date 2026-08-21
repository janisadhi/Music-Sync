import pytest
from unittest.mock import MagicMock, patch

from metadata_service.spotify_client import SpotifyEnricher, SpotifyEnrichmentResult


def test_spotify_unconfigured():
    enricher = SpotifyEnricher(client_id=None, client_secret=None)
    res = enricher.search_track(title="Test Track", artist="Test Artist")
    assert res.spotify_track_id is None
    assert res.artwork_url is None


def test_spotify_search_success():
    enricher = SpotifyEnricher(client_id="fake_id", client_secret="fake_secret")

    mock_spotipy = MagicMock()
    mock_spotipy.search.return_value = {
        "tracks": {
            "items": [
                {
                    "id": "spot_track_987",
                    "name": "Bohemian Rhapsody",
                    "popularity": 85,
                    "artists": [{"id": "spot_artist_123", "name": "Queen"}],
                    "album": {
                        "id": "spot_album_456",
                        "name": "A Night at the Opera",
                        "release_date": "1975-11-21",
                        "images": [{"url": "https://spotify.com/artwork.jpg"}],
                    },
                }
            ]
        }
    }

    with patch.object(enricher, "_get_client", return_value=mock_spotipy):
        res = enricher.search_track(title="Bohemian Rhapsody", artist="Queen")
        assert res.spotify_track_id == "spot_track_987"
        assert res.spotify_artist_id == "spot_artist_123"
        assert res.spotify_album_id == "spot_album_456"
        assert res.title == "Bohemian Rhapsody"
        assert res.artist == "Queen"
        assert res.album == "A Night at the Opera"
        assert res.release_year == 1975
        assert res.popularity == 85
        assert res.artwork_url == "https://spotify.com/artwork.jpg"
