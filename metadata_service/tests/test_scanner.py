import os
import pytest
from pathlib import Path
from metadata_service.scanner import DirectoryScanner, SUPPORTED_EXTENSIONS, IGNORE_EXTENSIONS


def test_scanner_extension_filtering(tmp_path: Path):
    downloads_dir = tmp_path / "downloads"
    downloads_dir.mkdir()

    # Create dummy audio files
    opus_file = downloads_dir / "song1.opus"
    opus_file.write_text("dummy opus content")

    mp3_file = downloads_dir / "song2.mp3"
    mp3_file.write_text("dummy mp3 content")

    # Create dummy temp files
    part_file = downloads_dir / "song3.opus.part"
    part_file.write_text("temp part download")

    ytdl_file = downloads_dir / "song4.opus.ytdl"
    ytdl_file.write_text("temp ytdl file")

    scanner = DirectoryScanner(downloads_dir=downloads_dir)
    discovered = scanner.scan_filesystem()

    assert len(discovered) == 2
    assert str(opus_file) in discovered
    assert str(mp3_file) in discovered
    assert str(part_file) not in discovered
    assert str(ytdl_file) not in discovered
