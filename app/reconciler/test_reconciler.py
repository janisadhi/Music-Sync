"""
Tests for PlaylistReconciler.

All tests use an in-memory SQLite database — no PostgreSQL required.

Coverage:
  - New song: inserted with download_status='pending'
  - Existing song: title/position updated; status not reset
  - Unavailable song: inserted/updated with download_status='unavailable'
  - Previously unavailable → accessible again: reset to pending
  - Removed song (whole mode): Song row deleted
  - Removed song with delete_local_file=True: audio + lyrics files deleted
  - Removed song with delete_local_file=False: files kept on disk
  - skip_deletions=True (last_n mode): old songs not removed
  - Incremental commit: each item committed before the next is processed
  - Composite unique constraint prevents duplicate (playlist_id, video_id)
"""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, DownloadedTrack, Playlist, Song
from app.reconciler.service import PlaylistReconciler
from app.watcher.youtube import UnavailableYouTubeSong, YouTubeSong


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def session():
    """In-memory SQLite session, fresh per test."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as s:
        yield s


def make_song(video_id: str, title: str = None, position: int = None) -> YouTubeSong:
    s = YouTubeSong(
        video_id=video_id,
        title=title or f"Title {video_id}",
        position=position,
    )
    return s


def make_unavail(video_id: str, reason: str = "Private", position: int = None) -> UnavailableYouTubeSong:
    return UnavailableYouTubeSong(
        video_id=video_id,
        reason=reason,
        position=position,
    )


def _reconcile(session, items, *, skip_deletions=False, delete_local=False):
    """Helper: run reconciler with standard test playlist."""
    r = PlaylistReconciler(session)
    return r.reconcile(
        playlist_url="https://youtube.com/playlist?list=pl1",
        youtube_playlist_id="pl1",
        playlist_name="Test Playlist",
        songs=items,
        skip_deletions=skip_deletions,
        delete_local_file_on_removal=delete_local,
    )


# ---------------------------------------------------------------------------
# New song
# ---------------------------------------------------------------------------

class TestNewSong:
    def test_new_song_inserted_as_pending(self, session):
        new = _reconcile(session, [make_song("vid1", "My Song", 1)])

        assert len(new) == 1
        assert new[0].youtube_video_id == "vid1"
        assert new[0].download_status == "pending"
        assert new[0].lyrics_status == "pending"

    def test_new_song_carries_correct_title_and_position(self, session):
        _reconcile(session, [make_song("vid1", "Great Track", 42)])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        assert song.title == "Great Track"
        assert song.position == 42

    def test_multiple_new_songs(self, session):
        items = [make_song(f"vid{i}", f"Song {i}", i) for i in range(1, 6)]
        new = _reconcile(session, items)
        assert len(new) == 5

    def test_new_song_playlist_created_if_missing(self, session):
        _reconcile(session, [make_song("vid1")])
        pl = session.scalar(
            select(Playlist).where(Playlist.youtube_playlist_id == "pl1")
        )
        assert pl is not None
        assert pl.name == "Test Playlist"

    def test_second_run_does_not_duplicate(self, session):
        """Calling reconcile twice with the same video_id must not create duplicates."""
        _reconcile(session, [make_song("vid1")])
        _reconcile(session, [make_song("vid1")])  # second pass – same item
        count = session.query(Song).filter_by(youtube_video_id="vid1").count()
        assert count == 1


# ---------------------------------------------------------------------------
# Existing song
# ---------------------------------------------------------------------------

class TestExistingSong:
    def test_title_and_position_updated(self, session):
        _reconcile(session, [make_song("vid1", "Old Title", 1)])

        _reconcile(session, [make_song("vid1", "New Title", 99)])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        assert song.title == "New Title"
        assert song.position == 99

    def test_download_status_not_reset(self, session):
        """Once a song is downloaded, re-scanning must not reset it to pending."""
        _reconcile(session, [make_song("vid1")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        song.download_status = "downloaded"
        session.commit()

        _reconcile(session, [make_song("vid1")])

        session.refresh(song)
        assert song.download_status == "downloaded"

    def test_existing_song_not_in_new_list(self, session):
        """Existing song returned by reconcile as 'new' only on first insertion."""
        new1 = _reconcile(session, [make_song("vid1")])
        assert len(new1) == 1

        new2 = _reconcile(session, [make_song("vid1")])
        assert len(new2) == 0


# ---------------------------------------------------------------------------
# Unavailable songs
# ---------------------------------------------------------------------------

class TestUnavailableSongs:
    def test_new_unavailable_inserted_with_unavailable_status(self, session):
        _reconcile(session, [make_unavail("vid_priv", "Private video")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid_priv"))
        assert song is not None
        assert song.download_status == "unavailable"
        assert song.lyrics_status == "unavailable"

    def test_unavailable_song_not_in_new_list(self, session):
        """Unavailable items must not appear in the 'new songs' return value."""
        new = _reconcile(session, [make_unavail("vid_priv")])
        assert len(new) == 0

    def test_unavailable_error_message_stored(self, session):
        _reconcile(session, [make_unavail("vid_del", "Video deleted by uploader")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid_del"))
        assert "Video deleted" in (song.error_message or "")

    def test_existing_pending_song_marked_unavailable(self, session):
        """If a previously pending song becomes unavailable, mark it."""
        _reconcile(session, [make_song("vid1")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        assert song.download_status == "pending"

        _reconcile(session, [make_unavail("vid1", "Video was removed")])

        session.refresh(song)
        assert song.download_status == "unavailable"

    def test_unavailable_remains_unavailable_during_rescan(self, session):
        """Unavailable songs must remain unavailable during sync scans until manually reset by user."""
        _reconcile(session, [make_unavail("vid1", "Private")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        assert song.download_status == "unavailable"

        _reconcile(session, [make_song("vid1", "Back online")])

        session.refresh(song)
        assert song.download_status == "unavailable"

    def test_downloaded_song_not_overwritten_by_unavailable(self, session):
        """A downloaded song must stay 'downloaded' even if seen as unavailable."""
        _reconcile(session, [make_song("vid1")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        song.download_status = "downloaded"
        session.commit()

        _reconcile(session, [make_unavail("vid1", "Region restricted")])

        session.refresh(song)
        # The song is already downloaded – must not be downgraded.
        assert song.download_status == "downloaded"

    def test_mixed_available_and_unavailable(self, session):
        items = [
            make_song("vid1", "Good Song", 1),
            make_unavail("vid_priv", "Private", 2),
            make_song("vid3", "Another Good Song", 3),
        ]
        new = _reconcile(session, items)

        assert len(new) == 2
        songs = session.scalars(select(Song)).all()
        assert len(songs) == 3

        priv = session.scalar(select(Song).where(Song.youtube_video_id == "vid_priv"))
        assert priv.download_status == "unavailable"

    def test_scanner_produces_record_for_each_unavailable_entry(self, session):
        """Every unavailable entry gets its own Song row in the Sync DB."""
        items = [
            make_unavail("v_priv", "[Private video]"),
            make_unavail("v_del", "[Deleted video]"),
            make_unavail("v_unavail", "[Unavailable video]"),
        ]
        _reconcile(session, items)

        count = session.query(Song).count()
        assert count == 3


# ---------------------------------------------------------------------------
# Removed songs
# ---------------------------------------------------------------------------

class TestRemovedSongs:
    def test_removed_song_deleted_in_whole_mode(self, session):
        """Song absent from a whole-mode scan is deleted from Sync DB."""
        _reconcile(session, [make_song("vid1"), make_song("vid2")])
        assert session.query(Song).count() == 2

        # Second scan only sees vid1 – vid2 was removed from YouTube playlist.
        _reconcile(session, [make_song("vid1")])

        assert session.query(Song).count() == 1
        remaining = session.scalar(select(Song))
        assert remaining.youtube_video_id == "vid1"

    def test_removed_song_kept_in_last_n_mode(self, session):
        """skip_deletions=True (last_n mode) keeps songs outside scan window."""
        _reconcile(session, [make_song("vid1"), make_song("vid2"), make_song("vid3")])

        # last_n scan only discovers vid3 – vid1/vid2 should be preserved.
        _reconcile(session, [make_song("vid3")], skip_deletions=True)

        assert session.query(Song).count() == 3

    def test_removal_with_delete_local_true_deletes_files(self, session, tmp_path):
        """
        delete_local_file=True: audio and lyrics files are unlinked.
        """
        # Set up song with real temp files.
        audio_file = tmp_path / "song.opus"
        lyrics_file = tmp_path / "song.lrc"
        audio_file.write_bytes(b"fake audio")
        lyrics_file.write_text("[00:00.00] test")

        _reconcile(session, [make_song("vid1"), make_song("vid2")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        song.file_path = str(audio_file)
        song.lyrics_path = str(lyrics_file)
        song.download_status = "downloaded"
        session.commit()

        # Now vid1 is removed from the YouTube playlist.
        _reconcile(session, [make_song("vid2")], delete_local=True)

        assert not audio_file.exists(), "Audio file should have been deleted"
        assert not lyrics_file.exists(), "Lyrics file should have been deleted"
        assert session.query(Song).filter_by(youtube_video_id="vid1").count() == 0

    def test_removal_with_delete_local_false_keeps_files(self, session, tmp_path):
        """
        delete_local_file=False: local files are NOT deleted; only DB row removed.
        """
        audio_file = tmp_path / "song.opus"
        audio_file.write_bytes(b"fake audio")

        _reconcile(session, [make_song("vid1"), make_song("vid2")])

        song = session.scalar(select(Song).where(Song.youtube_video_id == "vid1"))
        song.file_path = str(audio_file)
        song.download_status = "downloaded"
        session.commit()

        _reconcile(session, [make_song("vid2")], delete_local=False)

        # File stays on disk.
        assert audio_file.exists(), "Audio file must be kept when flag is False"
        # DB row is removed.
        assert session.query(Song).filter_by(youtube_video_id="vid1").count() == 0


# ---------------------------------------------------------------------------
# Incremental commit (concurrency behaviour)
# ---------------------------------------------------------------------------

class TestIncrementalCommit:
    def test_each_item_committed_individually(self, session):
        """
        Reconciler commits after each item so the Downloader can pick up
        new songs before the full playlist scan completes.

        We verify this by hooking commit() and checking the Song count
        after each call.
        """
        commit_counts: list[int] = []
        original_commit = session.commit

        def counting_commit():
            original_commit()
            count = session.query(Song).count()
            commit_counts.append(count)

        items = [make_song(f"vid{i}") for i in range(1, 4)]

        with patch.object(session, "commit", side_effect=counting_commit):
            _reconcile(session, items)

        # After the first commit there should be ≥ 1 song, etc.
        # (There is also a final commit for removals.)
        assert len(commit_counts) >= 3, (
            "Expected at least one commit per playlist item"
        )
        # The count should increase monotonically.
        for i in range(1, len(commit_counts)):
            assert commit_counts[i] >= commit_counts[i - 1]


# ---------------------------------------------------------------------------
# Playlist upsert
# ---------------------------------------------------------------------------

class TestPlaylistUpsert:
    def test_playlist_name_updated_on_rescan(self, session):
        _reconcile(session, [make_song("vid1")])

        # Simulate playlist rename.
        r = PlaylistReconciler(session)
        r.reconcile(
            playlist_url="https://youtube.com/playlist?list=pl1",
            youtube_playlist_id="pl1",
            playlist_name="Renamed Playlist",
            songs=[make_song("vid1")],
        )

        pl = session.scalar(select(Playlist).where(Playlist.youtube_playlist_id == "pl1"))
        assert pl.name == "Renamed Playlist"
