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
    
        for fallback_position, entry in enumerate(info.get("entries", [])):
            if not entry:
                continue
    
            # Use YouTube's actual playlist position when available.
            # This prevents unavailable/private videos from causing
            # duplicate or shifted positions.
            position = entry.get("playlist_index")
    
            if position is None:
                position = fallback_position
    
            songs.append(
                YouTubeSong(
                    video_id=entry.get("id"),
                    title=entry.get("title", "Unknown"),
                    artist=entry.get("artist"),
                    album=entry.get("album"),
                    duration=entry.get("duration"),
                    position=position,
                )
            )
    
        return songs
    