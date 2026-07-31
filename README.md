# Music Sync

Automatic YouTube Music playlist synchronization service built with Python, FastAPI, PostgreSQL, SQLAlchemy, Docker, and APScheduler.

The service monitors a YouTube playlist, reconciles its songs with a PostgreSQL database, downloads new songs, retrieves synchronized lyrics from LRCLIB, and exposes the music library through a REST API.

---

## Features

* YouTube playlist monitoring
* Automatic playlist reconciliation
* PostgreSQL-backed song tracking
* Automatic audio downloading with `yt-dlp`
* Audio conversion using FFmpeg
* Synchronized `.lrc` lyrics retrieval through LRCLIB
* Separate handling for songs without lyrics
* Persistent music storage
* Scheduled synchronization
* REST API using FastAPI
* Song metadata API
* Audio streaming/download endpoint
* Lyrics API
* Health-check endpoint
* Docker and Docker Compose deployment
* Alembic database migration support

---

## Architecture

```text
                    YouTube Playlist
                           |
                           v
                +----------------------+
                | YouTube Playlist     |
                | Watcher               |
                +----------+-----------+
                           |
                           v
                +----------------------+
                | Playlist Reconciler  |
                +----------+-----------+
                           |
                           v
                    +-------------+
                    | PostgreSQL  |
                    +------+------+
                           |
                 +---------+---------+
                 |                   |
                 v                   v
        +----------------+   +----------------+
        | Song Downloader|   | Lyrics Service |
        |    yt-dlp      |   |    LRCLIB      |
        +-------+--------+   +-------+--------+
                |                    |
                v                    v
        data/music/*.opus     data/music/*.lrc
                |
                v
             FastAPI
                |
       +--------+--------+
       |        |        |
       v        v        v
    /songs   /lyrics   /audio
```

---

## Project Structure

```text
music-sync/
├── alembic/
│   ├── versions/
│   ├── env.py
│   ├── README
│   └── script.py.mako
│
├── app/
│   ├── api/
│   │   ├── playlists.py
│   │   ├── schemas.py
│   │   └── songs.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   └── __init__.py
│   │
│   ├── database/
│   │   ├── models.py
│   │   ├── session.py
│   │   └── __init__.py
│   │
│   ├── downloader/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── lyrics/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── reconciler/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── scheduler/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── sync/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── watcher/
│   │   └── youtube.py
│   │
│   ├── main.py
│   └── __init__.py
│
├── config/
│
├── data/
│   ├── music/
│   ├── no-lyrics/
│   └── postgres/
│
├── tests/
│
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── progress.md
├── README.md
└── requirements.txt
```

---

# How Synchronization Works

The application runs a synchronization cycle at a configured interval.

### 1. Fetch playlist

The YouTube watcher reads the configured playlist and discovers the current songs.

```text
YouTube Playlist
       |
       v
YouTubePlaylistWatcher
       |
       v
list[YouTubeSong]
```

---

### 2. Reconcile with PostgreSQL

The reconciler compares the YouTube playlist with the database.

New songs are inserted into the `songs` table with:

```text
download_status = pending
lyrics_status   = pending
```

Existing songs are not downloaded again.

---

### 3. Download pending songs

The downloader selects pending songs and downloads them using `yt-dlp`.

The downloaded audio is stored under:

```text
data/music/
```

Inside Docker this directory is mounted as:

```text
/app/data/music
```

The host directory is therefore the persistent source of the music files.

---

### 4. Fetch lyrics

After a song has been successfully downloaded, the lyrics service searches LRCLIB for synchronized lyrics.

When lyrics are found:

```text
data/music/Song Name.lrc
```

is created and the database status becomes:

```text
lyrics_status = downloaded
```

If lyrics cannot be found, the song can be moved to:

```text
data/no-lyrics/
```

---

### 5. Repeat

The scheduler executes another synchronization cycle after the configured interval.

The current deployment uses an interval configured through:

```env
SYNC_INTERVAL_SECONDS=60
```

for one-minute synchronization during testing.

---

# Database

The project uses PostgreSQL.

The main tables are:

```text
playlists
songs
```

### Playlist

Stores information about the synchronized YouTube playlist.

Important fields:

```text
id
youtube_playlist_id
name
url
enabled
created_at
updated_at
```

### Song

Stores individual songs and their synchronization state.

Important fields:

```text
id
playlist_id
youtube_video_id
title
artist
album
duration
position
download_status
lyrics_status
file_path
lyrics_path
error_message
created_at
updated_at
```

Example state:

```text
download_status = downloaded
lyrics_status   = downloaded
```

---

# API

The application exposes a FastAPI REST API.

Base URL:

```text
http://localhost:8000
```

## Health Check

```http
GET /health
```

Example:

```bash
curl http://localhost:8000/health
```

Response:

```json
{
  "status": "ok",
  "service": "music-sync",
  "environment": "production",
  "database": "ok"
}
```

---

## List Songs

```http
GET /songs
```

Example:

```bash
curl http://localhost:8000/songs
```

Returns the songs ordered by playlist position.

---

## Get Song

```http
GET /songs/{song_id}
```

Example:

```bash
curl http://localhost:8000/songs/1
```

---

## Get Song Audio

```http
GET /songs/{song_id}/audio
```

Example:

```bash
curl -o song.mp3 http://localhost:8000/songs/1/audio
```

The endpoint returns the downloaded audio file.

---

## Get Song Lyrics

```http
GET /songs/{song_id}/lyrics
```

Example:

```bash
curl http://localhost:8000/songs/1/lyrics
```

Example response:

```json
{
  "song_id": 1,
  "title": "No Surprises (Remastered)",
  "lyrics_status": "downloaded",
  "lyrics": "[00:25.41] ..."
}
```

---

## API Documentation

FastAPI automatically provides interactive documentation.

Swagger UI:

```text
http://localhost:8000/docs
```

ReDoc:

```text
http://localhost:8000/redoc
```

---

# Configuration

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL=postgresql+psycopg://music_sync:music_sync@postgres:5432/music_sync

APP_NAME=music-sync
APP_ENV=production
APP_DEBUG=false

MUSIC_ROOT=/app/data/music

SYNC_INTERVAL_SECONDS=60

YOUTUBE_PLAYLIST_URL=https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID
```

For local development without Docker, the database URL can point to PostgreSQL on localhost:

```env
DATABASE_URL=postgresql+psycopg://music_sync:music_sync@localhost:5432/music_sync
```

---

# Docker Deployment

The project is designed to run with Docker Compose.

Services:

```text
music-sync-app
music-sync-postgres
```

Start the application:

```bash
sudo docker compose up -d --build
```

Check containers:

```bash
sudo docker compose ps
```

Expected:

```text
NAME                  SERVICE
music-sync-app        app
music-sync-postgres   postgres
```

---

## View Application Logs

```bash
sudo docker compose logs -f app
```

Expected scheduler output:

```text
Music Sync Scheduler
Interval: 60 seconds
Interval: 1.0 minutes

Starting scheduled sync

Music Sync

Playlist songs discovered: 13
New songs added: 0
Pending songs selected: 0
Songs waiting for lyrics: 0

Sync cycle completed
```

---

## Restart Application

```bash
sudo docker compose restart app
```

---

## Rebuild Application

After changing application code or dependencies:

```bash
sudo docker compose up -d --build
```

---

# Persistent Storage

Docker Compose mounts the music directory:

```yaml
volumes:
  - ./data/music:/app/data/music
  - ./data/no-lyrics:/app/data/no-lyrics
```

Therefore:

```text
Host:
./data/music

Container:
/app/data/music
```

and:

```text
Host:
./data/no-lyrics

Container:
/app/data/no-lyrics
```

Files downloaded by the application should therefore persist on the host.

PostgreSQL is also persisted:

```yaml
volumes:
  - ./data/postgres:/var/lib/postgresql/data
```

---

# PostgreSQL Management

Check PostgreSQL:

```bash
sudo docker compose ps
```

Enter PostgreSQL:

```bash
sudo docker exec -it music-sync-postgres \
psql -U music_sync -d music_sync
```

List songs:

```bash
sudo docker exec music-sync-postgres \
psql -U music_sync -d music_sync \
-c "SELECT id, position, title, download_status, lyrics_status FROM songs ORDER BY position;"
```

---

# Reset Database

To remove all songs and playlists while keeping the PostgreSQL database itself:

```bash
sudo docker exec music-sync-postgres \
psql -U music_sync -d music_sync \
-c "TRUNCATE TABLE songs, playlists RESTART IDENTITY CASCADE;"
```

Then remove downloaded files if a completely clean synchronization is required:

```bash
rm -f data/music/*
rm -f data/no-lyrics/*
```

Restart the application:

```bash
sudo docker compose restart app
```

The next synchronization cycle will rediscover the playlist and insert the songs again.

---

# Database Migrations

Alembic is used for database schema migrations.

Create a migration after changing models:

```bash
alembic revision --autogenerate -m "describe change"
```

Apply migrations:

```bash
alembic upgrade head
```

Check migration status:

```bash
alembic current
```

---

# Local Development

Create and activate the virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the FastAPI application:

```bash
uvicorn app.main:app --reload
```

---

# Testing Individual Components

The project contains small test-run modules for individual services.

### Reconciler

```bash
python -m app.reconciler.test_run
```

### Downloader

```bash
python -m app.downloader.test_run
```

### Lyrics

```bash
python -m app.lyrics.test_run
```

### Synchronization

```bash
python -m app.sync.test_run
```

### Scheduler

```bash
python -m app.scheduler.test_run
```

---

# Manual Synchronization

The complete synchronization process can be triggered manually with:

```bash
python -m app.sync.test_run
```

Expected output:

```text
============================================================
Music Sync
============================================================
Playlist songs discovered: 13
New songs added: 0
Pending songs selected: 1
Downloading: ...
Downloaded: ...
Songs waiting for lyrics: ...
============================================================
Sync cycle completed
============================================================
```

---

# Synchronization Status

Each song has independent download and lyrics states.

Possible download states include:

```text
pending
downloading
downloaded
failed
```

Possible lyrics states include:

```text
pending
downloading
downloaded
failed
unavailable
```

This allows failed operations to be identified without losing the song's playlist record.

---

# Current Workflow

The current system follows:

```text
YouTube Playlist
       |
       v
Playlist Watcher
       |
       v
Playlist Reconciler
       |
       v
PostgreSQL
       |
       v
Pending Songs
       |
       v
Song Downloader
       |
       v
Downloaded Audio
       |
       v
Lyrics Service
       |
       v
Synchronized Lyrics
       |
       v
FastAPI
       |
       +---- /health
       +---- /songs
       +---- /songs/{id}
       +---- /songs/{id}/audio
       +---- /songs/{id}/lyrics
```

---

# Technology Stack

| Component          | Technology        |
| ------------------ | ----------------- |
| Language           | Python            |
| API                | FastAPI           |
| Database           | PostgreSQL 17     |
| ORM                | SQLAlchemy        |
| Migrations         | Alembic           |
| YouTube extraction | yt-dlp            |
| Lyrics             | LRCLIB            |
| Scheduler          | APScheduler       |
| HTTP client        | HTTPX             |
| Validation/config  | Pydantic Settings |
| Containerization   | Docker            |
| Orchestration      | Docker Compose    |
| Application server | Uvicorn           |

---

# Project Status

The core synchronization pipeline is functional:

* YouTube playlist discovery
* Playlist reconciliation
* PostgreSQL persistence
* New-song detection
* Scheduled synchronization
* Audio downloading
* Persistent host storage
* LRCLIB synchronized lyrics
* FastAPI health endpoint
* Song listing API
* Song detail API
* Audio endpoint
* Lyrics endpoint
* Dockerized application
* PostgreSQL Docker service
* Persistent PostgreSQL storage
* Automatic scheduler startup

The next development focus is improving the downloader/audio pipeline, particularly reliable FFmpeg availability inside the Docker image and producing the desired high-quality Opus output.
