from contextlib import asynccontextmanager
from app.core.runtime import scheduler
from fastapi import FastAPI
from sqlalchemy import text
from app.api.sync import router as sync_router
from app.api.playlists import router as playlists_router
from app.api.songs import router as songs_router
from app.core.config import settings
from app.database.session import engine




@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("Starting Music Sync application")
    print("=" * 60)

    scheduler.start()

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

app.include_router(songs_router)
app.include_router(playlists_router)
app.include_router(sync_router)

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