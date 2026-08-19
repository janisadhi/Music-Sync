# Configuration Reference

Application configuration is split into two distinct tiers: **Static Environment Variables** (loaded at process launch via `.env`) and **Dynamic Database Settings** (stored in PostgreSQL and editable via GUI/API).

---

## 1. Static Infrastructure Configuration (`.env`)

Loaded by Pydantic `BaseSettings` (`app/core/config.py`) during backend startup.

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `POSTGRES_DB` | `music_sync` | PostgreSQL database name |
| `POSTGRES_USER` | `music_sync` | PostgreSQL database user |
| `POSTGRES_PASSWORD` | `music_sync` | PostgreSQL database password |
| `DATABASE_URL` | `postgresql+psycopg://...` | SQLAlchemy connection URI |
| `APP_NAME` | `music-sync` | Application identifier name |
| `APP_ENV` | `development` | Deployment environment (`development`, `production`) |
| `APP_DEBUG` | `true` | FastAPI debug mode flag |
| `MUSIC_ROOT` | `/app/data/music` | Configuration music root path |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Frontend API base URL (baked into React build) |

---

## 2. Dynamic Application Settings (`app_settings` Table)

Persisted in PostgreSQL (`app_settings` ID = 1) and dynamically updated at runtime via `PATCH /settings` or the dashboard Settings page.

| Setting Field Name | Default Seed Value | Constraints / Options | Description |
| :--- | :--- | :--- | :--- |
| `sync_interval_seconds` | `60` | `ge = 10` | Scheduler trigger interval in seconds |
| `download_limit` | `1` | `ge = 1` | Max concurrent `yt-dlp` audio download threads |
| `lyrics_limit` | `1` | `ge = 1` | Max concurrent LRCLIB lyrics worker threads |
| `max_download_retries` | `5` | `ge = 1` | Max retry attempts for transient download errors |
| `download_retry_delay_seconds` | `60` | `ge = 1` | Base delay for exponential backoff calculation |
| `auto_start_scheduler` | `false` | `boolean` | Auto-start periodic sync scheduler on backend startup |
| `playlist_watch_mode` | `'whole'` | `'whole'`, `'last_n'` | Scrape entire playlist vs only recent $N$ items |
| `playlist_watch_limit` | `null` | `int` or `null` | Number of items to scan when watch mode is `last_n` |
| `delete_local_file_on_playlist_removal` | `false` | `boolean` | Unlink local audio/lyrics files when videos disappear |
| `youtube_cookies` | `null` | Netscape text | Custom Netscape cookie file content |
