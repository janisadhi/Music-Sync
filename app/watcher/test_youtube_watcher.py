from unittest.mock import MagicMock, patch
import yt_dlp

from app.watcher.youtube import YouTubePlaylistWatcher, YouTubeSong


class MockYoutubeDL:
    def __init__(self, options=None):
        self.options = options or {}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False

    def extract_info(self, url, download=False):
        # Playlist extraction mock
        if "list=" in url or "playlist" in url:
            return {
                "id": "test_playlist_id",
                "title": "Test Playlist",
                "entries": [
                    {"id": "vid1", "title": "Song 1", "playlist_index": 1},
                    {"id": "vid_unavail", "title": "Song 2", "playlist_index": 2},
                    {"id": "vid3", "title": "Song 3", "playlist_index": 3},
                    {"id": "vid_private", "title": "[Private video]", "playlist_index": 4},
                    {"id": "vid5", "title": "Song 5", "playlist_index": 5},
                ],
            }

        # Per-video extraction mock
        if "vid1" in url:
            return {
                "title": "Song 1",
                "artist": "Artist 1",
                "album": "Album 1",
                "duration": 180,
            }
        elif "vid_unavail" in url:
            raise yt_dlp.utils.DownloadError("ERROR: [youtube] vid_unavail: Video unavailable. This video is not available")
        elif "vid3" in url:
            return {
                "title": "Song 3",
                "artist": "Artist 3",
                "album": "Album 3",
                "duration": 200,
            }
        elif "vid5" in url:
            return {
                "title": "Song 5",
                "artist": "Artist 5",
                "album": "Album 5",
                "duration": 220,
            }
        else:
            raise yt_dlp.utils.DownloadError("Video unavailable")


def test_valid_unavailable_valid():
    print("=" * 60)
    print("TEST: YouTube Playlist Watcher Unavailable Video Handling")
    print("=" * 60)

    watcher = YouTubePlaylistWatcher("https://www.youtube.com/playlist?list=test_playlist_id")

    with patch("yt_dlp.YoutubeDL", side_effect=MockYoutubeDL):
        songs = watcher.fetch()

    video_ids = [s.video_id for s in songs]
    print(f"Discovered songs: {video_ids}")

    assert len(songs) == 3, f"Expected 3 valid songs, got {len(songs)}"
    assert video_ids == ["vid1", "vid3", "vid5"], f"Unexpected video IDs: {video_ids}"
    assert songs[0].title == "Song 1"
    assert songs[1].title == "Song 3"
    assert songs[2].title == "Song 5"

    print("PASS: Valid songs extracted while unavailable and private videos were skipped.")


def test_unavailable_at_start():
    print()
    print("=" * 60)
    print("TEST: Unavailable Video at Start of Playlist")
    print("=" * 60)

    class MockYoutubeDLStartUnavail(MockYoutubeDL):
        def extract_info(self, url, download=False):
            if "list=" in url or "playlist" in url:
                return {
                    "id": "test_playlist_id",
                    "title": "Test Playlist",
                    "entries": [
                        {"id": "vid_unavail", "title": "Unavail", "playlist_index": 1},
                        {"id": "vid1", "title": "Song 1", "playlist_index": 2},
                        {"id": "vid3", "title": "Song 3", "playlist_index": 3},
                    ],
                }
            return super().extract_info(url, download)

    watcher = YouTubePlaylistWatcher("https://www.youtube.com/playlist?list=test_playlist_id")

    with patch("yt_dlp.YoutubeDL", side_effect=MockYoutubeDLStartUnavail):
        songs = watcher.fetch()

    video_ids = [s.video_id for s in songs]
    print(f"Discovered songs: {video_ids}")

    assert len(songs) == 2, f"Expected 2 valid songs, got {len(songs)}"
    assert video_ids == ["vid1", "vid3"]

    print("PASS: Unavailable video at start skipped cleanly.")


def test_unavailable_at_end():
    print()
    print("=" * 60)
    print("TEST: Unavailable Video at End of Playlist")
    print("=" * 60)

    class MockYoutubeDLEndUnavail(MockYoutubeDL):
        def extract_info(self, url, download=False):
            if "list=" in url or "playlist" in url:
                return {
                    "id": "test_playlist_id",
                    "title": "Test Playlist",
                    "entries": [
                        {"id": "vid1", "title": "Song 1", "playlist_index": 1},
                        {"id": "vid3", "title": "Song 3", "playlist_index": 2},
                        {"id": "vid_unavail", "title": "Unavail", "playlist_index": 3},
                    ],
                }
            return super().extract_info(url, download)

    watcher = YouTubePlaylistWatcher("https://www.youtube.com/playlist?list=test_playlist_id")

    with patch("yt_dlp.YoutubeDL", side_effect=MockYoutubeDLEndUnavail):
        songs = watcher.fetch()

    video_ids = [s.video_id for s in songs]
    print(f"Discovered songs: {video_ids}")

    assert len(songs) == 2, f"Expected 2 valid songs, got {len(songs)}"
    assert video_ids == ["vid1", "vid3"]

    print("PASS: Unavailable video at end skipped cleanly.")


def test_system_error_propagates():
    print()
    print("=" * 60)
    print("TEST: System Error Propagates")
    print("=" * 60)

    class MockYoutubeDLSystemError(MockYoutubeDL):
        def extract_info(self, url, download=False):
            if "list=" in url or "playlist" in url:
                return {
                    "id": "test_playlist_id",
                    "title": "Test Playlist",
                    "entries": [
                        {"id": "vid_sys_err", "title": "SysErr", "playlist_index": 1},
                    ],
                }
            raise RuntimeError("Database connection failed")

    watcher = YouTubePlaylistWatcher("https://www.youtube.com/playlist?list=test_playlist_id")

    raised = False
    try:
        with patch("yt_dlp.YoutubeDL", side_effect=MockYoutubeDLSystemError):
            watcher.fetch()
    except RuntimeError as exc:
        raised = True
        assert str(exc) == "Database connection failed"

    assert raised, "Expected RuntimeError to propagate"
    print("PASS: System error propagated as expected.")


def main():
    test_valid_unavailable_valid()
    test_unavailable_at_start()
    test_unavailable_at_end()
    test_system_error_propagates()
    print()
    print("=" * 60)
    print("ALL WATCHER TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
