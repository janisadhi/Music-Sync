from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "music-sync"
    app_env: str = "development"
    app_debug: bool = True

    database_url: str

    music_root: str = "./data/music"

    sync_interval_seconds: int = 300

    youtube_playlist_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
