from pathlib import Path

from app.database.models import AppSettings
from app.database.session import SessionLocal


def get_download_root() -> Path:
    """
    Return the configured download directory.

    The directory is read from app_settings.download_directory.
    """

    with SessionLocal() as session:
        app_settings = session.get(
            AppSettings,
            1,
        )

        if app_settings is None:
            raise RuntimeError(
                "Application settings are not configured"
            )

        if not app_settings.download_directory:
            raise RuntimeError(
                "Download directory is not configured"
            )

        path = Path(
            app_settings.download_directory
        ).expanduser()

    path.mkdir(
        parents=True,
        exist_ok=True,
    )

    return path


def get_playlist_music_root(
    playlist_id: int,
) -> Path:
    """
    Return the playlist-specific music directory.

    Example:
        /app/data/downloads/2/music
    """

    path = (
        get_download_root()
        / str(playlist_id)
        / "music"
    )

    path.mkdir(
        parents=True,
        exist_ok=True,
    )

    return path


def get_playlist_no_lyrics_root(
    playlist_id: int,
) -> Path:
    """
    Return the playlist-specific no-lyrics directory.

    Example:
        /app/data/downloads/2/no-lyrics
    """

    path = (
        get_download_root()
        / str(playlist_id)
        / "no-lyrics"
    )

    path.mkdir(
        parents=True,
        exist_ok=True,
    )

    return path


def resolve_file_path(
    file_path: str,
) -> Path:
    """
    Resolve a database file path.

    Absolute paths are returned unchanged.
    Relative paths are resolved from the configured
    download directory.
    """

    path = Path(file_path)

    if path.is_absolute():
        return path

    return get_download_root() / path