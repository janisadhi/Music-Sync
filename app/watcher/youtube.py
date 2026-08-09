from dataclasses import dataclass

import yt_dlp


@dataclass
class YouTubeSong:
    video_id: str
    title: str
    artist: str | None
    album: str | None
    duration: int | None
    position: int | None


class YouTubePlaylistWatcher:
    def __init__(self, playlist_url: str):
        self.playlist_url = playlist_url

    def fetch_playlist_metadata(self) -> dict:
        options = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "skip_download": True,
            "ignoreerrors": True,
        }

        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(
                self.playlist_url,
                download=False,
            )

        if not info:
            return {
                "id": None,
                "name": "YouTube Playlist",
            }

        return {
            "id": info.get("id"),
            "name": info.get("title")
            or "YouTube Playlist",
        }

    def fetch(
        self,
        watch_mode: str = "whole",
        watch_limit: int | None = None,
    ) -> list[YouTubeSong]:
        options = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "skip_download": True,
            "ignoreerrors": True,
        }

        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(
                self.playlist_url,
                download=False,
            )

        if not info:
            return []

        entries = list(info.get("entries", []))

        # ---------------------------------------------------------
        # Apply watch mode: limit entries to the latest N
        # (Scans both top N and bottom N entries to catch newly added
        # songs regardless of whether playlist is sorted newest-first
        # or newest-last)
        # ---------------------------------------------------------
        if (
            watch_mode == "last_n"
            and watch_limit is not None
            and watch_limit > 0
        ):
            total = len(entries)
            if total > watch_limit:
                top_entries = entries[:watch_limit]
                bottom_entries = entries[-watch_limit:]

                seen_ids = set()
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
                    f"scanning top {watch_limit} & bottom {watch_limit} entries: {len(entries)} unique total)"
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

        songs = []

        for fallback_position, entry in enumerate(
            entries
        ):
            if not entry:
                continue

            position = entry.get(
                "playlist_index"
            )

            if position is None:
                position = fallback_position

            video_id = entry.get("id")

            if not video_id:
                continue

            entry_title = entry.get("title") or ""
            if entry_title in (
                "[Private video]",
                "[Deleted video]",
                "[Unavailable video]",
            ):
                print(
                    f"Skipping unavailable video: {video_id}"
                )
                print(
                    f"Reason: Video is marked as {entry_title}"
                )
                print("Playlist scan continuing...")
                continue

            # Fetch full metadata for the individual video.
            video_url = (
                "https://www.youtube.com/watch?v="
                f"{video_id}"
            )

            video_options = {
                "quiet": True,
                "no_warnings": True,
                "ignoreerrors": True,
            }

            try:
                with yt_dlp.YoutubeDL(
                    video_options
                ) as video_ydl:
                    video_info = video_ydl.extract_info(
                        video_url,
                        download=False,
                    )
            except (
                yt_dlp.utils.YoutubeDLError,
                yt_dlp.utils.DownloadError,
                yt_dlp.utils.ExtractorError,
            ) as exc:
                reason = str(exc).strip()
                if "ERROR: [youtube]" in reason:
                    reason = reason.split(":", 2)[-1].strip()
                print(
                    f"Skipping unavailable video: {video_id}"
                )
                print(
                    f"Reason: {reason or 'Video unavailable'}"
                )
                print("Playlist scan continuing...")
                continue

            if not video_info or not isinstance(video_info, dict):
                print(
                    f"Skipping unavailable video: {video_id}"
                )
                print("Reason: Video unavailable")
                print("Playlist scan continuing...")
                continue

            title = video_info.get("title")
            if not title or title in (
                "[Private video]",
                "[Deleted video]",
                "[Unavailable video]",
            ):
                print(
                    f"Skipping unavailable video: {video_id}"
                )
                print(
                    f"Reason: Video unavailable ({title or 'missing title'})"
                )
                print("Playlist scan continuing...")
                continue

            songs.append(
                YouTubeSong(
                    video_id=video_id,
                    title=title,
                    artist=video_info.get(
                        "artist"
                    ),
                    album=video_info.get(
                        "album"
                    ),
                    duration=video_info.get(
                        "duration"
                    ),
                    position=position,
                )
            )

        return songs