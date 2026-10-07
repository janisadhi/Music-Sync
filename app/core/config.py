import json
from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]

DOWNLOADS_DIR = Path("/app/downloads") if Path("/app/downloads").exists() else BASE_DIR / "data" / "downloads"


class Settings(BaseSettings):
    app_name: str = "music-sync"
    app_env: str = "development"
    app_debug: bool = True

    database_url: str

    music_root: str = "/music"
    cors_origins: Any = "*"

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