from app.database.models import AppSettings
from app.database.session import SessionLocal

# Sentinel used to distinguish "caller passed None explicitly" from
# "caller did not pass this kwarg at all".
_UNSET = object()


class SettingsService:
    """
    Manages runtime application settings stored in PostgreSQL.
    """

    def _default_settings(self) -> AppSettings:
        return AppSettings(
            id=1,
            sync_interval_seconds=60,
            download_limit=1,
            lyrics_limit=1,
            max_download_retries=5,
            download_retry_delay_seconds=60,
            youtube_playlist_url=None,
            auto_start_scheduler=False,
            playlist_watch_mode="whole",
            playlist_watch_limit=None,
            delete_local_file_on_playlist_removal=False,
        )

    def get(self) -> AppSettings:
        with SessionLocal() as session:
            app_settings = session.get(AppSettings, 1)

            if app_settings is None:
                app_settings = self._default_settings()
                session.add(app_settings)
                session.commit()
                session.refresh(app_settings)

            return app_settings

    def update(
        self,
        *,
        sync_interval_seconds: int | None = None,
        download_limit: int | None = None,
        lyrics_limit: int | None = None,
        max_download_retries: int | None = None,
        download_retry_delay_seconds: int | None = None,
        youtube_playlist_url: str | None = None,
        auto_start_scheduler: bool | None = None,
        playlist_watch_mode: str | None = None,
        # Sentinel default so explicit None can clear the value.
        playlist_watch_limit: int | None = ...,  # type: ignore[assignment]
        delete_local_file_on_playlist_removal: bool | None = None,
    ) -> AppSettings:

        with SessionLocal() as session:
            app_settings = session.get(AppSettings, 1)

            if app_settings is None:
                app_settings = self._default_settings()
                session.add(app_settings)

            if sync_interval_seconds is not None:
                app_settings.sync_interval_seconds = sync_interval_seconds

            if download_limit is not None:
                app_settings.download_limit = download_limit

            if lyrics_limit is not None:
                app_settings.lyrics_limit = lyrics_limit

            if max_download_retries is not None:
                app_settings.max_download_retries = max_download_retries

            if download_retry_delay_seconds is not None:
                app_settings.download_retry_delay_seconds = download_retry_delay_seconds

            if youtube_playlist_url is not None:
                app_settings.youtube_playlist_url = youtube_playlist_url

            if auto_start_scheduler is not None:
                app_settings.auto_start_scheduler = auto_start_scheduler

            if playlist_watch_mode is not None:
                app_settings.playlist_watch_mode = playlist_watch_mode

            # Use sentinel (...) so that explicit None can clear the limit.
            if playlist_watch_limit is not ...:
                app_settings.playlist_watch_limit = playlist_watch_limit

            if delete_local_file_on_playlist_removal is not None:
                app_settings.delete_local_file_on_playlist_removal = (
                    delete_local_file_on_playlist_removal
                )

            session.commit()
            session.refresh(app_settings)

            return app_settings
