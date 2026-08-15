"""
Shared yt-dlp configuration and cookie context helpers.
"""

from contextlib import contextmanager
import os
import tempfile
from typing import Generator


@contextmanager
def get_cookie_context(cookies_text: str | None) -> Generator[str | None, None, None]:
    """
    Safely manage temporary Netscape cookie file for yt-dlp calls.

    - Prepends '# Netscape HTTP Cookie File\n' header if missing.
    - Creates temporary file.
    - Always cleans up temp file in a finally block.
    - Never prints or exposes cookie contents.
    """
    if not isinstance(cookies_text, str) or not cookies_text.strip():
        yield None
        return

    cookie_content = cookies_text.strip()
    if not cookie_content.startswith("# Netscape") and not cookie_content.startswith("# HTTP"):
        cookie_content = "# Netscape HTTP Cookie File\n" + cookie_content

    cookie_file_path = None
    try:
        temp_fd, cookie_file_path = tempfile.mkstemp(
            prefix="yt_cookies_", suffix=".txt"
        )
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            f.write(cookie_content + "\n")

        yield cookie_file_path
    finally:
        if cookie_file_path and os.path.exists(cookie_file_path):
            try:
                os.unlink(cookie_file_path)
            except OSError:
                pass


def build_ydl_options(
    *,
    quiet: bool = False,
    no_warnings: bool = False,
    extract_flat: bool = False,
    skip_download: bool = False,
    ignoreerrors: bool = False,
    outtmpl: str | None = None,
    cookiefile: str | None = None,
    postprocessors: list[dict] | None = None,
    writethumbnail: bool = False,
) -> dict:
    """
    Construct unified, robust yt-dlp options dictionary.
    Includes JS runtime configuration and optional cookie file path.
    """
    opts: dict = {
        "quiet": quiet,
        "no_warnings": no_warnings,
        "js_runtimes": {"deno": {}, "node": {}},
        "remote_components": ["ejs:github"],
    }

    if extract_flat:
        opts["extract_flat"] = True
    if skip_download:
        opts["skip_download"] = True
    if ignoreerrors:
        opts["ignoreerrors"] = True

    if not extract_flat and not skip_download:
        opts["format"] = "bestaudio/best"
        opts["noplaylist"] = True

    if outtmpl:
        opts["outtmpl"] = outtmpl

    if writethumbnail:
        opts["writethumbnail"] = True

    if postprocessors:
        opts["postprocessors"] = postprocessors

    if cookiefile:
        opts["cookiefile"] = cookiefile

    return opts
