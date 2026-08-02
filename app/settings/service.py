from app.core.config import settings
from app.database.models import AppSettings
from app.database.session import SessionLocal


class SettingsService:
    """
    Manages runtime application settings stored in PostgreSQL.
    """

    def get(self) -> AppSettings:
        with SessionLocal() as session:
            app_settings = session.get(AppSettings, 1)

            if app_settings is None:
                app_settings = AppSettings(
                    id=1,
                    sync_interval_seconds=(
                        settings.sync_interval_seconds
                    ),
                    download_limit=1,
                    lyrics_limit=1,
                    max_download_retries=5,
                    download_retry_delay_seconds=60,
                    youtube_playlist_url=(
                        settings.youtube_playlist_url
                    ),
                )

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
    ) -> AppSettings:

        with SessionLocal() as session:
            app_settings = session.get(
                AppSettings,
                1,
            )

            if app_settings is None:
                app_settings = AppSettings(
                    id=1,
                    sync_interval_seconds=(
                        settings.sync_interval_seconds
                    ),
                    download_limit=1,
                    lyrics_limit=1,
                    max_download_retries=5,
                    download_retry_delay_seconds=60,
                    youtube_playlist_url=(
                        settings.youtube_playlist_url
                    ),
                )

                session.add(app_settings)

            if sync_interval_seconds is not None:
                app_settings.sync_interval_seconds = (
                    sync_interval_seconds
                )

            if download_limit is not None:
                app_settings.download_limit = (
                    download_limit
                )

            if lyrics_limit is not None:
                app_settings.lyrics_limit = (
                    lyrics_limit
                )

            if max_download_retries is not None:
                app_settings.max_download_retries = (
                    max_download_retries
                )

            if download_retry_delay_seconds is not None:
                app_settings.download_retry_delay_seconds = (
                    download_retry_delay_seconds
                )

            if youtube_playlist_url is not None:
                app_settings.youtube_playlist_url = (
                    youtube_playlist_url
                )

            session.commit()
            session.refresh(app_settings)

            return app_settings