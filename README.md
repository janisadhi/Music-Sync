# Music Sync

[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

**Music Sync** is an automated, self-hosted media management and synchronization platform designed to continuously back up YouTube playlists into a locally organized, high-fidelity audio library. Built with a decoupled microservice-ready architecture (**SYNC DISCOVERS → DOWNLOADER DOWNLOADS → LYRICS FETCHES**), it automatically monitors changes across target playlists, extracts audio metadata, downloads high-quality audio streams using `yt-dlp` and `Deno`, retrieves synchronized `.lrc` lyrics via LRCLIB, and exposes a rich React web dashboard for streaming, metadata management, and continuous sync configuration.

---

## Built With

- **Backend Framework**: Python 3.13 / 3.14-slim, FastAPI, Uvicorn, Pydantic v2
- **Database & ORM**: PostgreSQL 17, SQLAlchemy 2.0, Alembic migrations
- **Frontend Dashboard**: React 19, Vite, Tailwind CSS, Lucide Icons, Axios
- **Audio Extraction & JS Solver**: `yt-dlp`, `yt-dlp-ejs`, **Deno** 2.9+ (JS Challenge Solver), FFmpeg (Opus audio encoding)
- **Lyrics Provider**: LRCLIB API (Synchronized `.lrc` lyrics search & parser)
- **Task Scheduling**: APScheduler (Background periodic synchronization engine)
- **Containerization & Server**: Docker, Docker Compose, Nginx (Frontend SPA proxy)

---

## Architecture Diagram

![System Architecture](architecture.svg)

---

## Key Features

- **Strict Architecture Principles**: Decoupled lifecycle (**SYNC DISCOVERS → DOWNLOADER DOWNLOADS**). Sync only performs flat, fast scanning without metadata extractions or audio downloads.
- **Deno JS Challenge Solver**: Bundled Deno 2.9+ and `yt-dlp-ejs` inside container runtime to execute complex YouTube JS challenges seamlessly without missing formats or 403 Forbidden errors.
- **Authenticated & Private Sync (YouTube Cookies)**: Supports Netscape format YouTube cookies stored directly in encrypted/secure database settings to sync age-restricted and private playlists safely.
- **JWT Authentication & Security**: Custom bearer token authentication with PBKDF2-HMAC-SHA256 password hashing and protected dashboard routes.
- **Multi-Playlist Sync**: Register multiple YouTube playlists with granular per-playlist toggle switches and metadata tracking.
- **Flexible Watch Modes**: Switch between full playlist monitoring (**Whole Playlist**) or fast delta syncing (**Last N Songs**).
- **Automated Metadata Reconciliation**: Compares YouTube playlist tracks against local PostgreSQL storage to queue missing downloads automatically.
- **High-Quality Opus Audio Downloading**: Extracts lossy/lossless audio streams using `yt-dlp` and normalizes metadata tags with FFmpeg.
- **Synchronized `.lrc` Lyrics Search**: Automatically matches title and artist metadata against LRCLIB to store synchronized lyrics files.
- **Interactive Web Player & Dashboard**: Real-time React dashboard with dynamic lyric scrolling, status filtering, and playback controls.
- **GUI-Based Sync & Concurrency Controls**: Live scheduler controls, manual batch execution, download worker queue limits, retry policy management, and cookie management.
- **Container-Native Infrastructure**: Production-ready deployment using Docker Compose orchestrating PostgreSQL, FastAPI backend, and Nginx frontend.

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine.
- Git installed on your system.

---

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/janisadhi/Music-Sync.git
   cd Music-Sync
   ```

2. Copy the template environment configuration file:
   ```bash
   cp .env.example .env
   ```

3. Review default environment variables in `.env`:
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
   MUSIC_ROOT=/app/downloads

   # Frontend Configuration (React / Vite)
   VITE_API_BASE_URL=http://localhost:8000
   ```

---

### Running with Docker Compose

#### Windows

1. Open PowerShell or Command Prompt.
2. Navigate to the project directory:
   ```powershell
   cd C:\path\to\Music-Sync
   ```
3. Launch the container stack:
   ```powershell
   docker compose up -d --build
   ```

#### Linux & macOS

1. Open Terminal and navigate to the project root:
   ```bash
   cd /path/to/Music-Sync
   ```
2. Build and launch all services in detached mode:
   ```bash
   docker compose up -d --build
   ```

#### Download Folder Location & Configuration

- **Default Location**: Files are stored inside the app container at `/app/downloads` and mapped on the host machine under `./data/downloads/`.
- **Organized Structure**: Audio and lyrics are grouped cleanly under sanitized playlist name folders:
  ```text
  data/downloads/
  └── <Playlist_Name>/
      ├── music/        # Downloaded .opus audio files
      └── no-lyrics/    # Tracks without synced lyrics
  ```
- **Customizing Download Directory**: To store downloaded media on a custom drive or directory, edit the `volumes` section of the `app` service in `docker-compose.yml`:
  ```yaml
      volumes:
        - ./app:/app/app
        - ./alembic:/app/alembic
        - /your/custom/storage/path:/app/downloads
  ```
  Then restart the container stack:
  ```bash
  docker compose down && docker compose up -d --build
  ```

---

## Application Quickstart & User Guide

Once the containers are running, follow these steps to set up your library:

1. **Access Dashboard**: Open `http://localhost:3000` in your web browser.
2. **Initial Login**:
   - **Default Username**: `admin`
   - **Default Password**: `admin`
   > **Note**: Update your password upon initial login under Settings. Keep your new password safe as administrative resets require database intervention.
3. **Register a Playlist**:
   - Navigate to the **Playlists** tab (`/playlists`).
   - Click **Add Playlist**, paste your YouTube playlist URL (e.g., `https://www.youtube.com/playlist?list=...`), and assign a name.
   - Ensure the playlist switch is toggled to **Enabled**.
4. **Configure YouTube Cookies (Optional)**:
   - Go to **Settings** (`/settings`) -> **YouTube Cookies Configuration**.
   - Paste your exported Netscape HTTP format cookies (e.g. from *Get cookies.txt LOCALLY* extension) to enable private/member video extraction.
5. **Trigger Synchronization**:
   - **Manual Single-Run**: Click **Sync Now** on the **Dashboard** page (`/`) or trigger sync for an individual playlist.
   - **Continuous Background Sync**: Navigate to **Settings** (`/settings`), configure your sync interval, and click **Start Scheduler**.

---

## Configuration & Settings Reference

All synchronization controls are managed persistently in PostgreSQL and customizable directly via the Settings GUI:

- **Automation & Startup**:
  - `auto_start_scheduler`: Automatically activates the periodic background sync engine on application launch.
- **Sync Frequency**:
  - `sync_interval_seconds`: Time interval (in seconds) between automatic background playlist sync cycles (e.g., `3600` for 1 hour).
- **Playlist Watch Mode**:
  - `playlist_watch_mode`:
    - `whole`: Scans the entire playlist during every sync run to ensure complete synchronization.
    - `last_n`: Scans only the top **N** and bottom **N** tracks of the playlist for fast incremental syncs.
  - `playlist_watch_limit`: Number of tracks (*N*) evaluated when operating in `last_n` mode (default: `20`).
- **YouTube Authentication**:
  - `youtube_cookies`: Exported Netscape HTTP cookie string used by `yt-dlp` for age-restricted / private playlist downloads. Automatically sanitized and used via temporary file context manager.
- **Concurrency Limits**:
  - `max_concurrent_downloads`: Maximum parallel audio download workers managed by `yt-dlp`.
  - `max_concurrent_lyrics`: Maximum parallel LRCLIB request workers.
- **Retry Policy & Backoff**:
  - `max_download_retries`: Maximum download attempts before marking a track permanently failed.
  - `download_retry_delay_seconds`: Base delay (in seconds) for exponential backoff retries.

---

## How the Modules Work Together

The end-to-end download and synchronization process operates through a coordinated service pipeline:

```text
  [ YouTube Playlist ]
           │
           ▼
┌──────────────────────┐
│  1. Playlist Watcher │ ── Performs fast flat scanning only (Whole or Last N mode)
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│ 2. DB Reconciler     │ ── Compares YouTube video IDs with PostgreSQL records;
└──────────────────────┘    inserts missing tracks as "pending"
           │
           ▼
┌──────────────────────┐
│ 3. Downloader Engine │ ── Queues pending tracks, executes yt-dlp with Deno JS solver & cookies,
└──────────────────────┘    fetches full metadata, encodes Opus files, and embeds tags
           │
           ▼
┌──────────────────────┐
│ 4. Lyrics Service    │ ── Queries LRCLIB for synced timing, writes .lrc files, or moves
└──────────────────────┘    tracks to no-lyrics fallback storage
           │
           ▼
┌──────────────────────┐
│ 5. FastAPI / React   │ ── Streams audio and synchronized scrolling lyrics directly to 
└──────────────────────┘    the browser dashboard player
```

---

## Dashboard Pages & Features

- **Dashboard (`/`)**: High-level overview of total tracks, downloaded/pending counts, active scheduler status, recent sync execution logs, and quick **Sync Now** action.
- **Playlists (`/playlists`)**: Interface to add, edit, toggle, or remove tracked YouTube playlists.
- **Playlist Detail (`/playlists/:id/detail`)**: Granular view of tracks associated with a specific playlist, showing track positions, download status badges, and manual re-sync buttons.
- **Songs Catalog (`/songs`)**: Complete audio library catalog with search filters (by title, artist, or status), built-in audio player, and real-time synchronized `.lrc` lyric display.
- **Artists View (`/songs/artists`)**: Unique artist grouping and library navigation.
- **Sync History (`/history`)**: Historical audit log recording execution timestamps, duration, track download statistics, and detailed failure logs.
- **Settings (`/settings`)**: Runtime configuration center for watch modes, YouTube cookie management, worker concurrency, sync schedules, and administrative security credentials.
- **System Health (`/health`)**: Real-time status reporting for PostgreSQL database connection, storage path availability, and FastAPI backend health.

---

## Local Development Setup (Without Docker)

To run the application locally without Docker containers:

### Prerequisites
- Python 3.13+
- Node.js 18+ and `npm`
- Deno 2.9+ installed and accessible in system `PATH`
- FFmpeg installed and accessible in system `PATH`
- PostgreSQL 17 running locally

### 1. Backend (FastAPI) Setup

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/macOS
   # .venv\Scripts\activate   # Windows
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/music_sync
   MUSIC_ROOT=./data/downloads
   ```

4. Run database migrations with Alembic:
   ```bash
   alembic upgrade head
   ```

5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### 2. Frontend (React Dashboard) Setup

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## API Reference

### Playlists API (`/playlists`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/playlists` | List all registered playlists |
| `POST` | `/playlists` | Register a new YouTube playlist |
| `GET` | `/playlists/{id}` | Get playlist details and associated track list |
| `PUT` | `/playlists/{id}` | Update playlist name, URL, or enabled status |
| `DELETE` | `/playlists/{id}` | Delete a playlist and optionally purge local media files |
| `POST` | `/playlists/{id}/sync` | Trigger an immediate sync for a specific playlist |

### Songs API (`/songs`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/songs` | List library songs with status/artist/playlist filtering |
| `GET` | `/songs/artists` | Retrieve distinct artist list |
| `GET` | `/songs/{id}` | Get detailed metadata for a specific song |
| `GET` | `/songs/{id}/lyrics` | Fetch synchronized `.lrc` lyric content |
| `GET` | `/songs/{id}/audio` | Stream or download `.opus` audio file |
| `POST` | `/songs/{id}/retry-download` | Reset download status to retry failed downloads |
| `POST` | `/songs/{id}/retry-lyrics` | Reset lyrics status to retry missing lyrics search |
| `DELETE` | `/songs/{id}` | Remove song metadata and delete local audio/lyric files |

### Sync & Scheduler API (`/sync`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/sync/status` | Get scheduler status, last run timestamps, and current state |
| `POST` | `/sync/start` | Start periodic background sync engine |
| `POST` | `/sync/stop` | Stop periodic background sync engine |
| `POST` | `/sync/run` | Execute an immediate manual sync cycle |
| `GET` | `/sync/history` | Retrieve historical sync logs and statistics |

### Settings API (`/settings`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/settings` | Retrieve active application runtime settings |
| `PUT` | `/settings` | Update sync intervals, watch modes, YouTube cookies, worker concurrency, and retry limits |

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## Top Contributors

Thanks to everyone who contributed to building and maintaining **Music Sync**!

<a href="https://github.com/janisadhi/Music-Sync/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=janisadhi/Music-Sync" alt="Music-Sync Contributors" />
</a>
