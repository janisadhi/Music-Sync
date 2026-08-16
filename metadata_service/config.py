import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]

# Downloads directory logic: /app/downloads if present, else repo_root/data/downloads
if Path("/app/downloads").exists():
    DOWNLOADS_DIR = Path("/app/downloads")
else:
    DOWNLOADS_DIR = BASE_DIR / "data" / "downloads"

# Beets data directory logic: /app/data/beets if present, else repo_root/data/beets
if Path("/app/data/beets").exists():
    BEETS_DATA_DIR = Path("/app/data/beets")
else:
    BEETS_DATA_DIR = BASE_DIR / "data" / "beets"

BEETS_CONFIG_PATH = BASE_DIR / "metadata_service" / "beets_config.yaml"


class Settings(BaseSettings):
    service_name: str = "metadata_service"
    service_port: int = 8001
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://music_sync:music_sync_pass@localhost:5432/music_sync"
    )

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
