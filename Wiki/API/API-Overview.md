# API Overview

## REST API Specification

The Music-Sync backend exposes a RESTful HTTP API built with FastAPI.

- **OpenAPI Schema**: Auto-generated interactive documentation available at `/docs` (Swagger UI) and `/redoc` (ReDoc).
- **Default Port**: `8000` (Docker internal port `8000`).
- **Base Request Payload**: JSON (`Content-Type: application/json`).
- **Media Streaming**: Streams audio directly via `FileResponse` (`audio/opus`).

---

## Router Prefix Architecture

API endpoints are organized into modular FastAPI routers (`app/api/`):

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI REST API Routers                        │
├───────────────────┬────────────────────────────────────────────────────┤
│ Router Prefix     │ Responsibility                                     │
├───────────────────┼────────────────────────────────────────────────────┤
│ /api/auth         │ User login, password changes, token verification   │
│ /playlists        │ Playlist CRUD, song listing, single playlist sync  │
│ /songs            │ Track listing, filtering, streaming, retries, del  │
│ /sync             │ Worker status, manual sync, scheduler controls     │
│ /dashboard        │ Aggregated dashboard status metrics & sync history │
│ /settings         │ Application settings retrieval & updates           │
│ /health           │ System health checks (PostgreSQL & workers)        │
└───────────────────┴────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Router Prefix Inconsistency**: The authentication router uses the `/api/auth` prefix, whereas all other routers omit the `/api` prefix (e.g. `/playlists`, `/songs`, `/settings`, `/sync`).

---

## Standard Response Wrappers

Standard API endpoints return JSON response payloads conforming to Pydantic models defined in `app/api/schemas.py`.

### Example Success Response (`GET /playlists/1`):
```json
{
  "id": 1,
  "youtube_playlist_id": "PLDcnymzs18LWRbK282dvkJ836eGfHjZ1A",
  "name": "Synthwave Collection",
  "url": "https://music.youtube.com/playlist?list=PLDcnymzs18LWRbK282dvkJ836eGfHjZ1A",
  "enabled": true,
  "created_at": "2026-08-15T12:00:00Z",
  "updated_at": "2026-08-15T12:00:00Z"
}
```
