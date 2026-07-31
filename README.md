# Music Sync

An automated music synchronization service that monitors a YouTube playlist, downloads new songs as MP3 files, retrieves time-synchronized lyrics in LRC format, and organizes songs based on lyrics availability.

---

## Overview

Music Sync continuously monitors a configured YouTube playlist and synchronizes its contents with a local music library.

The system:

1. Reads the configured YouTube playlist.
2. Detects new songs.
3. Stores playlist and song metadata in PostgreSQL.
4. Downloads new songs using `yt-dlp`.
5. Converts downloaded audio to MP3 using FFmpeg.
6. Searches LRCLIB for synchronized lyrics.
7. Saves synchronized lyrics as `.lrc` files next to the corresponding MP3.
8. Moves songs without synchronized lyrics to a separate directory.
9. Retries temporary lyrics-service failures.
10. Periodically repeats the synchronization using APScheduler.
11. Removes songs from the database when they are removed from the monitored playlist.

---

## Architecture

```text
                    YouTube Playlist
                           │
                           ▼
                 ┌───────────────────┐
                 │ Playlist Watcher  │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ Playlist          │
                 │ Reconciler        │
                 └─────────┬─────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ PostgreSQL  │
                    └──────┬──────┘
                           │
                  ┌────────┴────────┐
                  │                 │
                  ▼                 ▼
          ┌───────────────┐  ┌───────────────┐
          │ MP3 Downloader│  │ Lyrics Service│
          └───────┬───────┘  └───────┬───────┘
                  │                   │
                  │                   ▼
                  │             ┌───────────┐
                  │             │  LRCLIB   │
                  │             └───────────┘
                  │
                  ▼
             data/music/
              │
              ├── song.mp3
              └── song.lrc

                  │
                  │ No synchronized lyrics
                  ▼

             data/no-lyrics/
                  │
                  └── song.mp3
```

---

## Features

### YouTube Playlist Synchronization

The application monitors a configured YouTube playlist using `yt-dlp`.

It extracts:

* YouTube video ID
* Title
* Artist
* Album
* Duration
* Playlist position

The playlist watcher does not download videos during discovery.

---

### Playlist Reconciliation

The reconciler compares the current YouTube playlist against the PostgreSQL database.

If a song is already present, it is skipped.

If a new song appears, it is added to the database with:

```text
download_status = pending
lyrics_status = pending
```

Songs that are removed from the YouTube playlist are also detected and removed from the database.

---

### MP3 Downloading

New songs are downloaded using `yt-dlp`.

The downloader selects the best available audio and uses FFmpeg to convert it to MP3.

Example:

```text
YouTube
   │
   ▼
yt-dlp
   │
   ▼
WebM/Audio
   │
   ▼
FFmpeg
   │
   ▼
MP3
```

Downloaded files are stored in:

```text
data/music/
```

---

### Time-Synchronized Lyrics

Music Sync uses the LRCLIB API to find synchronized lyrics.

Only results containing synchronized lyrics are accepted.

Lyrics are stored in standard `.lrc` format:

```text
[00:25.41] A heart that's full up like a landfill
[00:35.23] A job that slowly kills you
[00:41.56] Bruises that won't heal
[00:51.35] You look so tired, unhappy
```

The `.lrc` file is placed in the same directory as the corresponding MP3.

Example:

```text
data/music/
├── No Surprises (Remastered).mp3
└── No Surprises (Remastered).lrc
```

---

### Lyrics Title Matching

The lyrics service performs title normalization before searching.

Common modifiers such as:

```text
(Remastered)
(Remaster)
(Live)
(Acoustic)
(Radio Edit)
```

and their square-bracket equivalents are handled.

For example:

```text
No Surprises (Remastered)
```

can also be searched as:

```text
No Surprises
```

The service attempts to match:

1. Title + artist
2. Title
3. First available synchronized result

---

### Lyrics Retry Handling

Temporary LRCLIB failures are not treated as permanent missing lyrics.

The service retries errors such as:

```text
503 Service Unavailable
429 Too Many Requests
5xx server errors
network/request failures
```

If the request eventually succeeds, the synchronized lyrics are saved normally.

If the service remains temporarily unavailable, the song stays:

```text
lyrics_status = pending
```

and can be retried during the next synchronization cycle.

---

### No-Lyrics Handling

If LRCLIB successfully responds but no synchronized lyrics are found, the song is considered unavailable.

The MP3 is moved from:

```text
data/music/
```

to:

```text
data/no-lyrics/
```

Example:

```text
data/no-lyrics/
└── song.mp3
```

The database records:

```text
lyrics_status = unavailable
```

This is different from a temporary service failure.

---

## Synchronization Workflow

A complete sync cycle looks like this:

```text
1. Fetch YouTube playlist
        │
        ▼
2. Reconcile playlist
        │
        ├── New song → database
        ├── Existing song → skip
        └── Removed song → remove
        │
        ▼
3. Find pending downloads
        │
        ▼
4. Download MP3
        │
        ▼
5. Find pending lyrics
        │
        ├── Lyrics found
        │      └── Save .lrc
        │
        ├── Temporary error
        │      └── Keep pending
        │
        └── No synced lyrics
               └── Move MP3 to no-lyrics
```

---

## Project Structure

```text
music-sync/
│
├── alembic/
│   └── ...
│
├── app/
│   │
│   ├── core/
│   │   └── config.py
│   │
│   ├── database/
│   │   ├── models.py
│   │   └── session.py
│   │
│   ├── downloader/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── lyrics/
│   │   ├── __init__.py
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── reconciler/
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   ├── sync/
│   │   ├── __init__.py
│   │   ├── service.py
│   │   └── test_run.py
│   │
│   └── watcher/
│       └── youtube.py
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
├── docker-compose.yml
├── requirements.txt
├── alembic.ini
└── .env
```

---

## Technology Stack

| Component            | Technology              |
| -------------------- | ----------------------- |
| Programming Language | Python                  |
| Database             | PostgreSQL              |
| ORM                  | SQLAlchemy              |
| Database Migrations  | Alembic                 |
| YouTube Integration  | yt-dlp                  |
| Audio Conversion     | FFmpeg                  |
| Lyrics API           | LRCLIB                  |
| HTTP Client          | HTTPX                   |
| Configuration        | Pydantic Settings       |
| Scheduler            | APScheduler             |
| Containerization     | Docker / Docker Compose |

---

## Database

The application currently uses PostgreSQL.

### Playlist

The `playlists` table stores monitored playlist information.

Important fields include:

```text
id
youtube_playlist_id
name
url
enabled
created_at
updated_at
```

---

### Song

The `songs` table stores individual songs.

Important fields include:

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

---

## Download States

Songs can have the following download states:

```text
pending
downloading
downloaded
failed
```

### `pending`

The song has been discovered but has not been downloaded.

### `downloading`

The downloader is currently processing the song.

### `downloaded`

The MP3 was successfully downloaded.

### `failed`

The download failed.

---

## Lyrics States

Lyrics currently use:

```text
pending
downloaded
unavailable
failed
```

### `pending`

Lyrics have not yet been processed.

### `downloaded`

Synchronized lyrics were successfully found and saved.

### `unavailable`

LRCLIB was successfully queried, but no synchronized lyrics were found.

The MP3 is moved to:

```text
data/no-lyrics/
```

### `failed`

An unexpected or temporary lyrics-service error occurred.

Temporary errors are normally returned to `pending` so they can be retried.

---

## Configuration

Configuration is handled through `.env`.

Example:

```env
DATABASE_URL=postgresql+psycopg://music_sync:password@localhost:5432/music_sync

MUSIC_ROOT=./data/music

SYNC_INTERVAL_SECONDS=300

YOUTUBE_PLAYLIST_URL=https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID
```

The actual `.env` file should not be committed to Git.

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd music-sync
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

---

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

### 4. Install FFmpeg

FFmpeg is required for MP3 conversion.

On Fedora:

```bash
sudo dnf install ffmpeg
```

Verify:

```bash
ffmpeg -version
```

---

### 5. Configure environment variables

Create:

```text
.env
```

and configure the database and YouTube playlist.

---

## PostgreSQL

The project includes Docker Compose configuration for PostgreSQL.

Start the database:

```bash
docker compose up -d postgres
```

Check:

```bash
docker compose ps
```

---

## Database Migrations

Run Alembic migrations:

```bash
alembic upgrade head
```

---

## Running Individual Components

During development, each component can be tested independently.

### Playlist watcher

```bash
python -c "from app.core.config import settings; from app.watcher.youtube import YouTubePlaylistWatcher; songs=YouTubePlaylistWatcher(settings.youtube_playlist_url).fetch(); print('Songs:', len(songs)); [print(s.position, s.title, s.video_id) for s in songs]"
```

---

### Reconciler

```bash
python -m app.reconciler.test_run
```

Example:

```text
YouTube songs: 10
New songs: 1
```

---

### Downloader

```bash
python -m app.downloader.test_run
```

Example:

```text
Pending songs selected: 1
Downloading: 9 - Kendrick Lamar - Count Me Out
Downloaded: Kendrick Lamar - Count Me Out
```

---

### Lyrics service

```bash
python -m app.lyrics.test_run
```

Example:

```text
Songs waiting for lyrics: 1
Fetching lyrics: 9 - Kendrick Lamar - Count Me Out
Lyrics downloaded: Kendrick Lamar - Count Me Out
LRC: data/music/Kendrick Lamar - Count Me Out.lrc
```

---

### Complete synchronization

```bash
python -m app.sync.test_run
```

Example:

```text
============================================================
Music Sync
============================================================
Playlist songs discovered: 11
New songs added: 1
Pending songs selected: 1
Downloading: ...
Songs waiting for lyrics: 1
Fetching lyrics: ...
Lyrics downloaded: ...
============================================================
Sync cycle completed
============================================================
```

---

## Scheduler

The project includes a scheduled synchronization process.

The scheduler repeatedly executes the complete sync pipeline according to:

```text
SYNC_INTERVAL_SECONDS
```

Example output:

```text
Scheduler started. Press Ctrl+C to stop.

Starting scheduled sync

Music Sync
Playlist songs discovered: 9
New songs added: 0
Pending songs selected: 0
Songs waiting for lyrics: 0

Sync cycle completed

Scheduled sync completed
```

When a new song is added to the YouTube playlist, the scheduler detects and processes it automatically.

---

## Data Layout

### Songs with synchronized lyrics

```text
data/music/
├── Creep.mp3
├── Creep.lrc
├── Fake Plastic Trees.mp3
├── Fake Plastic Trees.lrc
├── Let Down (Remastered).mp3
├── Let Down (Remastered).lrc
└── ...
```

### Songs without synchronized lyrics

```text
data/no-lyrics/
└── song.mp3
```

### PostgreSQL data

```text
data/postgres/
```

This directory is used for persistent PostgreSQL storage through Docker.

---

## Idempotency

The synchronization process is designed to be idempotent.

Running:

```bash
python -m app.sync.test_run
```

multiple times does not create duplicate database records for the same YouTube video.

When there are no changes:

```text
Playlist songs discovered: 9
New songs added: 0
Pending songs selected: 0
Songs waiting for lyrics: 0
```

This allows the scheduler to safely execute synchronization repeatedly.

---

## Example End-to-End Scenario

Suppose a new song is added to the monitored YouTube playlist:

```text
Kendrick Lamar - Count Me Out
```

The next sync cycle detects it:

```text
New songs added: 1
```

The song is inserted into PostgreSQL as:

```text
download_status = pending
lyrics_status = pending
```

The downloader then downloads:

```text
data/music/Kendrick Lamar - Count Me Out.mp3
```

The lyrics service searches LRCLIB.

If synchronized lyrics are found:

```text
data/music/
├── Kendrick Lamar - Count Me Out.mp3
└── Kendrick Lamar - Count Me Out.lrc
```

The database becomes:

```text
download_status = downloaded
lyrics_status = downloaded
```

If LRCLIB temporarily returns `503`, the song remains pending for another attempt.

If LRCLIB confirms that no synchronized lyrics exist:

```text
data/no-lyrics/
└── Kendrick Lamar - Count Me Out.mp3
```

and:

```text
lyrics_status = unavailable
```

---

## Error Handling

The application distinguishes between permanent and temporary failures.

### YouTube failure

Example:

```text
Video unavailable
```

The song becomes:

```text
download_status = failed
```

and the error is stored in:

```text
error_message
```

### Temporary LRCLIB failure

Example:

```text
503 Service Unavailable
```

The lyrics request is retried.

If it continues failing, the song remains:

```text
lyrics_status = pending
```

### No synchronized lyrics

If the API responds successfully but no synchronized lyrics exist:

```text
lyrics_status = unavailable
```

and the MP3 is moved to:

```text
data/no-lyrics/
```

---

## Current Status

### Completed

* [x] PostgreSQL database integration
* [x] SQLAlchemy models
* [x] Alembic integration
* [x] YouTube playlist watcher
* [x] Playlist reconciliation
* [x] New song detection
* [x] Duplicate prevention
* [x] Removed song detection
* [x] MP3 downloading
* [x] FFmpeg MP3 conversion
* [x] Synchronized lyrics retrieval
* [x] LRC file generation
* [x] Lyrics title normalization
* [x] Artist/title matching
* [x] LRCLIB retry handling
* [x] No-lyrics fallback directory
* [x] Complete synchronization service
* [x] Scheduled synchronization
* [x] Idempotent sync behavior
* [x] End-to-end testing

---

## Known Issues

### YouTube JavaScript Runtime Warning

`yt-dlp` currently reports:

```text
No supported JavaScript runtime could be found.
```

Downloads currently work despite this warning, but configuring a supported JavaScript runtime is recommended.

### YouTube Unavailable Videos

Some videos may become unavailable or restricted.

The downloader currently records the failure in the database.

### Playlist Position Updates

New songs receive their current playlist position, but synchronization of position changes for existing songs can be improved.

### Retry Metadata

The system currently retries temporary lyrics failures, but more detailed retry metadata such as retry count and last attempt time could be added.

---

## Planned Improvements

The next development phase is focused on productionization.

Planned improvements include:

* [ ] Fully containerize the Music Sync application
* [ ] Run the scheduler as a Docker Compose service
* [ ] Configure persistent Docker volumes
* [ ] Configure FFmpeg inside the application container
* [ ] Configure a supported JavaScript runtime for `yt-dlp`
* [ ] Improve retry tracking
* [ ] Track failed download attempts
* [ ] Improve playlist position synchronization
* [ ] Add automated unit/integration tests
* [ ] Improve logging
* [ ] Add health checks
* [ ] Improve production configuration
* [ ] Add monitoring
* [ ] Add backup strategy for the database and music metadata

---

## Development Philosophy

The project is designed around a simple principle:

```text
YouTube Playlist
       ↓
Database State
       ↓
Local Music Library
```

The database acts as the source of synchronization state.

The filesystem contains the resulting music library.

The synchronization process continuously reconciles the two with the current YouTube playlist.

---

## License

License information has not been finalized yet.
