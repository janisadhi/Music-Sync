import unittest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.core.paths import (
    sanitize_filename,
    get_playlist_music_root,
    get_playlist_no_lyrics_root,
)
from app.database.models import Playlist, Song
from app.downloader.service import SongDownloader
from app.lyrics.service import LyricsService


class TestPlaylistFolderByTitle(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.temp_dir.name)
        self.patcher = patch("app.core.paths.get_download_root", return_value=self.tmp_path)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.temp_dir.cleanup()

    def test_sanitize_filename(self):
        self.assertEqual(sanitize_filename("Check"), "Check")
        self.assertEqual(sanitize_filename("My / Rock : Playlist?"), "My _ Rock _ Playlist_")
        self.assertEqual(sanitize_filename("  Pop Music. "), "Pop Music")
        self.assertEqual(sanitize_filename("..."), "unnamed_playlist")

    def test_get_playlist_music_root(self):
        root = get_playlist_music_root("Check")
        self.assertEqual(root, self.tmp_path / "Check" / "music")
        self.assertTrue(root.exists())

    def test_get_playlist_no_lyrics_root(self):
        root = get_playlist_no_lyrics_root("Check")
        self.assertEqual(root, self.tmp_path / "Check" / "no-lyrics")
        self.assertTrue(root.exists())

    def test_downloader_uses_playlist_name(self):
        pl = Playlist(id=1, name="My Favorite Songs", youtube_playlist_id="yt123", url="http://example.com")
        song = Song(id=10, playlist_id=1, youtube_video_id="v123", title="Test Song", playlist=pl)

        downloader = SongDownloader()
        downloader.settings_service = MagicMock()
        downloader.settings_service.get.return_value = MagicMock(
            max_download_retries=3,
            download_retry_delay_seconds=10,
        )

        mock_ydl_instance = MagicMock()
        mock_ydl_instance.extract_info.return_value = {"id": "v123"}
        target_file = get_playlist_music_root("My Favorite Songs") / "Test Song.webm"
        mock_ydl_instance.prepare_filename.return_value = str(target_file)

        mock_ydl_class = MagicMock()
        mock_ydl_class.__enter__.return_value = mock_ydl_instance

        with patch("yt_dlp.YoutubeDL", return_value=mock_ydl_class):
            with patch("pathlib.Path.exists", return_value=True):
                downloader.download_song(song)

        self.assertIn("My Favorite Songs", song.file_path)

    def test_lyrics_no_lyrics_uses_playlist_name(self):
        pl = Playlist(id=2, name="Chill Beats", youtube_playlist_id="yt456", url="http://example.com")
        song = Song(id=20, playlist_id=2, youtube_video_id="v456", title="Lofi Song", playlist=pl)
        song.file_path = str(get_playlist_music_root("Chill Beats") / "Lofi Song.opus")

        lyrics_service = LyricsService()
        lyrics_service.settings_service = MagicMock()

        with patch("pathlib.Path.exists", return_value=True):
            with patch("shutil.copy2") as mock_copy, patch("pathlib.Path.unlink"):
                lyrics_service._move_to_no_lyrics(song)
                destination_path = mock_copy.call_args[0][1]
                self.assertIn("Chill Beats", str(destination_path))
                self.assertIn("no-lyrics", str(destination_path))


if __name__ == "__main__":
    unittest.main()
