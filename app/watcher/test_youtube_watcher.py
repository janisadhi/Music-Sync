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


def test_last_n_mode_limits_entries():
    print()
    print("=" * 60)
    print("TEST: Last N Mode Limits Entries (N=2)")
    print("=" * 60)

    class MockYoutubeDLLargePlaylist(MockYoutubeDL):
        def extract_info(self, url, download=False):
            if "list=" in url or "playlist" in url:
                return {
                    "id": "test_playlist_id",
                    "title": "Test Playlist",
                    "entries": [
                        {"id": "vid1", "title": "Song 1", "playlist_index": 1},
                        {"id": "vid2", "title": "Song 2", "playlist_index": 2},
                        {"id": "vid3", "title": "Song 3", "playlist_index": 3},
                        {"id": "vid4", "title": "Song 4", "playlist_index": 4},
                        {"id": "vid5", "title": "Song 5", "playlist_index": 5},
                        {"id": "vid6", "title": "Song 6", "playlist_index": 6},
                        {"id": "vid7", "title": "Song 7", "playlist_index": 7},
                        {"id": "vid8", "title": "Song 8", "playlist_index": 8},
                        {"id": "vid9", "title": "Song 9", "playlist_index": 9},
                        {"id": "vid10", "title": "Song 10", "playlist_index": 10},
                    ],
                }
            # Per-video extraction fallback
            vid_id = url.split("v=")[-1]
            return {
                "title": f"Song {vid_id.replace('vid', '')}",
                "artist": "Artist",
                "album": "Album",
                "duration": 180,
            }

    watcher = YouTubePlaylistWatcher("https://www.youtube.com/playlist?list=test_playlist_id")

    with patch("yt_dlp.YoutubeDL", side_effect=MockYoutubeDLLargePlaylist):
        # N=2 -> top 2 (vid1, vid2) + bottom 2 (vid9, vid10) = 4 total songs
        songs = watcher.fetch(watch_mode="last_n", watch_limit=2)

    video_ids = [s.video_id for s in songs]
    print(f"Discovered songs (top 2 & bottom 2 entries): {video_ids}")

    assert len(songs) == 4, f"Expected 4 valid songs from top 2 and bottom 2, got {len(songs)}"
    assert video_ids == ["vid1", "vid2", "vid9", "vid10"], f"Unexpected video IDs: {video_ids}"

    print("PASS: Last N mode correctly limited entry scanning to top N & bottom N.")


def test_last_n_mode_larger_than_total():
    print()
    print("=" * 60)
    print("TEST: Last N Mode Limit Larger Than Total (N=10)")
    print("=" * 60)

    watcher = YouTubePlaylistWatcher("https://www.youtube.com/playlist?list=test_playlist_id")

    with patch("yt_dlp.YoutubeDL", side_effect=MockYoutubeDL):
        songs = watcher.fetch(watch_mode="last_n", watch_limit=10)

    video_ids = [s.video_id for s in songs]
    print(f"Discovered songs: {video_ids}")

    assert len(songs) == 3, f"Expected 3 valid songs, got {len(songs)}"
    assert video_ids == ["vid1", "vid3", "vid5"]

    print("PASS: Last N mode with limit larger than playlist size handled correctly.")


def main():
    test_valid_unavailable_valid()
    test_unavailable_at_start()
    test_unavailable_at_end()
    test_system_error_propagates()
    test_last_n_mode_limits_entries()
    test_last_n_mode_larger_than_total()
    print()
    print("=" * 60)
    print("ALL WATCHER TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
