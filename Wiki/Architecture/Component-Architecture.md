# Component Architecture

## Subsystem Details

### 1. YouTube Watcher (`app/watcher/youtube.py`)

- **Class**: `YouTubePlaylistWatcher`
- **Responsibility**: Fetches video metadata from YouTube playlists using `yt-dlp` flat extraction without making individual HTTP requests per video.
- **Key Operations**:
  - `fetch(watch_mode, watch_limit)`: Returns a list of `YouTubeSong` or `UnavailableYouTubeSong` dataclasses.
  - **Flat Extraction**: Configures `extract_flat=True` and `skip_download=True` for high performance.
  - **Watch Modes**: Supports `whole` (scans entire playlist) and `last_n` (scans only the most recent $N$ items).
  - **Cookie Context**: Wraps calls with `get_cookie_context()` to enable scanning of private or age-restricted playlists.
  - **Unavailable Video Detection**: Identifies titles containing `[Private video]`, `[Deleted video]`, or `[Unavailable video]` and flags them as `UnavailableYouTubeSong`.

---

### 2. Playlist Reconciler (`app/reconciler/service.py`)

- **Class**: `PlaylistReconciler`
- **Responsibility**: Reconciles YouTube playlist state with PostgreSQL `songs` records.
- **Key Operations**:
  - `reconcile(...)`: Performs database diffing for a single playlist.
  - **New Song Insertion**: Creates new `Song` rows with `download_status='pending'` and `lyrics_status='pending'`.
  - **Granular Commits**: Commits the DB transaction **after each song**, allowing the `DownloaderWorker` thread to pick up new tracks immediately while scanning continues.
  - **Removal Handling**: When videos are removed from a YouTube playlist:
    - If `delete_local_file_on_playlist_removal == True`: unlinks local audio (`file_path`) and lyrics (`lyrics_path`) files from disk before deleting the `Song` row.
    - If `False`: deletes the `Song` row only, leaving files on disk intact.
  - **Unavailable Status Persistence**: Once a song is marked `unavailable` (due to non-retryable errors or age/region restrictions), periodic playlist scans do **not** automatically reset its status to `pending`. It will only be re-queued for download when manually reset by a user (via `POST /songs/{id}/retry-download`).
  - **Watch Mode Protection**: When `watch_mode == 'last_n'`, deletion handling is skipped (`skip_deletions=True`) to prevent accidental deletion of older playlist tracks not returned in the slice.

---

### 3. Downloader Worker & Service (`app/downloader/`)

- **Classes**: `SongDownloader` (`service.py`), `DownloaderWorker` (`worker.py`)
- **Responsibility**: Drains the pending audio download queue and manages retries.
- **Key Operations**:
  - **Worker Polling Loop**: `DownloaderWorker` runs a daemon thread polling every 1 second when active, 5 seconds when idle.
  - **Audio Download**: Extracts Opus audio via `yt-dlp` (`format="bestaudio/best"`), embeds artwork thumbnail using FFmpeg/AtomicParsley.
  - **Music Library Population**: Writes a `DownloadedTrack` record containing rich ID3/Opus metadata (`artist`, `album`, `genre`, `release_year`, `duration_seconds`) upon successful download.
  - **Stale Download Recovery**: `recover_stale_downloads()` checks for tracks stuck in `downloading` status on startup and recovers them.
  - **Failure Classification**: `_is_retryable_error()` distinguishes transient errors from permanent errors (private/deleted video, sign-in required).
  - **Exponential Backoff**: Calculates retry attempt time: $\text{next\_attempt} = \text{now} + (\text{base\_delay} \times 2^{\text{retry\_count}-1})$.

---

### 4. Lyrics Worker & Service (`app/lyrics/`)

- **Classes**: `LyricsService` (`service.py`), `LyricsWorker` (`worker.py`)
- **Responsibility**: Drains the pending lyrics queue for downloaded tracks.
- **Key Operations**:
  - **Worker Polling Loop**: `LyricsWorker` runs a daemon thread polling every 2 seconds when active, 10 seconds when idle.
  - **LRCLIB Search**: Queries `https://lrclib.net/api/search` using track title and `DownloadedTrack.artist` metadata.
  - **Title Sanitization**: Strips parenthetical noise (e.g. `(Official Video)`, `(Remastered 2020)`) to maximize search match rates.
  - **Synced Lyrics Storage**: Writes `.lrc` files adjacent to audio files (`lyrics_status='downloaded'`).
  - **No-Lyrics File Reorganization**: If synced lyrics are unavailable from LRCLIB (`lyrics_status='unavailable'`), moves the audio file from `<Playlist>/music/` to `<Playlist>/no-lyrics/` and updates `Song.file_path`.

---

### 5. Sync Scheduler (`app/scheduler/service.py`)

- **Class**: `MusicSyncScheduler`
- **Responsibility**: Periodically triggers `SyncService.run()`.
- **Key Operations**:
  - Wraps APScheduler `BackgroundScheduler`.
  - **Overlap Prevention**: Employs a thread-safe `sync_running` boolean flag with a `Lock` object, skipping trigger execution if a previous sync cycle is active.
  - **Sync History**: Maintains a rolling buffer of the last 100 sync executions.
  - **Dynamic Interval Updates**: Updates trigger interval live via `update_interval(seconds)`.

---

### 6. Application Settings (`app/settings/service.py`)

- **Class**: `SettingsService`
- **Responsibility**: Manages runtime settings stored in PostgreSQL `app_settings` (ID = 1).
- **Key Operations**:
  - `get()`: Returns current settings, auto-seeding defaults if empty.
  - `update()`: Updates settings using `Ellipsis` (`...`) default parameters to allow explicit `None` clearing (e.g. clearing `youtube_cookies` or `playlist_watch_limit`).
