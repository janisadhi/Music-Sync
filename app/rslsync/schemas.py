from datetime import datetime
from pydantic import BaseModel, Field


class ResilioPeer(BaseModel):
    id: str | None = None
    name: str
    status: str = "online"  # "online" | "offline"
    connection_state: str = "direct"  # "direct" | "relay" | "disconnected"
    sync_state: str = "synced"  # "synced" | "syncing" | "indexed" | "paused"
    download_speed: int = 0  # bytes/sec
    upload_speed: int = 0  # bytes/sec
    bytes_remaining: int = 0
    last_seen: str | None = None


class ResilioFolder(BaseModel):
    id: str | None = None
    name: str
    path: str
    status: str = "synced"  # "synced" | "syncing" | "indexing" | "error"
    size_bytes: int = 0
    files_count: int = 0
    synced_files_count: int = 0
    secret_masked: str | None = None
    last_sync: str | None = None


class ResilioTransfer(BaseModel):
    id: str | None = None
    filename: str
    direction: str = "download"  # "download" | "upload"
    peer_name: str | None = None
    progress_pct: float = 0.0
    transferred_bytes: int = 0
    total_bytes: int = 0
    speed_bytes_sec: int = 0


class ResilioErrorItem(BaseModel):
    id: str | None = None
    message: str
    affected_resource: str | None = None
    timestamp: str | None = None
    error_code: int | None = None


class ResilioStatusResponse(BaseModel):
    connected: bool = True
    status: str = "synced"  # "synced" | "syncing" | "connected" | "disconnected" | "error"
    overall_progress_pct: float = 100.0
    folder_count: int = 0
    connected_peers_count: int = 0
    active_transfers_count: int = 0
    download_speed: int = 0  # bytes/sec
    upload_speed: int = 0  # bytes/sec
    total_bytes: int = 0
    synced_bytes: int = 0
    total_files: int = 0
    synced_files: int = 0
    last_sync: str | None = None
    error_message: str | None = None


class ResilioDashboardOverview(BaseModel):
    status: ResilioStatusResponse
    folders: list[ResilioFolder] = []
    peers: list[ResilioPeer] = []
    transfers: list[ResilioTransfer] = []
    errors: list[ResilioErrorItem] = []
