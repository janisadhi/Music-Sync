"""
Tests for batch retry endpoints (retry-download and retry-lyrics).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.songs import router as songs_router
from app.database.models import Base, Playlist, Song
from app.database.session import get_db


def setup_test_app():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    app = FastAPI()
    app.include_router(songs_router)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return app, TestingSessionLocal


def test_batch_retry_download():
    app, TestingSessionLocal = setup_test_app()
    client = TestClient(app)
    db = TestingSessionLocal()

    playlist = Playlist(youtube_playlist_id="PL123", name="Test PL", url="http://example.com")
    db.add(playlist)
    db.commit()

    song1 = Song(playlist_id=playlist.id, youtube_video_id="v1", title="Song 1", download_status="failed", lyrics_status="pending")
    song2 = Song(playlist_id=playlist.id, youtube_video_id="v2", title="Song 2", download_status="pending", lyrics_status="pending")
    song3 = Song(playlist_id=playlist.id, youtube_video_id="v3", title="Song 3", download_status="downloaded", lyrics_status="pending")
    db.add_all([song1, song2, song3])
    db.commit()

    # Retry download for song1, song2, and song3
    resp = client.post("/songs/retry-download", json={"song_ids": [song1.id, song2.id, song3.id]})
    assert resp.status_code == 200
    data = resp.json()

    # song2 is already pending so it should be skipped. song1 and song3 should be queued.
    assert data["queued"] == 2
    assert data["skipped"] == 1
    assert data["total"] == 3

    db.refresh(song1)
    assert song1.download_status == "pending"
    db.close()


def test_batch_retry_lyrics():
    app, TestingSessionLocal = setup_test_app()
    client = TestClient(app)
    db = TestingSessionLocal()

    playlist = Playlist(youtube_playlist_id="PL123", name="Test PL", url="http://example.com")
    db.add(playlist)
    db.commit()

    # song1 downloaded + lyrics unavailable -> should queue
    song1 = Song(playlist_id=playlist.id, youtube_video_id="v1", title="Song 1", download_status="downloaded", lyrics_status="unavailable")
    # song2 not downloaded -> should skip
    song2 = Song(playlist_id=playlist.id, youtube_video_id="v2", title="Song 2", download_status="pending", lyrics_status="pending")
    # song3 downloaded + lyrics pending -> should skip (already pending)
    song3 = Song(playlist_id=playlist.id, youtube_video_id="v3", title="Song 3", download_status="downloaded", lyrics_status="pending")
    db.add_all([song1, song2, song3])
    db.commit()

    resp = client.post("/songs/retry-lyrics", json={"song_ids": [song1.id, song2.id, song3.id]})
    assert resp.status_code == 200
    data = resp.json()

    assert data["queued"] == 1
    assert data["skipped"] == 2
    assert data["total"] == 3

    db.refresh(song1)
    assert song1.lyrics_status == "pending"
    db.close()
