# System Overview

## Purpose & Scope

**Music-Sync** is an automated, self-hosted system that continuously synchronizes YouTube Music playlists with a structured local media library. 

The core goal of the project is to provide a reliable, local-first media synchronization engine that:
1. Automatically discovers new, updated, or removed tracks across multiple YouTube playlists.
2. Extracts high-quality audio files (`.opus`) and embeds rich ID3/Opus metadata and cover art.
3. Automatically fetches synchronized lyrics (`.lrc`) from [LRCLIB.net](https://lrclib.net/) and organizes tracks with missing lyrics into a designated fallback directory (`no-lyrics/`).
4. Exposes an interactive web dashboard for real-time status monitoring, audio playback with synced lyrics, playlist management, and runtime settings configuration.

---

## Key Features & Capabilities

- **Multi-Playlist Synchronization**: Synchronizes multiple YouTube playlists concurrently without requiring single-playlist lockouts.
- **Decoupled Asynchronous Processing**: Discovery (scanning), downloading, and lyrics fetching operate independently through database-backed queues.
- **Audio Extraction & Metadata Tagging**: Uses `yt-dlp` for flat extraction and media downloads, AtomicParsley/Mutagen for metadata tagging, and Deno JS challenge solving for YouTube EJS anti-bot mechanisms.
- **Synchronized Lyrics (.lrc)**: Automatically queries LRCLIB using title-sanitizing heuristics and embeds or places `.lrc` files adjacent to track files.
- **Netscape Cookie Integration**: Supports custom Netscape cookie files stored securely in database settings for syncing age-restricted or private YouTube playlists.
- **State-Aware Retries & Backoff**: Automatically handles transient network or post-processing errors using exponential backoff up to configurable retry limits.
- **Interactive Web SPA**: React 19 single-page web app providing real-time worker metrics, audio player with line-by-line synchronized lyrics, system health monitoring, and authentication.

---

## System Operational Model

Music-Sync operates under a 3-tier runtime execution model:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        User & API Interface Layer                      │
│                  FastAPI REST Endpoints + React 19 SPA                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Background Engine & Worker Layer                    │
│   • APScheduler Trigger Engine (Periodic Sync Discovery)                │
│   • Downloader Worker Thread (Continuous Audio Extraction Queue)        │
│   • Lyrics Worker Thread (Continuous LRCLIB Fetch Queue)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Persistence & File Storage Layer                    │
│   • PostgreSQL 17 Database (playlists, songs, downloaded_tracks, etc.)  │
│   • Local Filesystem Mount (/app/downloads/<Playlist>/music|no-lyrics) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Topology

The application is fully containerized as a 3-service Docker Compose stack:

1. **`postgres` Service**: PostgreSQL 17 database container handling persistence for synchronization queues, rich track metadata, app settings, and user credentials.
2. **`app` Service**: FastAPI Python 3.14-slim backend executing REST routers, background worker threads (`DownloaderWorker`, `LyricsWorker`), APScheduler, `yt-dlp`, Deno JS runtime, and FFmpeg.
3. **`dashboard` Service**: Nginx web server container serving the pre-built React 19 static SPA bundle and reverse-proxying API calls.
