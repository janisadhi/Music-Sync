from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.rslsync.schemas import (
    ResilioDashboardOverview,
    ResilioFolder,
    ResilioPeer,
    ResilioStatusResponse,
)

client = TestClient(app)


def test_get_rslsync_overview_endpoint():
    mock_overview = ResilioDashboardOverview(
        status=ResilioStatusResponse(
            connected=True,
            status="synced",
            overall_progress_pct=100.0,
            folder_count=1,
            connected_peers_count=1,
        ),
        folders=[
            ResilioFolder(
                id="f-1",
                name="Music Sync Library",
                path="/app/downloads",
                status="synced",
            )
        ],
        peers=[
            ResilioPeer(
                id="p-1",
                name="Mobile Phone",
                status="online",
            )
        ],
    )

    with patch("app.api.rslsync.resilio_service.get_overview", new=AsyncMock(return_value=mock_overview)):
        response = client.get("/api/rslsync/overview")
        assert response.status_code == 200
        data = response.json()
        assert data["status"]["connected"] is True
        assert data["folders"][0]["name"] == "Music Sync Library"
        assert data["peers"][0]["name"] == "Mobile Phone"


def test_get_rslsync_status_endpoint():
    mock_status = ResilioStatusResponse(
        connected=True,
        status="synced",
        overall_progress_pct=100.0,
    )

    with patch("app.api.rslsync.resilio_service.get_status", new=AsyncMock(return_value=mock_status)):
        response = client.get("/api/rslsync/status")
        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is True
        assert data["status"] == "synced"


def test_get_rslsync_disconnected_graceful_handling():
    disconnected_overview = ResilioDashboardOverview(
        status=ResilioStatusResponse(
            connected=False,
            status="disconnected",
            error_message="Resilio Sync unavailable",
        ),
        folders=[],
        peers=[],
        transfers=[],
        errors=[],
    )

    with patch("app.api.rslsync.resilio_service.get_overview", new=AsyncMock(return_value=disconnected_overview)):
        response = client.get("/api/rslsync/overview")
        assert response.status_code == 200
        data = response.json()
        assert data["status"]["connected"] is False
        assert data["status"]["status"] == "disconnected"


def test_generate_resilio_share_endpoint():
    from app.rslsync.schemas import ResilioShareInfo

    mock_share = ResilioShareInfo(
        folder_id="music-downloads",
        folder_name="Music Sync Library",
        folder_path="/app/downloads",
        permission="read_write",
        secret_key="BAZ42MSYNC88888888888888888888888",
        share_url="rslsync://BAZ42MSYNC88888888888888888888888",
        qr_code_svg="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    )

    with patch("app.api.rslsync.resilio_service.generate_share_info", new=AsyncMock(return_value=mock_share)):
        response = client.post("/api/rslsync/shares/generate", json={"folder_id": "music-downloads", "permission": "read_write"})
        assert response.status_code == 200
        data = response.json()
        assert data["folder_id"] == "music-downloads"
        assert data["secret_key"] == "BAZ42MSYNC88888888888888888888888"
        assert data["qr_code_svg"].startswith("data:image/svg+xml;base64,")


def test_get_pairing_status_endpoint():
    from app.rslsync.schemas import ResilioPairingStatus

    mock_pairing = ResilioPairingStatus(
        folder_id="music-downloads",
        pairing_active=True,
        detected=True,
        status="connected",
        device_name="Janis iPhone",
        device_id="p-123",
    )

    with patch("app.api.rslsync.resilio_service.check_pairing_status", new=AsyncMock(return_value=mock_pairing)):
        response = client.get("/api/rslsync/pairing-status?folder_id=music-downloads")
        assert response.status_code == 200
        data = response.json()
        assert data["detected"] is True
        assert data["device_name"] == "Janis iPhone"


def test_revoke_resilio_peer_endpoint():
    with patch("app.api.rslsync.resilio_service.revoke_peer", new=AsyncMock(return_value=True)):
        response = client.delete("/api/rslsync/peers/p-123")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["peer_id"] == "p-123"

