"""
Event Triggers and Asynchronous Task Dispatcher.

Responsibility: Provide non-blocking event dispatching between pipeline stages
(Sync -> Downloader -> Metadata / Lyrics).
"""

import logging
import os
from threading import Thread
import httpx

logger = logging.getLogger("app.core.events")

METADATA_SERVICE_URL = os.getenv("METADATA_SERVICE_URL", "http://metadata:8001")


def trigger_metadata_scan_async(force_reprocess: bool = False) -> None:
    """
    Triggers library metadata scan on the Metadata service asynchronously in a daemon thread.
    Returns immediately without blocking the caller.
    """
    def _call():
        try:
            url = f"{METADATA_SERVICE_URL}/scan"
            with httpx.Client(timeout=5.0) as client:
                client.post(url, json={"force_reprocess": force_reprocess})
        except Exception as exc:
            # Metadata service might be starting or temporarily unreachable.
            # Do not crash the caller; log warning.
            logger.warning(f"Non-blocking metadata scan trigger attempt: {exc}")

    Thread(target=_call, daemon=True, name="metadata-trigger").start()
