"""
Tests for SongDownloader.

All tests use in-memory SQLite and in-process mocks — no real YouTube
requests are made.

Coverage:
  - Downloader is fully decoupled from SyncService / Scheduler
  - Successful download → Song.download_status='downloaded'
  - Successful download → DownloadedTrack record created (Music Library DB)
  - DownloadedTrack carries rich metadata (title, artist, album, …)
  - Failed download → retry fields set (exponential backoff)
  - Non-retryable error → status='failed', no next_download_attempt
  - Max retries reached → no further retry scheduled
  - Stale 'downloading' recovery
  - Queue draining: all pending songs processed
  - Concurrent Sync + Downloader: Downloader picks up songs inserted by
    an in-progress scan before the scan finishes
  - Downloader does NOT import SyncService
"""

import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import yt_dlp

from app.database.models import AppSettings, Base, DownloadedTrack, Playlist, Song
from app.downloader.service import SongDownloader


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def engine():
    e = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(e)
    return e


@pytest.fixture()
def Session(engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture()
def settings_row():
    return AppSettings(
        id=1,
        sync_interval_seconds=60,
        download_limit=2,
        lyrics_limit=1,
        max_download_retries=3,
        download_retry_delay_seconds=10,
        youtube_playlist_url=None,
        auto_start_scheduler=False,
        playlist_watch_mode="whole",
        playlist_watch_limit=None,
        delete_local_file_on_playlist_removal=False,
    )


@pytest.fixture()
def populated_db(Session, settings_row):
    """DB with one playlist and three pending songs."""
    with Session() as s:
        s.add(settings_row)
        pl = Playlist(
            youtube_playlist_id="pl1",
            name="Test Playlist",
            url="https://youtube.com/playlist?list=pl1",
            enabled=True,
        )
        s.add(pl)
        s.flush()

        for i in range(1, 4):
            s.add(Song(
                playlist_id=pl.id,
                youtube_video_id=f"vid{i}",
                title=f"Song {i}",
                position=i,
                download_status="pending",
                lyrics_status="pending",
            ))
        s.commit()


def _make_downloader(Session, settings_row):
    """Downloader with patched SessionLocal and SettingsService."""
    downloader = SongDownloader()
    downloader.settings_service = MagicMock()
    downloader.settings_service.get.return_value = settings_row
    return downloader


def _fake_success(song: Song) -> bool:
    """Simulate a successful download without touching yt-dlp."""
    song.download_status = "downloaded"
    song.file_path = f"/tmp/fake_{song.youtube_video_id}.opus"
    return True


def _fake_fail(song: Song) -> bool:
    """Simulate a retryable failure."""
    song.download_status = "failed"
    song.download_retry_count += 1
    song.error_message = "Controlled retryable failure"
    song.next_download_attempt = datetime.now(timezone.utc) + timedelta(hours=1)
    return False


# ---------------------------------------------------------------------------
# Architecture contract
# ---------------------------------------------------------------------------

class TestDownloaderArchitectureContract:
    def test_downloader_does_not_import_sync_service(self):
        """SongDownloader must not import SyncService."""
        import app.downloader.service as mod
        assert not hasattr(mod, "SyncService"), (
            "Downloader must not depend on SyncService. "
            "They communicate through the DB only."
        )

    def test_downloader_does_not_import_scheduler(self):
        """SongDownloader must not import MusicSyncScheduler."""
        import app.downloader.service as mod
        assert not hasattr(mod, "MusicSyncScheduler")


# ---------------------------------------------------------------------------
# Successful download
# ---------------------------------------------------------------------------

class TestSuccessfulDownload:
    def test_download_status_set_to_downloaded(self, Session, settings_row):
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            song = Song(
                playlist_id=pl.id, youtube_video_id="vid1",
                title="Test Song", position=1,
                download_status="pending", lyrics_status="pending",
            )
            s.add(song)
            s.commit()
            song_id = song.id

        downloader = _make_downloader(Session, settings_row)

        with patch("app.downloader.service.SessionLocal", Session):
            with patch.object(downloader, "download_song", side_effect=_fake_success):
                downloader.download_pending(limit=1)

        with Session() as s:
            result = s.get(Song, song_id)
            assert result.download_status == "downloaded"
            assert result.file_path is not None

    def test_downloaded_track_created_after_successful_download(
        self, Session, settings_row, tmp_path
    ):
        """
        After a real download, a DownloadedTrack row must be created
        with the rich metadata from yt-dlp.
        """
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            song = Song(
                playlist_id=pl.id, youtube_video_id="vid1",
                title="Test Song", position=1,
                download_status="pending", lyrics_status="pending",
            )
            s.add(song)
            s.commit()
            song_id = song.id

        fake_audio = tmp_path / "test.opus"
        fake_audio.write_bytes(b"fake audio content")

        fake_info = {
            "title": "Real Track Title",
            "artist": "Real Artist",
            "album": "Real Album",
            "album_artist": "Real Album Artist",
            "genre": "Pop",
            "duration": 210,
            "upload_date": "20240101",
            "thumbnail": "https://example.com/thumb.jpg",
        }

        downloader = _make_downloader(Session, settings_row)

        with Session() as s:
            song = s.get(Song, song_id)
            # Manually set state to simulate a successful yt-dlp download.
            song.download_status = "downloaded"
            song.file_path = str(fake_audio)
            s.flush()
            downloader._upsert_downloaded_track(song, fake_info, fake_audio)
            s.commit()

        with Session() as s:
            track = s.scalar(
                select(DownloadedTrack).where(DownloadedTrack.song_id == song_id)
            )
            assert track is not None
            assert track.title == "Real Track Title"
            assert track.artist == "Real Artist"
            assert track.album == "Real Album"
            assert track.album_artist == "Real Album Artist"
            assert track.genre == "Pop"
            assert track.duration_seconds == 210
            assert track.release_year == 2024
            assert track.thumbnail_url == "https://example.com/thumb.jpg"
            assert track.artwork_embedded is True
            assert track.metadata_state == "raw"
            assert track.file_format == "opus"

    def test_downloaded_track_upsertion_idempotent(self, Session, settings_row, tmp_path):
        """Calling _upsert_downloaded_track twice must not create a duplicate row."""
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            song = Song(
                playlist_id=pl.id, youtube_video_id="vid1",
                title="Song", position=1,
                download_status="downloaded", lyrics_status="pending",
            )
            s.add(song)
            s.commit()
            song_id = song.id

        fake_audio = tmp_path / "song.opus"
        fake_audio.write_bytes(b"audio")
        info = {"title": "Title", "duration": 100}

        downloader = _make_downloader(Session, settings_row)

        with Session() as s:
            song = s.get(Song, song_id)
            downloader._upsert_downloaded_track(song, info, fake_audio)
            s.commit()

        with Session() as s:
            song = s.get(Song, song_id)
            downloader._upsert_downloaded_track(song, info, fake_audio)
            s.commit()

        with Session() as s:
            count = s.query(DownloadedTrack).filter_by(song_id=song_id).count()
            assert count == 1


# ---------------------------------------------------------------------------
# Retry logic
# ---------------------------------------------------------------------------

class TestRetryLogic:
    def test_retryable_error_increments_retry_count(self, Session, settings_row):
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            song = Song(
                playlist_id=pl.id, youtube_video_id="vid1",
                title="Song", position=1,
                download_status="pending", lyrics_status="pending",
            )
            s.add(song)
            s.commit()

            downloader = _make_downloader(Session, settings_row)

            class FakeYDL:
                def __init__(self, *a, **kw): pass
                def __enter__(self): return self
                def __exit__(self, *a): return False
                def extract_info(self, *a, **kw):
                    raise yt_dlp.utils.DownloadError("Network error")

            with patch("yt_dlp.YoutubeDL", side_effect=FakeYDL):
                with patch("app.downloader.service.get_playlist_music_root",
                           return_value=Path("/tmp")):
                    result = downloader.download_song(song)

            assert result is False
            assert song.download_status == "failed"
            assert song.download_retry_count == 1
            assert song.next_download_attempt is not None

    def test_non_retryable_error_no_retry_scheduled(self, Session, settings_row):
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            song = Song(
                playlist_id=pl.id, youtube_video_id="vid_priv",
                title="Private Song", position=1,
                download_status="pending", lyrics_status="pending",
            )
            s.add(song)
            s.commit()

            downloader = _make_downloader(Session, settings_row)

            class FakeYDLPrivate:
                def __init__(self, *a, **kw): pass
                def __enter__(self): return self
                def __exit__(self, *a): return False
                def extract_info(self, *a, **kw):
                    raise yt_dlp.utils.DownloadError("video unavailable")

            with patch("yt_dlp.YoutubeDL", side_effect=FakeYDLPrivate):
                with patch("app.downloader.service.get_playlist_music_root",
                           return_value=Path("/tmp")):
                    result = downloader.download_song(song)

            assert result is False
            assert song.download_status == "unavailable"
            assert song.download_retry_count == 0
            assert song.next_download_attempt is None

    def test_exponential_backoff_delay(self, settings_row):
        downloader = _make_downloader(None, settings_row)
        before = datetime.now(timezone.utc)

        t1 = downloader._calculate_retry_time(1, 10)
        t2 = downloader._calculate_retry_time(2, 10)
        t3 = downloader._calculate_retry_time(3, 10)

        assert 9 <= (t1 - before).total_seconds() <= 11
        assert 19 <= (t2 - before).total_seconds() <= 21
        assert 39 <= (t3 - before).total_seconds() <= 41

    def test_max_retries_clears_next_attempt(self, Session, settings_row):
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            song = Song(
                playlist_id=pl.id, youtube_video_id="vid1",
                title="Song", position=1,
                download_status="failed",
                download_retry_count=2,  # one below max (max=3)
                lyrics_status="pending",
            )
            s.add(song)
            s.commit()

            downloader = _make_downloader(Session, settings_row)

            class FakeYDLError:
                def __init__(self, *a, **kw): pass
                def __enter__(self): return self
                def __exit__(self, *a): return False
                def extract_info(self, *a, **kw):
                    raise yt_dlp.utils.DownloadError("Timeout")

            with patch("yt_dlp.YoutubeDL", side_effect=FakeYDLError):
                with patch("app.downloader.service.get_playlist_music_root",
                           return_value=Path("/tmp")):
                    downloader.download_song(song)

            # retry_count goes from 2 → 3 = max → no next attempt
            assert song.download_retry_count == 3
            assert song.next_download_attempt is None


# ---------------------------------------------------------------------------
# Stale download recovery
# ---------------------------------------------------------------------------

class TestStaleRecovery:
    def test_stuck_song_without_file_reset_to_pending(self, Session, settings_row):
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            stuck = Song(
                playlist_id=pl.id, youtube_video_id="vid_stuck",
                title="Stuck Song", position=1,
                download_status="downloading", lyrics_status="pending",
            )
            s.add(stuck)
            s.commit()
            stuck_id = stuck.id

        downloader = _make_downloader(Session, settings_row)

        with patch("app.downloader.service.SessionLocal", Session):
            recovered = downloader.recover_stale_downloads()

        assert recovered == 1
        with Session() as s:
            result = s.get(Song, stuck_id)
            assert result.download_status == "pending"

    def test_stuck_song_with_valid_file_marked_downloaded(
        self, Session, settings_row, tmp_path
    ):
        audio = tmp_path / "song.opus"
        audio.write_bytes(b"real audio content")

        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            stuck = Song(
                playlist_id=pl.id, youtube_video_id="vid_stuck",
                title="Stuck Song", position=1,
                download_status="downloading",
                file_path=str(audio),
                lyrics_status="pending",
            )
            s.add(stuck)
            s.commit()
            stuck_id = stuck.id

        downloader = _make_downloader(Session, settings_row)

        with patch("app.downloader.service.SessionLocal", Session):
            recovered = downloader.recover_stale_downloads()

        assert recovered == 1
        with Session() as s:
            result = s.get(Song, stuck_id)
            assert result.download_status == "downloaded"


# ---------------------------------------------------------------------------
# Queue draining
# ---------------------------------------------------------------------------

class TestQueueDraining:
    def test_all_pending_songs_processed(self, Session, settings_row):
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            for i in range(1, 8):
                s.add(Song(
                    playlist_id=pl.id, youtube_video_id=f"vid{i}",
                    title=f"Song {i}", position=i,
                    download_status="pending", lyrics_status="pending",
                ))
            s.commit()

        downloader = SongDownloader()
        downloader.settings_service = MagicMock()
        downloader.settings_service.get.return_value = settings_row

        with patch("app.downloader.service.SessionLocal", Session):
            with patch.object(downloader, "download_song", side_effect=_fake_success):
                count = downloader.download_pending(limit=1, batch_size=3)

        assert count == 7

        with Session() as s:
            pending = s.query(Song).filter_by(download_status="pending").count()
            downloaded = s.query(Song).filter_by(download_status="downloaded").count()

        assert pending == 0
        assert downloaded == 7

    def test_failed_retryable_songs_picked_up_when_due(self, Session, settings_row):
        now = datetime.now(timezone.utc)
        past = now - timedelta(seconds=5)

        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            s.add(Song(
                playlist_id=pl.id, youtube_video_id="vid_retry",
                title="Retry Song", position=1,
                download_status="failed",
                download_retry_count=1,
                next_download_attempt=past,
                lyrics_status="pending",
            ))
            s.commit()

        downloader = SongDownloader()
        downloader.settings_service = MagicMock()
        downloader.settings_service.get.return_value = settings_row

        with patch("app.downloader.service.SessionLocal", Session):
            with patch.object(downloader, "download_song", side_effect=_fake_success):
                count = downloader.download_pending(limit=1)

        assert count == 1

    def test_failed_songs_not_yet_due_are_skipped(self, Session, settings_row):
        future = datetime.now(timezone.utc) + timedelta(hours=1)

        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.flush()
            s.add(Song(
                playlist_id=pl.id, youtube_video_id="vid_future",
                title="Future Song", position=1,
                download_status="failed",
                download_retry_count=1,
                next_download_attempt=future,
                lyrics_status="pending",
            ))
            s.commit()

        downloader = SongDownloader()
        downloader.settings_service = MagicMock()
        downloader.settings_service.get.return_value = settings_row

        with patch("app.downloader.service.SessionLocal", Session):
            with patch.object(downloader, "download_song", side_effect=_fake_success):
                count = downloader.download_pending(limit=1)

        assert count == 0


# ---------------------------------------------------------------------------
# Concurrency: Downloader sees songs inserted mid-scan
# ---------------------------------------------------------------------------

class TestConcurrency:
    def test_downloader_can_pick_up_songs_before_scan_finishes(
        self, Session, settings_row
    ):
        """
        Simulates: Sync inserts song A and commits, then continues scanning.
        Downloader picks up song A immediately without waiting for Sync to finish.

        Implementation: we manually insert one song, run the Downloader,
        then insert another song, run the Downloader again — each pass should
        download exactly one song.
        """
        with Session() as s:
            s.add(settings_row)
            pl = Playlist(
                youtube_playlist_id="pl1", name="PL",
                url="http://example.com", enabled=True,
            )
            s.add(pl)
            s.commit()
            pl_id = pl.id

        downloader = SongDownloader()
        downloader.settings_service = MagicMock()
        downloader.settings_service.get.return_value = settings_row

        # Sync inserts song 1 and commits (simulating incremental reconciler).
        with Session() as s:
            s.add(Song(
                playlist_id=pl_id, youtube_video_id="vid1",
                title="Song 1", position=1,
                download_status="pending", lyrics_status="pending",
            ))
            s.commit()

        # Downloader runs concurrently and picks up song 1.
        with patch("app.downloader.service.SessionLocal", Session):
            with patch.object(downloader, "download_song", side_effect=_fake_success):
                count1 = downloader.download_pending(limit=1)

        assert count1 == 1

        # Sync continues and inserts song 2.
        with Session() as s:
            s.add(Song(
                playlist_id=pl_id, youtube_video_id="vid2",
                title="Song 2", position=2,
                download_status="pending", lyrics_status="pending",
            ))
            s.commit()

        # Downloader picks up song 2 without knowing about the full playlist.
        with patch("app.downloader.service.SessionLocal", Session):
            with patch.object(downloader, "download_song", side_effect=_fake_success):
                count2 = downloader.download_pending(limit=1)

        assert count2 == 1

        with Session() as s:
            downloaded = s.query(Song).filter_by(download_status="downloaded").count()
        assert downloaded == 2
