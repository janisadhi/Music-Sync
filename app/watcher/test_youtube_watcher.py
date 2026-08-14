"""
Tests for YouTubePlaylistWatcher.

All tests use in-process mocks – no real YouTube requests are made.

Coverage:
  - Flat scan returns YouTubeSong items (no per-video requests)
  - Unavailable/private/deleted entries produce UnavailableYouTubeSong
  - Scanner continues after encountering unavailable entries
  - watch_mode=last_n limiting behaviour
  - Empty playlist
  - Missing video_id entries are skipped
  - Title fallback to video_id when title is blank
"""

from unittest.mock import MagicMock, patch

import pytest

from app.watcher.youtube import (
    UnavailableYouTubeSong,
    YouTubePlaylistWatcher,
    YouTubeSong,
)


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _make_ydl_class(entries: list, playlist_id: str = "pl1"):
    """
    Build a mock yt_dlp.YoutubeDL context manager that returns a flat playlist.
    The flat extraction should NOT be called per-video; if it is, this mock
    will raise to make the violation visible.
    """
    class MockYDL:
        def __init__(self, opts):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def extract_info(self, url, download=False):
            # Flat playlist call — always return the playlist info.
            return {
                "id": playlist_id,
                "title": "Test Playlist",
                "entries": entries,
            }

    return MockYDL


AVAILABLE_ENTRIES = [
    {"id": "vid1", "title": "Song One", "playlist_index": 1},
    {"id": "vid2", "title": "Song Two", "playlist_index": 2},
    {"id": "vid3", "title": "Song Three", "playlist_index": 3},
]

MIXED_ENTRIES = [
    {"id": "vid1", "title": "Song One", "playlist_index": 1},
    {"id": "vid_priv", "title": "[Private video]", "playlist_index": 2},
    {"id": "vid3", "title": "Song Three", "playlist_index": 3},
    {"id": "vid_del", "title": "[Deleted video]", "playlist_index": 4},
    {"id": "vid5", "title": "Song Five", "playlist_index": 5},
]

TEN_ENTRIES = [
    {"id": f"vid{i}", "title": f"Song {i}", "playlist_index": i}
    for i in range(1, 11)
]


# ---------------------------------------------------------------------------
# Basic scan
# ---------------------------------------------------------------------------

class TestFlatScan:
    def test_returns_youtube_song_objects(self):
        """Watcher returns YouTubeSong items for accessible entries."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(AVAILABLE_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert len(items) == 3
        assert all(isinstance(i, YouTubeSong) for i in items)

    def test_video_ids_and_titles(self):
        """Returned items carry the correct video_id, title, position."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(AVAILABLE_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert items[0].video_id == "vid1"
        assert items[0].title == "Song One"
        assert items[0].position == 1

        assert items[1].video_id == "vid2"
        assert items[2].video_id == "vid3"

    def test_no_per_video_requests(self):
        """
        extract_info must be called ONCE (flat playlist call).
        A second call per video would indicate the old expensive path.
        """
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")

        call_count = 0

        class CountingYDL:
            def __init__(self, opts):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *a):
                return False
            def extract_info(self, url, download=False):
                nonlocal call_count
                call_count += 1
                return {
                    "id": "pl1",
                    "title": "Playlist",
                    "entries": AVAILABLE_ENTRIES,
                }

        with patch("yt_dlp.YoutubeDL", side_effect=CountingYDL):
            watcher.fetch()

        # Exactly one flat extraction call, never per-video.
        assert call_count == 1, (
            f"Expected 1 yt-dlp call (flat), got {call_count}. "
            "Per-video requests must not be made during sync."
        )

    def test_artist_album_duration_are_none(self):
        """
        Sync-time YouTubeSong must NOT carry artist/album/duration.
        Those fields are populated only by the Downloader after download.
        """
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(AVAILABLE_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        for item in items:
            assert isinstance(item, YouTubeSong)
            assert item.artist is None
            assert item.album is None
            assert item.duration is None

    def test_empty_playlist_returns_empty_list(self):
        """An empty playlist produces an empty list without errors."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class([])

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert items == []

    def test_missing_video_id_skipped(self):
        """Entries without an 'id' field are silently skipped."""
        entries = [
            {"title": "No ID here", "playlist_index": 1},  # no 'id'
            {"id": "vid2", "title": "Has ID", "playlist_index": 2},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert len(items) == 1
        assert items[0].video_id == "vid2"

    def test_blank_title_falls_back_to_video_id(self):
        """Entries with an empty title use the video_id as title."""
        entries = [{"id": "vid_notitle", "title": "", "playlist_index": 1}]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert len(items) == 1
        assert items[0].video_id == "vid_notitle"
        assert items[0].title == "vid_notitle"

    def test_none_entry_skipped(self):
        """None entries in the playlist (yt-dlp error sentinels) are skipped."""
        entries = [
            {"id": "vid1", "title": "Song One", "playlist_index": 1},
            None,
            {"id": "vid3", "title": "Song Three", "playlist_index": 3},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert len(items) == 2


# ---------------------------------------------------------------------------
# Unavailable / private / deleted videos
# ---------------------------------------------------------------------------

class TestUnavailableVideos:
    def test_private_video_produces_unavailable_item(self):
        """[Private video] title → UnavailableYouTubeSong, not skipped."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(MIXED_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        unavail = [i for i in items if isinstance(i, UnavailableYouTubeSong)]
        available = [i for i in items if isinstance(i, YouTubeSong)]

        assert len(unavail) == 2
        assert len(available) == 3

    def test_unavailable_item_carries_video_id(self):
        """UnavailableYouTubeSong must carry the video_id and a reason."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(MIXED_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        unavail_ids = {i.video_id for i in items if isinstance(i, UnavailableYouTubeSong)}
        assert "vid_priv" in unavail_ids
        assert "vid_del" in unavail_ids

        for item in items:
            if isinstance(item, UnavailableYouTubeSong):
                assert item.reason  # reason must be non-empty

    def test_scanner_continues_after_unavailable(self):
        """
        Items after an unavailable entry must still be processed.
        vid5 must appear in results even though vid_priv and vid_del precede it.
        """
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(MIXED_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        all_ids = [i.video_id for i in items]
        assert "vid5" in all_ids
        assert "vid1" in all_ids
        assert "vid3" in all_ids

    def test_all_three_sentinel_titles_detected(self):
        """All three YouTube sentinel titles are treated as unavailable."""
        entries = [
            {"id": "v1", "title": "[Private video]", "playlist_index": 1},
            {"id": "v2", "title": "[Deleted video]", "playlist_index": 2},
            {"id": "v3", "title": "[Unavailable video]", "playlist_index": 3},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert len(items) == 3
        assert all(isinstance(i, UnavailableYouTubeSong) for i in items)

    def test_unavailable_at_start_does_not_abort(self):
        """An unavailable item at position 0 must not abort the scan."""
        entries = [
            {"id": "priv_start", "title": "[Private video]", "playlist_index": 1},
            {"id": "vid_ok", "title": "Good Song", "playlist_index": 2},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        available = [i for i in items if isinstance(i, YouTubeSong)]
        assert len(available) == 1
        assert available[0].video_id == "vid_ok"

    def test_unavailable_at_end_does_not_drop_preceding(self):
        """An unavailable item at the end must not affect preceding items."""
        entries = [
            {"id": "vid_a", "title": "Good Song A", "playlist_index": 1},
            {"id": "vid_b", "title": "Good Song B", "playlist_index": 2},
            {"id": "priv_end", "title": "[Deleted video]", "playlist_index": 3},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        available = [i for i in items if isinstance(i, YouTubeSong)]
        assert len(available) == 2
        assert {i.video_id for i in available} == {"vid_a", "vid_b"}

    def test_playlist_unavailable_returns_empty(self):
        """If the whole playlist is inaccessible, return empty list."""
        class FailYDL:
            def __init__(self, opts):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *a):
                return False
            def extract_info(self, url, download=False):
                return None

        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=gone")
        with patch("yt_dlp.YoutubeDL", side_effect=FailYDL):
            items = watcher.fetch()

        assert items == []


# ---------------------------------------------------------------------------
# Watch mode: last_n
# ---------------------------------------------------------------------------

class TestLastNMode:
    def test_last_n_selects_top_and_bottom(self):
        """last_n=2 picks top-2 and bottom-2 entries (4 unique)."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(TEN_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch(watch_mode="last_n", watch_limit=2)

        ids = [i.video_id for i in items]
        assert set(ids) == {"vid1", "vid2", "vid9", "vid10"}
        assert len(ids) == 4

    def test_last_n_larger_than_playlist_returns_all(self):
        """If limit > playlist size, all entries are returned."""
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(AVAILABLE_ENTRIES)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch(watch_mode="last_n", watch_limit=100)

        assert len(items) == 3

    def test_last_n_no_duplicates_on_overlap(self):
        """When top-N and bottom-N overlap, no duplicate video_ids appear."""
        # 3 entries, N=2: top-2=(vid1,vid2), bottom-2=(vid2,vid3) → 3 unique
        entries = [
            {"id": "vid1", "title": "S1", "playlist_index": 1},
            {"id": "vid2", "title": "S2", "playlist_index": 2},
            {"id": "vid3", "title": "S3", "playlist_index": 3},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch(watch_mode="last_n", watch_limit=2)

        ids = [i.video_id for i in items]
        assert len(ids) == len(set(ids)), "Duplicate video IDs found"


# ---------------------------------------------------------------------------
# Positional fallback
# ---------------------------------------------------------------------------

class TestPositionFallback:
    def test_missing_playlist_index_uses_loop_index(self):
        """Entries without playlist_index get their loop position assigned."""
        entries = [
            {"id": "vid_a", "title": "Song A"},  # no playlist_index
            {"id": "vid_b", "title": "Song B"},
        ]
        watcher = YouTubePlaylistWatcher("https://youtube.com/playlist?list=pl1")
        MockYDL = _make_ydl_class(entries)

        with patch("yt_dlp.YoutubeDL", side_effect=MockYDL):
            items = watcher.fetch()

        assert items[0].position == 0
        assert items[1].position == 1


# ---------------------------------------------------------------------------
# Legacy-compatible main() for direct execution
# ---------------------------------------------------------------------------

def main():
    """Run all tests via pytest when called directly."""
    import sys
    import pytest as _pytest
    sys.exit(_pytest.main([__file__, "-v"]))


if __name__ == "__main__":
    main()
