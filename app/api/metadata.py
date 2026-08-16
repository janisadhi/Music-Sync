import os
import logging
from typing import Any
from fastapi import APIRouter, HTTPException, Query, status
import httpx

logger = logging.getLogger("app.api.metadata")

router = APIRouter(
    prefix="/api/metadata",
    tags=["Metadata"],
)

METADATA_SERVICE_URL = os.getenv("METADATA_SERVICE_URL", "http://localhost:8001")


async def _forward_request(
    method: str,
    path: str,
    json: dict | None = None,
    params: dict | None = None,
) -> Any:
    url = f"{METADATA_SERVICE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method=method, url=url, json=json, params=params)
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=resp.json().get("detail", f"Metadata service error ({resp.status_code})"),
                )
            return resp.json()
    except httpx.RequestError as exc:
        logger.error(f"Error connecting to Metadata Service at {url}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Metadata service unavailable: {exc}",
        )


@router.post("/scan", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scan(force_reprocess: bool = False):
    """Triggers library metadata scan & enrichment job."""
    return await _forward_request("POST", "/scan", json={"force_reprocess": force_reprocess})


@router.get("/status")
async def get_metadata_status():
    """Returns library metadata status and metrics."""
    return await _forward_request("GET", "/status")


@router.get("/results")
async def get_metadata_results(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    state: str | None = Query(None),
    beets_edited: bool | None = Query(None),
):
    """Returns paginated track metadata results."""
    params: dict[str, Any] = {"page": page, "limit": limit}
    if state is not None:
        params["state"] = state
    if beets_edited is not None:
        params["beets_edited"] = str(beets_edited).lower()
    return await _forward_request("GET", "/results", params=params)


@router.post("/enrich/{track_id}")
async def enrich_track(track_id: int):
    """Triggers immediate Beets autotag enrichment for a single track."""
    return await _forward_request("POST", f"/enrich/{track_id}")


@router.get("/tracks/{track_id}")
async def get_track_detail(track_id: int):
    """Returns detailed metadata, lyrics path, and change history for a single track."""
    return await _forward_request("GET", f"/tracks/{track_id}")
