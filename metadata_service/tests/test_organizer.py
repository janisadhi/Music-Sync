import os
from pathlib import Path
from unittest.mock import MagicMock
from app.database.models import DownloadedTrack, Song
from metadata_service.organizer import FileOrganizer


def test_lockstep_file_and_lyrics_relocation(tmp_path: Path):
    src_dir = tmp_path / "PlaylistA" / "music"
    src_dir.mkdir(parents=True)

    dest_dir = tmp_path / "PlaylistA" / "music" / "ArtistName" / "AlbumName"

    audio_file = src_dir / "track1.opus"
    audio_file.write_text("audio data")

    lyrics_file = src_dir / "track1.lrc"
    lyrics_file.write_text("[00:01.00] Sample lyrics")

    new_audio_path = str(dest_dir / "track1.opus")
    expected_new_lyrics_path = str(dest_dir / "track1.lrc")

    downloaded_track = DownloadedTrack(
        id=1,
        song_id=10,
        youtube_video_id="abc12345",
        file_path=str(audio_file),
        metadata_state="raw",
    )

    song = Song(
        id=10,
        playlist_id=1,
        youtube_video_id="abc12345",
        title="Sample Song",
        download_status="downloaded",
        lyrics_status="fetched",
        file_path=str(audio_file),
        lyrics_path=str(lyrics_file),
    )

    db_session = MagicMock()
    db_session.query().filter().first.return_value = song

    success = FileOrganizer.relocate_track_and_lyrics(
        session=db_session,
        downloaded_track=downloaded_track,
        new_audio_path=new_audio_path,
    )

    assert success is True
    assert downloaded_track.file_path == new_audio_path
    assert song.file_path == new_audio_path
    assert song.lyrics_path == expected_new_lyrics_path
    assert os.path.exists(new_audio_path)
    assert os.path.exists(expected_new_lyrics_path)
    assert not os.path.exists(str(audio_file))
    assert not os.path.exists(str(lyrics_file))


def test_rename_track_and_lyrics_artist_title_format(tmp_path: Path):
    src_dir = tmp_path / "PlaylistA" / "music"
    src_dir.mkdir(parents=True)

    old_audio = src_dir / "capturedtrack-song.opus"
    old_audio.write_text("audio content")

    old_lyrics = src_dir / "capturedtrack-song.lrc"
    old_lyrics.write_text("[00:01.00] Lyrics line")

    downloaded_track = DownloadedTrack(
        id=2,
        song_id=20,
        youtube_video_id="xyz987",
        file_path=str(old_audio),
        metadata_state="raw",
    )

    song = Song(
        id=20,
        playlist_id=1,
        youtube_video_id="xyz987",
        title="My Kind of Woman",
        download_status="downloaded",
        lyrics_status="fetched",
        file_path=str(old_audio),
        lyrics_path=str(old_lyrics),
    )

    db_session = MagicMock()
    db_session.query().filter().first.return_value = song

    res = FileOrganizer.rename_track_and_lyrics(
        session=db_session,
        downloaded_track=downloaded_track,
        new_artist="Mac DeMarco",
        new_title="My Kind of Woman",
    )

    expected_audio = str(src_dir / "Mac DeMarco - My Kind of Woman.opus")
    expected_lyrics = str(src_dir / "Mac DeMarco - My Kind of Woman.lrc")

    assert res["renamed"] is True
    assert res["new_audio_path"] == expected_audio
    assert res["new_lyrics_path"] == expected_lyrics
    assert downloaded_track.file_path == expected_audio
    assert song.file_path == expected_audio
    assert song.lyrics_path == expected_lyrics
    assert os.path.exists(expected_audio)
    assert os.path.exists(expected_lyrics)
    assert not os.path.exists(str(old_audio))
    assert not os.path.exists(str(old_lyrics))
