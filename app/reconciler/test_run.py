from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.database.session import SessionLocal
from app.reconciler.service import PlaylistReconciler
from app.watcher.youtube import YouTubePlaylistWatcher


def get_playlist_id(url: str) -> str:
    return parse_qs(urlparse(url).query)["list"][0]


def main():
    watcher = YouTubePlaylistWatcher(
        settings.youtube_playlist_url
    )

    songs = watcher.fetch()

    playlist_id = get_playlist_id(
        settings.youtube_playlist_url
    )

    with SessionLocal() as session:
        reconciler = PlaylistReconciler(session)

        new_songs = reconciler.reconcile(
            playlist_url=settings.youtube_playlist_url,
            youtube_playlist_id=playlist_id,
            playlist_name="My Music Playlist",
            songs=songs,
        )

    print(f"YouTube songs: {len(songs)}")
    print(f"New songs: {len(new_songs)}")

    for song in new_songs[:10]:
        print(
            f"{song.position}: "
            f"{song.title} "
            f"({song.youtube_video_id})"
        )


if __name__ == "__main__":
    main()
