import logging
import os
import time
from typing import Any
import httpx

from app.core.config import settings
from app.rslsync.schemas import (
    ResilioDashboardOverview,
    ResilioErrorItem,
    ResilioFolder,
    ResilioPeer,
    ResilioStatusResponse,
    ResilioTransfer,
)

logger = logging.getLogger("app.rslsync.service")


class ResilioSyncService:
    """
    Abstractions for communicating with the Resilio Sync container instance.
    Centralized communication and fault-tolerant fallback handling.
    """

    def __init__(self, host: str | None = None, port: int | None = None):
        self.host = host or getattr(settings, "resilio_host", os.getenv("RESILIO_HOST", "resilio"))
        self.port = port or getattr(settings, "resilio_port", int(os.getenv("RESILIO_PORT", "8888")))
        self.api_key = getattr(settings, "resilio_api_key", os.getenv("RESILIO_API_KEY", ""))
        self.username = getattr(settings, "resilio_username", os.getenv("RESILIO_USERNAME", "admin"))
        self.password = getattr(settings, "resilio_password", os.getenv("RESILIO_PASSWORD", ""))
        self.base_url = f"http://{self.host}:{self.port}"
        self._cache_data: ResilioDashboardOverview | None = None
        self._last_cache_time: float = 0.0
        self.cache_ttl_seconds: float = 3.0

    async def _request(self, method: str, path: str, params: dict | None = None) -> Any:
        url = f"{self.base_url}{path}"
        auth = (self.username, self.password) if self.username and self.password else None
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=3.0, auth=auth, headers=headers) as client:
            resp = await client.request(method=method, url=url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_overview(self, force_refresh: bool = False) -> ResilioDashboardOverview:
        """
        Returns consolidated status, folders, peers, transfers, and errors.
        Uses short backend TTL caching to avoid spamming Resilio API.
        Gracefully returns disconnected fallback if Resilio container is down.
        """
        now = time.time()
        if not force_refresh and self._cache_data and (now - self._last_cache_time < self.cache_ttl_seconds):
            return self._cache_data

        try:
            status = await self.get_status()
            folders = await self.get_sync_folders()
            peers = await self.get_peers()
            transfers = await self.get_transfer_status()
            errors = await self.get_errors()

            if not status.connected:
                sync_dir = os.getenv("DOWNLOADS_DIR", "/app/downloads")
                fallback_folder = ResilioFolder(
                    id="music-downloads",
                    name="Music Sync Library",
                    path=sync_dir,
                    status="error",
                    synced_files_count=0,
                )
                return ResilioDashboardOverview(
                    status=status,
                    folders=[fallback_folder],
                    peers=[],
                    transfers=[],
                    errors=[
                        ResilioErrorItem(
                            id="resilio-conn-err",
                            message=f"Cannot connect to Resilio Sync container at {self.base_url}",
                            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                        )
                    ],
                )

            overview = ResilioDashboardOverview(
                status=status,
                folders=folders,
                peers=peers,
                transfers=transfers,
                errors=errors,
            )
            self._cache_data = overview
            self._last_cache_time = now
            return overview

        except Exception as exc:
            logger.warning(f"Resilio Sync communication failed: {exc}")

            disconnected_status = ResilioStatusResponse(
                connected=False,
                status="disconnected",
                overall_progress_pct=0.0,
                error_message=f"Resilio Sync unavailable: {str(exc)}",
            )

            sync_dir = os.getenv("DOWNLOADS_DIR", "/app/downloads")
            fallback_folder = ResilioFolder(
                id="music-downloads",
                name="Music Sync Library",
                path=sync_dir,
                status="error",
                synced_files_count=0,
            )

            fallback_overview = ResilioDashboardOverview(
                status=disconnected_status,
                folders=[fallback_folder],
                peers=[],
                transfers=[],
                errors=[
                    ResilioErrorItem(
                        id="resilio-conn-err",
                        message=f"Cannot connect to Resilio Sync container at {self.base_url}",
                        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                    )
                ],
            )
            return fallback_overview

    async def get_status(self) -> ResilioStatusResponse:
        """Fetch general status from Resilio API with fallback endpoints."""
        endpoints = ["/api/v2/status", "/api/v1/status", "/gui/?action=getstatus"]
        for ep in endpoints:
            try:
                data = await self._request("GET", ep)
                if isinstance(data, dict):
                    return ResilioStatusResponse(
                        connected=True,
                        status=data.get("status", "synced"),
                        overall_progress_pct=float(data.get("progress", 100.0)),
                        folder_count=int(data.get("folder_count", 1)),
                        connected_peers_count=int(data.get("connected_peers", 0)),
                        active_transfers_count=int(data.get("active_transfers", 0)),
                        download_speed=int(data.get("download_speed", 0)),
                        upload_speed=int(data.get("upload_speed", 0)),
                        total_bytes=int(data.get("total_bytes", 0)),
                        synced_bytes=int(data.get("synced_bytes", 0)),
                    )
            except Exception:
                continue

        # If HTTP ping to root/port succeeds, consider it connected
        try:
            url = f"{self.base_url}/"
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(url)
                if resp.status_code in (200, 401, 403, 404):
                    return ResilioStatusResponse(
                        connected=True,
                        status="synced",
                        overall_progress_pct=100.0,
                        folder_count=1,
                        connected_peers_count=0,
                        active_transfers_count=0,
                    )
        except Exception as exc:
            return ResilioStatusResponse(
                connected=False,
                status="disconnected",
                overall_progress_pct=0.0,
                folder_count=1,
                connected_peers_count=0,
                active_transfers_count=0,
                error_message=f"Resilio Sync container unreachable at {self.base_url}: {str(exc)}",
            )

        return ResilioStatusResponse(
            connected=False,
            status="disconnected",
            overall_progress_pct=0.0,
            error_message=f"Cannot query status from Resilio Sync container at {self.base_url}",
        )

    async def get_sync_folders(self) -> list[ResilioFolder]:
        """Fetch list of sync folders from Resilio API."""
        endpoints = ["/api/v2/folders", "/api/v1/folders"]
        for ep in endpoints:
            try:
                raw_folders = await self._request("GET", ep)
                if isinstance(raw_folders, list):
                    result = []
                    for item in raw_folders:
                        result.append(
                            ResilioFolder(
                                id=item.get("id"),
                                name=item.get("name", "Music Sync Library"),
                                path=item.get("path", "/app/downloads"),
                                status=item.get("status", "synced"),
                                size_bytes=int(item.get("size", 0)),
                                files_count=int(item.get("files_count", 0)),
                                synced_files_count=int(item.get("synced_files_count", 0)),
                                secret_masked=item.get("secret_masked"),
                                last_sync=item.get("last_sync"),
                            )
                        )
                    return result
            except Exception:
                continue

        sync_dir = os.getenv("DOWNLOADS_DIR", "/app/downloads")
        return [
            ResilioFolder(
                id="music-downloads",
                name="Music Sync Library",
                path=sync_dir,
                status="synced",
                synced_files_count=0,
            )
        ]

    async def get_peers(self) -> list[ResilioPeer]:
        """Fetch paired device / peer information from Resilio API."""
        endpoints = ["/api/v2/peers", "/api/v1/peers"]
        for ep in endpoints:
            try:
                raw_peers = await self._request("GET", ep)
                if isinstance(raw_peers, list):
                    result = []
                    for p in raw_peers:
                        result.append(
                            ResilioPeer(
                                id=p.get("id"),
                                name=p.get("name", "Mobile Device"),
                                status=p.get("status", "online"),
                                connection_state=p.get("connection_state", "direct"),
                                sync_state=p.get("sync_state", "synced"),
                                download_speed=int(p.get("download_speed", 0)),
                                upload_speed=int(p.get("upload_speed", 0)),
                                bytes_remaining=int(p.get("bytes_remaining", 0)),
                                last_seen=p.get("last_seen"),
                            )
                        )
                    return result
            except Exception:
                continue

        return []

    async def get_transfer_status(self) -> list[ResilioTransfer]:
        """Fetch active file transfer details from Resilio API."""
        endpoints = ["/api/v2/transfers", "/api/v1/transfers"]
        for ep in endpoints:
            try:
                raw_transfers = await self._request("GET", ep)
                if isinstance(raw_transfers, list):
                    result = []
                    for t in raw_transfers:
                        result.append(
                            ResilioTransfer(
                                id=t.get("id"),
                                filename=t.get("filename", ""),
                                direction=t.get("direction", "download"),
                                peer_name=t.get("peer_name"),
                                progress_pct=float(t.get("progress_pct", 0.0)),
                                transferred_bytes=int(t.get("transferred_bytes", 0)),
                                total_bytes=int(t.get("total_bytes", 0)),
                                speed_bytes_sec=int(t.get("speed_bytes_sec", 0)),
                            )
                        )
                    return result
            except Exception:
                continue

        return []

    async def get_errors(self) -> list[ResilioErrorItem]:
        """Fetch sync errors from Resilio API."""
        endpoints = ["/api/v2/errors", "/api/v1/errors"]
        for ep in endpoints:
            try:
                raw_errors = await self._request("GET", ep)
                if isinstance(raw_errors, list):
                    result = []
                    for e in raw_errors:
                        result.append(
                            ResilioErrorItem(
                                id=e.get("id"),
                                message=e.get("message", "Sync error"),
                                affected_resource=e.get("affected_resource"),
                                timestamp=e.get("timestamp"),
                            )
                        )
                    return result
            except Exception:
                continue

        return []


resilio_service = ResilioSyncService()
