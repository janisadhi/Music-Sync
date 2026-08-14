"""
Application-level singletons.

Both objects are created at import time so that API routers can reference them
without circular imports.  Lifecycle management (start/stop) happens in
app/main.py lifespan.
"""

from app.scheduler.service import MusicSyncScheduler
from app.downloader.worker import DownloaderWorker


scheduler = MusicSyncScheduler()
downloader_worker = DownloaderWorker()
