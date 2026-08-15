# Music Sync

[![CI for Music-Sync](https://github.com/janisadhi/Music-Sync/actions/workflows/deploy.yaml/badge.svg)](https://github.com/janisadhi/Music-Sync/actions/workflows/deploy.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.14](https://img.shields.io/badge/Python-3.14-blue.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-336791.svg)](https://www.postgresql.org/)

**Music Sync** is an automated, self-hosted service that synchronizes YouTube Music playlists with a local music library. It periodically monitors configured YouTube playlists, extracts audio in high-quality Opus format using `yt-dlp`, embeds high-resolution artwork and ID3/Opus metadata, fetches synchronized (`.lrc`) lyrics from LRCLIB, and exposes a web management dashboard and REST API.

---

## Key Capabilities

- **Automated YouTube Playlist Sync**: Multi-playlist support with flat extraction scanning via `yt-dlp`.
- **High-Quality Audio & Metadata**: Downloads audio in native format (`.opus`), embeds thumbnails/artwork, and maintains rich track metadata in PostgreSQL.
- **Synchronized Lyrics (.lrc)**: Automatically fetches timed lyrics from [LRCLIB.net](https://lrclib.net/) and organizes tracks with missing lyrics into a dedicated `no-lyrics/` directory.
- **Interactive Web Dashboard**: React 19 SPA featuring an embedded audio player with synchronized lyric rendering, playlist manager, system status metrics, and settings GUI.
- **Robust Background Workers**: Independent, decoupled background daemon threads for audio downloading and lyrics fetching with exponential backoff retries.
- **Netscape Cookie Support**: Securely manages Netscape-formatted YouTube cookies stored in the database to sync age-restricted or private playlists safely.
- **Docker Compose Stack**: Fully containerized multi-service deployment (`postgres`, `app`, `dashboard`).

---

## High-Level Architecture

Music-Sync operates on a strict decoupled worker contract:
> **SYNC DISCOVERS → DOWNLOADER DOWNLOADS → LYRICS PROCESSES → SCHEDULER TRIGGERS**

![Music-Sync Architecture Diagram](architecture.svg)

For in-depth architectural details, refer to the [System Architecture Wiki](https://github.com/janisadhi/Music-Sync/wiki/Architecture-Overview).

---

## Technology Stack

- **Backend**: Python 3.14, FastAPI, SQLAlchemy 2.0 (ORM), Pydantic v2, Alembic (Migrations), APScheduler.
- **Media Engine**: `yt-dlp` (Audio extraction), Deno JS runtime (YouTube EJS challenge solver), FFmpeg (Media conversion), AtomicParsley / Mutagen (Tagging).
- **Frontend**: React 19, Vite, Axios, Lucide Icons, Nginx (Production static server & API proxy).
- **Database**: PostgreSQL 17.
- **Containerization & CI**: Docker, Docker Compose, GitHub Actions, GitHub Container Registry (GHCR).

---

## Repository Structure

```text
Music-Sync/
├── alembic/                  # Database migration scripts and configuration
├── app/                      # Python FastAPI Backend Application
│   ├── api/                  # REST endpoints (auth, dashboard, playlists, songs, settings, sync)
│   ├── core/                 # App configuration, security, path resolution, yt-dlp context
│   ├── database/             # SQLAlchemy ORM models and session management
│   ├── downloader/           # Audio download worker service and retry engine
│   ├── lyrics/               # LRCLIB synced lyrics worker service
│   ├── reconciler/           # YouTube-to-database state reconciliation engine
│   ├── scheduler/            # APScheduler background sync manager
│   ├── settings/             # Persistent database settings service
│   ├── sync/                 # Playlist synchronization runner
│   ├── watcher/              # YouTube playlist scraper using yt-dlp flat extraction
│   └── main.py               # FastAPI entry point & worker lifespan manager
├── dashboard/                # React 19 Frontend Web Dashboard
│   ├── src/                  # React components, pages, layouts, services
│   ├── Dockerfile            # Multi-stage Docker build (Node builder + Nginx runtime)
│   └── nginx.conf            # SPA routing and reverse proxy configuration
├── data/                     # Persistent mounted storage (bind mount target)
├── docker-compose.yml        # Local development container orchestration
├── docker-compose-cd.yaml     # Production CD stack (GHCR image deployment)
└── Dockerfile                # Backend container definition (Python 3.14-slim + Deno + FFmpeg)
```

---

## Quickstart & Local Development

### Prerequisites

- **Docker & Docker Compose** (Recommended for full stack execution)
- *Alternatively for native execution*:
  - Python 3.14+
  - Node.js 22+
  - PostgreSQL 17
  - FFmpeg & Deno installed in system `PATH`

### 1. Docker Compose (Quickest Method)

```bash
# 1. Clone repository
git clone https://github.com/janisadhi/Music-Sync.git
cd Music-Sync

# 2. Copy environment template
cp .env.example .env

# 3. Start full container stack
docker compose up -d

# Access Dashboard at http://localhost:3000
# Access API Docs at http://localhost:8000/docs
```

### 2. Manual Development Setup

#### Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

```bash
cd dashboard

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## Technical Documentation Wiki

For detailed technical documentation, architectural diagrams, API reference, database schema specifications, and operations guides, explore the repository **[GitHub Wiki](https://github.com/janisadhi/Music-Sync/wiki)**:

- 📐 **Architecture**
  - [Architecture Overview](https://github.com/janisadhi/Music-Sync/wiki/Architecture-Overview)
  - [Component Architecture](https://github.com/janisadhi/Music-Sync/wiki/Component-Architecture)
  - [Runtime Architecture](https://github.com/janisadhi/Music-Sync/wiki/Runtime-Architecture)
  - [Data Flow & Workflows](https://github.com/janisadhi/Music-Sync/wiki/Data-Flow)
  - [Authentication & Security](https://github.com/janisadhi/Music-Sync/wiki/Authentication-and-Authorization)
  - [External Integrations](https://github.com/janisadhi/Music-Sync/wiki/External-Integrations)
- 🗄️ **Database**
  - [Database Overview](https://github.com/janisadhi/Music-Sync/wiki/Database-Overview)
  - [Schema & Tables](https://github.com/janisadhi/Music-Sync/wiki/Schema)
  - [Entity Relationships](https://github.com/janisadhi/Music-Sync/wiki/Relationships)
  - [Data Lifecycle & Migrations](https://github.com/janisadhi/Music-Sync/wiki/Data-Lifecycle)
- 🔌 **API Reference**
  - [API Overview](https://github.com/janisadhi/Music-Sync/wiki/API-Overview)
  - [Endpoint Catalog](https://github.com/janisadhi/Music-Sync/wiki/Endpoints)
  - [Authentication & Headers](https://github.com/janisadhi/Music-Sync/wiki/Authentication)
  - [Error Handling](https://github.com/janisadhi/Music-Sync/wiki/Error-Handling)
- 💻 **Development & Operations**
  - [Local Setup & Environment](https://github.com/janisadhi/Music-Sync/wiki/Local-Setup)
  - [Testing Guide](https://github.com/janisadhi/Music-Sync/wiki/Testing)
  - [Container Build & Deployment](https://github.com/janisadhi/Music-Sync/wiki/Build)
  - [Technical Debt & Known Issues](https://github.com/janisadhi/Music-Sync/wiki/Technical-Debt-and-Known-Issues)

---

## Contributing & Community

We welcome contributions! Please review our community guidelines before opening issues or pull requests:

- [Contributing Guidelines](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
