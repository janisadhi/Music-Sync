"""
Playlist Reconciler.

Responsibility: compare a list of playlist items (from the watcher) against
the Sync DB and perform the minimum necessary writes.

Rules
-----
  NEW     – video exists in playlist but not in Sync DB → INSERT with
            download_status='pending'.  The Downloader will pick it up
            immediately (no need to wait for the full scan to finish).

  EXISTING – video already in Sync DB → UPDATE position / title if changed.
             Never resets download_status on an already-processed song.

  UNAVAILABLE – video was flagged unavailable/private/deleted by the watcher
             → INSERT or UPDATE with download_status='unavailable'.
             Will not be retried by the Downloader unless manually reset.

  REMOVED – video was previously in Sync DB but absent from current scan
            → handle according to delete_local_file_on_playlist_removal:
              True  → delete local audio file + DownloadedTrack record, then
                      delete the Song row.
              False → delete the Song row only; local file is kept on disk.

Concurrency note
----------------
The Reconciler commits after processing EACH playlist item so that the
Downloader can start processing newly inserted songs immediately, without
waiting for the entire playlist scan to complete.
"""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import DownloadedTrack, Playlist, Song
from app.watcher.youtube import UnavailableYouTubeSong, YouTubeSong


# Type alias for the union the watcher returns.
PlaylistItem = YouTubeSong | UnavailableYouTubeSong


class PlaylistReconciler:
    def __init__(self, session: Session):
        self.session = session

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def reconcile(
        self,
        playlist_url: str,
        youtube_playlist_id: str,
        playlist_name: str,
        songs: list[PlaylistItem],
        skip_deletions: bool = False,
        delete_local_file_on_removal: bool = False,
    ) -> list[Song]:
        """
        Reconcile *songs* (watcher output) against the Sync DB.

        Returns the list of newly inserted Song objects (download_status=
        'pending').

        Each item is committed individually so the Downloader can start
        processing new songs before the entire playlist has been scanned.
        """
        # ----------------------------------------------------------
        # Upsert the Playlist record
        # ----------------------------------------------------------
        playlist = self.session.scalar(
            select(Playlist).where(
                Playlist.youtube_playlist_id == youtube_playlist_id
            )
        )

        if playlist is None:
            playlist = Playlist(
                youtube_playlist_id=youtube_playlist_id,
                name=playlist_name,
                url=playlist_url,
            )
            self.session.add(playlist)
            self.session.flush()
        else:
            playlist.name = playlist_name
            playlist.url = playlist_url

        # ----------------------------------------------------------
        # Load existing songs for this playlist (one query)
        # ----------------------------------------------------------
        existing_songs = self.session.scalars(
            select(Song).where(Song.playlist_id == playlist.id)
        ).all()

        existing_by_video_id: dict[str, Song] = {
            song.youtube_video_id: song for song in existing_songs
        }

        # Track which video IDs we see in the current scan.
        scanned_video_ids: set[str] = set()
        new_songs: list[Song] = []

        # ----------------------------------------------------------
        # Process each playlist item
        # ----------------------------------------------------------
        for item in songs:
            scanned_video_ids.add(item.video_id)

            if isinstance(item, UnavailableYouTubeSong):
                self._handle_unavailable(
                    item=item,
                    playlist_id=playlist.id,
                    existing_by_video_id=existing_by_video_id,
                )
            else:
                new_song = self._handle_available(
                    item=item,
                    playlist_id=playlist.id,
                    existing_by_video_id=existing_by_video_id,
                )
                if new_song is not None:
                    new_songs.append(new_song)

            # Commit after each item so the Downloader can pick up new
            # songs immediately while scanning continues.
            self.session.commit()

        # ----------------------------------------------------------
        # Handle removed songs
        # ----------------------------------------------------------
        if not skip_deletions:
            self._handle_removals(
                existing_songs=existing_songs,
                scanned_video_ids=scanned_video_ids,
                delete_local_file=delete_local_file_on_removal,
            )
            self.session.commit()

        return new_songs

    # ------------------------------------------------------------------
    # Per-item handlers
    # ------------------------------------------------------------------

    def _handle_available(
        self,
        item: YouTubeSong,
        playlist_id: int,
        existing_by_video_id: dict[str, Song],
    ) -> Song | None:
        """
        Process an accessible playlist item.

        Returns the newly created Song if it was inserted, else None.
        """
        existing = existing_by_video_id.get(item.video_id)

        if existing is not None:
            # Song already known – update lightweight sync fields.
            # Never downgrade download_status of an already-processed song.
            existing.title = item.title
            existing.position = item.position

            # If the song was previously marked unavailable and it's now
            # accessible again, reset it to pending so it gets downloaded.
            if existing.download_status == "unavailable":
                existing.download_status = "pending"
                existing.error_message = None
                print(
                    f"Previously unavailable video is accessible again: "
                    f"{item.video_id} — reset to pending"
                )

            return None

        # New song – insert with pending status.
        song = Song(
            playlist_id=playlist_id,
            youtube_video_id=item.video_id,
            title=item.title,
            position=item.position,
            download_status="pending",
            lyrics_status="pending",
        )
        self.session.add(song)
        self.session.flush()

        print(f"New song queued for download: {item.title} ({item.video_id})")
        return song

    def _handle_unavailable(
        self,
        item: UnavailableYouTubeSong,
        playlist_id: int,
        existing_by_video_id: dict[str, Song],
    ) -> None:
        """
        Mark an inaccessible playlist slot as 'unavailable'.

        Inserts the row if it doesn't exist yet so we have a record of it.
        Does not schedule a download retry.
        """
        existing = existing_by_video_id.get(item.video_id)

        if existing is not None:
            # Only update if it's not already in a terminal state that
            # we want to preserve (e.g. 'downloaded').
            if existing.download_status not in (
                "downloaded",
                "unavailable",
            ):
                existing.download_status = "unavailable"
                existing.lyrics_status = "unavailable"
                existing.error_message = item.reason
                print(
                    f"Marked unavailable: {item.video_id} — {item.reason}"
                )
            return

        # First time we see this video_id – insert as unavailable.
        song = Song(
            playlist_id=playlist_id,
            youtube_video_id=item.video_id,
            # Use video_id as placeholder title; cannot fetch real title
            # without a per-video request.
            title=f"[Unavailable] {item.video_id}",
            position=item.position,
            download_status="unavailable",
            lyrics_status="unavailable",
            error_message=item.reason,
        )
        self.session.add(song)
        self.session.flush()

        print(
            f"Inserted unavailable video slot: {item.video_id} — {item.reason}"
        )

    # ------------------------------------------------------------------
    # Removal handling
    # ------------------------------------------------------------------

    def _handle_removals(
        self,
        existing_songs: list[Song],
        scanned_video_ids: set[str],
        delete_local_file: bool,
    ) -> None:
        """
        Remove songs that are no longer present in the YouTube playlist.

        If delete_local_file is True, also delete the audio file from disk
        and the DownloadedTrack record.  Otherwise only the Song (Sync DB)
        row is removed and the local file is left intact.
        """
        for song in existing_songs:
            if song.youtube_video_id in scanned_video_ids:
                continue

            print(
                f"Song removed from playlist: "
                f"{song.title} ({song.youtube_video_id})"
            )

            if delete_local_file:
                self._delete_local_file(song)

            self.session.delete(song)

    def _delete_local_file(self, song: Song) -> None:
        """
        Delete the audio and lyrics files for a song that was removed from
        the playlist (only called when delete_local_file_on_removal=True).
        """
        # Delete audio file
        if song.file_path:
            audio_path = Path(song.file_path)
            if audio_path.exists():
                try:
                    audio_path.unlink()
                    print(f"Deleted audio file: {audio_path}")
                except OSError as exc:
                    print(f"Failed to delete audio file {audio_path}: {exc}")

        # Delete lyrics file
        if song.lyrics_path:
            lyrics_path = Path(song.lyrics_path)
            if lyrics_path.exists():
                try:
                    lyrics_path.unlink()
                    print(f"Deleted lyrics file: {lyrics_path}")
                except OSError as exc:
                    print(f"Failed to delete lyrics file {lyrics_path}: {exc}")

        # The DownloadedTrack record will be cascade-deleted by the
        # ForeignKey(ondelete='CASCADE') when the Song row is deleted.
        # But we log it for clarity.
        if song.downloaded_track is not None:
            print(
                f"Removing DownloadedTrack record for: "
                f"{song.youtube_video_id}"
            )
