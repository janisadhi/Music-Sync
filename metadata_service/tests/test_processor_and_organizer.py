import json
from pathlib import Path
from metadata_service.organizer import FileOrganizer


def test_filename_generated_from_final_metadata(tmp_path):
    audio_path = tmp_path / "Mac DeMarco ⧸⧸ ＂My Kind Of Woman＂.opus"
    audio_path.write_bytes(b"dummy_audio_content")

    lrc_path = tmp_path / "Mac DeMarco ⧸⧸ ＂My Kind Of Woman＂.lrc"
    lrc_path.write_text("[00:00.00] Sample lyrics line", encoding="utf-8")

    class MockTrack:
        id = 1
        song_id = 10
        file_path = str(audio_path)

    class MockSong:
        id = 10
        file_path = str(audio_path)
        lyrics_path = str(lrc_path)

    class MockSession:
        def query(self, model):
            class Query:
                def filter(self, *args):
                    return self
                def first(self):
                    return MockSong()
            return Query()
        def flush(self):
            pass

    track = MockTrack()
    session = MockSession()

    res = FileOrganizer.rename_track_and_lyrics(
        session=session,
        downloaded_track=track,
        new_artist="Mac DeMarco",
        new_title="My Kind of Woman",
    )

    assert res["renamed"] is True
    expected_audio = tmp_path / "Mac DeMarco - My Kind of Woman.opus"
    expected_lrc = tmp_path / "Mac DeMarco - My Kind of Woman.lrc"

    assert expected_audio.exists()
    assert expected_lrc.exists()


def test_filename_collision_handling(tmp_path):
    # Create target file first
    existing_target = tmp_path / "Mac DeMarco - My Kind of Woman.opus"
    existing_target.write_bytes(b"existing_file")

    audio_path = tmp_path / "temp_download.opus"
    audio_path.write_bytes(b"new_download")

    class MockTrack:
        id = 2
        song_id = 20
        file_path = str(audio_path)

    class MockSession:
        def query(self, model):
            class Query:
                def filter(self, *args):
                    return self
                def first(self):
                    return None
            return Query()
        def flush(self):
            pass

    track = MockTrack()
    session = MockSession()

    res = FileOrganizer.rename_track_and_lyrics(
        session=session,
        downloaded_track=track,
        new_artist="Mac DeMarco",
        new_title="My Kind of Woman",
    )

    # Colliding target should result in "Mac DeMarco - My Kind of Woman (1).opus"
    expected_collision_audio = tmp_path / "Mac DeMarco - My Kind of Woman (1).opus"
    assert expected_collision_audio.exists()


def test_low_confidence_track_not_renamed_in_processor(tmp_path):
    from metadata_service.processor import MetadataProcessor
    from metadata_service.matcher import MatchResult

    audio_path = tmp_path / "Uncertain_Artist - Unknown_Song.opus"
    audio_path.write_bytes(b"dummy audio")

    class MockTrack:
        id = 99
        song_id = 999
        title = "Uncertain_Artist - Unknown_Song"
        artist = None
        album = None
        album_artist = None
        genre = None
        track_number = None
        release_year = None
        duration_seconds = 180
        artwork_embedded = False
        file_path = str(audio_path)
        metadata_state = "raw"
        beets_metadata_edited = False

    class MockSession:
        def get(self, model, key):
            return None
        def query(self, model):
            class Query:
                def filter(self, *args):
                    return self
                def first(self):
                    return None
            return Query()
        def commit(self):
            pass
        def rollback(self):
            pass
        def add(self, obj):
            pass

    processor = MetadataProcessor()
    # Mock matcher to return LOW confidence match
    processor.matcher.evaluate = lambda target, candidates, fallback_metadata: MatchResult(
        score=0.2,
        confidence="LOW",
        source="fallback",
        title="Uncertain Title",
        artist="Uncertain Artist",
        album=None,
        release_year=None,
        reason="Low score",
        recording_id=None,
        artist_id=None,
    )
    # Mock musicbrainz search to return empty list
    processor.musicbrainz.search_recordings = lambda title, artist: []
    # Mock tag writer
    processor.tag_writer.write_tags = lambda path, tags: False

    track = MockTrack()
    session = MockSession()

    res = processor.enrich_single_track(session, track)

    assert res is True
    assert track.metadata_state == "low_confidence"
    assert track.beets_metadata_edited is False
    # Verify original file on disk was NOT renamed
    assert audio_path.exists()
    assert track.file_path == str(audio_path)

