# Security Model & Architecture

## Security Architecture Overview

This document documents the security model of **Music-Sync** based strictly on reverse-engineering the codebase.

---

## 1. Authentication & Password Protection

- **Password Hashing**: Passwords are hashed using PBKDF2-HMAC-SHA256 with 100,000 iterations and a 16-byte random salt (`app/core/auth.py`). Plaintext passwords are never stored.
- **Custom JWT Signatures**: Authentication tokens are constructed using URL-safe base64 encoding and signed with HMAC-SHA256. Tokens expire after 7 days.
- **Timing Attack Protections**: Hash and signature verification methods invoke `secrets.compare_digest()` to mitigate timing side-channel attacks.
- **Default Admin Provisioning**: When launched against an empty database, `ensure_admin_exists(db)` seeds user `admin` with password `admin` and `must_change_password = true`.

---

## 2. YouTube Cookie Protection

- **Sensitive Credential Storage**: Netscape-formatted YouTube cookies are stored in PostgreSQL (`app_settings.youtube_cookies`).
- **Ephemeral Storage**: `yt-dlp` calls wrap cookies in `get_cookie_context(cookies_text)`, creating a temporary file via `tempfile.mkstemp` and unlinking it in a `finally` block (`app/core/ytdlp.py`).
- **API Payload Masking**: The `/settings` API endpoint returns `has_youtube_cookies: bool` rather than exposing raw cookie content over HTTP.

---

## 3. Path Sanitization & File Isolation

- **Path Sanitization**: Playlist names and track titles pass through `sanitize_filename()` (`app/core/paths.py`) to strip filesystem-reserved characters (`[\\/*?:"<>|]`) and prevent directory traversal attacks.
- **Relative Path Resolution**: Database file paths are stored relative to `DOWNLOADS_DIR` and resolved via `resolve_file_path()`.

---

## 4. Security Boundaries & Known Weaknesses

> [!WARNING]
> Security reviewers should note the following architectural boundaries:

1. **Unauthenticated Operational API Endpoints**: The `get_current_user` dependency is ONLY applied to `/api/auth/change-password` and `/api/auth/me`. All operational endpoints (`/playlists`, `/songs`, `/settings`, `/sync`, `/dashboard`) execute without authentication checks.
2. **Hardcoded JWT Secret Key**: `SECRET_KEY = "music-sync-super-secret-key-change-in-prod"` is hardcoded in `app/core/auth.py`.
3. **Invalid CORS Setup**: CORS middleware specifies `allow_origins=["*"]` with `allow_credentials=True` (`app/main.py`).
4. **Admin Password Override Vulnerability**: Logging in with username `admin` and password `admin` resets the admin password hash back to `hash_password("admin")` if password verification fails (`app/api/auth.py`).
