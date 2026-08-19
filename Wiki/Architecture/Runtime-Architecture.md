# Runtime Architecture

## Application Lifespan & Thread Model

Music-Sync executes within a multi-threaded Python 3.14 process managed by FastAPI's `asynccontextmanager` lifespan handler in `app/main.py`.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Application Process                    │
│                                (app/main.py)                           │
│                                                                        │
│  ┌───────────────────────┐                    ┌─────────────────────┐  │
│  │   Main Uvicorn Thread │                    │ App Singleton Reg.  │  │
│  │  (FastAPI Async Loop) │                    │ (app/core/runtime)  │  │
│  └───────────┬───────────┘                    └─────────────────────┘  │
│              │                                                         │
│              ├───────────────────────┬────────────────────────┐        │
│              ▼                       ▼                        ▼        │
│  ┌───────────────────────┐ ┌───────────────────┐ ┌──────────────────┐  │
│  │ DownloaderWorker Thread│ │LyricsWorker Thread│ │APScheduler Thread│  │
│  │    (Daemon Thread)    │ │  (Daemon Thread)  │ │ (BackgroundSched)│  │
│  └───────────────────────┘ └───────────────────┘ └──────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Startup Sequence

Upon application invocation (`uvicorn app.main:app`), the `lifespan` manager executes the following steps in sequence:

1. **Admin Seed**: Invokes `ensure_admin_exists(db)` to create the default administrator user (`admin` / `admin`) if the `users` table contains no rows.
2. **Downloader Worker Launch**: Starts `downloader_worker.start()`. Launches a dedicated daemon thread running `DownloaderWorker._poll_loop()`. Recovers stale downloads stuck in `downloading` state.
3. **Lyrics Worker Launch**: Starts `lyrics_worker.start()`. Launches a dedicated daemon thread running `LyricsWorker._poll_loop()`.
4. **Scheduler Auto-Start Check**: Queries `AppSettings.auto_start_scheduler`. If `True`, launches `scheduler.start()`; otherwise, leaves the scheduler stopped pending manual API activation.

---

## Shutdown Sequence

When FastAPI receives a termination signal (`SIGTERM` or `SIGINT`), lifespan cleans up workers in reverse order:

1. **Scheduler Stop**: Calls `scheduler.stop()`, unregistering scheduled jobs and shutting down APScheduler.
2. **Downloader Worker Stop**: Signals `downloader_worker.stop(timeout=30.0)`, setting `_stop_event` and waiting up to 30 seconds for active audio downloads to complete cleanly.
3. **Lyrics Worker Stop**: Signals `lyrics_worker.stop(timeout=30.0)`, setting `_stop_event` and waiting up to 30 seconds for active lyrics requests to finish.

---

## Thread Synchronization & Safety

Background workers utilize explicit Python concurrency primitives to prevent race conditions and unhandled exceptions:

- **MusicSyncScheduler**: Uses a `threading.Lock` to guard `sync_running` state mutations, preventing concurrent trigger invocations.
- **DownloaderWorker**: Uses `threading.Lock` for status reporting and `threading.Event` (`_stop_event`) for interruptible sleeping (`wait(timeout=sleep_interval)`).
- **LyricsWorker**: Uses `threading.Lock` and `threading.Event` (`_stop_event`) for clean thread signaling and status queries.
