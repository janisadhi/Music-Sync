import re
from pathlib import Path

from app.core.config import DOWNLOADS_DIR


def sanitize_filename(name: str) -> str:
    """
    Sanitize playlist name for safe use as a directory name across OSes.
    """
    # Replace invalid/unsafe filesystem characters with underscores
    sanitized = re.sub(r'[\\/*?:"<>|]', "_", name)
    # Strip leading/trailing whitespace and dots
    sanitized = sanitized.strip(" .")
    # Fallback if empty after sanitizing
    return sanitized if sanitized else "unnamed_playlist"


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
    playlist_name: str | int,
) -> Path:
    """
    Return the playlist-specific music directory using playlist name.

    Example:
        /app/downloads/Check/music
    """
    folder_name = (
        sanitize_filename(playlist_name)
        if isinstance(playlist_name, str)
        else str(playlist_name)
    )

    path = (
        get_download_root()
        / folder_name
        / "music"
    )

    path.mkdir(
        parents=True,
        exist_ok=True,
    )

    return path


def get_playlist_no_lyrics_root(
    playlist_name: str | int,
) -> Path:
    """
    Return the playlist-specific no-lyrics directory using playlist name.

    Example:
        /app/downloads/Check/no-lyrics
    """
    folder_name = (
        sanitize_filename(playlist_name)
        if isinstance(playlist_name, str)
        else str(playlist_name)
    )

    path = (
        get_download_root()
        / folder_name
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