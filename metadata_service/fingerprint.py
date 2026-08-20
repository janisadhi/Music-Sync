import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger("metadata_service.fingerprint")


@dataclass
class FingerprintResult:
    fingerprint: str | None = None
    duration: float | None = None
    acoustid_id: str | None = None
    recording_id: str | None = None
    title: str | None = None
    artist: str | None = None
    score: float | None = None
    source: str = "acoustid"


class AudioFingerprinter:
    """Generates Chromaprint audio fingerprints and performs AcoustID lookups."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("ACOUSTID_API_KEY")

    def generate_fingerprint(self, file_path: str | Path) -> tuple[str | None, float | None]:
        """Generates (fingerprint_string, duration) for an audio file using fpcalc or pyacoustid."""
        path_str = str(file_path)
        if not os.path.exists(path_str):
            logger.warning(f"File not found for fingerprinting: {path_str}")
            return None, None

        # 1. Try pyacoustid directly if available
        try:
            import acoustid
            duration, fp = acoustid.fingerprint_file(path_str)
            if fp:
                if isinstance(fp, bytes):
                    fp = fp.decode("utf-8")
                return str(fp), float(duration)
        except Exception as e:
            logger.debug(f"pyacoustid fingerprint_file failed for {path_str}: {e}")

        # 2. Fallback: try fpcalc CLI binary directly
        fpcalc_bin = shutil.which("fpcalc")
        if fpcalc_bin:
            try:
                res = subprocess.run(
                    [fpcalc_bin, "-json", path_str],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if res.returncode == 0:
                    import json
                    data = json.loads(res.stdout)
                    duration = float(data.get("duration", 0))
                    fingerprint = str(data.get("fingerprint", ""))
                    if fingerprint:
                        return fingerprint, duration
            except Exception as e:
                logger.debug(f"fpcalc CLI failed for {path_str}: {e}")

        logger.warning(f"Unable to generate fingerprint for {path_str} (fpcalc/pyacoustid unavailable)")
        return None, None

    def lookup_acoustid(self, file_path: str | Path) -> FingerprintResult:
        """Generates fingerprint and queries AcoustID web service to resolve recording metadata."""
        fp, duration = self.generate_fingerprint(file_path)
        result = FingerprintResult(fingerprint=fp, duration=duration)

        if not fp or not duration:
            return result

        if not self.api_key:
            logger.info("ACOUSTID_API_KEY not set. Fingerprint generated but AcoustID lookup skipped.")
            return result

        try:
            import acoustid
            # Query AcoustID service for matching recordings
            matches = acoustid.parse_lookup_result(
                acoustid.lookup(self.api_key, fp, duration)
            )

            for score, recording_id, title, artist in matches:
                result.score = float(score)
                result.recording_id = recording_id
                result.title = title
                result.artist = artist
                result.acoustid_id = recording_id  # AcoustID maps to MB recording
                logger.info(
                    f"AcoustID match found for {file_path}: MBID={recording_id}, "
                    f"Artist='{artist}', Title='{title}', Score={score}"
                )
                break
        except Exception as e:
            logger.warning(f"AcoustID web service lookup failed for {file_path}: {e}")

        return result
