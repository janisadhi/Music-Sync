import json
import os
from pathlib import Path
from typing import Any
from pydantic import field_validator
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
    cors_origins: Any = "*"
    acoustid_api_key: str | None = os.getenv("ACOUSTID_API_KEY", None)
    spotify_client_id: str | None = os.getenv("SPOTIFY_CLIENT_ID", None)
    spotify_client_secret: str | None = os.getenv("SPOTIFY_CLIENT_SECRET", None)
    min_confidence_threshold: str = os.getenv("METADATA_CONFIDENCE_THRESHOLD", "MEDIUM")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        def clean_origin(origin: str) -> str:
            cleaned = origin.strip().strip("'\"")
            if cleaned != "*":
                cleaned = cleaned.rstrip("/")
            return cleaned

        if isinstance(v, list):
            cleaned_list = [clean_origin(str(i)) for i in v if str(i).strip()]
            if "*" in cleaned_list or not cleaned_list:
                return ["*"]
            return cleaned_list
        if isinstance(v, str):
            v_stripped = v.strip()
            if not v_stripped or v_stripped == "*":
                return ["*"]
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        cleaned_list = [clean_origin(str(item)) for item in parsed if str(item).strip()]
                        if "*" in cleaned_list or not cleaned_list:
                            return ["*"]
                        return cleaned_list
                except Exception:
                    pass
            cleaned_list = [clean_origin(i) for i in v_stripped.split(",") if clean_origin(i)]
            if "*" in cleaned_list or not cleaned_list:
                return ["*"]
            return cleaned_list
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
