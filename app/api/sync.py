
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.core.runtime import downloader_worker, scheduler

router = APIRouter(
    prefix="/sync",
    tags=["Sync"],
)


class SyncIntervalRequest(BaseModel):
    seconds: int = Field(
        ge=10,
        description="Synchronization interval in seconds",
    )


@router.get("/status")
def get_sync_status():
    status = scheduler.get_status()
    status["downloader_worker"] = downloader_worker.get_status()
    return status


@router.get("/downloader")
def get_downloader_status():
    return downloader_worker.get_status()


@router.post("/downloader/start")
def start_downloader():
    started = downloader_worker.start()
    if not started:
        return {
            "status": "already_running",
            "message": "Downloader worker is already running.",
        }
    return {
        "status": "started",
        "message": "Downloader worker started.",
    }


@router.post("/downloader/stop")
def stop_downloader():
    stopped = downloader_worker.stop()
    if not stopped:
        return {
            "status": "already_stopped",
            "message": "Downloader worker is already stopped.",
        }
    return {
        "status": "stopped",
        "message": "Downloader worker stopped.",
    }


@router.post("")
def trigger_sync(background_tasks: BackgroundTasks):
    if scheduler.sync_running:
        return {
            "status": "already_running",
            "message": "Synchronization is already running.",
        }

    background_tasks.add_task(
        scheduler.run_sync
    )

    return {
        "status": "started",
        "message": "Synchronization started.",
    }


@router.get("/history")
def get_sync_history():
    return {
        "items": scheduler.get_history(),
    }


@router.get("/scheduler")
def get_scheduler_status():
    if scheduler.scheduler is None:
        return {
            "running": False,
            "interval_seconds": None,
        }

    job = scheduler.scheduler.get_job("music-sync")

    return {
        "running": scheduler.scheduler.running,
        "interval_seconds": (
            job.trigger.interval.total_seconds()
            if job
            else None
        ),
    }


@router.post("/scheduler/start")
def start_scheduler():
    started = scheduler.start(
        run_immediately=False
    )

    if not started:
        return {
            "status": "already_running",
            "message": "Scheduler is already running.",
        }

    return {
        "status": "started",
        "message": "Scheduler started.",
    }


@router.post("/scheduler/stop")
def stop_scheduler():
    stopped = scheduler.stop()

    if not stopped:
        return {
            "status": "already_stopped",
            "message": "Scheduler is already stopped.",
        }

    return {
        "status": "stopped",
        "message": "Scheduler stopped.",
    }


@router.patch("/scheduler")
def update_scheduler(
    request: SyncIntervalRequest,
):
    try:
        scheduler.update_interval(
            request.seconds
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    return {
        "status": "updated",
        "interval_seconds": request.seconds,
        "interval_minutes": request.seconds / 60,
    }
