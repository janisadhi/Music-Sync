# Important Workflows

## 1. Adding & Syncing a New Playlist

1. **User Action**: User submits `POST /playlists` with `{"url": "https://music.youtube.com/playlist?list=PL..."}`.
2. **URL Extraction**: `extract_playlist_id(url)` parses the `list` query parameter from the URL string.
3. **Metadata Fetching**: If `name` is omitted, `YouTubePlaylistWatcher.fetch_playlist_metadata()` is invoked to fetch the title from YouTube.
4. **Database Insertion**: A new `Playlist` record is inserted with `enabled=True`.
5. **Initial Discovery**: `SyncService.sync_single_playlist(playlist_id)` is invoked (or queued).
6. **Flat Scan**: `YouTubePlaylistWatcher` extracts video IDs and titles.
7. **Reconciliation**: `PlaylistReconciler` inserts new `Song` rows with `download_status='pending'` and `lyrics_status='pending'`, committing after each song.
8. **Downloader Pickup**: `DownloaderWorker` thread claims pending songs on its next poll cycle.

---

## 2. Audio Downloader Retry Workflow

1. **Worker Polling**: `DownloaderWorker` queries songs where `download_status == 'pending'` or (`download_status == 'failed'` AND `next_download_attempt <= now`).
2. **Download Execution**: `SongDownloader.download_song(song)` invokes `yt-dlp` in a thread worker.
3. **Transient Failure Triggered**: If `yt-dlp` raises a retryable exception (e.g. HTTP 503, network timeout):
   - `_is_retryable_error(exc)` returns `True`.
   - `song.download_retry_count` is incremented by 1.
4. **Backoff Calculation**:
   - If `song.download_retry_count < AppSettings.max_download_retries`:
     - Sets `song.download_status = 'failed'`.
     - Calculates $\text{next\_download\_attempt} = \text{now} + (\text{download\_retry\_delay\_seconds} \times 2^{\text{retry\_count}-1})$.
   - If `song.download_retry_count >= AppSettings.max_download_retries`:
     - Sets `song.download_status = 'failed'`.
     - Sets `next_download_attempt = None` (permanently failed, stops polling).

---

## 3. Lyrics Processing & File Reorganization Workflow

1. **Worker Polling**: `LyricsWorker` queries songs with `download_status == 'downloaded'` AND `lyrics_status == 'pending'`.
2. **Metadata Lookup**: Retrieves `DownloadedTrack` record to obtain `artist` and `title`.
3. **Title Cleaning**: `_clean_title()` strips noise expressions (`(Official Video)`, `(Remastered)`).
4. **LRCLIB Query**: `GET https://lrclib.net/api/search?q=<title>+<artist>`.
5. **Match Handling**:
   - **Synced Lyrics Found**: Writes `.lrc` file to `<Playlist>/music/<Title>.lrc`. Sets `lyrics_status = 'downloaded'`.
   - **Lyrics Unavailable**: Moves audio file from `<Playlist>/music/<Title>.opus` to `<Playlist>/no-lyrics/<Title>.opus`. Updates `Song.file_path` to new path. Sets `lyrics_status = 'unavailable'`.

---

## 4. Manual Lyrics Retry Workflow

1. **User Action**: User submits `POST /songs/{id}/retry-lyrics` via API or dashboard.
2. **File Restoration**: If the audio file was previously moved to `no-lyrics/`:
   - Checks if `song.file_path` contains `/no-lyrics/`.
   - Moves audio file back to `<Playlist>/music/<Title>.opus`.
   - Updates `song.file_path` to the restored `music/` path.
3. **State Reset**: Sets `song.lyrics_status = 'pending'`, clears `song.lyrics_path` and `song.error_message`.
4. **Worker Pickup**: `LyricsWorker` picks up the song on its next poll cycle and re-queries LRCLIB.

---

## 5. Deleting a Song

1. **User Action**: User submits `DELETE /songs/{id}`.
2. **Audio File Deletion**: If `song.file_path` exists on disk, unlinks and deletes the audio file.
3. **Lyrics File Deletion**: If `song.lyrics_path` exists on disk, unlinks and deletes the `.lrc` file.
4. **Database Record Cleanup**: Deletes the `Song` row from PostgreSQL (cascade-deleting the corresponding `DownloadedTrack` row).
