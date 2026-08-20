import pytest
from metadata_service.release_selector import ReleaseCandidate, ReleaseSelector
from metadata_service.musicbrainz import MusicBrainzClient


def test_studio_album_preferred_over_live_release():
    selector = ReleaseSelector()

    live_release = ReleaseCandidate(
        release_id="rel-live-123",
        release_group_id="rg-live-123",
        album_title="1994-11-09: Green Mill, Chicago, IL, USA",
        artist="Jeff Buckley",
        primary_type="Album",
        secondary_types=["Live"],
        status="Official",
        release_year=1994,
    )

    studio_release = ReleaseCandidate(
        release_id="rel-grace-456",
        release_group_id="rg-grace-456",
        album_title="Grace",
        artist="Jeff Buckley",
        primary_type="Album",
        secondary_types=[],
        status="Official",
        release_year=1994,
    )

    candidates = [live_release, studio_release]

    result = selector.select_best_release(
        candidates=candidates,
        identified_artist="Jeff Buckley",
        target_album_context="Grace",
    )

    assert result.album == "Grace"
    assert result.musicbrainz_release_id == "rel-grace-456"
    assert studio_release.score > live_release.score


def test_studio_album_preferred_over_compilation_release():
    selector = ReleaseSelector()

    compilation_release = ReleaseCandidate(
        release_id="rel-comp-789",
        release_group_id="rg-comp-789",
        album_title="Total Rock",
        artist="Jeff Buckley",
        primary_type="Album",
        secondary_types=["Compilation"],
        status="Official",
        release_year=2001,
    )

    studio_release = ReleaseCandidate(
        release_id="rel-grace-456",
        release_group_id="rg-grace-456",
        album_title="Grace",
        artist="Jeff Buckley",
        primary_type="Album",
        secondary_types=[],
        status="Official",
        release_year=1994,
    )

    candidates = [compilation_release, studio_release]

    result = selector.select_best_release(
        candidates=candidates,
        identified_artist="Jeff Buckley",
        target_album_context="Grace",
    )

    assert result.album == "Grace"
    assert studio_release.score > compilation_release.score


def test_jeff_buckley_hallelujah_regression():
    mb_client = MusicBrainzClient()

    raw_item = {
        "id": "rec-hallelujah-id",
        "title": "Hallelujah",
        "artist-credit": [{"name": "Jeff Buckley", "artist": {"id": "art-jeff"}}],
        "length": 418000,
        "releases": [
            {
                "id": "rel-greenmill",
                "title": "1994-11-09: Green Mill, Chicago, IL, USA",
                "status": "Official",
                "date": "1994-11-09",
                "release-group": {
                    "id": "rg-greenmill",
                    "primary-type": "Album",
                    "secondary-types": ["Live"],
                },
            },
            {
                "id": "rel-grace",
                "title": "Grace",
                "status": "Official",
                "date": "1994-08-23",
                "release-group": {
                    "id": "rg-grace",
                    "primary-type": "Album",
                    "secondary-types": [],
                },
            },
        ],
    }

    parsed = mb_client._process_recording_item(raw_item, target_album_context="Grace")

    assert parsed["album"] == "Grace"
    assert parsed["release_id"] == "rel-grace"
    assert parsed["release_group_id"] == "rg-grace"


def test_jeff_buckley_dream_brother_regression():
    mb_client = MusicBrainzClient()

    raw_item = {
        "id": "rec-dreambrother-id",
        "title": "Dream Brother",
        "artist-credit": [{"name": "Jeff Buckley"}],
        "length": 326000,
        "releases": [
            {
                "id": "rel-chicago",
                "title": "1994-11-09: Green Mill, Chicago, IL, USA",
                "status": "Official",
                "date": "1994-11-09",
                "release-group": {
                    "id": "rg-chicago",
                    "primary-type": "Album",
                    "secondary-types": ["Live"],
                },
            },
            {
                "id": "rel-grace",
                "title": "Grace",
                "status": "Official",
                "date": "1994-08-23",
                "release-group": {
                    "id": "rg-grace",
                    "primary-type": "Album",
                    "secondary-types": [],
                },
            },
        ],
    }

    parsed = mb_client._process_recording_item(raw_item, target_album_context="Grace")

    assert parsed["album"] == "Grace"
    assert parsed["release_id"] == "rel-grace"


def test_jeff_buckley_eternal_life_regression():
    mb_client = MusicBrainzClient()

    raw_item = {
        "id": "rec-eternallife-id",
        "title": "Eternal Life",
        "artist-credit": [{"name": "Jeff Buckley"}],
        "length": 285000,
        "releases": [
            {
                "id": "rel-totalrock",
                "title": "Total Rock",
                "status": "Official",
                "date": "2001-05-10",
                "release-group": {
                    "id": "rg-totalrock",
                    "primary-type": "Album",
                    "secondary-types": ["Compilation"],
                },
            },
            {
                "id": "rel-grace",
                "title": "Grace",
                "status": "Official",
                "date": "1994-08-23",
                "release-group": {
                    "id": "rg-grace",
                    "primary-type": "Album",
                    "secondary-types": [],
                },
            },
        ],
    }

    parsed = mb_client._process_recording_item(raw_item, target_album_context="Grace")

    assert parsed["album"] == "Grace"
    assert parsed["release_id"] == "rel-grace"


def test_jeff_buckley_grace_regression():
    mb_client = MusicBrainzClient()

    raw_item = {
        "id": "rec-grace-track-id",
        "title": "Grace",
        "artist-credit": [{"name": "Jeff Buckley"}],
        "length": 322000,
        "releases": [
            {
                "id": "rel-songwriter",
                "title": "Songwriter",
                "status": "Official",
                "date": "2002-01-01",
                "release-group": {
                    "id": "rg-songwriter",
                    "primary-type": "Album",
                    "secondary-types": ["Compilation"],
                },
            },
            {
                "id": "rel-grace",
                "title": "Grace",
                "status": "Official",
                "date": "1994-08-23",
                "release-group": {
                    "id": "rg-grace",
                    "primary-type": "Album",
                    "secondary-types": [],
                },
            },
        ],
    }

    parsed = mb_client._process_recording_item(raw_item, target_album_context="Grace")

    assert parsed["album"] == "Grace"
    assert parsed["release_id"] == "rel-grace"


def test_processor_dry_run_mode(tmp_path):
    from metadata_service.processor import MetadataProcessor

    audio_path = tmp_path / "Jeff Buckley - Hallelujah.opus"
    audio_path.write_bytes(b"dummy audio content")

    class MockTrack:
        id = 55
        song_id = 555
        title = "Jeff Buckley - Hallelujah"
        artist = "Jeff Buckley"
        album = "Grace"
        album_artist = "Jeff Buckley"
        genre = None
        track_number = None
        release_year = None
        duration_seconds = 418
        artwork_embedded = False
        file_path = str(audio_path)
        metadata_state = "raw"
        beets_metadata_edited = False

    class MockSong:
        id = 555
        file_path = str(audio_path)
        lyrics_path = None

    class MockSession:
        def get(self, model, key):
            return None
        def query(self, model):
            class Query:
                def filter(self, *args):
                    return self
                def first(self):
                    return MockSong()
            return Query()

    processor = MetadataProcessor()

    # Dry run execution
    res = processor.enrich_single_track(
        session=MockSession(),
        track=MockTrack(),
        dry_run=True,
    )

    assert isinstance(res, dict)
    assert res["dry_run"] is True
    assert res["track_id"] == 55
    assert "proposed_metadata" in res
    assert "release_selection_debug_log" in res

    # Verify original file on disk was untouched
    assert audio_path.exists()
    assert audio_path.read_bytes() == b"dummy audio content"
