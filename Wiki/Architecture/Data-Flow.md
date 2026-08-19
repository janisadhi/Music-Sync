# Data Flow & Workflows

## 1. Playlist Synchronization Workflow

This flow details how new tracks are discovered from YouTube playlists and queued into the database.

```mermaid
sequenceDiagram
    autonumber
    participant S as MusicSyncScheduler
    participant SVC as SyncService
    participant W as YouTubePlaylistWatcher
    participant R as PlaylistReconciler
    participant DB as PostgreSQL DB
    participant DL as DownloaderWorker

    S->>SVC: run()
    SVC->>DB: Query enabled playlists & AppSettings
    DB-->>SVC: Playlists & Settings
    loop For each enabled playlist
        SVC->>W: fetch(watch_mode, watch_limit)
        W->>YT: yt-dlp flat extraction
        YT-->>W: Video entries metadata
        W-->>SVC: List[YouTubeSong / UnavailableYouTubeSong]
        
        loop For each song item
            SVC->>R: reconcile(item)
            alt New Song
                R->>DB: INSERT INTO songs (download_status='pending', lyrics_status='pending')
            else Existing Song
                R->>DB: UPDATE songs position / title
            else Removed Song & delete_local_file=True
                R->>DB: DELETE FROM songs (and unlink local files)
            end
            R->>DB: COMMIT (per item)
            Note over DB,DL: DB commit allows DownloaderWorker to claim song immediately
        end
    end
```

---

## 2. Audio Download & Metadata Tagging Flow

This flow details how pending audio download tasks are claimed, processed via `yt-dlp`, and stored as rich track records.

```mermaid
sequenceDiagram
    autonumber
    participant DLW as DownloaderWorker
    participant DL as SongDownloader
    participant DB as PostgreSQL DB
    participant YT as YouTube Music
    participant FS as Local Filesystem

    loop Polling Loop (Active: 1s, Idle: 5s)
        DLW->>DL: download_pending(limit)
        DL->>DB: SELECT song_id WHERE download_status='pending' OR (status='failed' AND retry_due)
        DB-->>DL: Pending Song IDs
        
        loop For each song ID (Concurrent ThreadPoolExecutor)
            DL->>DB: UPDATE songs SET download_status='downloading' WHERE id=song_id
            DL->>YT: yt-dlp download audio (Opus + Deno EJS + Netscape cookies)
            YT-->>FS: Save /downloads/<Playlist>/music/<Title>.opus
            DL->>FS: Embed thumbnail artwork via AtomicParsley / FFmpeg
            
            alt Download Successful
                DL->>DB: INSERT INTO downloaded_tracks (song_id, title, artist, album, duration...)
                DL->>DB: UPDATE songs SET download_status='downloaded', file_path=...
            else Download Failed (Retryable)
                DL->>DB: UPDATE songs SET download_status='failed', retry_count+=1, next_download_attempt=now+backoff
            else Download Failed (Permanent / Unavailable)
                DL->>DB: UPDATE songs SET download_status='unavailable', lyrics_status='unavailable'
            end
        end
    end
```

---

## 3. Lyrics Fetching & Reorganization Flow

This flow details how downloaded tracks are processed for synchronized `.lrc` lyrics via LRCLIB.

```mermaid
sequenceDiagram
    autonumber
    participant LW as LyricsWorker
    participant LS as LyricsService
    participant DB as PostgreSQL DB
    participant LRC as LRCLIB.net API
    participant FS as Local Filesystem

    loop Polling Loop (Active: 2s, Idle: 10s)
        LW->>LS: process_pending(limit)
        LS->>DB: SELECT song_id WHERE download_status='downloaded' AND lyrics_status='pending'
        DB-->>LS: Pending Songs
        
        loop For each song ID
            LS->>DB: Query Song + DownloadedTrack (for artist/album)
            LS->>LRC: GET /api/search?q=CleanedTitle+Artist
            
            alt Synced Lyrics Found
                LRC-->>LS: Synced LRC Content
                LS->>FS: Write /downloads/<Playlist>/music/<Title>.lrc
                LS->>DB: UPDATE songs SET lyrics_status='downloaded', lyrics_path=...
            else Lyrics Unavailable (404 / No Match)
                LS->>FS: Move audio file to /downloads/<Playlist>/no-lyrics/<Title>.opus
                LS->>DB: UPDATE songs SET lyrics_status='unavailable', file_path=new_path
                Note over DB,LS: BUG-01 Note: downloaded_tracks.file_path is currently NOT updated
            end
        end
    end
```

---

## 4. Reconciler Removal Workflow

This flow details what happens when a video is removed from a YouTube playlist.

```text
[Sync Cycle Scan] -> Detects video missing from YouTube Playlist
        │
        ▼
[PlaylistReconciler._handle_removals]
        │
        ├── IF delete_local_file_on_playlist_removal == True:
        │      1. Unlink audio file from disk (`song.file_path`)
        │      2. Unlink lyrics file from disk (`song.lyrics_path`)
        │      3. DELETE FROM songs WHERE id = song_id (Cascade deletes downloaded_tracks)
        │
        └── IF delete_local_file_on_playlist_removal == False:
               1. Preserve audio file on disk
               2. Preserve lyrics file on disk
               3. DELETE FROM songs WHERE id = song_id ONLY
```
