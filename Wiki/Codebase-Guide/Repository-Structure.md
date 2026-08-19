# Repository Structure

Below is the repository directory structure for **Music-Sync**:

```text
Music-Sync/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md             # Bug report template
│   │   ├── feature_request.md        # Feature request template
│   │   └── documentation_issue.md    # Documentation issue template
│   ├── PULL_REQUEST_TEMPLATE.md      # Pull request template
│   ├── dependabot.yml                # Dependabot auto-update config (pip, npm, docker, gh-actions)
│   └── workflows/
│       └── deploy.yaml               # GitHub Actions CI build & GHCR container push
│
├── alembic/
│   ├── versions/                     # 11 database migration scripts
│   ├── env.py                        # Alembic environment runner
│   ├── README                        # Alembic readme
│   └── script.py.mako                # Migration generation template
│
├── app/                              # FastAPI Backend Application Package
│   ├── api/                          # REST Endpoint Routers & Schemas
│   │   ├── auth.py                   # User auth (/api/auth/*) & admin seeding
│   │   ├── dashboard.py              # Aggregated status router (/dashboard)
│   │   ├── playlists.py              # Playlist CRUD & single sync (/playlists)
│   │   ├── schemas.py                # Pydantic API response & request models
│   │   ├── settings.py               # Application settings endpoint (/settings)
│   │   ├── songs.py                  # Song operations & media streaming (/songs)
│   │   └── sync.py                   # Worker & scheduler controls (/sync)
│   ├── core/                         # Core Utilities & Configurations
│   │   ├── auth.py                   # Password hashing & custom JWT module
│   │   ├── config.py                 # Pydantic BaseSettings & directory path setup
│   │   ├── paths.py                  # Filename sanitization & path resolution helpers
│   │   ├── runtime.py                # Application singletons (scheduler, workers)
│   │   └── ytdlp.py                  # yt-dlp options builder & Netscape cookie manager
│   ├── database/                     # Persistence Layer
│   │   ├── models.py                 # SQLAlchemy ORM models (Playlist, Song, etc.)
│   │   └── session.py                # Engine, SessionLocal, & get_db dependency
│   ├── downloader/                   # Audio Downloader Subsystem
│   │   ├── service.py                # SongDownloader service & retry engine
│   │   ├── worker.py                 # DownloaderWorker daemon thread
│   │   └── test_*.py                 # Unit tests for downloader service & worker
│   ├── library/                      # Music Library Subsystem
│   │   └── __init__.py               # Reserved for future Beets integration
│   ├── lyrics/                       # Lyrics Subsystem
│   │   ├── service.py                # LyricsService (LRCLIB client & .lrc writer)
│   │   ├── worker.py                 # LyricsWorker daemon thread
│   │   └── test_*.py                 # Unit tests for lyrics service & worker
│   ├── reconciler/                   # Playlist Reconciliation Subsystem
│   │   ├── service.py                # PlaylistReconciler DB diffing engine
│   │   └── test_reconciler.py        # Reconciler unit tests
│   ├── scheduler/                    # Sync Scheduler Subsystem
│   │   ├── service.py                # MusicSyncScheduler APScheduler manager
│   │   └── test_*.py                 # Scheduler unit tests
│   ├── settings/                     # Runtime Settings Subsystem
│   │   └── service.py                # SettingsService DB settings manager
│   ├── sync/                         # Sync Execution Subsystem
│   │   └── service.py                # SyncService playlist discovery runner
│   ├── watcher/                      # YouTube Scraper Subsystem
│   │   └── youtube.py                # YouTubePlaylistWatcher flat extraction
│   ├── main.py                       # FastAPI entrypoint, lifespan manager, CORS
│   ├── test_configurable_watcher.py  # Unit tests for watcher modes
│   └── test_playlist_folder_name.py  # Unit tests for path sanitization
│
├── dashboard/                        # React 19 Frontend SPA Web Application
│   ├── public/                       # Static public assets (favicons, icons)
│   ├── src/
│   │   ├── components/               # AudioPlayer, Lyrics, ProtectedRoute, Sidebar, SongList
│   │   ├── layouts/                  # DashboardLayout
│   │   ├── pages/                    # Dashboard, Songs, Playlists, Detail, Settings, etc.
│   │   ├── services/                 # Axios API clients (api.js, auth.js, playlists.js, songs.js)
│   │   ├── styles/                   # Modern CSS styling tokens and utilities
│   │   ├── App.jsx                   # React Router v7 routes
│   │   └── main.jsx                  # React DOM render entrypoint
│   ├── Dockerfile                    # Multi-stage Docker build (Node builder + Nginx runtime)
│   ├── nginx.conf                    # Nginx SPA web server config & API proxying
│   ├── package.json                  # React 19, Axios, Lucide Icons, Vite, Vitest
│   └── vite.config.js                # Vite build config
│
├── data/                             # Host Bind-Mount Storage Target
│   ├── downloads/                    # Downloaded audio & lyrics per playlist
│   └── postgres/                     # PostgreSQL database storage directory
│
├── Wiki/                             # Technical Documentation Wiki
├── .env                              # Environment configuration file
├── .env.example                      # Template environment variables
├── alembic.ini                       # Alembic database migration config
├── architecture.mermaid              # System architecture diagram source
├── conftest.py                       # Pytest root configuration (sets sqlite:///:memory:)
├── Dockerfile                        # Backend container definition (Python 3.14-slim + Deno)
├── docker-compose.yml                # Local development 3-container stack
├── docker-compose-cd.yaml            # CD deployment stack using GHCR pre-built images
├── LICENSE                           # MIT License file
├── progress.md                       # Development progress log
├── pytest.ini                        # Pytest settings
├── README.md                         # Main repository README
├── requirements.txt                  # Python dependencies
└── SECURITY.md                       # Security disclosure policy & architecture notes
```
