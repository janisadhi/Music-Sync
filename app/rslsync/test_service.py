from unittest.mock import AsyncMock, patch
import pytest
import httpx

from app.rslsync.service import ResilioSyncService
from app.rslsync.schemas import (
    ResilioDashboardOverview,
    ResilioFolder,
    ResilioLicenseStatus,
    ResilioPeer,
)


@pytest.mark.asyncio
async def test_resilio_service_overview_success():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    mock_license = ResilioLicenseStatus(status="activated", valid=True, license_type="Pro")

    mock_folders = [
        ResilioFolder(
            id="f-123",
            name="Music Sync Library",
            path="/app/downloads",
            status="synced",
            size_bytes=10485760,
            ondisk_size_bytes=10485760,
            files_count=42,
            synced_files_count=42,
        )
    ]

    mock_peers = [
        ResilioPeer(
            id="p-1",
            name="Janis iPhone",
            status="online",
            connection_state="direct",
            sync_state="synced",
        )
    ]

    with patch.object(service, "get_license_status", new=AsyncMock(return_value=mock_license)), \
         patch.object(service, "get_sync_folders", new=AsyncMock(return_value=mock_folders)), \
         patch.object(service, "get_peers", new=AsyncMock(return_value=mock_peers)), \
         patch.object(service, "get_transfer_status", new=AsyncMock(return_value=[])), \
         patch.object(service, "get_errors", new=AsyncMock(return_value=[])):

        overview = await service.get_overview(force_refresh=True)

        assert isinstance(overview, ResilioDashboardOverview)
        assert overview.status.connected is True
        assert overview.status.status == "synced"
        assert len(overview.folders) == 1
        assert overview.folders[0].name == "Music Sync Library"
        assert len(overview.peers) == 1
        assert overview.peers[0].name == "Janis iPhone"
        assert overview.license.status == "activated"


@pytest.mark.asyncio
async def test_resilio_service_graceful_fallback_on_disconnection():
    service = ResilioSyncService(host="invalid-host", port=9999)

    with patch.object(service, "get_license_status", side_effect=httpx.RequestError("Connection refused")):
        overview = await service.get_overview(force_refresh=True)

        assert isinstance(overview, ResilioDashboardOverview)
        assert overview.status.connected is False
        assert overview.status.status == "disconnected"
        assert ("unreachable" in overview.status.error_message.lower() or "unavailable" in overview.status.error_message.lower())
        assert len(overview.errors) > 0


@pytest.mark.asyncio
async def test_resilio_generate_share_info():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    share_info = await service.generate_share_info(folder_id="music-downloads", permission="read_write")

    assert share_info.folder_id == "music-downloads"
    assert share_info.permission == "read_write"
    assert len(share_info.secret_key) == 33
    assert share_info.secret_key.startswith(("A", "B"))
    assert len(share_info.share_url) >= 33
    assert share_info.qr_code_svg.startswith("data:image/svg+xml;base64,")


@pytest.mark.asyncio
async def test_resilio_check_pairing_status():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    with patch.object(service, "get_peers", new=AsyncMock(return_value=[
        ResilioPeer(id="p-99", name="Janis Mobile", status="online", connection_state="direct", sync_state="synced")
    ])):
        status = await service.check_pairing_status(folder_id="music-downloads")

        assert status.detected is True
        assert status.status == "connected"
        assert status.device_name == "Janis Mobile"
        assert status.device_id == "p-99"


@pytest.mark.asyncio
async def test_resilio_revoke_peer():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    with patch.object(service, "_webui_request", new=AsyncMock(return_value={"status": "ok"})):
        success = await service.revoke_peer("p-99")
        assert success is True
