import logging
from fastapi import APIRouter, Query, status

from app.rslsync.schemas import (
    ResilioDashboardOverview,
    ResilioErrorItem,
    ResilioFolder,
    ResilioPeer,
    ResilioStatusResponse,
    ResilioTransfer,
)
from app.rslsync.service import resilio_service

logger = logging.getLogger("app.api.rslsync")

router = APIRouter(
    prefix="/api/rslsync",
    tags=["Resilio Sync"],
)


@router.get("/overview", response_model=ResilioDashboardOverview)
async def get_resilio_overview(
    force_refresh: bool = Query(False, description="Force live refresh ignoring backend TTL cache"),
):
    """Returns consolidated Resilio Sync dashboard overview (status, folders, peers, transfers, errors)."""
    return await resilio_service.get_overview(force_refresh=force_refresh)


@router.get("/status", response_model=ResilioStatusResponse)
async def get_resilio_status():
    """Returns general Resilio Sync connection and synchronization metrics."""
    return await resilio_service.get_status()


@router.get("/folders", response_model=list[ResilioFolder])
async def get_resilio_folders():
    """Returns synchronized music folders managed by Resilio Sync."""
    return await resilio_service.get_sync_folders()


@router.get("/peers", response_model=list[ResilioPeer])
async def get_resilio_peers():
    """Returns paired mobile devices / P2P peers."""
    return await resilio_service.get_peers()


@router.get("/transfers", response_model=list[ResilioTransfer])
async def get_resilio_transfers():
    """Returns active file transfers and download/upload progress."""
    return await resilio_service.get_transfer_status()


@router.get("/errors", response_model=list[ResilioErrorItem])
async def get_resilio_errors():
    """Returns current Resilio Sync error log items."""
    return await resilio_service.get_errors()
