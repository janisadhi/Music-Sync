from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.runtime import scheduler
from app.settings.service import SettingsService


router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)

settings_service = SettingsService()


class SettingsResponse(BaseModel):
    sync_interval_seconds: int
    download_limit: int
    lyrics_limit: int
    youtube_playlist_url: str | None
    max_download_retries: int
    download_retry_delay_seconds: int
    auto_start_scheduler: bool = False


class SettingsUpdateRequest(BaseModel):
    sync_interval_seconds: int | None = Field(
        default=None,
        ge=10,
    )

    download_limit: int | None = Field(
        default=None,
        ge=1,
    )

    lyrics_limit: int | None = Field(
        default=None,
        ge=1,
    )

    max_download_retries: int | None = Field(
        default=None,
        ge=1,
    )

    download_retry_delay_seconds: int | None = Field(
        default=None,
        ge=1,
    )

    youtube_playlist_url: str | None = None

    auto_start_scheduler: bool | None = None


@router.get(
    "",
    response_model=SettingsResponse,
)
def get_settings():
    settings = settings_service.get()

    return settings


@router.patch(
    "",
    response_model=SettingsResponse,
)
def update_settings(
    request: SettingsUpdateRequest,
):
    try:
        if request.sync_interval_seconds is not None:
            scheduler.update_interval(
                request.sync_interval_seconds
            )

        updated = settings_service.update(
            sync_interval_seconds=(
                request.sync_interval_seconds
                if request.sync_interval_seconds
                is not None
                else None
            ),
            download_limit=(
                request.download_limit
                if request.download_limit
                is not None
                else None
            ),
            lyrics_limit=(
                request.lyrics_limit
                if request.lyrics_limit
                is not None
                else None
            ),
            youtube_playlist_url=(
                request.youtube_playlist_url
                if request.youtube_playlist_url
                is not None
                else None
            ),
            max_download_retries=(
                request.max_download_retries
                if request.max_download_retries
                is not None
                else None
            ),
            download_retry_delay_seconds=(
                request.download_retry_delay_seconds
                if request.download_retry_delay_seconds
                is not None
                else None
            ),
            auto_start_scheduler=(
                request.auto_start_scheduler
                if request.auto_start_scheduler
                is not None
                else None
            ),
        )

        return updated

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )