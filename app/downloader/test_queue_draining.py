"""
Queue-draining architecture tests.

Updated for new architecture:
  - Song model no longer has artist/album/duration fields
  - SongDownloader is decoupled from SyncService
"""

from unittest.mock import patch

from app.downloader.service import SongDownloader
from app.lyrics.service import LyricsService
from app.database.models import Song, Playlist
from app.database.session import SessionLocal, Base, engine


def setup_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        session.query(Song).delete()
        session.query(Playlist).delete()
        session.commit()


def fake_download_song(song: Song) -> bool:
    song.download_status = "downloaded"
    song.file_path = f"/tmp/fake_{song.id}.opus"
    return True


def fake_process_song(song: Song) -> bool:
    song.lyrics_status = "downloaded"
    song.lyrics_path = f"/tmp/fake_{song.id}.lrc"
    return True


def test_queue_draining_single_sync():
    print("=" * 60)
    print("TEST: Queue-Draining Architecture (Multiple Songs in Single Sync)")
    print("=" * 60)

    setup_db()

    with SessionLocal() as session:
        pl = Playlist(
            youtube_playlist_id="pl1",
            name="Test PL",
            url="https://youtube.com/playlist?list=pl1",
        )
        session.add(pl)
        session.flush()

        for i in range(1, 10):
            s = Song(
                playlist_id=pl.id,
                youtube_video_id=f"vid_{i}",
                title=f"Song {i}",
                download_status="pending",
                lyrics_status="pending",
            )
            session.add(s)
        session.commit()

    downloader = SongDownloader()

    with patch.object(downloader, "download_song", side_effect=fake_download_song):
        count = downloader.download_pending(limit=1, batch_size=3)

    assert count == 9, f"Expected 9 songs downloaded, got {count}"

    with SessionLocal() as session:
        pending_count = session.query(Song).filter(Song.download_status == "pending").count()
        downloaded_count = session.query(Song).filter(Song.download_status == "downloaded").count()

    assert pending_count == 0, "Queue should be completely empty"
    assert downloaded_count == 9, "All 9 songs should be marked downloaded"

    print("PASS: Entire pending queue was drained in a single sync.")


def test_stale_download_recovery():
    print()
    print("=" * 60)
    print("TEST: Stale Download Crash Recovery")
    print("=" * 60)

    setup_db()

    with SessionLocal() as session:
        pl = Playlist(
            youtube_playlist_id="pl1",
            name="Test PL",
            url="https://youtube.com/playlist?list=pl1",
        )
        session.add(pl)
        session.flush()

        stuck1 = Song(
            playlist_id=pl.id,
            youtube_video_id="stuck1",
            title="Stuck Song 1",
            download_status="downloading",
            lyrics_status="pending",
        )
        stuck2 = Song(
            playlist_id=pl.id,
            youtube_video_id="stuck2",
            title="Stuck Song 2",
            download_status="downloading",
            lyrics_status="pending",
        )
        session.add_all([stuck1, stuck2])
        session.commit()

    downloader = SongDownloader()
    recovered = downloader.recover_stale_downloads()

    assert recovered == 2, f"Expected 2 recovered songs, got {recovered}"

    with SessionLocal() as session:
        pending_count = session.query(Song).filter(Song.download_status == "pending").count()

    assert pending_count == 2, (
        "Stuck downloading songs without existing files should reset to pending"
    )

    print("PASS: Stale download recovery succeeded.")


def test_lyrics_queue_draining():
    print()
    print("=" * 60)
    print("TEST: Lyrics Queue Draining")
    print("=" * 60)

    setup_db()

    with SessionLocal() as session:
        pl = Playlist(
            youtube_playlist_id="pl1",
            name="Test PL",
            url="https://youtube.com/playlist?list=pl1",
        )
        session.add(pl)
        session.flush()

        for i in range(1, 6):
            s = Song(
                playlist_id=pl.id,
                youtube_video_id=f"vid_lrc_{i}",
                title=f"LRC Song {i}",
                download_status="downloaded",
                lyrics_status="pending",
                file_path=f"/tmp/fake_{i}.opus",
            )
            session.add(s)
        session.commit()

    lyrics = LyricsService()

    with patch.object(lyrics, "process_song", side_effect=fake_process_song):
        count = lyrics.process_pending(limit=1, batch_size=2)

    assert count == 5, f"Expected 5 lyrics processed, got {count}"

    with SessionLocal() as session:
        pending_lyrics = session.query(Song).filter(Song.lyrics_status == "pending").count()

    assert pending_lyrics == 0, "Lyrics queue should be completely empty"

    print("PASS: Entire pending lyrics queue was drained in a single sync.")


def main():
    test_queue_draining_single_sync()
    test_stale_download_recovery()
    test_lyrics_queue_draining()
    print()
    print("=" * 60)
    print("ALL QUEUE-DRAINING ARCHITECTURE TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
