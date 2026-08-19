# Architecture Overview

## Architectural Contract

Music-Sync enforces a strict separation of concerns across its core modules according to the contract:

> **SYNC DISCOVERS → DOWNLOADER DOWNLOADS → LYRICS PROCESSES → SCHEDULER TRIGGERS**

No individual background component directly invokes or controls another worker component. Communication across discovery, downloading, and lyrics fetching occurs **exclusively through database state transitions** in PostgreSQL.

---

## High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Client["Client Layer (React 19 / Nginx)"]
        UI["React 19 Web Dashboard"] --> AuthRoute["ProtectedRoute / Auth Views"]
        AuthRoute --> Axios["Axios API Client (JWT Interceptor)"]
    end

    subgraph Backend["API & Core Layer (FastAPI)"]
        Axios -->|HTTP /api + JWT| API["FastAPI REST Endpoints"]
        API --> AuthDep["JWT Auth & Security Handler"]
        API --> CoreYTDLP["Core YTDLP & Cookie Context"]
        API --> Scheduler["APScheduler Engine"]
    end

    subgraph Workers["Background Worker Threads"]
        Scheduler -->|"Periodic Trigger"| SyncService["SyncService<br/>(Sync Orchestrator)"]
        SyncService --> Watcher["1. YouTube Watcher<br/>(Flat Scraper)"]
        Watcher --> Reconciler["2. Playlist Reconciler"]
        Reconciler -->|"INSERT/UPDATE Song rows<br/>(commits per item)"| DB

        CoreYTDLP -.->|"yt-dlp Options & Cookies"| Watcher
        CoreYTDLP -.->|"yt-dlp Options & Cookies"| SongDownloader

        DownloaderWorker["3. Downloader Worker<br/>(Independent Daemon Thread)"] -->|"Polls pending/retryable songs"| DB
        DownloaderWorker --> SongDownloader["Song Downloader<br/>(yt-dlp + Deno + FFmpeg)"]

        LyricsWorker["4. Lyrics Worker<br/>(Independent Daemon Thread)"] -->|"Polls downloaded songs<br/>with pending lyrics"| DB
        LyricsWorker --> LyricsService["Lyrics Service<br/>(LRCLIB Client)"]
    end

    subgraph Persistence["Persistence Layer"]
        AuthDep --> DB[("PostgreSQL 17 Database")]
        API --> DB
        Alembic["Alembic Migrations"] --- DB
    end

    subgraph Storage["Local Storage Mounts"]
        SongDownloader -->|"Write Opus Audio &<br/>Embed Artwork/Tags"| AudioFiles["/app/downloads/&lt;Playlist&gt;/music/*.opus"]
        LyricsService -->|"Write .lrc Files"| AudioFiles
        LyricsService -->|"Move Audio<br/>(No Lyrics Found)"| NoLyricsFiles["/app/downloads/&lt;Playlist&gt;/no-lyrics/*.opus"]
        API -->|"Stream Audio & Lyrics"| AudioFiles
        API -->|"Stream Audio"| NoLyricsFiles
    end

    subgraph External["External Services"]
        Watcher -->|"Flat Playlist Extraction"| YT["YouTube Music"]
        SongDownloader -->|"Stream Audio &<br/>Deno Challenge Solving"| YT
        LyricsService -->|"Fetch Synced .lrc"| LRCLIB["LRCLIB.net API"]
    end

    style Client fill:#1e1e2e,stroke:#89b4fa,color:#cdd6f4
    style Backend fill:#181825,stroke:#f9e2af,color:#cdd6f4
    style Workers fill:#11111b,stroke:#a6e3a1,color:#cdd6f4
    style Persistence fill:#181825,stroke:#fab387,color:#cdd6f4
    style Storage fill:#1e1e2e,stroke:#94e2d5,color:#cdd6f4
    style External fill:#1e1e2e,stroke:#f38ba8,color:#cdd6f4
```

> [!TIP]
> View vector SVG version: [architecture.svg](architecture.svg)


---

## Subsystem Boundaries & Responsibilities

### 1. API & Web Routing Layer (`app/api/`)
- Exposes REST endpoints for auth, dashboard metrics, playlist CRUD, song streaming, background worker controls, and settings management.
- Performs request payload validation using Pydantic models.

### 2. Core Foundation Layer (`app/core/`)
- `app/core/config.py`: Environment configuration via Pydantic BaseSettings.
- `app/core/auth.py`: Password hashing (PBKDF2-HMAC-SHA256) and custom JWT signing/verification.
- `app/core/paths.py`: OS-safe filename sanitization and path resolution helpers (`get_playlist_music_root`, `get_playlist_no_lyrics_root`, `resolve_file_path`).
- `app/core/runtime.py`: Application singletons (`scheduler`, `downloader_worker`, `lyrics_worker`) to prevent circular import issues.
- `app/core/ytdlp.py`: Unified `yt-dlp` options builder and ephemeral Netscape cookie file context manager (`get_cookie_context`).

### 3. Data Persistence Layer (`app/database/`)
- Manages PostgreSQL connections via SQLAlchemy `SessionLocal`.
- Houses ORM models (`Playlist`, `Song`, `DownloadedTrack`, `AppSettings`, `User`).

### 4. Background Workers & Execution Layer
- **`app/watcher/`**: `YouTubePlaylistWatcher` runs flat extractions on YouTube playlists using `yt-dlp`.
- **`app/reconciler/`**: `PlaylistReconciler` diffs discovered playlist entries against the database and commits new `Song` rows per item.
- **`app/downloader/`**: `DownloaderWorker` runs an independent daemon thread continuously polling for `pending` or retry-due `failed` audio downloads.
- **`app/lyrics/`**: `LyricsWorker` runs an independent daemon thread continuously polling for `downloaded` tracks with `pending` lyrics.
- **`app/scheduler/`**: `MusicSyncScheduler` wraps APScheduler to trigger `SyncService.run()` at configurable intervals.
