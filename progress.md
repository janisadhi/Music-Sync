# Music Sync — Project Progress

## 1. Project Overview

**Music Sync** is an automated music synchronization service that monitors a YouTube playlist and maintains a local music library.

The system currently performs the following workflow:

```text
YouTube Playlist
       │
       ▼
Playlist Watcher
       │
       ▼
Playlist Reconciler
       │
       ▼
PostgreSQL
       │
       ▼
MP3 Downloader
       │
       ▼
Synced Lyrics Service
       │
       ├── Lyrics found
       │      └── MP3 + LRC → data/music/
       │
       └── No synced lyrics
              └── MP3 → data/no-lyrics/
```

The system is designed to be idempotent, meaning running the synchronization repeatedly should not download or process the same song again.

---

# 2. Current Project Structure

```text
music-sync/
├── alembic/
├── alembic.ini
├── app/
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
├── data/
│   ├── music/
│   ├── no-lyrics/
│   └── postgres/
│
├── tests/
├── docker-compose.yml
├── requirements.txt
└── .env
```

---

# 3. Technology Stack

## Backend

* Python
* SQLAlchemy
* PostgreSQL
* Alembic
* Pydantic Settings

## YouTube

* `yt-dlp`

Used for:

* Reading YouTube playlists
* Extracting playlist entries
* Downloading audio
* Converting audio to MP3

## Lyrics

* LRCLIB API
* `httpx`

Used to retrieve synchronized lyrics in `.lrc` format.

## Scheduling

* APScheduler

Used to execute the synchronization process periodically.

## Infrastructure

* Docker
* Docker Compose
* PostgreSQL container

---

# 4. Database

The project currently uses PostgreSQL.

The main tables implemented so far are:

```text
playlists
songs
```

---

# 5. Playlist Model

The `playlists` table stores information about monitored YouTube playlists.

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

The YouTube playlist ID is unique.

This prevents the same playlist from being registered multiple times.

---

# 6. Song Model

The `songs` table stores individual playlist songs.

Current fields include:

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

### Download states

The downloader currently uses states such as:

```text
pending
downloading
downloaded
failed
```

### Lyrics states

The lyrics service uses:

```text
pending
downloaded
unavailable
failed
```

The distinction between `unavailable` and `failed` is important.

### `unavailable`

Means the service successfully checked LRCLIB but could not find synchronized lyrics.

The song is therefore moved to:

```text
data/no-lyrics/
```

### `failed`

Usually indicates a temporary or technical failure, such as:

```text
503 Service Unavailable
429 Too Many Requests
network failure
```

The song remains:

```text
lyrics_status = pending
```

so that the next synchronization cycle can retry it.

---

# 7. YouTube Playlist Watcher

File:

```text
app/watcher/youtube.py
```

The watcher uses `yt-dlp` to inspect the configured YouTube playlist.

It runs with:

```python
extract_flat = True
skip_download = True
```

This allows the system to discover playlist entries without downloading them.

Each entry is converted into a:

```python
YouTubeSong
```

object containing:

```text
video_id
title
artist
album
duration
position
```

Example:

```text
0  No Surprises (Remastered)  7374CZQoS2Y
1  Fake Plastic Trees          6gDhsUWCHrg
2  Let Down (Remastered)      ZVgHPSyEIqk
...
```

The watcher has been successfully tested against the real playlist.

---

# 8. Playlist Reconciliation

File:

```text
app/reconciler/service.py
```

The reconciler compares the current YouTube playlist against the database.

For every YouTube song it checks:

```text
playlist_id
youtube_video_id
```

If the song already exists, it is skipped.

If it does not exist, a new `Song` record is created.

Example output:

```text
YouTube songs: 9
New songs: 1
```

After adding a song:

```text
New songs: 0
```

on subsequent runs.

This confirms that duplicate prevention is working.

---

# 9. Removed Song Handling

The reconciler was extended to detect songs that no longer exist in the YouTube playlist.

Example:

```text
Removed from playlist: Bohemian Rhapsody (yl3TsqL0ZPw)
```

The corresponding database record was removed.

This is important because the local database should represent the current playlist rather than permanently accumulating deleted playlist entries.

---

# 10. Song Downloader

File:

```text
app/downloader/service.py
```

The downloader selects:

```text
download_status = pending
```

songs.

Example:

```text
Pending songs selected: 1
Downloading: 9 - Kendrick Lamar - Count Me Out
```

The YouTube URL is generated from:

```text
youtube_video_id
```

and passed to `yt-dlp`.

---

# 11. Audio Download

The downloader uses:

```text
bestaudio/best
```

and then FFmpeg extracts MP3 audio.

The resulting file is stored under:

```text
data/music/
```

Example:

```text
data/music/Kendrick Lamar - Count Me Out.mp3
```

The database is then updated:

```text
download_status = downloaded
file_path = data/music/Kendrick Lamar - Count Me Out.mp3
```

---

# 12. Failed YouTube Downloads

The system correctly handles unavailable YouTube videos.

For example:

```text
Bohemian Rhapsody
```

returned:

```text
Video unavailable. This video is not available
```

The database recorded:

```text
download_status = failed
```

with the error message.

This song was later removed from the playlist during reconciliation, so it no longer remains in the active playlist database.

---

# 13. YouTube JavaScript Runtime Warning

`yt-dlp` currently reports:

```text
WARNING: No supported JavaScript runtime could be found.
```

Despite the warning, downloads are currently working.

For example:

```text
Downloading 1 format(s): 251
```

followed by successful MP3 conversion.

This warning should eventually be addressed by installing/configuring a supported JavaScript runtime for `yt-dlp`.

It is currently a **known technical improvement**, not a blocker.

---

# 14. Lyrics Service

File:

```text
app/lyrics/service.py
```

The lyrics service uses:

```text
https://lrclib.net/api/search
```

to search for synchronized lyrics.

The returned `syncedLyrics` field is stored directly as an `.lrc` file.

---

# 15. Time-Synchronized Lyrics

The system specifically requires **time-synchronized lyrics**.

The resulting file uses standard LRC timestamps:

```text
[00:25.41] A heart that's full up like a landfill
[00:35.23] A job that slowly kills you
[00:41.56] Bruises that won't heal
[00:47.42]
[00:51.35] You look so tired, unhappy
```

Therefore the lyrics are suitable for synchronized playback.

Plain unsynchronized lyrics are not accepted as a successful lyrics result.

---

# 16. LRC File Location

When synchronized lyrics are found, the `.lrc` file is created in the **same directory as the MP3**.

Example:

```text
data/music/
├── No Surprises (Remastered).mp3
└── No Surprises (Remastered).lrc
```

Another example:

```text
data/music/
├── Radiohead - All I Need.mp3
└── Radiohead - All I Need.lrc
```

This satisfies the requirement that the MP3 and its synchronized lyrics remain together.

---

# 17. Lyrics Filename

The lyrics path is derived directly from the music path:

```python
Path(song.file_path).with_suffix(".lrc")
```

For example:

```text
song.mp3
```

becomes:

```text
song.lrc
```

This ensures the MP3 and LRC filenames remain synchronized.

---

# 18. Lyrics Matching

The lyrics service does more than simply accept the first LRCLIB result.

It attempts to match:

1. Song title
2. Artist
3. Synchronized lyrics availability

It also cleans common title modifiers.

For example:

```text
No Surprises (Remastered)
```

can be searched as:

```text
No Surprises
```

The title cleaner currently handles common variants such as:

```text
Remastered
Remaster
Live
Acoustic
Radio Edit
```

in both parentheses and square brackets.

---

# 19. Lyrics Search Strategy

The service uses multiple matching levels.

### First priority

Title + artist match.

### Second priority

Title match without requiring artist.

### Third priority

First available synchronized result.

This improves the chance of finding lyrics when YouTube metadata is incomplete.

---

# 20. LRCLIB Error Handling

LRCLIB can occasionally return temporary errors.

One example encountered during testing:

```text
503 Service Unavailable
```

Initially this caused:

```text
lyrics_status = failed
```

The service was then improved to retry temporary failures.

The current retry behavior supports:

```text
503
5xx errors
429
network/request failures
```

with multiple attempts and increasing delays.

---

# 21. Temporary vs Permanent Lyrics Failure

This distinction is now implemented.

### Temporary failure

Example:

```text
503 Service Unavailable
```

Result:

```text
lyrics_status = pending
```

The song remains in `data/music/`.

The next sync cycle can retry.

### Permanent unavailability

Example:

```text
No synchronized lyrics found
```

Result:

```text
lyrics_status = unavailable
```

The MP3 is moved to:

```text
data/no-lyrics/
```

---

# 22. No-Lyrics Folder

The project requirement is:

> Songs without synchronized lyrics should be placed in a different folder.

This is implemented as:

```text
data/no-lyrics/
```

Example:

```text
data/no-lyrics/
└── NO_LYRICS_TEST.mp3
```

The corresponding database record contains:

```text
lyrics_status = unavailable
```

and:

```text
file_path = data/no-lyrics/NO_LYRICS_TEST.mp3
```

---

# 23. No-Lyrics Test

A fake song was manually inserted into the database:

```text
This Song Definitely Does Not Exist 987654321
```

The lyrics service returned:

```text
No synced lyrics
```

The MP3 was successfully moved:

```text
data/music/NO_LYRICS_TEST.mp3
```

to:

```text
data/no-lyrics/NO_LYRICS_TEST.mp3
```

Database result:

```text
lyrics_status = unavailable
```

This confirms that the fallback mechanism works.

---

# 24. Sync Service

File:

```text
app/sync/service.py
```

The sync service combines the individual components into one workflow.

The current synchronization pipeline is:

```text
1. Fetch YouTube playlist
2. Reconcile playlist with database
3. Find pending downloads
4. Download songs
5. Find pending lyrics
6. Download synchronized LRC files
7. Move songs without lyrics to no-lyrics
```

---

# 25. Full Sync Test

The full sync command:

```bash
python -m app.sync.test_run
```

produces output similar to:

```text
============================================================
Music Sync
============================================================
Playlist songs discovered: 11
New songs added: 1
Pending songs selected: 1
Downloading: 10 - JAY-Z - Empire State Of Mind (Lyrics) ft. Alicia Keys
...
Downloaded: JAY-Z - Empire State Of Mind (Lyrics) ft. Alicia Keys
File: data/music/JAY-Z - Empire State Of Mind (Lyrics) ft. Alicia Keys.mp3
Songs waiting for lyrics: 1
Fetching lyrics: 10 - JAY-Z - Empire State Of Mind (Lyrics) ft. Alicia Keys
Lyrics downloaded: JAY-Z - Empire State Of Mind (Lyrics) ft. Alicia Keys
LRC: data/music/JAY-Z - Empire State Of Mind (Lyrics) ft. Alicia Keys.lrc
============================================================
Sync cycle completed
============================================================
```

This confirms the entire pipeline works in one execution.

---

# 26. Scheduler

The scheduler has also been tested successfully.

The application periodically executes the complete sync process.

Example:

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

When a new song was added to the playlist, the scheduler detected it automatically.

Example:

```text
Playlist songs discovered: 10
New songs added: 1
Pending songs selected: 1
Downloading: Kendrick Lamar - Count Me Out
...
Songs waiting for lyrics: 1
Fetching lyrics: Kendrick Lamar - Count Me Out
Lyrics downloaded
```

This confirms the scheduled synchronization workflow is operational.

---

# 27. Idempotency

Repeated sync cycles do not duplicate existing songs.

Example:

```text
Playlist songs discovered: 9
New songs added: 0
Pending songs selected: 0
Songs waiting for lyrics: 0
```

Running the sync repeatedly produces the same result when nothing has changed.

This is a major requirement for an automated synchronization service.

---

# 28. Current Music Library

The successfully processed music library currently contains MP3/LRC pairs such as:

```text
Creep
Fake Plastic Trees
Gigi Perez - Sailor Song
I Thought I Saw Your Face Today
JAY-Z - Empire State Of Mind
Kendrick Lamar - Count Me Out
Kiss Me
Let Down (Remastered)
No Surprises (Remastered)
Radiohead - All I Need
Sign of the Times
```

Each successfully processed song has:

```text
.mp3
.lrc
```

in the same directory.

---

# 29. Current Database State

The active playlist currently contains songs with states similar to:

```text
No Surprises (Remastered)       downloaded / downloaded
Fake Plastic Trees              downloaded / downloaded
Let Down (Remastered)           downloaded / downloaded
Creep                           downloaded / downloaded
Sign of the Times               downloaded / downloaded
Gigi Perez - Sailor Song        downloaded / downloaded
I Thought I Saw Your Face Today downloaded / downloaded
Kiss Me                         downloaded / downloaded
Radiohead - All I Need           downloaded / downloaded
Kendrick Lamar - Count Me Out   downloaded / downloaded
JAY-Z - Empire State Of Mind    downloaded / downloaded
```

The manually created no-lyrics test entry is:

```text
This Song Definitely Does Not Exist 987654321
```

with:

```text
lyrics_status = unavailable
```

and its MP3 located under:

```text
data/no-lyrics/
```

---

# 30. Important Path Behavior

Music:

```text
data/music/
```

No synchronized lyrics:

```text
data/no-lyrics/
```

PostgreSQL data:

```text
data/postgres/
```

The PostgreSQL directory may produce:

```text
Permission denied
```

when inspected by a normal user because it is owned/managed by the PostgreSQL container.

This is expected and does not affect the application.

---

# 31. Known Issues

## 31.1 YouTube JavaScript Runtime

`yt-dlp` currently reports:

```text
No supported JavaScript runtime could be found
```

Downloads still work, but the runtime should eventually be configured properly.

---

## 31.2 Failed YouTube Videos

Some YouTube videos can become:

```text
Video unavailable
```

The downloader correctly records the failure.

If the video remains in the playlist, the system may need a policy for repeated download failures.

Potential future improvement:

```text
failed
retry_count
last_error
last_attempt_at
```

---

## 31.3 LRCLIB Availability

LRCLIB occasionally returns:

```text
503 Service Unavailable
```

Retry logic has been implemented.

The song remains pending rather than being incorrectly classified as having no lyrics.

---

## 31.4 Artist Metadata

Some YouTube playlist entries do not provide reliable:

```text
artist
album
```

metadata.

The lyrics service therefore does not depend entirely on artist matching.

---

## 31.5 Position Changes

The reconciler currently uses the YouTube playlist position when adding songs.

Existing songs should eventually have their position updated if the order of the playlist changes.

This should be considered for a future improvement.

---

# 32. Testing Performed

The following tests have successfully been performed.

### YouTube playlist discovery

```bash
python -c "from app.core.config import settings; from app.watcher.youtube import YouTubePlaylistWatcher; songs=YouTubePlaylistWatcher(settings.youtube_playlist_url).fetch(); print('Songs:', len(songs)); [print(s.position, s.title, s.video_id) for s in songs]"
```

### Reconciliation

```bash
python -m app.reconciler.test_run
```

### MP3 downloading

```bash
python -m app.downloader.test_run
```

### Lyrics service

```bash
python -m app.lyrics.test_run
```

### Full synchronization

```bash
python -m app.sync.test_run
```

### Scheduler

The scheduler has successfully detected newly added playlist songs and processed them.

### No-lyrics behavior

A fake song was inserted and successfully moved from:

```text
data/music/
```

to:

```text
data/no-lyrics/
```

### Temporary LRCLIB failure

A `503` error was reproduced and retry handling was implemented.

---

# 33. Current End-to-End Status

The following components are **working**:

| Component                | Status  |
| ------------------------ | ------- |
| PostgreSQL               | Working |
| SQLAlchemy models        | Working |
| YouTube playlist watcher | Working |
| Playlist reconciliation  | Working |
| Duplicate prevention     | Working |
| Removed-song detection   | Working |
| MP3 downloader           | Working |
| FFmpeg MP3 conversion    | Working |
| Synced lyrics lookup     | Working |
| LRC file creation        | Working |
| Title normalization      | Working |
| Lyrics retry handling    | Working |
| No-lyrics fallback       | Working |
| Full sync pipeline       | Working |
| APScheduler              | Working |
| Repeated/idempotent sync | Working |

---

# 34. Current Architecture

```text
                    ┌─────────────────────┐
                    │   YouTube Playlist  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ YouTubeSongWatcher  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ PlaylistReconciler  │
                    └──────────┬──────────┘
                               │
                               ▼
                       ┌──────────────┐
                       │  PostgreSQL  │
                       └──────┬───────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             ┌──────────────┐    ┌──────────────┐
             │ Song         │    │ Lyrics       │
             │ Downloader   │    │ Service      │
             └──────┬───────┘    └──────┬───────┘
                    │                   │
                    ▼                   ▼
             ┌──────────────┐    ┌──────────────┐
             │ data/music/  │    │ LRCLIB       │
             │ *.mp3        │◄───│ API          │
             │ *.lrc        │    └──────────────┘
             └──────────────┘
                    │
                    │ no synced lyrics
                    ▼
             ┌────────────────┐
             │ data/no-lyrics │
             │     *.mp3      │
             └────────────────┘
```

---

# 35. Next Development Phase

The core application is now functional.

The next phase should focus on **productionization and reliability** rather than adding another core feature.

Recommended order:

### 1. Dockerize the application

Create a production application container containing:

```text
Python
dependencies
application code
FFmpeg
yt-dlp
```

---

### 2. Update Docker Compose

The final Compose stack should contain at least:

```text
music-sync
postgres
```

with persistent volumes for:

```text
data/music
data/no-lyrics
data/postgres
```

---

### 3. Environment Configuration

Move all runtime configuration into `.env`, including:

```text
DATABASE_URL
YOUTUBE_PLAYLIST_URL
SYNC_INTERVAL_SECONDS
MUSIC_ROOT
```

---

### 4. Configure YouTube JavaScript Runtime

Resolve the current `yt-dlp` warning by installing/configuring a supported JavaScript runtime.

---

### 5. Improve Error Tracking

Consider adding:

```text
retry_count
last_error
last_attempt_at
```

to the `songs` table.

This would make failed downloads and lyric requests easier to manage.

---

### 6. Improve Playlist Position Synchronization

When a song moves within the YouTube playlist, update:

```text
Song.position
```

rather than keeping the original position.

---

### 7. Add Automated Tests

Create proper tests for:

```text
watcher
reconciler
downloader
lyrics service
no-lyrics behavior
retry behavior
full sync
```

Mock external APIs where appropriate.

---

### 8. Production Scheduler

Run the scheduler as a long-running Docker service rather than manually:

```bash
python ...
```

The final system should start automatically with:

```bash
docker compose up -d
```

---

# 36. Project Milestone

## Milestone: Core Music Synchronization — COMPLETE

The core requirement has been successfully implemented:

> Monitor a YouTube playlist, download new songs as MP3, retrieve time-synchronized lyrics as LRC, keep MP3/LRC pairs together, and move songs without synchronized lyrics into a separate directory.

The complete workflow has been tested against real playlist changes and has successfully processed newly added songs automatically.

The project is now ready to move from **functional development** into **production deployment and hardening**.
