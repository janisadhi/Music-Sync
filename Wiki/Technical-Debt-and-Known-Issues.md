# Technical Debt & Known Issues

This document explicitly catalog-documents architectural debt, security vulnerabilities, code discrepancies, and unhandled edge cases identified during codebase reverse-engineering.

---

## 1. Critical Security Vulnerabilities

### SEC-01: Unauthenticated Operational API Endpoints
- **Location**: `app/api/playlists.py`, `app/api/songs.py`, `app/api/settings.py`, `app/api/sync.py`, `app/api/dashboard.py`
- **Description**: The `get_current_user` FastAPI authorization dependency is ONLY declared on `/api/auth/change-password` and `/api/auth/me`. All operational endpoints (`/playlists`, `/songs`, `/settings`, `/sync`, `/dashboard`) execute without authentication checks.
- **Impact**: Any client with HTTP access to port `8000` can read settings, trigger sync cycles, delete playlists/songs, and update runtime options without presenting a JWT Bearer token.

### SEC-02: Admin Password Override Vulnerability
- **Location**: `app/api/auth.py` (lines 55–68)
- **Description**: In the login endpoint handler (`POST /api/auth/login`), if password verification for user `admin` fails when attempting `admin` / `admin`, `ensure_admin_exists(db)` resets `user.password_hash` back to `hash_password("admin")`.
- **Impact**: Anyone can reset a changed admin password back to `admin` by attempting to log in with `admin` / `admin`.

### SEC-03: Hardcoded JWT Secret Key
- **Location**: `app/core/auth.py` (line 16)
- **Description**: `SECRET_KEY = "music-sync-super-secret-key-change-in-prod"` is hardcoded in source code rather than loaded from environment settings.

---

## 2. High Severity Data Discrepancies & Bugs

### BUG-01: Stale `file_path` in `downloaded_tracks` Table
- **Location**: `app/lyrics/service.py` (`_move_to_no_lyrics()`)
- **Description**: When `LyricsService` moves an audio file to the `no-lyrics/` subdirectory due to missing LRCLIB lyrics, it updates `song.file_path` in the `songs` table, but does **NOT** update `downloaded_track.file_path` in the `downloaded_tracks` table.
- **Impact**: `DownloadedTrack.file_path` continues pointing to the non-existent original path in `<Playlist>/music/`.

### BUG-02: API Playlist Deletion Leaves Orphan Files
- **Location**: `app/api/playlists.py` (`DELETE /playlists/{id}`)
- **Description**: Deleting a playlist via the API deletes the `Playlist` DB record and cascade-deletes `Song` DB rows, but does **NOT** delete audio or lyrics files on disk, nor does it check `delete_local_file_on_playlist_removal`.
- **Impact**: Orphaned audio and lyrics files accumulate on disk after API playlist deletions.

---

## 3. Architectural & Code Quality Debt

### DEBT-01: Custom Cryptographic JWT Implementation
- **Location**: `app/core/auth.py`
- **Description**: Hand-rolled JWT generation using `hmac`, `hashlib`, and custom base64 URL encoding instead of standard PyJWT or python-jose packages.

### DEBT-02: Duplicated Regex Artist Fallback Logic
- **Location**: `app/api/songs.py` & `app/downloader/service.py`
- **Description**: The `_extract_artist_fallback()` regex function is duplicated verbatim across both files.

### DEBT-03: Unused `download_directory` Setting Column
- **Location**: `app_settings.download_directory` vs `app/core/config.py`
- **Description**: Migration `8af1e62daed1` added a `download_directory` column to `app_settings`, but the column is ignored by `AppSettings` ORM models and settings services. Downloads use `DOWNLOADS_DIR` from `app/core/config.py`.

### DEBT-04: Empty Package Placeholder (`app/library/`)
- **Location**: `app/library/`
- **Description**: Contains only an empty `__init__.py` file reserved for future Beets integration.

### DEBT-05: Inconsistent Router Prefix Conventions
- **Location**: `app/api/auth.py` vs other routers
- **Description**: Auth router uses `/api/auth` prefix, while all other routers omit `/api` (`/playlists`, `/songs`, `/settings`, `/sync`).
