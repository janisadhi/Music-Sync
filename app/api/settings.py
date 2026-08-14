from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

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
    playlist_watch_mode: str = "whole"
    playlist_watch_limit: int | None = None
    delete_local_file_on_playlist_removal: bool = False


class SettingsUpdateRequest(BaseModel):
    sync_interval_seconds: int | None = Field(default=None, ge=10)
    download_limit: int | None = Field(default=None, ge=1)
    lyrics_limit: int | None = Field(default=None, ge=1)
    max_download_retries: int | None = Field(default=None, ge=1)
    download_retry_delay_seconds: int | None = Field(default=None, ge=1)
    youtube_playlist_url: str | None = None
    auto_start_scheduler: bool | None = None
    playlist_watch_mode: Literal["whole", "last_n"] | None = None
    playlist_watch_limit: int | None = None
    delete_local_file_on_playlist_removal: bool | None = None

    @model_validator(mode="after")
    def validate_watch_settings(self):
        mode = self.playlist_watch_mode
        limit = self.playlist_watch_limit

        if mode == "last_n":
            if limit is None:
                raise ValueError(
                    "playlist_watch_limit is required "
                    "when playlist_watch_mode is 'last_n'."
                )
            if limit < 1:
                raise ValueError(
                    "playlist_watch_limit must be a "
                    "positive integer (>= 1)."
                )

        if mode == "whole":
            # Clear the limit when switching back to whole mode.
            self.playlist_watch_limit = None

        return self


@router.get("", response_model=SettingsResponse)
def get_settings():
    return settings_service.get()


@router.patch("", response_model=SettingsResponse)
def update_settings(request: SettingsUpdateRequest):
    try:
        if request.sync_interval_seconds is not None:
            scheduler.update_interval(request.sync_interval_seconds)

        update_kwargs: dict = {}

        if request.sync_interval_seconds is not None:
            update_kwargs["sync_interval_seconds"] = request.sync_interval_seconds

        if request.download_limit is not None:
            update_kwargs["download_limit"] = request.download_limit

        if request.lyrics_limit is not None:
            update_kwargs["lyrics_limit"] = request.lyrics_limit

        if request.youtube_playlist_url is not None:
            update_kwargs["youtube_playlist_url"] = request.youtube_playlist_url

        if request.max_download_retries is not None:
            update_kwargs["max_download_retries"] = request.max_download_retries

        if request.download_retry_delay_seconds is not None:
            update_kwargs["download_retry_delay_seconds"] = (
                request.download_retry_delay_seconds
            )

        if request.auto_start_scheduler is not None:
            update_kwargs["auto_start_scheduler"] = request.auto_start_scheduler

        if request.playlist_watch_mode is not None:
            update_kwargs["playlist_watch_mode"] = request.playlist_watch_mode
            # Always update the limit together with mode so "whole" clears it.
            update_kwargs["playlist_watch_limit"] = request.playlist_watch_limit

        if request.delete_local_file_on_playlist_removal is not None:
            update_kwargs["delete_local_file_on_playlist_removal"] = (
                request.delete_local_file_on_playlist_removal
            )

        return settings_service.update(**update_kwargs)

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
