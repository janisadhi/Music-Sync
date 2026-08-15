"""
YouTube playlist watcher.

DESIGN PRINCIPLE: SYNC DISCOVERS, DOWNLOADER DOWNLOADS.

The watcher's only job is to produce a minimal list of playlist items from a
flat YouTube API call.  It does NOT:
  - make per-video extract_info() calls
  - fetch artist / album / artwork / thumbnail metadata
  - download anything

For each playlist entry the flat extraction already gives us everything Sync
needs:
  - YouTube video ID
  - title (as provided by the playlist feed)
  - playlist position / index

Unavailable / private / deleted videos are detected from the flat-extraction
title sentinel values ("[Private video]", "[Deleted video]", etc.) and are
yielded as UnavailableYouTubeSong items so that the Reconciler can mark them
with download_status='unavailable' rather than silently skipping them.
"""

from dataclasses import dataclass, field

import yt_dlp

from app.settings.service import SettingsService
from app.core.ytdlp import build_ydl_options, get_cookie_context


# Titles that YouTube uses in flat extraction to flag inaccessible videos.
_UNAVAILABLE_TITLES = frozenset(
    {
        "[Private video]",
        "[Deleted video]",
        "[Unavailable video]",
    }
)


@dataclass
class YouTubeSong:
    """
    Minimal playlist-item descriptor produced by the lightweight flat scan.

    Only fields that are free from the flat extraction are populated here.
    Rich metadata (artist, album, duration, artwork …) is fetched later by
    the Downloader when it actually processes the track.
    """

    video_id: str
    title: str
    position: int | None

    # Always None at scan time – populated by Downloader after download.
    artist: str | None = field(default=None, init=False)
    album: str | None = field(default=None, init=False)
    duration: int | None = field(default=None, init=False)

    # Flag: this item was inaccessible during the flat scan.
    unavailable: bool = field(default=False, init=False)


@dataclass
class UnavailableYouTubeSong:
    """
    Represents a playlist slot that is inaccessible (private / deleted /
    region-locked / etc.).

    The Reconciler uses this to mark the corresponding Song row with
    download_status='unavailable' so the slot is not silently lost and the
    Downloader does not keep retrying it.
    """

    video_id: str
    reason: str
    position: int | None


class YouTubePlaylistWatcher:
    def __init__(self, playlist_url: str):
        self.playlist_url = playlist_url
        self.settings_service = SettingsService()

    def _get_cookies_text(self) -> str | None:
        try:
            s = self.settings_service.get()
            return getattr(s, "youtube_cookies", None)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Playlist-level metadata (used when auto-naming a new playlist)
    # ------------------------------------------------------------------

    def fetch_playlist_metadata(self) -> dict:
        cookies_text = self._get_cookies_text()
        with get_cookie_context(cookies_text) as cookiefile:
            options = build_ydl_options(
                quiet=True,
                no_warnings=True,
                extract_flat=True,
                skip_download=True,
                ignoreerrors=True,
                cookiefile=cookiefile,
            )

            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(self.playlist_url, download=False)

        if not info:
            return {"id": None, "name": "YouTube Playlist"}

        return {
            "id": info.get("id"),
            "name": info.get("title") or "YouTube Playlist",
        }

    # ------------------------------------------------------------------
    # Lightweight flat scan
    # ------------------------------------------------------------------

    def fetch(
        self,
        watch_mode: str = "whole",
        watch_limit: int | None = None,
    ) -> list[YouTubeSong | UnavailableYouTubeSong]:
        """
        Return a list of playlist items using a single flat extraction call.

        No per-video requests are made.  The returned list contains either
        YouTubeSong (accessible) or UnavailableYouTubeSong (inaccessible)
        items.

        The caller (Reconciler) decides what to do with each item type.
        """
        cookies_text = self._get_cookies_text()
        with get_cookie_context(cookies_text) as cookiefile:
            options = build_ydl_options(
                quiet=True,
                no_warnings=True,
                extract_flat=True,
                skip_download=True,
                ignoreerrors=True,
                cookiefile=cookiefile,
            )

            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(self.playlist_url, download=False)

        if not info:
            return []

        entries = list(info.get("entries", []))

        # ------------------------------------------------------------------
        # Apply watch mode
        # ------------------------------------------------------------------
        if (
            watch_mode == "last_n"
            and watch_limit is not None
            and watch_limit > 0
        ):
            total = len(entries)
            if total > watch_limit:
                top_entries = entries[:watch_limit]
                bottom_entries = entries[-watch_limit:]

                seen_ids: set = set()
                selected = []
                for entry in top_entries + bottom_entries:
                    if entry and isinstance(entry, dict):
                        vid = entry.get("id")
                        key = vid if vid else id(entry)
                        if key not in seen_ids:
                            seen_ids.add(key)
                            selected.append(entry)
                    elif entry:
                        selected.append(entry)

                entries = selected
                print(
                    f"Watch mode: last_{watch_limit} "
                    f"(playlist has {total} entries, "
                    f"scanning top {watch_limit} & bottom {watch_limit}: "
                    f"{len(entries)} unique total)"
                )
            else:
                print(
                    f"Watch mode: last_{watch_limit} "
                    f"(playlist has {total} entries, "
                    f"scanning all — total <= limit)"
                )
        else:
            print(
                f"Watch mode: whole "
                f"(scanning all {len(entries)} entries)"
            )

        items: list[YouTubeSong | UnavailableYouTubeSong] = []

        for fallback_position, entry in enumerate(entries):
            if not entry:
                continue

            # Resolve position: prefer playlist_index, fall back to loop index.
            position = entry.get("playlist_index")
            if position is None:
                position = fallback_position

            video_id = entry.get("id")
            if not video_id:
                continue

            entry_title = entry.get("title") or ""

            # ----------------------------------------------------------
            # Detect unavailable entries from flat-extraction sentinels.
            # No per-video request needed – the flat feed already tells us.
            # ----------------------------------------------------------
            if entry_title in _UNAVAILABLE_TITLES:
                reason = f"Video marked as '{entry_title}' in playlist feed"
                print(
                    f"Unavailable video detected during scan: {video_id} "
                    f"— {reason}"
                )
                items.append(
                    UnavailableYouTubeSong(
                        video_id=video_id,
                        reason=reason,
                        position=position,
                    )
                )
                continue

            # Accessible entry – use title from flat extraction.
            # If for some reason title is empty, substitute the video ID.
            title = entry_title.strip() or video_id

            items.append(
                YouTubeSong(
                    video_id=video_id,
                    title=title,
                    position=position,
                )
            )

        return items
