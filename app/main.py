from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.playlists import router as playlists_router
from app.api.songs import router as songs_router
from app.api.sync import router as sync_router
from app.core.config import settings
from app.core.runtime import scheduler
from app.database.session import engine
from app.api.dashboard import router as dashboard_router
from app.api.settings import router as settings_router
from app.settings.service import SettingsService


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("Starting Music Sync application")
    print("=" * 60)

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

    print("=" * 60)
    print("Shutting down Music Sync application")
    print("=" * 60)

    scheduler.stop()


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

app.include_router(songs_router)
app.include_router(playlists_router)
app.include_router(sync_router)
app.include_router(dashboard_router)
app.include_router(settings_router)


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
    }