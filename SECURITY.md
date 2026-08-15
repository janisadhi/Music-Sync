# Security Policy

## Supported Versions

Security updates are provided for the latest code on the `main` branch and active release tags.

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main`           | :white_check_mark: |
| Development      | :white_check_mark: |
| Deprecated Tags  | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability within **Music-Sync**, please report it responsibly rather than opening a public GitHub issue.

### Contact Information
Please report security issues directly to the maintainers at:
- **Email**: `adhikarijanis@gmail.com`

Include the following details in your report:
- Description of the vulnerability and its potential impact.
- Affected component (FastAPI backend, React frontend, database, Docker stack).
- Step-by-step proof of concept (PoC) or instructions to reproduce.
- Any proposed remediation or patch.

We will acknowledge receipt of your report within 48 hours and provide regular updates on patch progress.

---

## Security Architecture & Implementation Details

Based on reverse-engineering of the codebase, the following security controls are currently implemented:

### 1. Authentication & Authorization
- **JWT Token Authentication**: Authentication endpoints (`/api/auth/login`, `/api/auth/change-password`, `/api/auth/me`) issue and verify signed JSON Web Tokens (`Bearer`).
- **Password Hashing**: User passwords are hashed using PBKDF2-HMAC-SHA256 with 100,000 iterations and a 16-byte random salt (`app/core/auth.py`). Plaintext passwords are never stored.
- **Initial Password Change**: Default accounts require immediate password changes (`must_change_password=True`).

### 2. YouTube Netscape Cookie Handling
- **Isolated Tempfiles**: User-provided Netscape cookies are stored in the PostgreSQL database (`app_settings.youtube_cookies`).
- **Ephemeral Storage**: When invoking `yt-dlp`, cookies are written to temporary files created via `tempfile.mkstemp` with restricted permissions and unlinked immediately in a `finally` block (`app/core/ytdlp.py`).
- **Data Protection**: Cookie content is masked in API responses (`has_youtube_cookies` boolean flag) to prevent credential leakage over REST APIs.

### 3. Path Sanitization & File System Boundaries
- **Path Sanitization**: User-controlled string inputs (playlist names, track titles) pass through `sanitize_filename()` (`app/core/paths.py`) to strip filesystem-reserved characters (`\/*?:"<>|`) and prevent directory traversal.
- **Root Resolution**: File paths stored in the database are stored relative to the downloads directory (`DOWNLOADS_DIR`) and resolved explicitly via `resolve_file_path()`.

### 4. Container & Network Isolation
- **Non-Exposed Database**: Docker Compose binds PostgreSQL (`5432`) to `127.0.0.1:5432`, preventing direct database exposure to untrusted networks.
- **Nginx Reverse Proxy**: Production dashboard builds use Nginx to proxy API requests and serve static assets securely.

---

## Known Security Boundaries & Considerations

> [!WARNING]
> Security reviewers and deployment operators should be aware of the following implementation characteristics:

1. **Unauthenticated REST Endpoints**: Operational API routes (`/playlists`, `/songs`, `/settings`, `/sync`, `/dashboard`) currently execute without requiring authentication headers. Deployments exposed to untrusted networks MUST place the application behind an authenticating reverse proxy or API gateway.
2. **CORS Configuration**: The FastAPI CORS middleware is currently configured with `allow_origins=["*"]`. Production deployments should restrict origins to trusted frontend domains in `app/main.py`.
3. **JWT Secret Key Configuration**: The secret key used for signing JWT tokens is set via `app/core/auth.py`. Operators should ensure custom secret keys are loaded from environment variables in production environments.
