from pathlib import Path

from app.core.config import DOWNLOADS_DIR


def get_download_root() -> Path:
    """
    Return the fixed download root directory.

    Local:  <project>/data/downloads
    Docker: /app/downloads
    """

    DOWNLOADS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    return DOWNLOADS_DIR


def get_playlist_music_root(
    playlist_id: int,
) -> Path:
    """
    Return the playlist-specific music directory.

    Example:
        /app/downloads/1/music
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
        /app/downloads/1/no-lyrics
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
    Relative paths are resolved from the
    download directory.
    """

    path = Path(file_path)

    if path.is_absolute():
        return path

    return get_download_root() / path