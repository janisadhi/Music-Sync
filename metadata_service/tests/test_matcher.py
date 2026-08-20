from metadata_service.matcher import CandidateMatcher
from metadata_service.musicbrainz import MusicBrainzClient


def test_musicbrainz_high_confidence_match():
    matcher = CandidateMatcher()
    target = {
        "title": "My Kind of Woman",
        "artist": "Mac DeMarco",
        "duration_seconds": 190,
    }

    candidates = [
        {
            "recording_id": "mb-mac-1",
            "artist_id": "mb-art-mac",
            "title": "My Kind of Woman",
            "artist": "Mac DeMarco",
            "album": "2",
            "release_year": 2012,
            "duration_seconds": 190,
        }
    ]

    fallback = {"title": "Mac DeMarco // \"My Kind Of Woman\"", "artist": "CapturedTracks"}

    result = matcher.evaluate(target, candidates, fallback)
    assert result.confidence == "HIGH"
    assert result.source == "MusicBrainz"
    assert result.artist == "Mac DeMarco"
    assert result.title == "My Kind of Woman"
    assert result.album == "2"


def test_musicbrainz_low_confidence_rejection():
    matcher = CandidateMatcher()
    target = {
        "title": "My Kind of Woman",
        "artist": "Mac DeMarco",
        "duration_seconds": 190,
    }

    candidates = [
        {
            "recording_id": "mb-wrong",
            "title": "Random Song",
            "artist": "Completely Unrelated Artist",
            "duration_seconds": 190,
        }
    ]

    fallback = {"title": "My Kind of Woman", "artist": "Mac DeMarco"}

    result = matcher.evaluate(target, candidates, fallback)
    assert result.confidence == "LOW"
    assert result.source == "YouTube Fallback"
    assert result.artist == "Mac DeMarco"
    assert result.title == "My Kind of Woman"


def test_duration_based_verification():
    matcher = CandidateMatcher()
    target = {
        "title": "On the Level",
        "artist": "Mac DeMarco",
        "duration_seconds": 227,  # 3m 47s
    }

    candidates = [
        {
            "recording_id": "mb-mismatch",
            "title": "On the Level",
            "artist": "Mac DeMarco",
            "duration_seconds": 450,  # 7m 30s (duration mismatch > 30s)
        }
    ]

    fallback = {"title": "On the Level", "artist": "Mac DeMarco"}

    result = matcher.evaluate(target, candidates, fallback)
    assert result.confidence == "LOW"
    assert result.source == "YouTube Fallback"


def test_musicbrainz_cache_hit(tmp_path):
    cache_file = tmp_path / "mb_cache.json"
    client = MusicBrainzClient(cache_path=cache_file)
    cache_key = "rec::::art::mac demarco::title::my kind of woman::alb::"
    client._cache[cache_key] = [
        {
            "recording_id": "cached-123",
            "title": "My Kind of Woman",
            "artist": "Mac DeMarco",
        }
    ]

    results = client.search_recordings("My Kind of Woman", "Mac DeMarco")
    assert len(results) == 1
    assert results[0]["recording_id"] == "cached-123"
