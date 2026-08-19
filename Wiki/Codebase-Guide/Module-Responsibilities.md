# Module Responsibilities

Below is a module-by-module mapping detailing responsibilities, primary classes, exported functions, and inter-module interactions.

---

## 1. Application Core & API (`app/` & `app/api/`)

| File / Path | Key Classes & Functions | Module Responsibilities |
| :--- | :--- | :--- |
| `app/main.py` | `app`, `lifespan()`, `health_check()` | Application entrypoint. Configures FastAPI, CORS middleware (`allow_origins=["*"]`), routes, and lifespan manager (seeds admin user, starts/stops background worker threads). |
| `app/api/auth.py` | `router`, `LoginRequest`, `ChangePasswordRequest`, `ensure_admin_exists()` | Authentication API router (`/api/auth/*`). Provides login, password change, user info retrieval, and admin seeding logic. |
| `app/api/dashboard.py` | `router`, `get_dashboard()` | Dashboard status router (`/dashboard`). Aggregates counts for total songs, download states, lyrics states, scheduler status, worker states, and recent sync history. |
| `app/api/playlists.py` | `router`, `extract_playlist_id()`, CRUD routes | Playlists API router (`/playlists`). Handles creating playlists from URLs, editing name/enabled flags, deleting playlists, listing songs, and triggering single playlist sync. |
| `app/api/schemas.py` | `PlaylistCreate`, `SongResponse`, `DownloadedTrackResponse`, etc. | Pydantic data validation schemas for request bodies and API response models. |
| `app/api/settings.py` | `router`, `SettingsResponse`, `SettingsUpdateRequest` | Runtime settings router (`/settings`). Manages runtime sync intervals, concurrency limits, retry options, watch modes, and Netscape YouTube cookies. |
| `app/api/songs.py` | `router`, `delete_song()`, streaming endpoints | Songs API router (`/songs`). Handles artist aggregation, song filtering, streaming Opus audio files, serving `.lrc` lyrics, manual download/lyrics retry triggers, and song deletion. |
| `app/api/sync.py` | `router`, worker control endpoints | Sync engine API router (`/sync`). Exposes endpoints to start, stop, and query status for the scheduler, downloader worker, and lyrics worker. |

---

## 2. Core Foundations (`app/core/`)

| File / Path | Key Classes & Functions | Module Responsibilities |
| :--- | :--- | :--- |
| `app/core/auth.py` | `hash_password()`, `verify_password()`, `create_access_token()`, `verify_access_token()`, `get_current_user()` | Cryptographic authentication module. Implements PBKDF2-HMAC-SHA256 password hashing and custom HMAC-SHA256 JWT token generation/verification. |
| `app/core/config.py` | `Settings`, `settings`, `DOWNLOADS_DIR` | Global environment configuration loaded from `.env` via Pydantic `BaseSettings`. Resolves `DOWNLOADS_DIR` path. |
| `app/core/paths.py` | `sanitize_filename()`, `get_download_root()`, `get_playlist_music_root()`, `resolve_file_path()` | File system path management. Sanitizes playlist names into safe directory names and resolves database paths relative to download roots. |
| `app/core/runtime.py` | `scheduler`, `downloader_worker`, `lyrics_worker` | Application singleton registry preventing circular import loops between API routers and worker services. |
| `app/core/ytdlp.py` | `get_cookie_context()`, `build_ydl_options()` | Centralized `yt-dlp` configuration. Constructs option dictionaries (Deno JS solver runtime) and manages temporary Netscape cookie files safely. |

---

## 3. Database Layer (`app/database/`)

| File / Path | Key Classes & Functions | Module Responsibilities |
| :--- | :--- | :--- |
| `app/database/models.py` | `Playlist`, `Song`, `DownloadedTrack`, `AppSettings`, `User` | SQLAlchemy 2.0 ORM models defining table schemas, column types, foreign keys, unique constraints, and relationships. |
| `app/database/session.py` | `Base`, `engine`, `SessionLocal`, `get_db()` | Database connection management. Initializes SQLAlchemy engine (`pool_pre_ping=True`), session factory, and FastAPI session dependency generator. |

---

## 4. Downloader Engine (`app/downloader/`)

| File / Path | Key Classes & Functions | Module Responsibilities |
| :--- | :--- | :--- |
| `app/downloader/service.py` | `SongDownloader` | Core download service. Polls pending songs, downloads Opus audio via `yt-dlp`, embeds thumbnail cover art, populates `DownloadedTrack` metadata, handles exponential backoff retries. |
| `app/downloader/worker.py` | `DownloaderWorker` | Background daemon thread running `SongDownloader.download_pending()` in a continuous polling loop. Recovers stale downloads on startup. |

---

## 5. Lyrics Engine (`app/lyrics/`)

| File / Path | Key Classes & Functions | Module Responsibilities |
| :--- | :--- | :--- |
| `app/lyrics/service.py` | `LyricsService` | Core lyrics service. Queries LRCLIB.net for synchronized `.lrc` lyrics using title-cleaning heuristics. Writes `.lrc` files or moves songs without lyrics to `no-lyrics/` directory. |
| `app/lyrics/worker.py` | `LyricsWorker` | Background daemon thread running `LyricsService.process_pending()` in a continuous polling loop. |

---

## 6. Reconciler, Scheduler, Settings & Sync (`app/reconciler/`, `app/scheduler/`, `app/settings/`, `app/sync/`, `app/watcher/`)

| File / Path | Key Classes & Functions | Module Responsibilities |
| :--- | :--- | :--- |
| `app/reconciler/service.py` | `PlaylistReconciler` | State reconciliation engine. Compares YouTube playlist items against database records, inserts new songs, updates existing records, handles video removals (and optional file unlinking). Commits per-item. |
| `app/scheduler/service.py` | `MusicSyncScheduler` | APScheduler background manager. Triggers `SyncService.run()` periodically, prevents overlapping runs via `sync_running` lock, maintains sync history. |
| `app/settings/service.py` | `SettingsService` | Single-row database settings manager (`AppSettings` ID=1). Provides default fallback seeding and sentinel-based (`...`) update methods. |
| `app/sync/service.py` | `SyncService` | Orchestrates multi-playlist scanning pipeline. Invokes `YouTubePlaylistWatcher` and passes results to `PlaylistReconciler`. |
| `app/watcher/youtube.py` | `YouTubePlaylistWatcher`, `YouTubeSong`, `UnavailableYouTubeSong` | YouTube scraper. Performs lightweight `yt-dlp` flat extraction to fetch video metadata and detect private/deleted videos. |
