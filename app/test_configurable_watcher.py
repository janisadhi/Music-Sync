from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, AppSettings, Playlist, Song
from app.settings.service import SettingsService
from app.api.settings import SettingsUpdateRequest
from app.reconciler.service import PlaylistReconciler
from app.watcher.youtube import YouTubePlaylistWatcher, YouTubeSong
from app.watcher.test_youtube_watcher import MockYoutubeDL


def setup_in_memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine)
    return TestingSessionLocal


def test_settings_defaults_and_updates():
    print("=" * 60)
    print("TEST 1: Settings Defaults and Updates")
    print("=" * 60)

    TestingSessionLocal = setup_in_memory_db()

    with patch("app.settings.service.SessionLocal", TestingSessionLocal):
        service = SettingsService()

        # 1. Check default settings
        settings = service.get()
        assert settings.playlist_watch_mode == "whole"
        assert settings.playlist_watch_limit is None
        print("PASS: Default watch settings are mode='whole', limit=None")

        # 2. Update to last_n mode
        updated = service.update(
            playlist_watch_mode="last_n",
            playlist_watch_limit=10,
        )
        assert updated.playlist_watch_mode == "last_n"
        assert updated.playlist_watch_limit == 10
        print("PASS: Updated to mode='last_n', limit=10 successfully")

        # 3. Update back to whole mode (should clear limit to None)
        updated_whole = service.update(
            playlist_watch_mode="whole",
            playlist_watch_limit=None,
        )
        assert updated_whole.playlist_watch_mode == "whole"
        assert updated_whole.playlist_watch_limit is None
        print("PASS: Switch back to mode='whole' cleared limit to None")


def test_settings_api_validation():
    print()
    print("=" * 60)
    print("TEST 2: Settings API Request Validation")
    print("=" * 60)

    # Valid whole mode
    req1 = SettingsUpdateRequest(playlist_watch_mode="whole")
    assert req1.playlist_watch_mode == "whole"
    assert req1.playlist_watch_limit is None
    print("PASS: Valid 'whole' request validates cleanly.")

    # Valid last_n mode with limit
    req2 = SettingsUpdateRequest(playlist_watch_mode="last_n", playlist_watch_limit=10)
    assert req2.playlist_watch_mode == "last_n"
    assert req2.playlist_watch_limit == 10
    print("PASS: Valid 'last_n' + 10 request validates cleanly.")

    # Invalid: last_n without limit
    try:
        SettingsUpdateRequest(playlist_watch_mode="last_n", playlist_watch_limit=None)
        assert False, "Expected ValueError for last_n without limit"
    except ValueError as exc:
        print(f"PASS: Rejection of last_n without limit: {exc}")

    # Invalid: last_n with negative/zero limit
    try:
        SettingsUpdateRequest(playlist_watch_mode="last_n", playlist_watch_limit=0)
        assert False, "Expected ValueError for last_n with limit 0"
    except ValueError as exc:
        print(f"PASS: Rejection of last_n with 0 limit: {exc}")


def test_reconciler_skip_deletions():
    print()
    print("=" * 60)
    print("TEST 3: Reconciler Deletion Behavior")
    print("=" * 60)

    TestingSessionLocal = setup_in_memory_db()

    with TestingSessionLocal() as session:
        reconciler = PlaylistReconciler(session)

        # Populate with 3 initial songs
        initial_songs = [
            YouTubeSong("vid1", "Song 1", "Artist 1", "Album 1", 180, 1),
            YouTubeSong("vid2", "Song 2", "Artist 2", "Album 2", 200, 2),
            YouTubeSong("vid3", "Song 3", "Artist 3", "Album 3", 220, 3),
        ]
        reconciler.reconcile(
            playlist_url="https://youtube.com/playlist?list=test",
            youtube_playlist_id="test",
            playlist_name="Test",
            songs=initial_songs,
            skip_deletions=False,
        )

        all_songs = session.query(Song).all()
        assert len(all_songs) == 3

        # Simulate last_n scan discovering only vid3
        reconciler.reconcile(
            playlist_url="https://youtube.com/playlist?list=test",
            youtube_playlist_id="test",
            playlist_name="Test",
            songs=[YouTubeSong("vid3", "Song 3", "Artist 3", "Album 3", 220, 3)],
            skip_deletions=True, # last_n mode
        )

        all_songs_after_last_n = session.query(Song).all()
        assert len(all_songs_after_last_n) == 3, f"Expected 3 songs to remain, got {len(all_songs_after_last_n)}"
        print("PASS: last_n mode (skip_deletions=True) preserved existing songs not in scan window.")

        # Simulate whole mode scan discovering only vid3 (meaning vid1 and vid2 were removed from YT)
        reconciler.reconcile(
            playlist_url="https://youtube.com/playlist?list=test",
            youtube_playlist_id="test",
            playlist_name="Test",
            songs=[YouTubeSong("vid3", "Song 3", "Artist 3", "Album 3", 220, 3)],
            skip_deletions=False, # whole mode
        )

        all_songs_after_whole = session.query(Song).all()
        assert len(all_songs_after_whole) == 1, f"Expected 1 song to remain, got {len(all_songs_after_whole)}"
        assert all_songs_after_whole[0].youtube_video_id == "vid3"
        print("PASS: whole mode (skip_deletions=False) removed deleted songs as expected.")


def main():
    test_settings_defaults_and_updates()
    test_settings_api_validation()
    test_reconciler_skip_deletions()
    print()
    print("=" * 60)
    print("ALL CONFIGURABLE WATCHER TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
