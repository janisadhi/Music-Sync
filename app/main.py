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

from app.api.rslsync import router as rslsync_router
from app.rslsync.service import resilio_service

app.include_router(auth_router)
app.include_router(songs_router)
app.include_router(playlists_router)
app.include_router(sync_router)
app.include_router(dashboard_router)
app.include_router(settings_router)
app.include_router(metadata_router)
app.include_router(rslsync_router)


import os
import time
import httpx

START_TIME = time.time()


def format_uptime(seconds: float) -> str:
    total_seconds = int(seconds)
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, secs = divmod(remainder, 60)

    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0 or days > 0:
        parts.append(f"{hours}h")
    if minutes > 0 or hours > 0 or days > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)


@app.get("/health")
async def health_check():
    # 1. Backend Status & Uptime
    backend_uptime_str = format_uptime(time.time() - START_TIME)

    # 2. Database Status & Uptime
    db_status = "running"
    db_uptime_str = None
    try:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT pg_postmaster_start_time()")).scalar()
            if row and hasattr(row, "timestamp"):
                start_ts = row.timestamp()
                db_uptime_str = format_uptime(time.time() - start_ts)
            else:
                db_uptime_str = backend_uptime_str
    except Exception:
        db_status = "stopped"
        db_uptime_str = "N/A"

    # 3. Metadata Service Status & Uptime
    metadata_status = "running"
    metadata_uptime_str = None
    try:
        metadata_url = os.getenv("METADATA_SERVICE_URL", "http://metadata:8001")
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{metadata_url}/health")
            if resp.status_code == 200:
                data = resp.json()
                sec = data.get("uptime_seconds")
                if sec is not None:
                    metadata_uptime_str = format_uptime(sec)
                else:
                    metadata_uptime_str = backend_uptime_str
            else:
                metadata_status = "stopped"
                metadata_uptime_str = "N/A"
    except Exception:
        metadata_status = "stopped"
        metadata_uptime_str = "N/A"

    # 4. Resilio Sync Service Status & Uptime
    rslsync_status = "running"
    rslsync_uptime_str = None
    try:
        rsl_overview = await resilio_service.get_overview()
        if rsl_overview.status.connected:
            rslsync_status = "running"
            rslsync_uptime_str = backend_uptime_str
        else:
            rslsync_status = "stopped"
            rslsync_uptime_str = "N/A"
    except Exception:
        rslsync_status = "stopped"
        rslsync_uptime_str = "N/A"

    all_running = (db_status == "running" and metadata_status == "running")

    return {
        "status": "ok" if all_running else "degraded",
        "services": {
            "backend": {
                "name": "Backend Service",
                "status": "running",
                "uptime": backend_uptime_str,
            },
            "frontend": {
                "name": "Frontend Dashboard",
                "status": "running",
                "uptime": backend_uptime_str,
            },
            "metadata": {
                "name": "Metadata Service",
                "status": metadata_status,
                "uptime": metadata_uptime_str or "N/A",
            },
            "database": {
                "name": "PostgreSQL Database",
                "status": db_status,
                "uptime": db_uptime_str or "N/A",
            },
            "rslsync": {
                "name": "Resilio Sync",
                "status": rslsync_status,
                "uptime": rslsync_uptime_str or "N/A",
            },
        },
    }



