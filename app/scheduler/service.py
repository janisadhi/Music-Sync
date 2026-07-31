from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.sync.service import SyncService


class MusicSyncScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def run_sync(self):
        print("=" * 60)
        print("Starting scheduled sync")
        print("=" * 60)

        try:
            sync_service = SyncService()
            sync_service.run()

        except Exception as exc:
            print(f"Sync cycle failed: {exc}")

        print("=" * 60)
        print("Scheduled sync completed")
        print("=" * 60)

    def start(self):
        interval = settings.sync_interval_seconds

        print("=" * 60)
        print("Music Sync Scheduler")
        print("=" * 60)
        print(f"Interval: {interval} seconds")
        print(f"Interval: {interval / 60:.1f} minutes")
        print("=" * 60)

        self.scheduler.add_job(
            self.run_sync,
            "interval",
            seconds=interval,
            id="music-sync",
            replace_existing=True,
            max_instances=1,
        )

        # Run once immediately.
        self.run_sync()

        self.scheduler.start()

        print("Scheduler started.")

    def shutdown(self):
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            print("Scheduler stopped.")