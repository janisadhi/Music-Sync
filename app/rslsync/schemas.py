from datetime import datetime
from pydantic import BaseModel, Field


class ResilioLicenseStatus(BaseModel):
    status: str = "not_configured"  # "not_configured" | "configured" | "activated" | "invalid" | "unavailable"
    has_license_file: bool = False
    masked_key: str | None = None
    license_type: str | None = None  # "Pro" | "Free"
    valid: bool = False
    expiration: str | None = None
    error_message: str | None = None


class ResilioLicenseRequest(BaseModel):
    license_key: str


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
    last_seen_ts: int | None = None
    synced_files: int = 0
    total_files: int = 0


class ResilioFolder(BaseModel):
    id: str | None = None
    name: str
    path: str
    status: str = "synced"  # "synced" | "syncing" | "indexing" | "error"
    size_bytes: int = 0
    ondisk_size_bytes: int = 0
    files_count: int = 0
    synced_files_count: int = 0
    remaining_files_count: int = 0
    queue_upload_files: int = 0
    queue_download_files: int = 0
    queue_upload_size: int = 0
    queue_download_size: int = 0
    up_speed: int = 0  # bytes/sec
    down_speed: int = 0  # bytes/sec
    secret_masked: str | None = None
    readonlysecret_masked: str | None = None
    secret: str | None = None
    readonlysecret: str | None = None
    last_sync: str | None = None
    connected_peers_count: int = 0


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
    remaining_files: int = 0
    last_sync: str | None = None
    error_message: str | None = None


class ResilioDashboardOverview(BaseModel):
    status: ResilioStatusResponse
    license: ResilioLicenseStatus | None = None
    folders: list[ResilioFolder] = []
    peers: list[ResilioPeer] = []
    transfers: list[ResilioTransfer] = []
    errors: list[ResilioErrorItem] = []


class ResilioShareRequest(BaseModel):
    folder_id: str = "music-downloads"
    permission: str = "read_write"  # "read_write" | "read_only"


class ResilioShareInfo(BaseModel):
    folder_id: str
    folder_name: str
    folder_path: str
    permission: str
    secret_key: str
    share_url: str
    qr_code_svg: str
    expires_at: str | None = None


class ResilioPairingStatus(BaseModel):
    folder_id: str
    pairing_active: bool = True
    detected: bool = False
    status: str = "waiting"  # "waiting" | "detected" | "connecting" | "connected" | "syncing"
    device_name: str | None = None
    device_id: str | None = None
    connection_type: str | None = None
    sync_progress_pct: float = 0.0
    error_message: str | None = None


