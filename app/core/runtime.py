"""
Application-level singletons.

All three objects are created at import time so that API routers can reference
them without circular imports.  Lifecycle management (start/stop) happens in
app/main.py lifespan.

Architecture:
  Scheduler     → periodically triggers SyncService
  Downloader    → continuously drains the pending audio download queue
  Lyrics        → continuously drains the pending lyrics queue
"""

from app.scheduler.service import MusicSyncScheduler
from app.downloader.worker import DownloaderWorker
from app.lyrics.worker import LyricsWorker


scheduler = MusicSyncScheduler()
downloader_worker = DownloaderWorker()
lyrics_worker = LyricsWorker()
