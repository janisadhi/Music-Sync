# API Endpoint Catalog

Complete reference catalog of all API endpoints implemented in the codebase.

---

## 1. Authentication Router (`app/api/auth.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user credentials & issue JWT token | `LoginRequest` | No |
| `POST` | `/api/auth/change-password` | Update current user password | `ChangePasswordRequest` | **Yes (Bearer)** |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | None | **Yes (Bearer)** |
| `POST` | `/api/auth/logout` | Client-side logout response | None | No |

---

## 2. Dashboard Router (`app/api/dashboard.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/dashboard` | Returns aggregated metrics, queue counts, worker status, and sync history | None | No* |

---

## 3. Playlists Router (`app/api/playlists.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/playlists` | List all monitored playlists | None | No* |
| `POST` | `/playlists` | Add new playlist from YouTube URL | `PlaylistCreate` | No* |
| `GET` | `/playlists/{id}` | Get playlist details by ID | None | No* |
| `PATCH` | `/playlists/{id}` | Update playlist name, URL, or enabled toggle | `PlaylistUpdate` | No* |
| `DELETE` | `/playlists/{id}` | Delete playlist record (cascade-deletes songs in DB) | None | No* |
| `GET` | `/playlists/{id}/songs` | List all songs in playlist ordered by position | None | No* |
| `POST` | `/playlists/{id}/sync` | Manually trigger sync for single playlist | None | No* |

---

## 4. Songs Router (`app/api/songs.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/songs/artists` | Returns aggregated list of unique artists | None | No* |
| `GET` | `/songs` | List songs (query params: `artist`, `playlist_id`) | None | No* |
| `GET` | `/songs/{id}` | Get song record joined with `DownloadedTrack` metadata | None | No* |
| `GET` | `/songs/{id}/audio` | Stream Opus audio file (`FileResponse`) | None | No* |
| `GET` | `/songs/{id}/lyrics` | Read and stream `.lrc` lyrics file content | None | No* |
| `POST` | `/songs/{id}/retry-download` | Reset song `download_status` to `pending` | None | No* |
| `POST` | `/songs/{id}/retry-lyrics` | Restore audio file from `no-lyrics/` & reset lyrics status | None | No* |
| `DELETE` | `/songs/{id}` | Delete audio file, lyrics file, and DB record | None | No* |

---

## 5. Sync Controls Router (`app/api/sync.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/sync/status` | Aggregated status of scheduler and worker threads | None | No* |
| `POST` | `/sync` | Trigger full background sync execution | None | No* |
| `GET` | `/sync/history` | List rolling execution history (last 100 runs) | None | No* |
| `GET` | `/sync/downloader` | Get Downloader Worker status | None | No* |
| `POST` | `/sync/downloader/start` | Launch Downloader Worker thread | None | No* |
| `POST` | `/sync/downloader/stop` | Stop Downloader Worker thread | None | No* |
| `GET` | `/sync/lyrics` | Get Lyrics Worker status | None | No* |
| `POST` | `/sync/lyrics/start` | Launch Lyrics Worker thread | None | No* |
| `POST` | `/sync/lyrics/stop` | Stop Lyrics Worker thread | None | No* |
| `GET` | `/sync/scheduler` | Get APScheduler status | None | No* |
| `POST` | `/sync/scheduler/start` | Launch APScheduler engine | None | No* |
| `POST` | `/sync/scheduler/stop` | Stop APScheduler engine | None | No* |
| `PATCH` | `/sync/scheduler` | Dynamically update sync interval in seconds | `SyncIntervalRequest` | No* |

---

## 6. Settings Router (`app/api/settings.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/settings` | Retrieve active database application settings | None | No* |
| `PATCH` | `/settings` | Update database application settings | `SettingsUpdateRequest` | No* |

---

---

## 7. System Health Endpoint (`app/main.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Real-time health check (PostgreSQL query + worker state) | None | No |

---

## 8. Resilio Sync Router (`app/api/rslsync.py`)

| HTTP Method | Path | Description | Request Body | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/rslsync/overview` | Consolidated dashboard overview (status, folders, peers, transfers, errors) | None | No* |
| `GET` | `/api/rslsync/status` | General P2P sync metrics | None | No* |
| `GET` | `/api/rslsync/folders` | Monitored sync folders with storage and file counts | None | No* |
| `GET` | `/api/rslsync/peers` | List of paired mobile devices / P2P peers | None | No* |
| `DELETE` | `/api/rslsync/peers/{peer_id}` | Revokes and disconnects a paired mobile device | None | No* |
| `POST` | `/api/rslsync/shares/generate` | Generates pairing key secret, share URL, and SVG QR Code | `ResilioShareRequest` | No* |
| `GET` | `/api/rslsync/pairing-status` | Polls real-time pairing detection status | None | No* |
| `GET` | `/api/rslsync/transfers` | Active file transfer speeds and progress | None | No* |
| `GET` | `/api/rslsync/errors` | Resilio engine error items | None | No* |
| `GET` | `/api/rslsync/license` | Resilio Sync engine license status | None | No* |
| `POST` | `/api/rslsync/license` | Uploads and applies `.btskey` license key | `ResilioLicenseRequest` | No* |
| `DELETE` | `/api/rslsync/license` | Deletes stored license key file | None | No* |

---

> [!NOTE]
> `No*` indicates that the endpoint does not enforce backend authentication. Route access control is enforced on the frontend SPA via `<ProtectedRoute />`.
