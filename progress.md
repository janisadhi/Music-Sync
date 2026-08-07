# Music Sync — Development Progress

## Project Overview

**Music Sync** is an automated service that synchronizes YouTube Music playlists with a local music library.

Current system architecture:

```text
                  +--------------------------+
                  |  YouTube Music Playlists |
                  +------------+-------------+
                               |
                               v
                     [ YouTube Watcher ]
                               |
                               v
                  [ Playlist Reconciler ]
                               |
                               v
                  +------------+-------------+
                  |    PostgreSQL Database   |
                  +------+-------------+-----+
                         |             |
           +-------------+             +-------------+
           | Pending Downloads                       | Pending Lyrics
           v                                         v
   [ Song Downloader ]                       [ Lyrics Service ]
      (`yt-dlp`)                                 (LRCLIB API)
           |                                         |
           v                                         v
   `data/music/*.opus`                       `data/music/*.lrc`
           \                                         /
            +--------------------+------------------+
                                 |
                                 v
                     [ FastAPI REST Backend ]
                                 |
                                 v
                 [ Nginx + React Web Dashboard ]
```

---

# 1. Current Component Status

| Component | Status | Description / Notes |
| :--- | :--- | :--- |
| Python project structure | **Complete** | Modular FastAPI package layout under `app/` |
| Environment configuration | **Complete** | Standard `.env` & `.env.example` with `docker compose env_file` integration |
| PostgreSQL DB & Alembic | **Complete** | PostgreSQL 17 container with automated migrations (`alembic upgrade head`) |
| Multi-Playlist Support | **Complete** | Database model & service support for multiple YouTube playlists |
| YouTube Playlist Watcher | **Complete** | Scrapes video metadata via `yt-dlp` |
| Playlist Reconciliation | **Complete** | Reconciles YouTube state with database records per playlist |
| Song Downloader | **Complete** | Downloads `.opus` audio using `yt-dlp` & FFmpeg, handles retries |
| Lyrics Service | **Complete** | Retrieves synchronized `.lrc` lyrics from LRCLIB API |
| FastAPI REST Endpoints | **Complete** | `playlists`, `songs`, `sync`, `dashboard`, `settings`, `health` endpoints |
| APScheduler Sync Engine | **Complete** | Thread-safe start/stop controls, periodic scheduling & manual triggers |
| React Web Dashboard | **Complete** | React 19 + Vite SPA with audio player, synced lyrics, playlist details & settings GUI |
| Dashboard Dockerization | **Complete** | Multi-stage Docker build (`node:22-alpine` builder + `nginx:alpine` runtime) |
| Docker Compose Integration | **Complete** | Full 3-container orchestration (`postgres`, `app`, `dashboard`) |
| Persistent Volume Storage | **Complete** | Host bind mounts for `./data/postgres` and `./data/downloads` |
| GUI Settings Management | **Complete** | Sync interval, retry delay, and limits configured from GUI / DB |

---

# 2. Project Directory Layout

```text
Music-Sync/
├── alembic/                  # Database migration scripts
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
│
├── app/                      # FastAPI Backend Application
│   ├── api/                  # Endpoints (playlists, songs, sync, dashboard, settings)
│   ├── core/                 # Config (Pydantic Settings)
│   ├── database/             # SQLAlchemy models & sessions
│   ├── downloader/           # yt-dlp downloader service
│   ├── library/              # Music library service
│   ├── lyrics/               # LRCLIB lyrics service
│   ├── reconciler/           # Playlist reconciler
│   ├── scheduler/            # APScheduler manager
│   ├── settings/             # Persistent settings service
│   ├── sync/                 # Sync process runner
│   ├── watcher/              # YouTube scraper
│   └── main.py               # FastAPI entrypoint
│
├── dashboard/                # React 19 Frontend Web Application
│   ├── public/               # Favicons & public assets
│   ├── src/
│   │   ├── components/       # AudioPlayer, Lyrics, Sidebar, SongList
│   │   ├── layouts/          # DashboardLayout
│   │   ├── pages/            # Dashboard, Playlists, Detail, Songs, History, Settings, Health
│   │   └── services/         # Axios API clients (api.js, playlists.js, songs.js)
│   ├── Dockerfile            # Multi-stage Docker build
│   ├── nginx.conf            # Nginx SPA web server config
│   ├── package.json
│   └── vite.config.js
│
├── data/                     # Persistent mounted data
│   ├── music/                # Downloaded audio & lyrics
│   └── postgres/             # PostgreSQL data directory
│
├── .env                      # Active environment configuration
├── .env.example              # Environment variables template
├── Dockerfile                # Python backend container definition
├── docker-compose.yml        # Docker Compose orchestration
├── README.md                 # Project documentation
└── requirements.txt          # Python dependencies
```

---

# 3. Environment & Runtime Configuration

The application environment settings are divided cleanly between static container infrastructure and dynamic runtime options:

### Static Infrastructure (`.env` file)
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `APP_NAME`, `APP_ENV`, `APP_DEBUG`
- `MUSIC_ROOT`
- `VITE_API_BASE_URL`

### Dynamic Application Settings (PostgreSQL `app_settings` table / GUI)
- `sync_interval_seconds`
- `download_limit`
- `lyrics_limit`
- `max_download_retries`
- `download_retry_delay_seconds`
- Playlist management (add, edit, toggle, remove)

---

# 4. Completed Milestones

1. **Multi-Playlist Backend Refactor**: Transformed single-playlist logic into full multi-playlist reconciliation and per-playlist status monitoring.
2. **Dashboard SPA Development**: Built full-featured React 19 web application for interactive media playback, lyrics visualization, playlist management, and system health checks.
3. **Frontend Dockerization**: Authored a multi-stage `Dockerfile` with Nginx reverse proxy / SPA fallback configuration for serving built static frontend assets.
4. **Unified Docker Compose Stack**: Orchestrated `postgres`, `app`, and `dashboard` services using `env_file: - .env` for seamless container startup.
5. **GUI Settings Decoupling**: Fully decoupled runtime sync parameters (`sync_interval_seconds`, `youtube_playlist_url`) from environment files to make the dashboard the single source of operational management.
