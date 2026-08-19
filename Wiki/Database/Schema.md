# Database Schema

This document details the PostgreSQL schema, table structures, column definitions, data types, constraints, and defaults.

> [!NOTE]
> Derived from SQLAlchemy models (`app/database/models.py`), Alembic migration history, and the provided YAML database schema.

---

## 1. Table: `playlists`

Stores watched YouTube playlists.

| Column Name | Data Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | **No** | `nextval(...)` | Primary Key |
| `youtube_playlist_id` | `VARCHAR(255)` | **No** | None | Unique Index (`ix_playlists_youtube_playlist_id`) |
| `name` | `VARCHAR(255)` | **No** | None | Playlist display name |
| `url` | `TEXT` | **No** | None | Full YouTube playlist URL |
| `enabled` | `BOOLEAN` | **No** | None | Sync toggle flag |
| `created_at` | `TIMESTAMP` | **No** | `now()` | Timestamp created |
| `updated_at` | `TIMESTAMP` | **No** | `now()` | Timestamp updated |

---

## 2. Table: `songs`

Stores individual track sync states and file paths (Sync DB).

| Column Name | Data Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | **No** | `nextval(...)` | Primary Key |
| `playlist_id` | `INTEGER` | **No** | None | Foreign Key -> `playlists.id` (ON DELETE CASCADE) |
| `youtube_video_id` | `VARCHAR(255)` | **No** | None | YouTube 11-char video ID (Indexed) |
| `title` | `VARCHAR(500)` | **No** | None | Discovered video title |
| `position` | `INTEGER` | Yes | None | Track order index in playlist |
| `download_status` | `VARCHAR(50)` | **No** | None | Indexed (`pending`, `downloading`, `downloaded`, `failed`, `unavailable`) |
| `lyrics_status` | `VARCHAR(50)` | **No** | None | Indexed (`pending`, `downloaded`, `unavailable`, `failed`) |
| `file_path` | `TEXT` | Yes | None | Path to audio file relative to download root |
| `lyrics_path` | `TEXT` | Yes | None | Path to `.lrc` file relative to download root |
| `error_message` | `TEXT` | Yes | None | Last failure error log snippet |
| `download_retry_count` | `INTEGER` | **No** | `0` | Number of failed download attempts |
| `next_download_attempt` | `TIMESTAMP` | Yes | None | Scheduled timestamp for next retry attempt |
| `created_at` | `TIMESTAMP` | **No** | `now()` | Timestamp created |
| `updated_at` | `TIMESTAMP` | **No** | `now()` | Timestamp updated |

- **Unique Constraint**: `uq_songs_playlist_video` on `(playlist_id, youtube_video_id)`

---

## 3. Table: `downloaded_tracks`

Stores rich ID3/Opus metadata for successfully downloaded media (Music Library DB).

| Column Name | Data Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | **No** | `nextval(...)` | Primary Key |
| `song_id` | `INTEGER` | **No** | None | Foreign Key -> `songs.id` (ON DELETE CASCADE, UNIQUE) |
| `youtube_video_id` | `VARCHAR(255)` | **No** | None | YouTube video ID (Indexed) |
| `file_path` | `TEXT` | Yes | None | Audio file path on disk |
| `file_format` | `VARCHAR(20)` | Yes | None | Media container format (e.g. `opus`) |
| `file_size_bytes` | `INTEGER` | Yes | None | File size in bytes |
| `title` | `VARCHAR(500)` | Yes | None | Extracted track title |
| `artist` | `VARCHAR(500)` | Yes | None | Extracted artist name |
| `album` | `VARCHAR(500)` | Yes | None | Extracted album name |
| `album_artist` | `VARCHAR(500)` | Yes | None | Extracted album artist |
| `genre` | `VARCHAR(255)` | Yes | None | Extracted genre tag |
| `track_number` | `INTEGER` | Yes | None | Track number tag |
| `duration_seconds` | `INTEGER` | Yes | None | Media duration in seconds |
| `release_year` | `INTEGER` | Yes | None | Release year tag |
| `thumbnail_url` | `TEXT` | Yes | None | High-res cover art URL |
| `artwork_path` | `TEXT` | Yes | None | Local path to cached cover art image |
| `artwork_embedded` | `BOOLEAN` | **No** | `false` | Embedded artwork flag |
| `metadata_state` | `VARCHAR(50)` | **No** | `'raw'` | Metadata extraction state |
| `created_at` | `TIMESTAMP` | **No** | `now()` | Timestamp created |
| `updated_at` | `TIMESTAMP` | **No** | `now()` | Timestamp updated |

---

## 4. Table: `app_settings`

Single-row configuration table (`id = 1`).

| Column Name | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | **No** | `1` | Primary Key |
| `sync_interval_seconds` | `INTEGER` | **No** | `60` | Scheduler trigger interval |
| `download_limit` | `INTEGER` | **No** | `1` | Max concurrent audio downloads |
| `lyrics_limit` | `INTEGER` | **No** | `1` | Max concurrent lyrics fetches |
| `max_download_retries` | `INTEGER` | **No** | `5` | Retry attempt limit |
| `download_retry_delay_seconds` | `INTEGER` | **No** | `60` | Base exponential backoff delay |
| `auto_start_scheduler` | `BOOLEAN` | **No** | `false` | Auto-start scheduler on backend launch |
| `playlist_watch_mode` | `VARCHAR(20)` | **No** | `'whole'` | Watch mode (`whole` or `last_n`) |
| `playlist_watch_limit` | `INTEGER` | Yes | `None` | Item limit when mode is `last_n` |
| `delete_local_file_on_playlist_removal` | `BOOLEAN` | **No** | `false` | File unlinking setting on video removal |
| `youtube_playlist_url` | `VARCHAR` | Yes | `None` | Legacy single-playlist URL |
| `download_directory` | `VARCHAR` | Yes | `None` | Database setting column for download directory |
| `youtube_cookies` | `TEXT` | Yes | `None` | Plaintext Netscape cookie file content |
| `updated_at` | `TIMESTAMP` | **No** | `now()` | Timestamp updated |

---

## 5. Table: `users`

Stores authentication credentials.

| Column Name | Data Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | **No** | `nextval(...)` | Primary Key |
| `username` | `VARCHAR(255)` | **No** | None | Unique Index (`ix_users_username`) |
| `password_hash` | `VARCHAR(255)` | **No** | None | PBKDF2-HMAC-SHA256 hash |
| `must_change_password` | `BOOLEAN` | **No** | `true` | Forced password reset flag |
| `created_at` | `TIMESTAMP` | **No** | `now()` | Timestamp created |
| `updated_at` | `TIMESTAMP` | **No** | `now()` | Timestamp updated |

---

## 6. Table: `alembic_version`

Alembic migration revision tracker.

| Column Name | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `version_num` | `VARCHAR(32)` | **No** | None | Current migration revision hash (Primary Key) |

---

## Identified Discrepancies (YAML Schema vs ORM Implementation)

> [!IMPORTANT]
> 1. **`download_directory` Setting Column**: The `app_settings` table contains a `download_directory` column (added via migration `8af1e62daed1`). However, the ORM model `AppSettings` in `app/database/models.py` does not reference or populate this column. Paths are resolved dynamically using `DOWNLOADS_DIR` in `app/core/config.py`.
> 2. **`Song.download_retry_count` Default**: The PostgreSQL schema check constraint requires `download_retry_count` to be NOT NULL. SQLAlchemy initializes new `Song` records with `download_retry_count = 0`.
