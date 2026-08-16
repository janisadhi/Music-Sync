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

    - If path exists on disk as-is, return it.
    - If path starts with /app/downloads or data/downloads, remap it under get_download_root().
    - Relative paths are resolved from get_download_root().
    """
    if not file_path:
        return get_download_root()

    path = Path(file_path)
    if path.exists():
        return path

    download_root = get_download_root()
    str_path = str(file_path).replace("\\", "/")

    # Check if path starts with container prefix /app/downloads
    if str_path.startswith("/app/downloads/"):
        rel_part = str_path[len("/app/downloads/"):]
        candidate = download_root / rel_part
        if candidate.exists() or not path.is_absolute():
            return candidate

    # Check if path contains data/downloads
    if "data/downloads/" in str_path:
        rel_part = str_path.split("data/downloads/", 1)[1]
        candidate = download_root / rel_part
        if candidate.exists() or not path.is_absolute():
            return candidate

    if path.is_absolute():
        return path

    return download_root / path