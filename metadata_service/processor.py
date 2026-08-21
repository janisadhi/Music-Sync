import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine, func

from app.database.models import DownloadedTrack, Song, TrackMetadataHistory
from app.core.paths import resolve_file_path
from metadata_service.config import settings
from metadata_service.schemas import ScanJobStatus, LibraryMetrics, MetadataStatusResponse
from metadata_service.scanner import DirectoryScanner
from metadata_service.normalizer import (
    clean_title,
    clean_artist,
    parse_youtube_title,
    is_known_record_label_or_channel,
)
from metadata_service.musicbrainz import MusicBrainzClient
from metadata_service.matcher import CandidateMatcher, MatchResult
from metadata_service.tag_writer import TagWriter
from metadata_service.organizer import FileOrganizer

from metadata_service.beets_adapter import BeetsAdapter
from metadata_service.fingerprint import AudioFingerprinter
from metadata_service.spotify_client import SpotifyEnricher

logger = logging.getLogger("metadata_service.processor")

# Database session factory for background jobs
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class MetadataProcessor:
    """Orchestrates scan jobs, state transitions, Beets, AcoustID fingerprinting, MusicBrainz & Spotify enrichment, tag writing, and history."""

    def __init__(self):
        self.scanner = DirectoryScanner()
        self.musicbrainz = MusicBrainzClient()
        self.matcher = CandidateMatcher()
        self.tag_writer = TagWriter()
        self.organizer = FileOrganizer()
        self.beets = BeetsAdapter()
        self.fingerprinter = AudioFingerprinter(api_key=settings.acoustid_api_key)
        self.spotify = SpotifyEnricher(
            client_id=settings.spotify_client_id,
            client_secret=settings.spotify_client_secret,
        )
        self._lock = threading.Lock()
        self.is_scanning: bool = False
        self.current_job: ScanJobStatus | None = None

    def get_status(self) -> MetadataStatusResponse:
        """Computes current scan status and database library metrics."""
        session: Session = SessionLocal()
        try:
            total_files = session.query(func.count(DownloadedTrack.id)).scalar() or 0
            raw_files = (
                session.query(func.count(DownloadedTrack.id))
                .filter(DownloadedTrack.metadata_state == "raw")
                .scalar() or 0
            )
            processing_files = (
                session.query(func.count(DownloadedTrack.id))
                .filter(DownloadedTrack.metadata_state == "processing")
                .scalar() or 0
            )
            enriched_files = (
                session.query(func.count(DownloadedTrack.id))
                .filter(DownloadedTrack.metadata_state.in_(["enriched", "normalized"]))
                .scalar() or 0
            )
            failed_files = (
                session.query(func.count(DownloadedTrack.id))
                .filter(DownloadedTrack.metadata_state == "failed")
                .scalar() or 0
            )
            skipped_files = (
                session.query(func.count(DownloadedTrack.id))
                .filter(DownloadedTrack.metadata_state == "low_confidence")
                .scalar() or 0
            )
            beets_edited_count = (
                session.query(func.count(DownloadedTrack.id))
                .filter(DownloadedTrack.beets_metadata_edited == True)
                .scalar() or 0
            )

            metrics = LibraryMetrics(
                total_files=total_files,
                raw_files=raw_files,
                processing_files=processing_files,
                enriched_files=enriched_files,
                low_confidence_files=skipped_files,
                failed_files=failed_files,
                skipped_files=skipped_files,
                beets_edited_count=beets_edited_count,
            )

            with self._lock:
                return MetadataStatusResponse(
                    is_scanning=self.is_scanning,
                    current_job=self.current_job,
                    metrics=metrics,
                )
        finally:
            session.close()

    def start_scan_job(self, force_reprocess: bool = False) -> ScanJobStatus:
        """Launches background library scan job if not already running."""
        with self._lock:
            if self.is_scanning:
                if self.current_job:
                    return self.current_job
                raise RuntimeError("Scan job already in progress")

            job_id = f"scan_{uuid.uuid4().hex[:8]}"
            self.current_job = ScanJobStatus(
                job_id=job_id,
                status="started",
                started_at=datetime.now(timezone.utc),
            )
            self.is_scanning = True

        thread = threading.Thread(
            target=self._run_scan,
            args=(force_reprocess,),
            daemon=True,
        )
        thread.start()
        return self.current_job

    def _run_scan(self, force_reprocess: bool):
        session: Session = SessionLocal()
        try:
            with self._lock:
                if self.current_job:
                    self.current_job.status = "running"

            # 1. Reset any stale "processing" tracks left over from crashed runs
            stale_tracks = (
                session.query(DownloadedTrack)
                .filter(DownloadedTrack.metadata_state == "processing")
                .all()
            )
            for t in stale_tracks:
                t.metadata_state = "raw"
            session.commit()

            # 2. Get tracks eligible for enrichment
            tracks = self.scanner.get_tracks_for_enrichment(session, force_reprocess=force_reprocess)
            with self._lock:
                if self.current_job:
                    self.current_job.total_tracks = len(tracks)

            logger.info(f"Starting metadata scan job for {len(tracks)} tracks")

            for track in tracks:
                if not self.is_scanning:
                    break

                self.enrich_single_track(session, track, force_reprocess=force_reprocess)

                with self._lock:
                    if self.current_job:
                        self.current_job.processed_tracks += 1
                        if track.metadata_state == "enriched":
                            self.current_job.enriched_tracks += 1
                        elif track.metadata_state == "failed":
                            self.current_job.failed_tracks += 1

            with self._lock:
                if self.current_job:
                    self.current_job.status = "completed"
                    self.current_job.finished_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.exception(f"Error during metadata scan job: {e}")
            with self._lock:
                if self.current_job:
                    self.current_job.status = "failed"
                    self.current_job.error = str(e)
                    self.current_job.finished_at = datetime.now(timezone.utc)
        finally:
            session.close()
            with self._lock:
                self.is_scanning = False

    def enrich_single_track(
        self,
        session: Session,
        track: DownloadedTrack,
        force_reprocess: bool = False,
        dry_run: bool = False,
    ) -> bool | dict[str, Any]:
        """Processes a single track through precise normalization, MusicBrainz scoring, tag writing, and lockstep file renaming."""
        if not track.file_path:
            track.metadata_state = "failed"
            if not dry_run:
                session.commit()
            return False

        resolved_path = str(resolve_file_path(track.file_path))

        # Idempotency check: If track is already enriched and force_reprocess is False, skip
        if not dry_run and not force_reprocess and track.metadata_state in ("enriched", "low_confidence") and track.beets_metadata_edited:
            logger.info(f"Track {track.id} is already processed ({track.metadata_state}). Skipping.")
            return True

        song = session.query(Song).filter(Song.id == track.song_id).first()

        # Capture pre-enrichment metadata snapshot
        previous_metadata_dict = {
            "title": track.title,
            "artist": track.artist,
            "album": track.album,
            "album_artist": track.album_artist,
            "genre": track.genre,
            "track_number": track.track_number,
            "release_year": track.release_year,
            "artwork_embedded": getattr(track, "artwork_embedded", False),
            "thumbnail_url": getattr(track, "thumbnail_url", None),
        }
        previous_filename = resolved_path
        previous_lyrics_filename = song.lyrics_path if song else None

        if not dry_run:
            # Transition state: processing -> resolving
            track.metadata_state = "processing"
            session.commit()

        try:
            from app.database.models import AppSettings
            app_settings = session.get(AppSettings, 1)
            auto_rename = app_settings.auto_rename_files if app_settings else True
            min_confidence = app_settings.min_confidence_threshold if app_settings else "MEDIUM"
            clean_noise = app_settings.clean_youtube_titles if app_settings else True

            # 1. AUDIO FINGERPRINTING & ACOUSTID LOOKUP
            fp_res = self.fingerprinter.lookup_acoustid(resolved_path)
            if fp_res.fingerprint:
                setattr(track, "fingerprint", fp_res.fingerprint)
            if fp_res.acoustid_id:
                setattr(track, "acoustid_id", fp_res.acoustid_id)

            # 2. BEETS IMPORT & AUTOTAGGING ENGINE
            beets_success = False
            if not dry_run:
                beets_success = self.beets.run_beets_import(resolved_path)
            beets_tags = self.beets.extract_tags(resolved_path)

            # 3. ARTIST RESOLUTION & TITLE PARSING
            artist_from_title, title_from_title = parse_youtube_title(track.title)

            resolved_artist = beets_tags.get("artist") or artist_from_title or fp_res.artist
            if not resolved_artist:
                if track.artist and not is_known_record_label_or_channel(track.artist):
                    resolved_artist = clean_artist(track.artist)

            if clean_noise:
                clean_song_title = beets_tags.get("title") or title_from_title or fp_res.title or clean_title(track.title)
            else:
                clean_song_title = beets_tags.get("title") or title_from_title or fp_res.title or track.title

            target_album_context = track.album or beets_tags.get("album")

            target_dict = {
                "title": clean_song_title,
                "artist": resolved_artist,
                "album": target_album_context,
                "duration_seconds": track.duration_seconds,
                "release_year": beets_tags.get("release_year") or track.release_year,
            }

            fallback_dict = {
                "title": clean_song_title,
                "artist": resolved_artist or "Unknown Artist",
                "album": target_album_context,
                "genre": beets_tags.get("genre") or track.genre,
                "track_number": beets_tags.get("track_number") or track.track_number,
                "release_year": beets_tags.get("release_year") or track.release_year,
            }

            # 4. MUSICBRAINZ RESOLUTION WITH RELEASE SELECTOR SCORING
            mb_recording_id = fp_res.recording_id or beets_tags.get("musicbrainz_recording_id")
            mb_candidates = []

            if mb_recording_id:
                mb_candidates = self.musicbrainz.search_recordings(
                    title=clean_song_title,
                    artist=resolved_artist,
                    recording_id=mb_recording_id,
                    target_album_context=target_album_context,
                )

            if not mb_candidates:
                mb_candidates = self.musicbrainz.search_recordings(
                    title=target_dict["title"],
                    artist=target_dict["artist"],
                    target_album_context=target_album_context,
                )

            # Evaluate Candidate Match
            match_result: MatchResult = self.matcher.evaluate(
                target=target_dict,
                candidates=mb_candidates,
                fallback_metadata=fallback_dict,
            )

            # 5. SPOTIFY METADATA ENRICHMENT (Does not override canonical MusicBrainz album identity)
            spotify_res = self.spotify.search_track(
                title=match_result.title or clean_song_title,
                artist=match_result.artist or resolved_artist,
                album=match_result.album or target_album_context,
            )

            if spotify_res.spotify_track_id:
                setattr(track, "spotify_track_id", spotify_res.spotify_track_id)
                setattr(track, "spotify_artist_id", spotify_res.spotify_artist_id)
                setattr(track, "spotify_album_id", spotify_res.spotify_album_id)

            # Determine match confidence against configured threshold
            allowed_confidences = ("HIGH",) if min_confidence == "HIGH" else ("HIGH", "MEDIUM")
            is_enriched = match_result.confidence in allowed_confidences

            # Compute proposed metadata values
            proposed_title = match_result.title if is_enriched else clean_song_title
            proposed_artist = match_result.artist if (is_enriched and match_result.artist and match_result.artist != "Unknown Artist") else (resolved_artist or track.artist)
            proposed_album = match_result.album if is_enriched else (spotify_res.album or target_album_context)
            proposed_year = match_result.release_year if is_enriched else (spotify_res.release_year or track.release_year)

            if dry_run:
                # DRY RUN MODE: Return detailed debug dictionary without modifying disk or DB
                return {
                    "dry_run": True,
                    "track_id": track.id,
                    "file_path": resolved_path,
                    "original_metadata": previous_metadata_dict,
                    "fingerprint": fp_res.fingerprint,
                    "acoustid_id": fp_res.acoustid_id,
                    "musicbrainz_recording_id": match_result.recording_id,
                    "selected_release_id": match_result.release_id,
                    "selected_release_group_id": match_result.release_group_id,
                    "match_confidence": match_result.confidence,
                    "match_score": match_result.score,
                    "proposed_metadata": {
                        "title": proposed_title,
                        "artist": proposed_artist,
                        "album": proposed_album,
                        "album_artist": proposed_artist,
                        "release_year": proposed_year,
                    },
                    "spotify_enrichment": {
                        "spotify_track_id": spotify_res.spotify_track_id,
                        "popularity": spotify_res.popularity,
                        "artwork_url": spotify_res.artwork_url,
                    },
                    "release_selection_debug_log": match_result.debug_log,
                }

            if is_enriched:
                track.title = proposed_title
                track.artist = proposed_artist
                track.album_artist = proposed_artist
                track.album = proposed_album
                track.release_year = proposed_year

                # Persist MusicBrainz identifiers
                setattr(track, "musicbrainz_recording_id", match_result.recording_id or beets_tags.get("musicbrainz_recording_id"))
                setattr(track, "musicbrainz_artist_id", match_result.artist_id or beets_tags.get("musicbrainz_artist_id"))

                resolved_tags = {
                    "title": track.title,
                    "artist": track.artist,
                    "album": track.album,
                    "album_artist": track.album_artist,
                    "genre": track.genre,
                    "track_number": track.track_number,
                    "release_year": track.release_year,
                }

                # Write audio tags
                tag_success = self.tag_writer.write_tags(resolved_path, resolved_tags)
                if tag_success:
                    self.tag_writer.verify_written_tags(resolved_path, resolved_tags)

                # Auto-find and replace album cover art if available from Spotify/Beets
                artwork_url = spotify_res.artwork_url
                if artwork_url:
                    try:
                        import httpx
                        with httpx.Client(timeout=10.0) as http_client:
                            art_resp = http_client.get(artwork_url)
                            if art_resp.status_code == 200 and art_resp.content:
                                mime_type = art_resp.headers.get("content-type", "image/jpeg")
                                art_ok = self.tag_writer.embed_artwork(
                                    file_path=resolved_path,
                                    image_bytes=art_resp.content,
                                    mime_type=mime_type,
                                )
                                if art_ok:
                                    track.artwork_embedded = True
                                    track.thumbnail_url = artwork_url
                                    logger.info(f"Auto-replaced cover art for track {track.id} from {artwork_url}")
                    except Exception as art_err:
                        logger.warning(f"Auto artwork embedding warning for track {track.id}: {art_err}")

                if beets_tags.get("artwork_embedded"):
                    track.artwork_embedded = True

                # Lockstep Audio & Lyrics File Renaming ONLY IF ENRICHED
                rename_res = self.organizer.rename_track_and_lyrics(
                    session=session,
                    downloaded_track=track,
                    new_artist=track.artist,
                    new_title=track.title,
                    auto_rename=auto_rename,
                )

                track.metadata_state = "enriched"
                track.beets_metadata_edited = True
            else:
                track.metadata_state = "low_confidence"
                track.beets_metadata_edited = False

            new_metadata_dict = {
                "title": track.title,
                "artist": track.artist,
                "album": track.album,
                "album_artist": track.album_artist,
                "genre": track.genre,
                "track_number": track.track_number,
                "release_year": track.release_year,
                "artwork_embedded": getattr(track, "artwork_embedded", False),
                "thumbnail_url": getattr(track, "thumbnail_url", None),
                "musicbrainz_recording_id": getattr(track, "musicbrainz_recording_id", None),
                "acoustid_id": getattr(track, "acoustid_id", None),
                "spotify_track_id": getattr(track, "spotify_track_id", None),
            }

            # Record audit history
            history_entry = TrackMetadataHistory(
                downloaded_track_id=track.id,
                action=f"metadata_enrichment_{match_result.confidence.lower()}",
                previous_metadata=json.dumps(previous_metadata_dict),
                new_metadata=json.dumps(new_metadata_dict),
                previous_filename=previous_filename,
                new_filename=track.file_path,
                previous_lyrics_filename=previous_lyrics_filename,
                new_lyrics_filename=song.lyrics_path if song else None,
                match_source=match_result.source if match_result.confidence != "FALLBACK" else ("beets" if beets_success else "acoustid" if fp_res.acoustid_id else "youtube"),
                match_confidence=match_result.confidence,
                musicbrainz_recording_id=getattr(track, "musicbrainz_recording_id", None),
                musicbrainz_artist_id=getattr(track, "musicbrainz_artist_id", None),
                acoustid_id=getattr(track, "acoustid_id", None),
                spotify_track_id=getattr(track, "spotify_track_id", None),
                status="success" if match_result.confidence in ("HIGH", "MEDIUM") else "low_confidence",
                error_message=match_result.reason,
            )
            session.add(history_entry)
            session.commit()
            return True

        except Exception as e:
            logger.exception(f"Failed to enrich track {track.id}: {e}")
            session.rollback()
            track.metadata_state = "failed"

            history_entry = TrackMetadataHistory(
                downloaded_track_id=track.id,
                action="enrichment_failed",
                previous_metadata=json.dumps(previous_metadata_dict),
                new_metadata=json.dumps(previous_metadata_dict),
                previous_filename=previous_filename,
                new_filename=track.file_path,
                previous_lyrics_filename=previous_lyrics_filename,
                new_lyrics_filename=song.lyrics_path if song else None,
                status="failed",
                error_message=str(e),
            )
            session.add(history_entry)
            session.commit()
            return False
