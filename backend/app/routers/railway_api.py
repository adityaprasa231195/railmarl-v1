"""
RAILMARL — External Railway API Router.
Stage 7: Live & Scheduled Railway API Endpoints for Itarsi Junction (ET).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.railway_api import railway_api_service, cache
from ..schemas.railway_api import (
    RailwayAPIStatusResponse,
    TrainSearchResponse,
    TrainImportRequest,
    TrainImportResponse,
    LiveRunningStatusResponse,
)

router = APIRouter(prefix="/railway-api", tags=["External Railway API"])

@router.get("/status", response_model=RailwayAPIStatusResponse)
def get_api_status():
    """Retrieves current external Railway API provider configuration, status, and cache info."""
    return railway_api_service.get_status()

@router.post("/test-connection")
async def test_api_connection():
    """Tests connectivity to the active railway API provider or offline adapter."""
    return await railway_api_service.test_connection()

@router.get("/search", response_model=TrainSearchResponse)
async def search_trains(
    query: str = Query("ALL", alias="query", description="Train number or name substring to search"),
    station_code: str = Query("ET", alias="station_code", description="Station code (default ET for Itarsi Jn)"),
    db: Session = Depends(get_db),
):
    """
    Searches trains associated with Itarsi Junction (ET) from the external railway API or cache.
    Cross-references each result with the local database to indicate whether it is already imported.
    """
    if not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty. Enter a train number (e.g. '12627') or train name.",
        )
    return await railway_api_service.search_trains(query=query.strip(), db=db, station_code=station_code.strip().upper())

@router.get("/live-status", response_model=LiveRunningStatusResponse)
def get_live_train_status(
    train_number: str = Query(..., alias="train_number", description="5-digit train number"),
    station_code: str = Query("ET", alias="station_code", description="Station code"),
):
    """Retrieves live running status and delay estimate for a given train."""
    if not train_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Train number is required for live status lookup.",
        )
    return railway_api_service.get_live_status(train_number.strip(), station_code.strip().upper())

@router.post("/import", response_model=TrainImportResponse)
def import_trains(
    payload: TrainImportRequest,
    db: Session = Depends(get_db),
):
    """
    Imports selected external train schedules into the local SQLite database.
    Prevents duplicate imports and preserves existing manual entries unless overwriteExisting=True.
    """
    if not payload.trains:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No trains provided for import.",
        )
    return railway_api_service.import_trains(
        trains=payload.trains,
        overwrite_existing=payload.overwriteExisting,
        db=db,
    )

@router.delete("/cache")
def clear_api_cache():
    """Clears the in-memory external API response cache."""
    cleared = cache.clear()
    return {
        "success": True,
        "clearedEntries": cleared,
        "message": f"Cleared {cleared} entries from the railway API cache.",
    }
