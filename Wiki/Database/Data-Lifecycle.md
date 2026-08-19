# Data Lifecycle & Migrations

## Migration History (`alembic/versions/`)

Schema evolution in Music-Sync is tracked through 11 sequential Alembic migration files:

```text
d07c97b6c79e  (Create playlists & songs tables)
     │
     ▼
759b9406838b  (Create app_settings table)
     │
     ▼
46e434edb2db  (Add song error_message column)
     │
     ▼
96b5617a9d26  (Add download retry fields to songs)
     │
     ▼
8af1e62daed1  (Add download_directory setting)
     │
     ▼
d3918d8857c7  (Add download retry settings to app_settings)
     │
     ▼
e51922c09d1a  (Add auto_start_scheduler setting)
     │
     ▼
a1b2c3d4e5f6  (Add playlist watch settings)
     │
     ▼
b1c2d3e4f5a6  (Refactor architecture - adds downloaded_tracks table)
     │
     ▼
f9e8d7c6b5a4  (Create users table)
     │
     ▼
c2d3e4f5a6b7  (Add youtube_cookies setting) [HEAD]
```

---

## Chronological Migration Breakdown

1. **`d07c97b6c79e_create_playlists_and_songs_tables.py`**: Initial schema creation establishing `playlists` and `songs` tables with foreign keys and unique constraints.
2. **`759b9406838b_create_app_settings_table.py`**: Creates the `app_settings` table for runtime configurations (`sync_interval_seconds`, `download_limit`, `lyrics_limit`).
3. **`46e434edb2db_add_song_error_message.py`**: Adds the `error_message` text column to `songs`.
4. **`96b5617a9d26_add_download_retry_fields.py`**: Adds `download_retry_count` and `next_download_attempt` timestamp columns to `songs` for exponential backoff retries.
5. **`8af1e62daed1_add_download_directory_setting.py`**: Adds `download_directory` column to `app_settings`.
6. **`d3918d8857c7_add_download_retry_settings.py`**: Adds `max_download_retries` and `download_retry_delay_seconds` columns to `app_settings`.
7. **`e51922c09d1a_add_auto_start_scheduler_setting.py`**: Adds `auto_start_scheduler` boolean setting.
8. **`a1b2c3d4e5f6_add_playlist_watch_settings.py`**: Adds `playlist_watch_mode`, `playlist_watch_limit`, and `delete_local_file_on_playlist_removal` columns to `app_settings`.
9. **`b1c2d3e4f5a6_refactor_architecture.py`**: Major structural migration. Creates the `downloaded_tracks` table for rich metadata, establishes the 1:1 foreign key relationship with `songs`, and updates song statuses.
10. **`f9e8d7c6b5a4_create_users_table.py`**: Creates the `users` authentication table.
11. **`c2d3e4f5a6b7_add_youtube_cookies_setting.py`**: Adds the `youtube_cookies` text column to `app_settings`.

---

## Automatic Database Initialization & Seeding

1. **Automated Migration**: In Docker containerized execution, the container entrypoint CMD executes `alembic upgrade head` automatically before launching Uvicorn.
2. **Settings Auto-Seeding**: When `SettingsService.get()` is invoked, if `app_settings` contains no rows, default configuration values (ID = 1) are automatically seeded and committed.
3. **Admin User Auto-Seeding**: During application lifespan startup, `ensure_admin_exists(db)` checks for an `admin` username in `users`. If absent, it auto-seeds `admin` / `admin` with `must_change_password = true`.
