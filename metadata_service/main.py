import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine

from app.database.models import DownloadedTrack
from metadata_service.config import settings
from metadata_service.schemas import (
    ScanRequest,
    ScanJobStatus,
    MetadataStatusResponse,
    TrackResultsResponse,
    TrackMetadataItem,
    EnrichTrackResponse,
    TrackDetailResponse,
    MetadataHistoryItem,
)
from metadata_service.processor import MetadataProcessor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("metadata_service")

# DB session setup
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


processor = MetadataProcessor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.service_name} on port {settings.service_port}")
    yield
    logger.info(f"Shutting down {settings.service_name}")


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Music-Sync Metadata Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled metadata service error on {request.url}: {exc}")
    response = JSONResponse(
        status_code=500,
        content={"detail": f"Internal Metadata Service Error: {str(exc)}"},
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


import time

METADATA_START_TIME = time.time()


@app.get("/health", tags=["Health"])
def health_check():
    uptime_sec = int(time.time() - METADATA_START_TIME)
    return {
        "status": "ok",
        "service": settings.service_name,
        "uptime_seconds": uptime_sec,
    }



@app.post("/scan", response_model=ScanJobStatus, status_code=status.HTTP_202_ACCEPTED, tags=["Metadata"])
def start_scan(req: ScanRequest):
    """Triggers library metadata scan & autotag enrichment job."""
    try:
        job = processor.start_scan_job(force_reprocess=req.force_reprocess)
        return job
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/status", response_model=MetadataStatusResponse, tags=["Metadata"])
def get_status():
    """Returns current scan progress and library metadata metrics."""
    return processor.get_status()


@app.get("/results", response_model=TrackResultsResponse, tags=["Metadata"])
def get_results(
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    state: str | None = Query(None),
    beets_edited: bool | None = Query(None),
):
    """Returns paginated metadata track results."""
    query = db.query(DownloadedTrack)

    if state:
        query = query.filter(DownloadedTrack.metadata_state == state)
    if beets_edited is not None:
        query = query.filter(DownloadedTrack.beets_metadata_edited == beets_edited)

    total = query.count()
    tracks = (
        query.order_by(DownloadedTrack.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

def _to_track_item(t: DownloadedTrack) -> TrackMetadataItem:
    return TrackMetadataItem(
        id=t.id,
        song_id=t.song_id,
        youtube_video_id=t.youtube_video_id,
        file_path=t.file_path,
        title=t.title,
        artist=t.artist,
        album=t.album,
        album_artist=t.album_artist,
        genre=t.genre,
        track_number=t.track_number,
        duration_seconds=t.duration_seconds,
        release_year=t.release_year,
        musicbrainz_recording_id=getattr(t, "musicbrainz_recording_id", None),
        musicbrainz_artist_id=getattr(t, "musicbrainz_artist_id", None),
        musicbrainz_release_id=getattr(t, "musicbrainz_release_id", None),
        musicbrainz_release_group_id=getattr(t, "musicbrainz_release_group_id", None),
        acoustid_id=getattr(t, "acoustid_id", None),
        fingerprint=getattr(t, "fingerprint", None),
        spotify_track_id=getattr(t, "spotify_track_id", None),
        spotify_artist_id=getattr(t, "spotify_artist_id", None),
        spotify_album_id=getattr(t, "spotify_album_id", None),
        metadata_state=t.metadata_state,
        beets_metadata_edited=t.beets_metadata_edited,
        updated_at=t.updated_at,
    )


@app.get("/results", response_model=TrackResultsResponse, tags=["Metadata"])
def get_results(
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    state: str | None = Query(None),
    beets_edited: bool | None = Query(None),
):
    """Returns paginated metadata track results."""
    query = db.query(DownloadedTrack)

    if state:
        query = query.filter(DownloadedTrack.metadata_state == state)
    if beets_edited is not None:
        query = query.filter(DownloadedTrack.beets_metadata_edited == beets_edited)

    total = query.count()
    tracks = (
        query.order_by(DownloadedTrack.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = [_to_track_item(t) for t in tracks]

    return TrackResultsResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@app.post("/enrich/{track_id}", response_model=EnrichTrackResponse, tags=["Metadata"])
def enrich_track(
    track_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Triggers immediate Beets enrichment for a single track."""
    track = db.query(DownloadedTrack).filter(DownloadedTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail=f"DownloadedTrack {track_id} not found")

    success = processor.enrich_single_track(db, track)
    db.refresh(track)

    return EnrichTrackResponse(
        success=success,
        message="Enrichment completed" if success else "Enrichment failed or skipped",
        track=_to_track_item(track),
    )


@app.get("/tracks/{track_id}", response_model=TrackDetailResponse, tags=["Metadata"])
def get_track_detail(
    track_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Returns detailed track metadata, lyrics path, and change history."""
    import json
    from app.database.models import Song, TrackMetadataHistory

    track = db.query(DownloadedTrack).filter(DownloadedTrack.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail=f"DownloadedTrack {track_id} not found")

    song = db.query(Song).filter(Song.id == track.song_id).first()
    history_records = (
        db.query(TrackMetadataHistory)
        .filter(TrackMetadataHistory.downloaded_track_id == track_id)
        .order_by(TrackMetadataHistory.created_at.desc())
        .all()
    )

    track_item = _to_track_item(track)

    from metadata_service.normalizer import parse_youtube_title
    parsed_art, parsed_tit = parse_youtube_title(track.title)

    history_items = []
    for h in history_records:
        prev_meta = json.loads(h.previous_metadata) if h.previous_metadata else None
        new_meta = json.loads(h.new_metadata) if h.new_metadata else None
        history_items.append(
            MetadataHistoryItem(
                id=h.id,
                action=h.action,
                previous_metadata=prev_meta,
                new_metadata=new_meta,
                previous_filename=h.previous_filename,
                new_filename=h.new_filename,
                previous_lyrics_filename=h.previous_lyrics_filename,
                new_lyrics_filename=h.new_lyrics_filename,
                match_source=h.match_source,
                match_confidence=h.match_confidence,
                musicbrainz_recording_id=getattr(h, "musicbrainz_recording_id", None),
                musicbrainz_artist_id=getattr(h, "musicbrainz_artist_id", None),
                acoustid_id=getattr(h, "acoustid_id", None),
                spotify_track_id=getattr(h, "spotify_track_id", None),
                status=h.status,
                error_message=h.error_message,
                created_at=h.created_at,
            )
        )

    return TrackDetailResponse(
        track=track_item,
        lyrics_path=song.lyrics_path if song else None,
        parsed_artist=parsed_art,
        parsed_title=parsed_tit,
        history=history_items,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.service_port, reload=True)
