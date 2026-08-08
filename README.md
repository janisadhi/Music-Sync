# Music Sync

[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

**Music Sync** is an automated, self-hosted YouTube Music playlist synchronization and media management service. It continuously monitors configured YouTube playlists, reconciles song metadata in PostgreSQL, downloads high-quality audio files using `yt-dlp`, fetches synchronized `.lrc` lyrics from LRCLIB, and provides a rich web dashboard and REST API for library playback and administration.

---

## Key Features

* **User Authentication & Authorization**: Custom JWT-based bearer authentication backend (PBKDF2-HMAC-SHA256 password hashing) with protected frontend routes and interactive password update views.
* **Multi-Playlist Support**: Register and monitor multiple YouTube playlists with individual enable/disable toggles.
* **Automatic Playlist Reconciliation**: Tracks additions, updates, and removals across YouTube playlists with persistent PostgreSQL records.
* **High-Quality Audio Downloading**: Automatic audio extraction and conversion using `yt-dlp` and FFmpeg.
* **Synchronized `.lrc` Lyrics Retrieval**: Automatic search and storage of timed lyrics matching track title and artist via LRCLIB.
* **Web Dashboard**: Modern SPA built with React 19, Vite, and Lucide icons featuring an audio player with synchronized scrolling lyrics.
* **GUI-Driven Settings & Controls**: Start/stop periodic background synchronization, run instant sync cycles, configure download limits, and adjust sync intervals directly from the web interface.
* **Resilient Execution & Retries**: Automated retry logic with exponential backoffs for failed downloads and missing lyrics.
* **Full REST API**: FastAPI backend providing endpoints for song metadata, streaming audio, synchronized lyrics, sync logs, and health metrics.
* **Container-Native**: Fully containerized using Docker and Docker Compose (PostgreSQL 17, FastAPI backend, Nginx frontend).

---

## Architecture

![System Architecture](architecture.svg)

---

## Project Structure

```text
Music-Sync/
├── alembic/                  # Database migration scripts
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
│
├── app/                      # FastAPI Backend Application
│   ├── api/                  # REST endpoints (playlists, songs, sync, dashboard, settings)
│   ├── core/                 # App configuration & runtime settings
│   ├── database/             # SQLAlchemy models, session, and DB engine
│   ├── downloader/           # yt-dlp audio download service
│   ├── library/              # Music storage management
│   ├── lyrics/               # LRCLIB synchronized lyrics service
│   ├── reconciler/           # YouTube vs Database reconciler
│   ├── scheduler/            # APScheduler background sync manager
│   ├── settings/             # PostgreSQL persistent settings service
│   ├── sync/                 # Sync orchestrator
│   ├── watcher/              # YouTube playlist scraper
│   └── main.py               # FastAPI entrypoint
│
├── dashboard/                # React 19 Frontend Dashboard
│   ├── public/               # Favicons and static web assets
│   ├── src/
│   │   ├── components/       # AudioPlayer, Lyrics, Sidebar, SongList
│   │   ├── layouts/          # DashboardLayout
│   │   ├── pages/            # Dashboard, Playlists, Detail, Songs, History, Settings, Health
│   │   ├── services/         # Axios API clients
│   │   └── App.jsx           # React Router setup
│   ├── Dockerfile            # Multi-stage Nginx build for dashboard
│   ├── nginx.conf            # Nginx SPA proxy & static server
│   ├── package.json
│   └── vite.config.js
│
├── data/                     # Persistent storage mounted in Docker
│   ├── music/                # Downloaded audio (.opus) & lyrics (.lrc)
│   └── postgres/             # PostgreSQL data directory
│
├── .env.example              # Environment variables template
├── Dockerfile                # Python backend container definition
├── docker-compose.yml        # Multi-container orchestration
└── requirements.txt          # Python dependencies
```

---

## Getting Started

### Prerequisites

* [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.

---

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/janisadhi/Music-Sync.git
   cd Music-Sync
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Default environment variables in `.env`:
   ```env
   # Database Configuration (PostgreSQL)
   POSTGRES_DB=music_sync
   POSTGRES_USER=music_sync
   POSTGRES_PASSWORD=music_sync
   DATABASE_URL=postgresql+psycopg://music_sync:music_sync@postgres:5432/music_sync

   # Backend Configuration (FastAPI)
   APP_NAME=music-sync
   APP_ENV=production
   APP_DEBUG=false
   MUSIC_ROOT=/app/data/music

   # Frontend Configuration (React / Vite)
   VITE_API_BASE_URL=http://localhost:8000
   ```

*Note: Sync intervals, retry delays, download limits, and playlist URLs are configured directly from the Web Dashboard GUI and stored in PostgreSQL.*

---

### Running with Docker Compose

Build and launch all services in detached mode:

```bash
docker compose up -d --build
```

#### Service URLs

* **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
* **REST API & Interactive Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **PostgreSQL Database**: `127.0.0.1:5432`

---

## Web Dashboard Features

Navigate to `http://localhost:3000` to manage your music library:

* **Dashboard (`/`)**: Real-time overview of library statistics, active scheduler status, recent sync execution history, and quick sync action buttons.
* **Playlists (`/playlists`)**: Add, edit, enable/disable, or delete YouTube playlists.
* **Playlist Detail (`/playlists/:id/detail`)**: View songs specific to a single playlist with status badges and re-sync triggers.
* **Songs Catalog (`/songs`)**: Filter and search songs by status (downloaded, pending, failed) or artist, play audio, and view synchronized lyrics.
* **Sync History (`/history`)**: Detailed audit log of previous sync cycles including start time, duration, status, and error logs.
* **Settings (`/settings`)**: Configure sync interval (in seconds), download concurrency limits, lyrics concurrency limits, and retry delays.
* **System Health (`/health`)**: Check real-time database connectivity and backend service status.

---

## How Synchronization Works

The sync engine executes the following pipeline when triggered (either manually or via the background scheduler):

```text
[1. Fetch Playlists] ──► Discovers active songs across all enabled YouTube playlists.
          │
          ▼
[2. Reconcile DB]    ──► Compares discovered YouTube IDs with PostgreSQL. Inserts new songs as "pending".
          │
          ▼
[3. Download Audio]  ──► Fetches pending audio streams via yt-dlp to `data/music/*.opus`.
          │
          ▼
[4. Fetch Lyrics]    ──► Queries LRCLIB for matching timed lyrics and writes `data/music/*.lrc`.
```

---

## API Reference

### Playlists API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/playlists` | List all registered playlists |
| `POST` | `/playlists` | Add a new YouTube playlist |
| `GET` | `/playlists/{id}` | Get playlist details and associated songs |
| `PUT` | `/playlists/{id}` | Update playlist name, URL, or enabled state |
| `DELETE` | `/playlists/{id}` | Remove playlist and optionally delete associated tracks |
| `POST` | `/playlists/{id}/sync` | Trigger an immediate sync for a specific playlist |

### Songs API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/songs` | List songs with optional filtering by status, artist, or playlist |
| `GET` | `/songs/{id}/lyrics` | Retrieve synchronized `.lrc` content for a song |
| `GET` | `/songs/{id}/audio` | Stream/download the audio file for a song |
| `POST` | `/songs/{id}/retry-download` | Reset download status to retry failed downloads |
| `POST` | `/songs/{id}/retry-lyrics` | Reset lyrics status to retry fetching missing lyrics |
| `DELETE` | `/songs/{id}` | Remove a song and delete local audio/lyrics files |

### Sync & Scheduler API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/sync/status` | Get scheduler status, last run timestamps, and current state |
| `POST` | `/sync/start` | Start the periodic background scheduler |
| `POST` | `/sync/stop` | Stop the periodic background scheduler |
| `POST` | `/sync/run` | Trigger an immediate manual sync cycle across enabled playlists |
| `GET` | `/sync/history` | Retrieve sync execution logs and statistics |

### Settings API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/settings` | Get current application runtime settings |
| `PUT` | `/settings` | Update sync interval, download limit, lyrics limit, and retry parameters |

---

## Local Development Setup

### Backend (FastAPI)

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Ensure PostgreSQL is running locally or in Docker, then set `DATABASE_URL` in `.env`:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend (React Dashboard)

1. Navigate to the `dashboard` directory:
   ```bash
   cd dashboard
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start Vite dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## License

This project is open source and available under the [MIT License](LICENSE).
