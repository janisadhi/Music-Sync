import os
import shutil
import logging
from pathlib import Path

from sqlalchemy.orm import Session
from app.database.models import DownloadedTrack, Song
from app.core.paths import resolve_file_path, sanitize_filename

logger = logging.getLogger("metadata_service.organizer")


class FileOrganizer:
    """Manages audio file reorganization and lockstep .lrc lyrics relocation."""

    @staticmethod
    def rename_track_and_lyrics(
        session: Session,
        downloaded_track: DownloadedTrack,
        new_artist: str | None,
        new_title: str | None,
        auto_rename: bool = True,
    ) -> dict[str, str | None]:
        """
        Renames audio file to 'Artist Name - Music Title.extension' in place,
        and renames matching .lrc lyrics file to 'Artist Name - Music Title.lrc' in lockstep.
        If auto_rename is False, physical renaming is skipped.
        """
        old_audio_path = downloaded_track.file_path
        result_paths = {
            "old_audio_path": old_audio_path,
            "new_audio_path": old_audio_path,
            "old_lyrics_path": None,
            "new_lyrics_path": None,
            "renamed": False,
        }

        if not old_audio_path or not auto_rename:
            return result_paths

        resolved_old_path = str(resolve_file_path(old_audio_path))
        if not os.path.exists(resolved_old_path):
            # Fallback: file may have been moved to no-lyrics/ by the lyrics
            # service, which updates Song.file_path but historically did not
            # update DownloadedTrack.file_path.
            song = session.query(Song).filter(Song.id == downloaded_track.song_id).first()
            if song and song.file_path:
                song_resolved = str(resolve_file_path(song.file_path))
                if os.path.exists(song_resolved):
                    resolved_old_path = song_resolved
                    old_audio_path = song.file_path
                    downloaded_track.file_path = old_audio_path
                    logger.info(f"Track {downloaded_track.id}: synced stale DT path to Song path: {old_audio_path}")
                else:
                    logger.warning(f"File not found on disk for track {downloaded_track.id}: {old_audio_path}")
                    return result_paths
            else:
                logger.warning(f"File not found on disk for track {downloaded_track.id}: {old_audio_path}")
                return result_paths

        old_audio_obj = Path(resolved_old_path)
        ext = old_audio_obj.suffix

        # Format stem: Artist Name - Music Title
        artist_clean = sanitize_filename(new_artist.strip()) if new_artist and new_artist.strip() and new_artist.strip().lower() != "unknown artist" else None
        title_clean = sanitize_filename(new_title.strip()) if new_title and new_title.strip() else None

        if artist_clean and title_clean:
            base_stem = f"{artist_clean} - {title_clean}"
        elif title_clean:
            base_stem = title_clean
        else:
            return result_paths

        target_dir = old_audio_obj.parent
        target_filename = f"{base_stem}{ext}"
        target_audio_obj = target_dir / target_filename

        # Collision avoidance: If target already exists and is a different file, add counter
        count = 1
        while target_audio_obj.exists() and target_audio_obj.resolve() != old_audio_obj.resolve():
            target_filename = f"{base_stem} ({count}){ext}"
            target_audio_obj = target_dir / target_filename
            count += 1

        target_audio_path = str(target_audio_obj)

        # Check lyrics file
        song = session.query(Song).filter(Song.id == downloaded_track.song_id).first()
        old_lyrics_path = song.lyrics_path if song else None

        lyrics_src = None
        if old_lyrics_path:
            resolved_lrc = str(resolve_file_path(old_lyrics_path))
            if os.path.exists(resolved_lrc):
                lyrics_src = resolved_lrc
        if not lyrics_src:
            potential_lrc = old_audio_obj.with_suffix(".lrc")
            if potential_lrc.exists():
                lyrics_src = str(potential_lrc)

        result_paths["old_lyrics_path"] = lyrics_src

        # Perform lockstep relocation
        success = FileOrganizer.relocate_track_and_lyrics(
            session=session,
            downloaded_track=downloaded_track,
            new_audio_path=target_audio_path,
        )

        if success:
            result_paths["new_audio_path"] = target_audio_path
            result_paths["new_lyrics_path"] = (
                str(target_audio_obj.with_suffix(".lrc")) if lyrics_src else None
            )
            result_paths["renamed"] = (target_audio_path != resolved_old_path)

        return result_paths

    @staticmethod
    def relocate_track_and_lyrics(
        session: Session,
        downloaded_track: DownloadedTrack,
        new_audio_path: str,
    ) -> bool:
        """
        Relocates audio track and matching .lrc lyrics file (if present) in lockstep,
        updating downloaded_tracks.file_path, songs.file_path, and songs.lyrics_path in DB.
        """
        old_audio_path = downloaded_track.file_path
        if not old_audio_path:
            return False

        resolved_old_audio = str(resolve_file_path(old_audio_path))
        resolved_new_audio = str(resolve_file_path(new_audio_path))

        if resolved_old_audio == resolved_new_audio:
            return True

        old_audio_path_obj = Path(resolved_old_audio)
        new_audio_path_obj = Path(resolved_new_audio)

        # Ensure destination directory exists
        new_audio_path_obj.parent.mkdir(parents=True, exist_ok=True)

        song = session.query(Song).filter(Song.id == downloaded_track.song_id).first()
        old_lyrics_path = song.lyrics_path if song else None
        new_lyrics_path = None

        lyrics_to_move_src = None
        if old_lyrics_path:
            resolved_lrc = str(resolve_file_path(old_lyrics_path))
            if os.path.exists(resolved_lrc):
                lyrics_to_move_src = resolved_lrc
        if not lyrics_to_move_src:
            potential_lrc = old_audio_path_obj.with_suffix(".lrc")
            if potential_lrc.exists():
                lyrics_to_move_src = str(potential_lrc)

        if lyrics_to_move_src:
            new_lyrics_path = str(new_audio_path_obj.with_suffix(".lrc"))

        audio_moved = False
        lyrics_moved = False

        try:
            # Move audio file if source exists and is different
            if old_audio_path_obj.exists() and str(old_audio_path_obj) != str(new_audio_path_obj):
                shutil.move(str(old_audio_path_obj), str(new_audio_path_obj))
                audio_moved = True
                logger.info(f"Renamed/Moved audio: {resolved_old_audio} -> {resolved_new_audio}")

            # Move lyrics file in lockstep
            if lyrics_to_move_src and new_lyrics_path and lyrics_to_move_src != new_lyrics_path:
                shutil.move(lyrics_to_move_src, new_lyrics_path)
                lyrics_moved = True
                logger.info(f"Renamed/Moved lyrics in lockstep: {lyrics_to_move_src} -> {new_lyrics_path}")

            # Update DB paths
            downloaded_track.file_path = resolved_new_audio
            if song:
                song.file_path = resolved_new_audio
                if new_lyrics_path:
                    song.lyrics_path = new_lyrics_path

            session.flush()
            return True

        except Exception as e:
            logger.exception(f"Error during file relocation for track {downloaded_track.id}: {e}")
            # Fallback / Rollback file moves if operation failed
            if lyrics_moved and new_lyrics_path and lyrics_to_move_src:
                try:
                    shutil.move(new_lyrics_path, lyrics_to_move_src)
                except Exception as rollback_err:
                    logger.error(f"Failed to rollback lyrics move: {rollback_err}")

            if audio_moved and resolved_old_audio:
                try:
                    shutil.move(str(new_audio_path_obj), resolved_old_audio)
                except Exception as rollback_err:
                    logger.error(f"Failed to rollback audio move: {rollback_err}")

            session.rollback()
            return False
