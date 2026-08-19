# Testing Guide

## Testing Framework & Architecture

Backend testing is powered by `pytest`.

To guarantee fast, isolated test execution without requiring a live PostgreSQL instance, the root `conftest.py` pre-configures an in-memory SQLite database before any application modules are imported:

```python
# conftest.py
import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
```

---

## Running Backend Tests

```bash
# Ensure virtual environment is active
source .venv/bin/activate

# Execute complete unit test suite
pytest

# Run tests with verbose output
pytest -v

# Run tests for a specific subsystem
pytest app/downloader/
pytest app/lyrics/
pytest app/reconciler/
pytest app/scheduler/
```

---

## Test Suite Catalog

| Test Directory / File | Component Covered | Test Cases Handled |
| :--- | :--- | :--- |
| `app/downloader/test_downloader_service.py` | `SongDownloader` | Download success, metadata extraction, failure handling |
| `app/downloader/test_download_failure_path.py` | Downloader Error Paths | Transient vs permanent error recovery |
| `app/downloader/test_failure_classification.py` | Error Classifier | `_is_retryable_error()` regex classification rules |
| `app/downloader/test_queue_draining.py` | Batch Processing | Concurrent batch execution & queue limits |
| `app/downloader/test_retry.py` | Backoff Engine | Exponential backoff calculation & retry attempts |
| `app/downloader/test_retry_settings.py` | Retry Configuration | Dynamic setting overrides for max retries & delay |
| `app/downloader/test_worker.py` | `DownloaderWorker` | Polling loop, thread start/stop, stale recovery |
| `app/lyrics/test_lyrics_service.py` | `LyricsService` | LRCLIB API search, title cleaning, `.lrc` writing |
| `app/lyrics/test_lyrics_worker.py` | `LyricsWorker` | Daemon thread polling & queue draining |
| `app/reconciler/test_reconciler.py` | `PlaylistReconciler` | DB diffing, removal handling, `last_n` protection |
| `app/scheduler/test_scheduler_service.py` | `MusicSyncScheduler` | APScheduler start/stop, interval update, lock protection |
| `app/scheduler/test_retry_integration.py` | Scheduler Integration | Retry integration within scheduled sync loops |
| `app/sync/test_sync_service.py` | `SyncService` | End-to-end multi-playlist discovery execution |
| `app/watcher/test_youtube_watcher.py` | `YouTubePlaylistWatcher` | Flat extraction, unavailable video detection |
| `app/test_configurable_watcher.py` | Watcher Modes | `whole` vs `last_n` mode behavior |
| `app/test_playlist_folder_name.py` | `paths.py` | `sanitize_filename()` invalid character replacement |

---

## Frontend Testing

Frontend component tests use **Vitest** and **React Testing Library** (`dashboard/src/App.test.jsx`).

```bash
cd dashboard

# Execute Vitest test runner
npm test
```
