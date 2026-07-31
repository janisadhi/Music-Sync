# Music Sync — Development Progress

## Project Overview

**Music Sync** is an automated service that synchronizes a YouTube playlist with a local music library.

The current architecture is:

```text
YouTube Playlist
       │
       ▼
YouTube Watcher
       │
       ▼
Playlist Reconciler
       │
       ▼
PostgreSQL
       │
       ├── Download Service ──► Local Music Library
       │
       └── Lyrics Service ───► .lrc Files
       
FastAPI
   │
   ├── Health API
   ├── Songs API
   ├── Audio API
   └── Lyrics API

APScheduler
   │
   └── Periodic Sync
```

---

# 1. Current Status

| Component                    | Status                                    |
| ---------------------------- | ----------------------------------------- |
| Python project structure     | Complete                                  |
| Environment configuration    | Complete                                  |
| PostgreSQL                   | Working                                   |
| SQLAlchemy models            | Working                                   |
| Alembic setup                | Added                                     |
| YouTube playlist watcher     | Working                                   |
| Playlist reconciliation      | Working                                   |
| New song detection           | Working                                   |
| Song database persistence    | Working                                   |
| Song downloader              | Working, needs final refinement           |
| MP3 conversion               | Implemented but requires FFmpeg in Docker |
| Lyrics search                | Working                                   |
| Synced `.lrc` generation     | Working                                   |
| No-lyrics handling           | Implemented/tested                        |
| FastAPI                      | Working                                   |
| Health endpoint              | Working                                   |
| Songs endpoint               | Working                                   |
| Audio endpoint               | Working                                   |
| Lyrics endpoint              | Working                                   |
| APScheduler                  | Working                                   |
| Immediate sync on startup    | Working                                   |
| Periodic sync                | Working                                   |
| Docker Compose               | Working                                   |
| PostgreSQL Docker container  | Working                                   |
| Application Docker container | Working                                   |
| Docker networking            | Working                                   |
| Persistent music volume      | Configured                                |
| Production environment       | Working                                   |
| Clean database reset         | Supported                                 |
| End-to-end clean sync test   | Next step                                 |

---

# 2. Project Structure

Current application structure:

```text
app/
├── api/
│   ├── __init__.py
│   ├── playlists.py
│   ├── schemas.py
│   └── songs.py
│
├── core/
│   ├── __init__.py
│   └── config.py
│
├── database/
│   ├── __init__.py
│   ├── models.py
│   └── session.py
│
├── downloader/
│   ├── __init__.py
│   ├── service.py
│   └── test_run.py
│
├── library/
│   └── __init__.py
│
├── lyrics/
│   ├── __init__.py
│   ├── service.py
│   └── test_run.py
│
├── reconciler/
│   ├── __init__.py
│   ├── service.py
│   └── test_run.py
│
├── scheduler/
│   ├── __init__.py
│   ├── service.py
│   └── test_run.py
│
├── sync/
│   ├── __init__.py
│   ├── service.py
│   └── test_run.py
│
├── watcher/
│   ├── __init__.py
│   └── youtube.py
│
├── main.py
│
├── alembic/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── .env
├── .env.example
├── .gitignore
├── progress.md
└── README.md
```

---

# 3. Configuration

`app/core/config.py` uses Pydantic Settings.

Current important settings:

```text
APP_NAME
APP_ENV
APP_DEBUG
DATABASE_URL
MUSIC_ROOT
SYNC_INTERVAL_SECONDS
YOUTUBE_PLAYLIST_URL
```

Production Docker configuration currently uses:

```text
APP_ENV=production
APP_DEBUG=false
MUSIC_ROOT=/app/data/music
SYNC_INTERVAL_SECONDS=60
```

The application receives the YouTube playlist URL through Docker Compose environment configuration.

---

# 4. PostgreSQL

PostgreSQL is running inside Docker.

Current container:

```text
music-sync-postgres
```

Image:

```text
postgres:17
```

Database:

```text
music_sync
```

User:

```text
music_sync
```

PostgreSQL is exposed locally through:

```text
127.0.0.1:5432
```

Persistent database storage:

```text
./data/postgres
```

Healthcheck is configured using:

```text
pg_isready
```

The application waits for PostgreSQL to become healthy before starting.

---

# 5. Database Models

Two primary models currently exist.

## Playlist

Contains:

* YouTube playlist ID
* playlist name
* playlist URL
* enabled state
* timestamps

## Song

Contains:

* playlist ID
* YouTube video ID
* title
* artist
* album
* duration
* playlist position
* download status
* lyrics status
* audio file path
* lyrics file path
* error message
* timestamps

Current status values include:

```text
download_status:
pending
downloading
downloaded
failed
```

and:

```text
lyrics_status:
pending
downloading
downloaded
unavailable
failed
```

---

# 6. YouTube Playlist Watcher

The watcher successfully retrieves songs from the configured YouTube playlist.

Example result:

```text
Playlist songs discovered: 13
```

The watcher provides information such as:

```text
YouTube video ID
title
duration
position
```

The application is currently able to detect changes in the playlist.

---

# 7. Playlist Reconciliation

The reconciler compares the YouTube playlist with the local database.

Test command:

```bash
python -m app.reconciler.test_run
```

Successful result:

```text
YouTube songs: 11
New songs: 0
```

The reconciler correctly avoids inserting duplicate songs.

When a new YouTube song is added:

```text
New songs added: 1
```

The song is inserted with:

```text
download_status = pending
lyrics_status = pending
```

---

# 8. Synchronization Service

The main synchronization pipeline is:

```text
1. Fetch YouTube playlist
2. Reconcile playlist with database
3. Download one pending song
4. Fetch lyrics for one downloaded song
```

Current service:

```text
app/sync/service.py
```

Test:

```bash
python -m app.sync.test_run
```

Example successful output:

```text
============================================================
Music Sync
============================================================
Playlist songs discovered: 11
New songs added: 0
Pending songs selected: 0
Songs waiting for lyrics: 0
============================================================
Sync cycle completed
============================================================
```

The service currently processes one pending download and one pending lyrics operation per sync cycle.

---

# 9. Downloader

The downloader uses `yt-dlp`.

Current flow:

```text
YouTube
   ↓
yt-dlp
   ↓
best audio format
   ↓
FFmpeg post-processing
   ↓
music file
```

The original downloader was configured to convert audio to:

```text
MP3
192 kbps
```

However, the current desired direction is to use:

```text
Opus
high bitrate
```

This still requires final downloader configuration.

---

# 10. FFmpeg Issue

A Docker test exposed the following error:

```text
ERROR: Postprocessing: ffprobe and ffmpeg not found.
Please install or provide the path using --ffmpeg-location
```

The current Docker image is:

```dockerfile
FROM python:3.13-slim
```

The image currently installs Python dependencies but does not install FFmpeg.

This means yt-dlp can download the original YouTube audio stream, but cannot perform post-processing/conversion.

### Required fix

Install FFmpeg inside the Docker image.

The Dockerfile should eventually include the required Debian packages before installing Python dependencies.

This is required for:

* Opus conversion
* MP3 conversion
* audio post-processing
* metadata handling
* reliable output extension

---

# 11. Current Audio Download Problem

During testing, yt-dlp selected:

```text
format 251
```

and downloaded:

```text
.webm
```

The log showed:

```text
[info] HxfE6PJmGS8: Downloading 1 format(s): 251
```

followed by:

```text
Jeff Buckley - Lover, You Should've Come Over (Official Audio).webm
```

The download itself succeeded, but post-processing failed because FFmpeg was unavailable.

Therefore:

```text
YouTube download
        ↓
WebM/Opus stream
        ↓
FFmpeg
        ↓
desired .opus output
```

is the correct architecture.

---

# 12. Lyrics Service

Lyrics are retrieved from:

```text
LRCLIB
```

The service searches using the song title and optionally artist/album information.

It supports title cleaning for common variants such as:

```text
(Remastered)
(Remaster)
(Live)
(Acoustic)
(Radio Edit)
```

The service searches for synchronized lyrics using:

```text
syncedLyrics
```

---

# 13. Lyrics Testing

The lyrics service was tested independently.

Example:

```python
result = service._find_synced_lyrics(
    title="Kendrick Lamar - Count Me Out",
)
```

Result:

```text
Status: available
Lyrics found: True
Error: None
```

Lyrics were successfully written to `.lrc` files for the existing songs.

---

# 14. No-Lyrics Handling

A fake test song was inserted into PostgreSQL:

```text
This Song Definitely Does Not Exist 987654321
```

The lyrics service correctly detected:

```text
No synced lyrics
```

Database result:

```text
lyrics_status = unavailable
```

and:

```text
error_message = No synchronized lyrics found
```

The test also confirmed that the song was moved into:

```text
data/no-lyrics/
```

This prevents songs without synchronized lyrics from continuously being retried.

---

# 15. Music Library

The application uses:

```text
data/music/
```

as the host music directory.

Docker mounts:

```yaml
- ./data/music:/app/data/music
```

Therefore:

```text
Host:
./data/music

Container:
/app/data/music
```

refer to the same physical files.

Lyrics are stored alongside the audio files:

```text
Song.opus
Song.lrc
```

---

# 16. No-Lyrics Library

Songs without synchronized lyrics are moved to:

```text
data/no-lyrics/
```

Docker mounts this directory as:

```text
/app/data/no-lyrics
```

This keeps songs without lyrics separate from the main music library.

---

# 17. FastAPI

FastAPI is running successfully inside Docker.

Application:

```text
http://localhost:8000
```

The health endpoint:

```text
GET /health
```

returns:

```json
{
  "status": "ok",
  "service": "music-sync",
  "environment": "production",
  "database": "ok"
}
```

---

# 18. Songs API

The songs API is available at:

```text
GET /songs
```

It returns all songs ordered by playlist position.

Example:

```text
curl http://localhost:8000/songs
```

Individual song:

```text
GET /songs/{song_id}
```

---

# 19. Audio API

Audio files can be retrieved using:

```text
GET /songs/{song_id}/audio
```

Example:

```bash
curl -o /tmp/test.mp3 \
http://localhost:8000/songs/1/audio
```

The endpoint successfully returned an audio file during testing.

The endpoint validates:

1. Song exists
2. Download status is `downloaded`
3. File path exists
4. File is returned using `FileResponse`

---

# 20. Lyrics API

Lyrics are available through:

```text
GET /songs/{song_id}/lyrics
```

Example:

```bash
curl http://localhost:8000/songs/1/lyrics
```

Response contains:

```json
{
  "song_id": 1,
  "title": "No Surprises (Remastered)",
  "lyrics_status": "downloaded",
  "lyrics": "..."
}
```

The `.lrc` file is read from the path stored in the database.

---

# 21. Scheduler

The scheduler uses:

```text
APScheduler
AsyncIOScheduler
```

The scheduler runs:

```text
SyncService.run()
```

on a configured interval.

Current interval:

```text
60 seconds
```

The scheduler also performs one sync immediately when the application starts.

This was changed because the previous scheduler only waited for the first interval before running.

Current behavior:

```text
Application starts
       ↓
Immediate sync
       ↓
Wait 60 seconds
       ↓
Sync
       ↓
Wait 60 seconds
       ↓
Sync
       ↓
...
```

---

# 22. Docker Application

Application container:

```text
music-sync-app
```

The container runs:

```text
uvicorn app.main:app
```

on:

```text
0.0.0.0:8000
```

Host mapping:

```text
127.0.0.1:8000 -> container:8000
```

Current Docker Compose status has successfully shown:

```text
music-sync-app       Up
music-sync-postgres  Up (healthy)
```

---

# 23. Docker Networking

The application communicates with PostgreSQL using the Docker service name:

```text
postgres
```

Database URL:

```text
postgresql+psycopg://music_sync:music_sync@postgres:5432/music_sync
```

This works correctly.

Database health check:

```text
database: ok
```

---

# 24. DNS / Internet Connectivity

A temporary YouTube DNS problem was observed inside the application container.

The container initially reported:

```text
Temporary failure in name resolution
```

Docker DNS was later verified.

Inside the container:

```text
youtube.com
lrclib.net
```

resolved successfully.

HTTP connectivity was also verified:

```text
Google: HTTP 200
LRCLIB: HTTP 200
```

After restarting the application container, YouTube synchronization worked successfully.

---

# 25. Database Reset

For clean end-to-end testing, the database can be completely reset with:

```bash
sudo docker exec music-sync-postgres \
psql -U music_sync -d music_sync \
-c "TRUNCATE TABLE songs, playlists RESTART IDENTITY CASCADE;"
```

This removes all playlist and song records and resets their IDs.

Verify:

```bash
sudo docker exec music-sync-postgres \
psql -U music_sync -d music_sync \
-c "SELECT COUNT(*) AS playlists FROM playlists; SELECT COUNT(*) AS songs FROM songs;"
```

Expected:

```text
playlists = 0
songs = 0
```

---

# 26. Current Clean-Test State

The local music directory was emptied:

```text
data/music/
```

The database still contained previous records before the reset.

The next clean test should:

```text
1. Truncate database
2. Ensure data/music is empty
3. Ensure data/no-lyrics is empty
4. Restart application
5. Allow immediate sync
6. Verify all playlist songs are inserted
7. Verify downloads
8. Verify lyrics
9. Verify database file paths
10. Verify files exist on the host
```

---

# 27. Current Known Issues

## Issue 1 — FFmpeg missing from Docker

Current error:

```text
ffprobe and ffmpeg not found
```

Impact:

```text
yt-dlp downloads WebM
        ↓
FFmpeg conversion fails
        ↓
download marked failed
```

### Priority

**High**

### Required action

Install FFmpeg in the Docker image.

---

## Issue 2 — Audio format

The downloader currently uses:

```text
MP3 192 kbps
```

The desired format is:

```text
Opus
high bitrate
```

### Priority

**High**

### Required action

Update `SongDownloader` to request the best audio and convert/store it as Opus.

---

## Issue 3 — Lyrics processing

Lyrics worked during standalone testing and for the initial library.

However, the downloader failure prevents newly downloaded songs from reaching the lyrics stage.

Pipeline must remain:

```text
download successful
        ↓
download_status = downloaded
        ↓
lyrics processor sees pending lyrics
        ↓
LRCLIB search
        ↓
.lrc generated
```

---

## Issue 4 — Failed downloads

A song that reaches:

```text
download_status = failed
```

is currently not automatically retried because the downloader selects:

```text
download_status == pending
```

A retry strategy should eventually be implemented.

---

# 28. Next Development Tasks

## Phase 1 — Fix Audio Pipeline

* [ ] Install FFmpeg in Docker image
* [ ] Verify `ffmpeg` inside container
* [ ] Verify `ffprobe` inside container
* [ ] Change output format to Opus
* [ ] Select high-quality audio
* [ ] Verify final file extension is `.opus`
* [ ] Verify database `file_path`
* [ ] Verify host `data/music` contains the file

---

## Phase 2 — Verify Lyrics Pipeline

* [ ] Download a fresh song
* [ ] Confirm `lyrics_status = pending`
* [ ] Run lyrics processing
* [ ] Confirm `.lrc` file creation
* [ ] Confirm `lyrics_path`
* [ ] Test `/songs/{id}/lyrics`
* [ ] Test song with unavailable lyrics
* [ ] Confirm unavailable songs move to `data/no-lyrics`

---

## Phase 3 — Clean End-to-End Test

Run:

```bash
sudo docker exec music-sync-postgres \
psql -U music_sync -d music_sync \
-c "TRUNCATE TABLE songs, playlists RESTART IDENTITY CASCADE;"
```

Then:

```bash
rm -f data/music/*
rm -f data/no-lyrics/*
```

Restart:

```bash
sudo docker compose restart app
```

Watch:

```bash
sudo docker compose logs -f app
```

Expected flow:

```text
Playlist songs discovered: 13
New songs added: 13

Pending songs selected: 1
Downloading: ...

Downloaded: ...

Songs waiting for lyrics: 1

Lyrics downloaded: ...
```

Repeated scheduler cycles should gradually process the entire playlist.

---

# 29. Verification Checklist

After the clean sync:

### Database

```bash
sudo docker exec music-sync-postgres \
psql -U music_sync -d music_sync \
-c "SELECT id, position, title, download_status, lyrics_status, file_path, lyrics_path FROM songs ORDER BY position;"
```

Expected:

```text
download_status = downloaded
```

and preferably:

```text
lyrics_status = downloaded
```

for songs with available synchronized lyrics.

---

### Host files

```bash
find data/music -maxdepth 1 -type f | sort
```

Expected:

```text
Song 1.opus
Song 1.lrc
Song 2.opus
Song 2.lrc
...
```

---

### API

```bash
curl http://localhost:8000/health
```

```bash
curl http://localhost:8000/songs
```

```bash
curl http://localhost:8000/songs/1/lyrics
```

```bash
curl -o /tmp/test.opus \
http://localhost:8000/songs/1/audio
```

---

# 30. Current Milestone

## Milestone: Core Music Synchronization System

**Status: ~80% complete**

The following core functionality is operational:

```text
YouTube playlist discovery       ✓
Database persistence              ✓
Playlist reconciliation           ✓
New song detection                ✓
Docker deployment                 ✓
PostgreSQL                        ✓
FastAPI                           ✓
Health API                        ✓
Songs API                         ✓
Audio API                         ✓
Lyrics API                        ✓
Lyrics lookup                     ✓
LRC generation                    ✓
No-lyrics handling                ✓
Automatic scheduler               ✓
Immediate startup sync            ✓
Periodic sync                     ✓
Persistent music volume           ✓
```

The major remaining work is the **production-quality audio pipeline**, particularly:

```text
FFmpeg installation
       ↓
Opus conversion
       ↓
High-quality audio selection
       ↓
Reliable file-path handling
       ↓
Lyrics processing
       ↓
Retry/error handling
```

Once this is complete, the project will have a reliable end-to-end synchronization pipeline suitable for the next stage of development.
