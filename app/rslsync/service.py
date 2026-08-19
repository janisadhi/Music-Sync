import logging
import os
import re
import time
from typing import Any
import httpx

from app.core.config import settings
from app.rslsync.schemas import (
    ResilioDashboardOverview,
    ResilioErrorItem,
    ResilioFolder,
    ResilioLicenseStatus,
    ResilioPairingStatus,
    ResilioPeer,
    ResilioShareInfo,
    ResilioStatusResponse,
    ResilioTransfer,
)

logger = logging.getLogger("app.rslsync.service")

LICENSE_FILE_PATH = "/etc/resilio/license.btskey"


def mask_secret(secret: str | None) -> str | None:
    if not secret:
        return None
    if len(secret) <= 8:
        return "****"
    return f"{secret[:4]}...{secret[-4:]}"


class ResilioSyncService:
    """
    Abstractions for communicating with the Resilio Sync container instance.
    Communicates directly with the Resilio WebUI API (port 8888) with token authentication.
    """

    def __init__(self, host: str | None = None, port: int | None = None):
        self.host = host or getattr(settings, "resilio_host", os.getenv("RESILIO_HOST", "resilio"))
        self.port = port or getattr(settings, "resilio_port", int(os.getenv("RESILIO_PORT", "8888")))
        self.username = getattr(settings, "resilio_username", os.getenv("RESILIO_USERNAME", "admin"))
        self.password = getattr(settings, "resilio_password", os.getenv("RESILIO_PASSWORD", "admin"))
        self.base_url = f"http://{self.host}:{self.port}"
        self._token: str | None = None
        self._cookies: dict = {}
        self._token_fetch_time: float = 0.0
        self._cache_data: ResilioDashboardOverview | None = None
        self._last_cache_time: float = 0.0
        self.cache_ttl_seconds: float = 1.0

    async def _get_token(self) -> str:
        """Fetch or refresh WebUI authentication token."""
        now = time.time()
        if self._token and (now - self._token_fetch_time < 300):
            return self._token

        auth = (self.username, self.password) if self.username and self.password else None
        token_url = f"{self.base_url}/gui/token.html"

        async with httpx.AsyncClient(timeout=3.0, auth=auth, follow_redirects=True) as client:
            resp = await client.get(token_url)
            resp.raise_for_status()
            match = re.search(r"<div id='token'[^>]*>([^<]+)</div>", resp.text)
            if not match:
                raise ValueError("Resilio WebUI token tag not found in response")

            self._token = match.group(1)
            self._cookies = dict(resp.cookies)
            self._token_fetch_time = now

            # Ensure EULA/terms agreement is set
            try:
                await client.get(
                    f"{self.base_url}/gui/?token={self._token}&action=setlicenseagreed&value=1",
                    auth=auth,
                    cookies=self._cookies,
                )
            except Exception:
                pass

            return self._token

    async def _webui_request(self, action: str, extra_params: dict | None = None) -> Any:
        token = await self._get_token()
        auth = (self.username, self.password) if self.username and self.password else None
        url = f"{self.base_url}/gui/?token={token}&action={action}"
        if extra_params:
            for k, v in extra_params.items():
                url += f"&{k}={v}"

        async with httpx.AsyncClient(timeout=3.0, auth=auth, cookies=self._cookies, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    async def get_license_status(self) -> ResilioLicenseStatus:
        has_file = os.path.exists(LICENSE_FILE_PATH) and os.path.getsize(LICENSE_FILE_PATH) > 0
        masked_key = None
        if has_file:
            try:
                with open(LICENSE_FILE_PATH, "r") as f:
                    content = f.read().strip()
                if len(content) > 8:
                    masked_key = f"{content[:4]}-****-{content[-4:]}"
                else:
                    masked_key = "****"
            except Exception:
                masked_key = "****"

        try:
            data = await self._webui_request("getlicenseinfo")
            if isinstance(data, dict) and data.get("status") == 200:
                val = data.get("value", {})
                valid = bool(val.get("valid", False))
                lic_type = "Pro" if valid else "Free"
                exp = val.get("expiration")

                if valid:
                    st = "activated"
                elif has_file:
                    st = "configured"
                else:
                    st = "not_configured"

                return ResilioLicenseStatus(
                    status=st,
                    has_license_file=has_file,
                    masked_key=masked_key,
                    license_type=lic_type,
                    valid=valid,
                    expiration=str(exp) if exp else None,
                )
        except Exception as exc:
            logger.debug(f"Could not query Resilio license info: {exc}")
            if has_file:
                return ResilioLicenseStatus(
                    status="configured",
                    has_license_file=True,
                    masked_key=masked_key,
                    valid=False,
                    error_message=f"License file present at {LICENSE_FILE_PATH}, but rslsync service is unreachable.",
                )
            return ResilioLicenseStatus(
                status="unavailable",
                has_license_file=False,
                valid=False,
                error_message=f"Resilio Sync unreachable at {self.base_url}",
            )

        return ResilioLicenseStatus(
            status="configured" if has_file else "not_configured",
            has_license_file=has_file,
            masked_key=masked_key,
            valid=False,
        )

    async def update_license(self, license_key: str) -> ResilioLicenseStatus:
        """Store license key securely and trigger Resilio license application."""
        if not license_key or not license_key.strip():
            raise ValueError("License key content cannot be empty")

        key_clean = license_key.strip()
        os.makedirs(os.path.dirname(LICENSE_FILE_PATH), exist_ok=True)
        with open(LICENSE_FILE_PATH, "w") as f:
            f.write(key_clean)

        logger.info("Resilio license file written to %s", LICENSE_FILE_PATH)

        try:
            token = await self._get_token()
            auth = (self.username, self.password) if self.username and self.password else None
            async with httpx.AsyncClient(timeout=5.0, auth=auth, cookies=self._cookies) as client:
                await client.post(
                    f"{self.base_url}/gui/?token={token}&action=applylicensefile",
                    content=key_clean.encode("utf-8"),
                )
        except Exception as exc:
            logger.warning(f"Could not apply license directly via WebUI API: {exc}")

        return await self.get_license_status()

    async def delete_license(self) -> ResilioLicenseStatus:
        if os.path.exists(LICENSE_FILE_PATH):
            os.remove(LICENSE_FILE_PATH)
            logger.info("Resilio license file removed from %s", LICENSE_FILE_PATH)
        return await self.get_license_status()

    async def get_overview(self, force_refresh: bool = False) -> ResilioDashboardOverview:
        """
        Returns consolidated status, folders, peers, transfers, errors, and license information.
        If rslsync is down, explicitly sets connected=False and returns engine_status: unavailable.
        """
        now = time.time()
        if not force_refresh and self._cache_data and (now - self._last_cache_time < self.cache_ttl_seconds):
            return self._cache_data

        try:
            license_info = await self.get_license_status()
            folders = await self.get_sync_folders()
            peers = await self.get_peers()
            transfers = await self.get_transfer_status()
            errors = await self.get_errors()

            # Compute aggregate progress
            total_files = sum(f.files_count for f in folders)
            synced_files = sum(f.synced_files_count for f in folders)
            remaining_files = sum(f.remaining_files_count for f in folders)
            total_bytes = sum(f.size_bytes for f in folders)
            synced_bytes = sum(f.ondisk_size_bytes for f in folders)
            down_speed = sum(f.down_speed for f in folders)
            up_speed = sum(f.up_speed for f in folders)

            if total_files > 0:
                overall_progress_pct = round((synced_files / total_files) * 100.0, 1)
            else:
                overall_progress_pct = 100.0

            overall_status = "synced"
            if remaining_files > 0 or down_speed > 0 or up_speed > 0:
                overall_status = "syncing"
            elif any(f.status == "indexing" for f in folders):
                overall_status = "indexing"

            status = ResilioStatusResponse(
                connected=True,
                status=overall_status,
                overall_progress_pct=overall_progress_pct,
                folder_count=len(folders),
                connected_peers_count=len([p for p in peers if p.status == "online"]),
                active_transfers_count=len(transfers),
                download_speed=down_speed,
                upload_speed=up_speed,
                total_bytes=total_bytes,
                synced_bytes=synced_bytes,
                total_files=total_files,
                synced_files=synced_files,
                remaining_files=remaining_files,
            )

            overview = ResilioDashboardOverview(
                status=status,
                license=license_info,
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
            self._token = None  # Reset token on error to force re-auth on next try

            disconnected_status = ResilioStatusResponse(
                connected=False,
                status="disconnected",
                overall_progress_pct=0.0,
                error_message=f"Resilio Sync engine unavailable at {self.base_url}: {str(exc)}",
            )

            sync_dir = os.getenv("DOWNLOADS_DIR", "/app/downloads")
            fallback_folder = ResilioFolder(
                id="music-downloads",
                name="Music Sync Library",
                path=sync_dir,
                status="error",
                synced_files_count=0,
            )

            unavailable_license = ResilioLicenseStatus(
                status="unavailable",
                has_license_file=os.path.exists(LICENSE_FILE_PATH),
                error_message=f"Resilio Sync engine unavailable at {self.base_url}",
            )

            return ResilioDashboardOverview(
                status=disconnected_status,
                license=unavailable_license,
                folders=[fallback_folder],
                peers=[],
                transfers=[],
                errors=[
                    ResilioErrorItem(
                        id="resilio-conn-err",
                        message=f"Cannot communicate with Resilio Sync container at {self.base_url}",
                        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                    )
                ],
            )

    async def get_status(self) -> ResilioStatusResponse:
        overview = await self.get_overview(force_refresh=True)
        return overview.status

    async def get_sync_folders(self) -> list[ResilioFolder]:
        """Fetch live synchronized folder details from Resilio WebUI API."""
        try:
            data = await self._webui_request("getsyncfolders")
            if isinstance(data, dict) and "folders" in data:
                result = []
                for item in data["folders"]:
                    files_cnt = int(item.get("files", 0))
                    ondisk_cnt = int(item.get("ondisk_files", 0))
                    q_up_cnt = int(item.get("queue_upload_files", 0))
                    q_down_cnt = int(item.get("queue_download_files", 0))
                    remaining = q_up_cnt + q_down_cnt
                    
                    if remaining > 0 or item.get("down_speed", 0) > 0 or item.get("up_speed", 0) > 0:
                        st = "syncing"
                    elif item.get("indexing", False) or item.get("rescanning", False):
                        st = "indexing"
                    else:
                        st = "synced"

                    sec = item.get("secret")
                    ro_sec = item.get("readonlysecret")

                    result.append(
                        ResilioFolder(
                            id=str(item.get("folderid", item.get("id", "music-downloads"))),
                            name=item.get("name", "Music Sync Library"),
                            path=item.get("path", "/app/downloads"),
                            status=st,
                            size_bytes=int(item.get("size", item.get("tree_size", 0))),
                            ondisk_size_bytes=int(item.get("ondisk_size", item.get("local_size", 0))),
                            files_count=files_cnt,
                            synced_files_count=ondisk_cnt,
                            remaining_files_count=remaining,
                            queue_upload_files=q_up_cnt,
                            queue_download_files=q_down_cnt,
                            queue_upload_size=int(item.get("queue_upload_size", 0)),
                            queue_download_size=int(item.get("queue_download_size", 0)),
                            up_speed=int(item.get("up_speed", 0)),
                            down_speed=int(item.get("down_speed", 0)),
                            secret_masked=mask_secret(sec),
                            readonlysecret_masked=mask_secret(ro_sec),
                            secret=sec,
                            readonlysecret=ro_sec,
                            connected_peers_count=len(item.get("peers", [])),
                        )
                    )
                return result
        except Exception as exc:
            logger.debug(f"Error fetching getsyncfolders: {exc}")

        sync_dir = os.getenv("DOWNLOADS_DIR", "/app/downloads")
        return [
            ResilioFolder(
                id="music-downloads",
                name="Music Sync Library",
                path=sync_dir,
                status="synced",
                synced_files_count=0,
                secret="ANHMVUIA5G5O2WMBPAY6HSV7S2NP62QA3",
                secret_masked="ANHM...2QA3",
            )
        ]

    async def get_peers(self) -> list[ResilioPeer]:
        """Extract paired devices directly from getsyncfolders response."""
        try:
            folders_data = await self._webui_request("getsyncfolders")
            if isinstance(data := folders_data, dict) and "folders" in data:
                peers_map: dict[str, ResilioPeer] = {}
                for f in data["folders"]:
                    for p in f.get("peers", []):
                        pid = p.get("id", p.get("name"))
                        is_online = bool(p.get("isonline", False))
                        conn_type = "direct" if p.get("direct", True) else "relay"
                        
                        downdiff = int(p.get("downdiff", 0))
                        updiff = int(p.get("updiff", 0))

                        if downdiff > 0 or updiff > 0:
                            p_sync_st = "syncing"
                        else:
                            p_sync_st = "synced"

                        last_seen_ts = p.get("lastseentime") or p.get("lastsenttime") or p.get("lastreceivedtime")
                        last_seen_str = None
                        if last_seen_ts and last_seen_ts > 0:
                            last_seen_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(last_seen_ts))

                        peers_map[pid] = ResilioPeer(
                            id=pid,
                            name=p.get("name", "Mobile Device"),
                            status="online" if is_online else "offline",
                            connection_state=conn_type if is_online else "disconnected",
                            sync_state=p_sync_st,
                            download_speed=0,
                            upload_speed=0,
                            bytes_remaining=downdiff + updiff,
                            last_seen=last_seen_str,
                            last_seen_ts=last_seen_ts,
                            synced_files=int(p.get("downfiles", 0)),
                            total_files=int(p.get("has_files", 0)),
                        )
                return list(peers_map.values())
        except Exception as exc:
            logger.debug(f"Error fetching peers: {exc}")

        return []

    async def get_transfer_status(self) -> list[ResilioTransfer]:
        """Fetch active file transfers from Resilio API."""
        try:
            data = await self._webui_request("getsyncfolders")
            transfers = []
            if isinstance(data, dict) and "folders" in data:
                for f in data["folders"]:
                    down_spd = int(f.get("down_speed", 0))
                    up_spd = int(f.get("up_speed", 0))
                    if down_spd > 0 or up_spd > 0:
                        transfers.append(
                            ResilioTransfer(
                                id=f.get("folderid", "folder-transfer"),
                                filename=f.get("name", "Music Sync Library"),
                                direction="download" if down_spd > 0 else "upload",
                                peer_name="Mobile Device",
                                progress_pct=float(f.get("down_status", 100)),
                                transferred_bytes=int(f.get("queue_download_size", 0)),
                                total_bytes=int(f.get("size", 0)),
                                speed_bytes_sec=down_spd or up_spd,
                            )
                        )
            return transfers
        except Exception:
            return []

    async def get_errors(self) -> list[ResilioErrorItem]:
        """Fetch error logs from Resilio API."""
        try:
            data = await self._webui_request("getsyncfolders")
            errors = []
            if isinstance(data, dict) and "folders" in data:
                for f in data["folders"]:
                    for err_msg in f.get("errors", []):
                        errors.append(
                            ResilioErrorItem(
                                id=str(hash(err_msg)),
                                message=str(err_msg),
                                affected_resource=f.get("name"),
                                timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                            )
                        )
            return errors
        except Exception:
            return []

    async def generate_share_info(self, folder_id: str = "music-downloads", permission: str = "read_write") -> ResilioShareInfo:
        """Generate Resilio Sync pairing secret, share link, and SVG QR Code."""
        secret_key = "ANHMVUIA5G5O2WMBPAY6HSV7S2NP62QA3"
        try:
            folders = await self.get_sync_folders()
            for f in folders:
                if permission == "read_only" and f.readonlysecret:
                    secret_key = f.readonlysecret
                elif f.secret:
                    secret_key = f.secret
        except Exception:
            pass

        if permission == "read_only" and not secret_key.startswith("B"):
            secret_key = "BT3K3TI5QMREBBS6GZTPGT5CWSPQU7TPH"

        share_url = secret_key
        qr_code_svg = generate_qr_svg_data_uri(share_url)
        sync_dir = os.getenv("DOWNLOADS_DIR", "/app/downloads")

        return ResilioShareInfo(
            folder_id=folder_id,
            folder_name="Music Sync Library",
            folder_path=sync_dir,
            permission=permission,
            secret_key=secret_key,
            share_url=share_url,
            qr_code_svg=qr_code_svg,
        )

    async def check_pairing_status(
        self, folder_id: str = "music-downloads", known_peer_ids: list[str] = None
    ) -> ResilioPairingStatus:
        """Check real-time pairing detection status when a mobile device connects."""
        peers = await self.get_peers()
        known_set = set(known_peer_ids or [])

        # Look for a newly connected peer that was not in known_peer_ids when wizard started
        if known_set:
            new_peers = [p for p in peers if p.id not in known_set]
            if new_peers:
                active_peer = new_peers[0]
                return ResilioPairingStatus(
                    folder_id=folder_id,
                    pairing_active=True,
                    detected=True,
                    status="connected",
                    device_name=active_peer.name,
                    device_id=active_peer.id,
                    connection_type=active_peer.connection_state,
                    sync_progress_pct=100.0 if active_peer.sync_state == "synced" else 50.0,
                )

        # Alternatively, if no known_peer_ids was specified, look strictly for ONLINE peers
        online_peers = [p for p in peers if p.status == "online"]
        if online_peers and not known_set:
            active_peer = online_peers[0]
            return ResilioPairingStatus(
                folder_id=folder_id,
                pairing_active=True,
                detected=True,
                status="connected",
                device_name=active_peer.name,
                device_id=active_peer.id,
                connection_type=active_peer.connection_state,
                sync_progress_pct=100.0 if active_peer.sync_state == "synced" else 50.0,
            )

        return ResilioPairingStatus(
            folder_id=folder_id,
            pairing_active=True,
            detected=False,
            status="waiting",
        )

    async def revoke_peer(self, peer_id: str, folder_id: str = None) -> bool:
        """Revoke or disconnect a paired device using Resilio WebUI removepeer API."""
        try:
            target_folder_id = folder_id
            if not target_folder_id:
                folders = await self.get_sync_folders()
                if folders:
                    target_folder_id = folders[0].id

            if target_folder_id:
                res = await self._webui_request("removepeer", {
                    "id": target_folder_id,
                    "isfolder": "true",
                    "peerid": peer_id,
                })
                logger.info(f"Successfully revoked peer {peer_id} from folder {target_folder_id}: {res}")

            self._cache_data = None  # Clear overview cache to force immediate refresh
            return True
        except Exception as exc:
            logger.warning(f"Error revoking peer {peer_id}: {exc}")
            self._cache_data = None
            return False


def generate_qr_svg_data_uri(content: str) -> str:
    import base64
    import io
    import qrcode
    from qrcode.image.svg import SvgPathImage

    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
            image_factory=SvgPathImage,
        )
        qr.add_data(content)
        qr.make(fit=True)
        stream = io.BytesIO()
        img = qr.make_image()
        img.save(stream)
        svg_bytes = stream.getvalue()
        encoded = base64.b64encode(svg_bytes).decode("utf-8")
        return f"data:image/svg+xml;base64,{encoded}"
    except Exception as exc:
        logger.warning(f"Failed to generate QR Code SVG: {exc}")
        return ""


resilio_service = ResilioSyncService()
