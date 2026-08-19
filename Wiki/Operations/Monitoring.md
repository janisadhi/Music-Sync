# Monitoring & Observability

## 1. System Health Endpoint (`GET /health`)

The application exposes an unauthenticated health check endpoint (`/health`) that checks PostgreSQL connectivity and worker thread status:

### Example Response Payload (`200 OK`):
```json
{
  "status": "ok",
  "service": "music-sync",
  "environment": "production",
  "database": "ok",
  "downloader_worker": {
    "worker_running": true,
    "last_poll_started_at": "2026-08-15T22:30:00Z",
    "last_poll_completed_at": "2026-08-15T22:30:05Z",
    "last_poll_status": "success",
    "last_poll_error": null,
    "last_poll_downloaded": 2,
    "total_downloaded": 142
  },
  "lyrics_worker": {
    "worker_running": true,
    "last_poll_completed_at": "2026-08-15T22:30:10Z",
    "last_poll_status": "success",
    "last_poll_error": null,
    "total_processed": 138
  }
}
```

If the PostgreSQL database connection fails, `"status"` degrades to `"degraded"` and `"database"` reports `"error"`.

---

## 2. Dashboard Status Metrics (`GET /dashboard`)

The dashboard router calculates real-time metrics across PostgreSQL tables:

- **Song Status Aggregations**: Counts for pending downloads, completed downloads, failed downloads, unavailable downloads, pending lyrics, completed lyrics, unavailable lyrics, and failed lyrics.
- **Scheduler State**: Scheduler running flag, active sync status, sync interval, and last sync execution stats.
- **Recent Sync History**: Returns the 10 most recent sync execution objects from `MusicSyncScheduler.history`.

---

## 3. Container Healthchecks

- **PostgreSQL**: `docker-compose.yml` configures healthchecks using `pg_isready`:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-music_sync} -d $${POSTGRES_DB:-music_sync}"]
    interval: 5s
    timeout: 5s
    retries: 5
    start_period: 10s
  ```
- The backend `app` service configures `depends_on: postgres: condition: service_healthy` to ensure database readiness before running Alembic migrations.
