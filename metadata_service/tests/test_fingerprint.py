import pytest
from unittest.mock import MagicMock, patch

from metadata_service.fingerprint import AudioFingerprinter, FingerprintResult


def test_fingerprint_file_not_found():
    fingerprinter = AudioFingerprinter()
    fp, duration = fingerprinter.generate_fingerprint("/nonexistent/file.opus")
    assert fp is None
    assert duration is None


def test_fingerprint_unconfigured_api_key(tmp_path):
    fake_file = tmp_path / "song.opus"
    fake_file.write_bytes(b"dummy audio data")

    fingerprinter = AudioFingerprinter(api_key=None)
    with patch.object(fingerprinter, "generate_fingerprint", return_value=("fake_fp_string", 180.0)):
        res = fingerprinter.lookup_acoustid(fake_file)
        assert res.fingerprint == "fake_fp_string"
        assert res.duration == 180.0
        assert res.acoustid_id is None
        assert res.recording_id is None


def test_acoustid_lookup_success(tmp_path):
    fake_file = tmp_path / "song.opus"
    fake_file.write_bytes(b"dummy audio data")

    fingerprinter = AudioFingerprinter(api_key="valid_test_key")

    mock_match = [(0.95, "mbid-recording-1234", "Test Song", "Test Artist")]

    with patch.object(fingerprinter, "generate_fingerprint", return_value=("fake_fp_string", 200.0)), \
         patch("acoustid.lookup") as mock_lookup, \
         patch("acoustid.parse_lookup_result", return_value=mock_match):

        res = fingerprinter.lookup_acoustid(fake_file)

        assert res.fingerprint == "fake_fp_string"
        assert res.duration == 200.0
        assert res.recording_id == "mbid-recording-1234"
        assert res.title == "Test Song"
        assert res.artist == "Test Artist"
        assert res.score == 0.95
