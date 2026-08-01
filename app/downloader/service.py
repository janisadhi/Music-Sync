from pathlib import Path
import re

import yt_dlp
from sqlalchemy import select

from app.core.config import settings
from app.database.session import SessionLocal
from app.database.models import Song


class SongDownloader:
    def __init__(self):
        self.music_root = Path(settings.music_root)
        self.music_root.mkdir(parents=True, exist_ok=True)

    def download_song(self, song: Song) -> bool:
        output_template = str(
            self.music_root / "%(title)s.%(ext)s"
        )

        video_url = (
            f"https://www.youtube.com/watch?v={song.youtube_video_id}"
        )

        ydl_opts = {
            # Best available audio.
            "format": "bestaudio/best",

            "outtmpl": output_template,

            "noplaylist": True,

            "quiet": False,
            "no_warnings": False,

            # Download the thumbnail so it can be embedded
            # into the final audio file.
            "writethumbnail": True,

            # Convert audio to Opus.
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "opus",
                    "preferredquality": "0",
                },
                {
                    "key": "EmbedThumbnail",
                },
            ],

            # Write metadata into the audio file.
            "addmetadata": True,
        }

        try:
            song.download_status = "downloading"
            song.error_message = None

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(
                    video_url,
                    download=True,
                )

                prepared = ydl.prepare_filename(info)

                opus_path = Path(prepared).with_suffix(".opus")

            if not opus_path.exists():
                raise FileNotFoundError(
                    f"Downloaded file not found: {opus_path}"
                )

            song.file_path = str(opus_path)
            song.download_status = "downloaded"
            song.error_message = None

            print(f"Downloaded: {song.title}")
            print(f"Artist: {song.artist or 'Unknown'}")
            print(f"Album: {song.album or 'Unknown'}")
            print(f"File: {opus_path}")

            return True

        except Exception as exc:
            song.download_status = "failed"

            song.error_message = re.sub(
                r"\x1B\[[0-?]*[ -/]*[@-~]",
                "",
                str(exc),
            )

            print(f"Download failed: {song.title}")
            print(f"Error: {exc}")

            return False

    def download_pending(self, limit: int = 1):
        with SessionLocal() as session:
            songs = session.scalars(
                select(Song)
                .where(
                    Song.download_status.in_(
                        ["pending", "failed"]
                    )
                )
                .order_by(Song.position)
                .limit(limit)
            ).all()

            print(
                f"Songs selected for download: {len(songs)}"
            )

            for song in songs:
                print(
                    f"Downloading: "
                    f"{song.position} - {song.title} "
                    f"({song.youtube_video_id})"
                )

                self.download_song(song)

            session.commit()