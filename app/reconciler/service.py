from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Playlist, Song
from app.watcher.youtube import YouTubeSong


class PlaylistReconciler:
    def __init__(self, session: Session):
        self.session = session

    def reconcile(
        self,
        playlist_url: str,
        youtube_playlist_id: str,
        playlist_name: str,
        songs: list[YouTubeSong],
    ) -> list[Song]:

        playlist = self.session.scalar(
            select(Playlist).where(
                Playlist.youtube_playlist_id == youtube_playlist_id
            )
        )

        if playlist is None:
            playlist = Playlist(
                youtube_playlist_id=youtube_playlist_id,
                name=playlist_name,
                url=playlist_url,
            )

            self.session.add(playlist)
            self.session.flush()

        else:
            playlist.name = playlist_name
            playlist.url = playlist_url

        youtube_video_ids = {
            youtube_song.video_id
            for youtube_song in songs
        }

        existing_songs = self.session.scalars(
            select(Song).where(
                Song.playlist_id == playlist.id
            )
        ).all()

        existing_by_video_id = {
            song.youtube_video_id: song
            for song in existing_songs
        }

        new_songs = []

        for youtube_song in songs:

            existing_song = existing_by_video_id.get(
                youtube_song.video_id
            )

            if existing_song:
                existing_song.title = youtube_song.title
                existing_song.artist = youtube_song.artist
                existing_song.album = youtube_song.album
                existing_song.duration = youtube_song.duration
                existing_song.position = youtube_song.position

                continue

            song = Song(
                playlist_id=playlist.id,
                youtube_video_id=youtube_song.video_id,
                title=youtube_song.title,
                artist=youtube_song.artist,
                album=youtube_song.album,
                duration=youtube_song.duration,
                position=youtube_song.position,
                download_status="pending",
                lyrics_status="pending",
            )

            self.session.add(song)
            new_songs.append(song)

        # Remove songs that are no longer in the YouTube playlist.
        for existing_song in existing_songs:

            if existing_song.youtube_video_id not in youtube_video_ids:

                print(
                    f"Removed from playlist: "
                    f"{existing_song.title} "
                    f"({existing_song.youtube_video_id})"
                )

                self.session.delete(existing_song)

        self.session.commit()

        return new_songs