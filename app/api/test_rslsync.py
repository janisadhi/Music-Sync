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
