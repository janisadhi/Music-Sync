from unittest.mock import AsyncMock, patch
import pytest
import httpx

from app.rslsync.service import ResilioSyncService
from app.rslsync.schemas import ResilioDashboardOverview, ResilioPeer, ResilioStatusResponse


@pytest.mark.asyncio
async def test_resilio_service_overview_success():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    mock_status = {
        "status": "synced",
        "progress": 100.0,
        "folder_count": 1,
        "connected_peers": 2,
        "active_transfers": 0,
        "download_speed": 0,
        "upload_speed": 0,
        "total_bytes": 10485760,
        "synced_bytes": 10485760,
    }

    mock_folders = [
        {
            "id": "f-123",
            "name": "Music Downloads",
            "path": "/app/downloads",
            "status": "synced",
            "size": 10485760,
            "files_count": 42,
            "synced_files_count": 42,
        }
    ]

    mock_peers = [
        {
            "id": "p-1",
            "name": "Janis iPhone",
            "status": "online",
            "connection_state": "direct",
            "sync_state": "synced",
            "download_speed": 0,
            "upload_speed": 0,
            "bytes_remaining": 0,
        }
    ]

    async def mock_request(method, path, params=None):
        if path == "/api/v2/status":
            return mock_status
        if path == "/api/v2/folders":
            return mock_folders
        if path == "/api/v2/peers":
            return mock_peers
        if path == "/api/v2/transfers":
            return []
        if path == "/api/v2/errors":
            return []
        return {}

    with patch.object(service, "_request", new=AsyncMock(side_effect=mock_request)):
        overview = await service.get_overview(force_refresh=True)

        assert isinstance(overview, ResilioDashboardOverview)
        assert overview.status.connected is True
        assert overview.status.status == "synced"
        assert len(overview.folders) == 1
        assert overview.folders[0].name == "Music Downloads"
        assert len(overview.peers) == 1
        assert overview.peers[0].name == "Janis iPhone"


@pytest.mark.asyncio
async def test_resilio_service_graceful_fallback_on_disconnection():
    service = ResilioSyncService(host="invalid-host", port=9999)

    with patch.object(service, "_request", side_effect=httpx.RequestError("Connection refused")):
        overview = await service.get_overview(force_refresh=True)

        assert isinstance(overview, ResilioDashboardOverview)
        assert overview.status.connected is False
        assert overview.status.status == "disconnected"
        assert ("unreachable" in overview.status.error_message.lower() or "unavailable" in overview.status.error_message.lower())
        assert len(overview.errors) > 0
        assert "Cannot connect" in overview.errors[0].message


@pytest.mark.asyncio
async def test_resilio_generate_share_info():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    share_info = await service.generate_share_info(folder_id="music-downloads", permission="read_write")

    assert share_info.folder_id == "music-downloads"
    assert share_info.permission == "read_write"
    assert len(share_info.secret_key) == 33
    assert share_info.secret_key.startswith(("A", "B"))
    assert share_info.share_url.startswith("rslsync://")
    assert share_info.qr_code_svg.startswith("data:image/svg+xml;base64,")


@pytest.mark.asyncio
async def test_resilio_check_pairing_status():
    service = ResilioSyncService(host="mock-resilio", port=8888)

    mock_peers = [
        {
            "id": "p-99",
            "name": "Janis Mobile",
            "status": "online",
            "connection_state": "direct",
            "sync_state": "synced",
        }
    ]

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

    with patch.object(service, "_request", new=AsyncMock(return_value={"status": "ok"})):
        success = await service.revoke_peer("p-99")
        assert success is True

