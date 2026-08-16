from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.auth import router as auth_router, ensure_admin_exists
from app.api.playlists import router as playlists_router
from app.api.songs import router as songs_router
from app.api.sync import router as sync_router
from app.api.dashboard import router as dashboard_router
from app.api.settings import router as settings_router
from app.api.metadata import router as metadata_router
from app.core.config import settings
from app.core.runtime import downloader_worker, lyrics_worker, scheduler
from app.database.session import Base, engine, SessionLocal
from app.settings.service import SettingsService


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("Starting Music Sync application")
    print("=" * 60)

    # ----------------------------------------------------------------
    # Seed the admin user if it doesn't exist yet.
    # ----------------------------------------------------------------
    try:
        with SessionLocal() as db:
            ensure_admin_exists(db)
    except Exception as exc:
        print(f"Could not seed admin user on startup: {exc}")

    # ----------------------------------------------------------------
    # Start the Downloader worker unconditionally.
    # Drains the pending audio download queue.
    # Independent of the Scheduler.
    # ----------------------------------------------------------------
    try:
        downloader_worker.start()
    except Exception as exc:
        print(f"Could not start Downloader worker on startup: {exc}")

    # ----------------------------------------------------------------
    # Start the Lyrics worker unconditionally.
    # Drains the pending lyrics queue (songs with download_status=downloaded
    # and lyrics_status=pending).
    # Independent of the Scheduler and Downloader.
    # ----------------------------------------------------------------
    try:
        lyrics_worker.start()
    except Exception as exc:
        print(f"Could not start Lyrics worker on startup: {exc}")

    # ----------------------------------------------------------------
    # Start the Scheduler only if auto_start is enabled.
    # The Scheduler's only job is to trigger SyncService periodically.
    # ----------------------------------------------------------------
    try:
        app_settings = SettingsService().get()
        if app_settings.auto_start_scheduler:
            print("Auto-starting Music Sync Scheduler on startup...")
            scheduler.start(run_immediately=False)
        else:
            print("Scheduler is stopped by default (auto-start disabled).")
    except Exception as exc:
        print(f"Could not load auto-start setting on startup: {exc}")

    yield

    # ----------------------------------------------------------------
    # Graceful shutdown — stop in reverse startup order.
    # ----------------------------------------------------------------
    print("=" * 60)
    print("Shutting down Music Sync application")
    print("=" * 60)

    scheduler.stop()
    downloader_worker.stop(timeout=30.0)
    lyrics_worker.stop(timeout=30.0)


app = FastAPI(
    title="Music Sync",
    description="Automatic YouTube Music playlist synchronization service",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(songs_router)
app.include_router(playlists_router)
app.include_router(sync_router)
app.include_router(dashboard_router)
app.include_router(settings_router)
app.include_router(metadata_router)


@app.get("/health")
def health_check():
    database_status = "ok"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_status = "error"

    return {
        "status": "ok" if database_status == "ok" else "degraded",
        "service": settings.app_name,
        "environment": settings.app_env,
        "database": database_status,
        "downloader_worker": downloader_worker.get_status(),
        "lyrics_worker": lyrics_worker.get_status(),
    }
