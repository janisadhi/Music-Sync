import logging
from fastapi import APIRouter, Query, status

from app.rslsync.schemas import (
    ResilioDashboardOverview,
    ResilioErrorItem,
    ResilioFolder,
    ResilioLicenseRequest,
    ResilioLicenseStatus,
    ResilioPairingStatus,
    ResilioPeer,
    ResilioShareInfo,
    ResilioShareRequest,
    ResilioStatusResponse,
    ResilioTransfer,
)
from app.rslsync.service import resilio_service

logger = logging.getLogger("app.api.rslsync")

router = APIRouter(
    prefix="/api/rslsync",
    tags=["Resilio Sync"],
)


@router.get("/license", response_model=ResilioLicenseStatus)
async def get_resilio_license():
    """Returns current Resilio Sync engine license status and masked key details."""
    return await resilio_service.get_license_status()


@router.post("/license", response_model=ResilioLicenseStatus)
async def update_resilio_license(req: ResilioLicenseRequest):
    """Saves and applies a new Resilio Sync license key or .btskey content."""
    return await resilio_service.update_license(req.license_key)


@router.delete("/license", response_model=ResilioLicenseStatus)
async def delete_resilio_license():
    """Removes stored Resilio Sync license file."""
    return await resilio_service.delete_license()


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


@router.delete("/peers/{peer_id}")
async def revoke_resilio_peer(
    peer_id: str,
    folder_id: str = Query(None, description="Optional folder ID from which to remove peer"),
):
    """Disconnects and revokes a paired mobile device / peer."""
    success = await resilio_service.revoke_peer(peer_id, folder_id=folder_id)
    return {"status": "success" if success else "failed", "peer_id": peer_id}


@router.post("/shares/generate", response_model=ResilioShareInfo)
async def generate_resilio_share(req: ResilioShareRequest):
    """Generates pairing key secret, share URL, and SVG QR Code for mobile pairing."""
    return await resilio_service.generate_share_info(
        folder_id=req.folder_id,
        permission=req.permission,
    )


@router.get("/pairing-status", response_model=ResilioPairingStatus)
async def get_pairing_status(
    folder_id: str = Query("music-downloads"),
    known_peers: str = Query(None, description="Comma-separated list of known peer IDs prior to pairing"),
):
    """Polls real-time pairing detection status when a mobile device connects."""
    known_list = [p.strip() for p in known_peers.split(",")] if known_peers else []
    return await resilio_service.check_pairing_status(folder_id=folder_id, known_peer_ids=known_list)


@router.get("/transfers", response_model=list[ResilioTransfer])
async def get_resilio_transfers():
    """Returns active file transfers and download/upload progress."""
    return await resilio_service.get_transfer_status()


@router.get("/errors", response_model=list[ResilioErrorItem])
async def get_resilio_errors():
    """Returns current Resilio Sync error log items."""
    return await resilio_service.get_errors()

