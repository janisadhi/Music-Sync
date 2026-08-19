# Architecture Decisions

This document records key architectural decisions, design patterns, and technical trade-offs established in the codebase.

---

## AD-01: Decoupled Worker Architecture via Database Queues

- **Status**: Implemented
- **Decision**: Separate Sync Discovery, Audio Downloading, and Lyrics Fetching into independent background worker components communicating exclusively through PostgreSQL state columns.
- **Rationale**: Prevents long-running audio downloads or slow LRCLIB queries from blocking playlist scanning. Enables independent worker startup, shutdown, and worker thread concurrency control.
- **Trade-off**: Requires background polling loops (`DownloaderWorker`, `LyricsWorker`) rather than event-driven message queues (Redis/RabbitMQ), adding minor polling overhead to PostgreSQL.

---

## AD-02: Dual Database Conceptual Segregation

- **Status**: Implemented
- **Decision**: Split media persistence into two distinct domain models sharing one PostgreSQL connection:
  1. **Sync DB (`songs`, `playlists`)**: Lean synchronization tracking records.
  2. **Music Library DB (`downloaded_tracks`)**: Rich ID3/Opus metadata populated only after successful download.
- **Rationale**: Keeps synchronization scanning lightweight while preserving rich metadata for library management and external tools.
- **Trade-off**: Requires joining `songs` and `downloaded_tracks` on `song_id` for complete track views.

---

## AD-03: Per-Item Database Commits During Reconciliation

- **Status**: Implemented
- **Decision**: `PlaylistReconciler` commits the DB transaction after processing each individual playlist entry rather than committing once at the end of the scan.
- **Rationale**: Allows `DownloaderWorker` threads to claim and download newly discovered songs immediately while the reconciler continues scanning remaining items.
- **Trade-off**: Playlist scans are not atomic; partial reconciliation states remain in DB if a scan is interrupted mid-way.

---

## AD-04: Isolated Ephemeral Netscape Cookie Management

- **Status**: Implemented
- **Decision**: Store Netscape cookies in PostgreSQL settings and write them to ephemeral temporary files via `get_cookie_context()` only during `yt-dlp` execution.
- **Rationale**: Avoids leaving unencrypted cookie files permanently on disk while allowing support for private or age-restricted YouTube playlists.
- **Trade-off**: Requires disk I/O to `/tmp` for each playlist scan or audio download.

---

## AD-05: Automatic Reorganization for Missing Lyrics (`no-lyrics/`)

- **Status**: Implemented
- **Decision**: Automatically move downloaded audio files from `<Playlist>/music/` to `<Playlist>/no-lyrics/` when LRCLIB returns no synchronized lyrics (`lyrics_status = 'unavailable'`).
- **Rationale**: Keeps the primary `music/` directory populated exclusively with tracks that have matching `.lrc` lyrics for media player integration.
- **Trade-off**: Mutates file paths on disk post-download, requiring `Song.file_path` updates in DB.
