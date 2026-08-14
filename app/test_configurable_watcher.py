"""
Tests for configurable watch settings and reconciler skip-deletion behaviour.

Updated for new architecture:
  - YouTubeSong no longer accepts artist/album/duration at construction time
    (those fields are populated by the Downloader, not during scanning).
  - Reconciler no longer stores artist/album/duration on Song rows.
"""

from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, AppSettings, Playlist, Song
from app.settings.service import SettingsService
from app.reconciler.service import PlaylistReconciler
from app.watcher.youtube import YouTubeSong


# Import SettingsUpdateRequest lazily to avoid pulling in app.core.runtime
# (which starts the scheduler singleton) during plain test collection.
def _get_settings_update_request():
    from app.api.settings import SettingsUpdateRequest
    return SettingsUpdateRequest


def setup_in_memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def make_song(video_id: str, title: str = "Song", position: int = 1) -> YouTubeSong:
    return YouTubeSong(video_id=video_id, title=title, position=position)


def test_settings_defaults_and_updates():
    print("=" * 60)
    print("TEST 1: Settings Defaults and Updates")
    print("=" * 60)

    TestingSessionLocal = setup_in_memory_db()

    with patch("app.settings.service.SessionLocal", TestingSessionLocal):
        service = SettingsService()

        settings = service.get()
        assert settings.playlist_watch_mode == "whole"
        assert settings.playlist_watch_limit is None
        print("PASS: Default watch settings are mode='whole', limit=None")

        updated = service.update(
            playlist_watch_mode="last_n",
            playlist_watch_limit=10,
        )
        assert updated.playlist_watch_mode == "last_n"
        assert updated.playlist_watch_limit == 10
        print("PASS: Updated to mode='last_n', limit=10 successfully")

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

    SettingsUpdateRequest = _get_settings_update_request()

    req1 = SettingsUpdateRequest(playlist_watch_mode="whole")
    assert req1.playlist_watch_mode == "whole"
    assert req1.playlist_watch_limit is None
    print("PASS: Valid 'whole' request validates cleanly.")

    req2 = SettingsUpdateRequest(playlist_watch_mode="last_n", playlist_watch_limit=10)
    assert req2.playlist_watch_mode == "last_n"
    assert req2.playlist_watch_limit == 10
    print("PASS: Valid 'last_n' + 10 request validates cleanly.")

    try:
        SettingsUpdateRequest(playlist_watch_mode="last_n", playlist_watch_limit=None)
        assert False, "Expected ValueError for last_n without limit"
    except ValueError as exc:
        print(f"PASS: Rejection of last_n without limit: {exc}")

    try:
        SettingsUpdateRequest(playlist_watch_mode="last_n", playlist_watch_limit=0)
        assert False, "Expected ValueError for last_n with limit 0"
    except ValueError as exc:
        print(f"PASS: Rejection of last_n with 0 limit: {exc}")


def test_reconciler_skip_deletions():
    print()
    print("=" * 60)
    print("TEST 3: Reconciler Deletion Behaviour")
    print("=" * 60)

    TestingSessionLocal = setup_in_memory_db()

    with TestingSessionLocal() as session:
        reconciler = PlaylistReconciler(session)

        initial_songs = [
            make_song("vid1", "Song 1", 1),
            make_song("vid2", "Song 2", 2),
            make_song("vid3", "Song 3", 3),
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

        # Simulate last_n scan discovering only vid3.
        reconciler.reconcile(
            playlist_url="https://youtube.com/playlist?list=test",
            youtube_playlist_id="test",
            playlist_name="Test",
            songs=[make_song("vid3", "Song 3", 3)],
            skip_deletions=True,
        )

        all_songs_after_last_n = session.query(Song).all()
        assert len(all_songs_after_last_n) == 3, (
            f"Expected 3 songs to remain, got {len(all_songs_after_last_n)}"
        )
        print("PASS: last_n mode (skip_deletions=True) preserved existing songs.")

        # Simulate whole mode scan discovering only vid3.
        reconciler.reconcile(
            playlist_url="https://youtube.com/playlist?list=test",
            youtube_playlist_id="test",
            playlist_name="Test",
            songs=[make_song("vid3", "Song 3", 3)],
            skip_deletions=False,
        )

        all_songs_after_whole = session.query(Song).all()
        assert len(all_songs_after_whole) == 1, (
            f"Expected 1 song to remain, got {len(all_songs_after_whole)}"
        )
        assert all_songs_after_whole[0].youtube_video_id == "vid3"
        print("PASS: whole mode (skip_deletions=False) removed deleted songs.")


def test_delete_local_file_setting():
    print()
    print("=" * 60)
    print("TEST 4: delete_local_file_on_playlist_removal Setting")
    print("=" * 60)

    TestingSessionLocal = setup_in_memory_db()

    with patch("app.settings.service.SessionLocal", TestingSessionLocal):
        service = SettingsService()

        settings = service.get()
        assert settings.delete_local_file_on_playlist_removal is False
        print("PASS: Default delete_local_file_on_playlist_removal is False")

        updated = service.update(delete_local_file_on_playlist_removal=True)
        assert updated.delete_local_file_on_playlist_removal is True
        print("PASS: Setting can be enabled")

        updated2 = service.update(delete_local_file_on_playlist_removal=False)
        assert updated2.delete_local_file_on_playlist_removal is False
        print("PASS: Setting can be disabled")


def main():
    test_settings_defaults_and_updates()
    test_settings_api_validation()
    test_reconciler_skip_deletions()
    test_delete_local_file_setting()
    print()
    print("=" * 60)
    print("ALL CONFIGURABLE WATCHER TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
