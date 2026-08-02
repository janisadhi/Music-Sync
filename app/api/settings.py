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

    youtube_playlist_url: str | None = None


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
        )

        return updated

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )