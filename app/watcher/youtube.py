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

    def fetch(self) -> list[YouTubeSong]:
        options = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "skip_download": True,
        }

        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(
                self.playlist_url,
                download=False,
            )

        songs = []

        for fallback_position, entry in enumerate(
            info.get("entries", [])
        ):
            if not entry:
                continue

            position = entry.get("playlist_index")

            if position is None:
                position = fallback_position

            video_id = entry.get("id")

            if not video_id:
                continue

            # Fetch full metadata for the individual video.
            video_url = (
                f"https://www.youtube.com/watch?v={video_id}"
            )

            video_options = {
                "quiet": True,
                "no_warnings": True,
            }

            with yt_dlp.YoutubeDL(video_options) as video_ydl:
                video_info = video_ydl.extract_info(
                    video_url,
                    download=False,
                )

            songs.append(
                YouTubeSong(
                    video_id=video_id,
                    title=video_info.get(
                        "title",
                        entry.get("title", "Unknown"),
                    ),
                    artist=video_info.get("artist"),
                    album=video_info.get("album"),
                    duration=video_info.get("duration"),
                    position=position,
                )
            )

        return songs