from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.traffic_service import traffic_service
from ..schemas.traffic import (
    TrafficOverviewResponse,
    TrafficArrivalsResponse,
    TrafficDeparturesResponse,
    TrafficQueueResponse,
    TrafficConflictsResponse,
    TrafficSyncResponse,
)

router = APIRouter(prefix="/traffic", tags=["Railway Traffic Management"])

@router.get("/overview", response_model=TrafficOverviewResponse)
def get_traffic_overview(db: Session = Depends(get_db)):
    """Retrieves real-time station traffic summary, platform occupancy, and hourly density."""
    return traffic_service.get_overview(db)

@router.get("/arrivals", response_model=TrafficArrivalsResponse)
def get_traffic_arrivals(db: Session = Depends(get_db)):
    """Retrieves incoming trains approaching or scheduled for Itarsi Junction."""
    return traffic_service.get_arrivals(db)

@router.get("/departures", response_model=TrafficDeparturesResponse)
def get_traffic_departures(db: Session = Depends(get_db)):
    """Retrieves departing trains scheduled or berthed at Itarsi Junction."""
    return traffic_service.get_departures(db)

@router.get("/queue", response_model=TrafficQueueResponse)
def get_traffic_queue(db: Session = Depends(get_db)):
    """Retrieves priority-ranked queue of trains waiting for platform allocation."""
    return traffic_service.get_queue(db)

@router.get("/conflicts", response_model=TrafficConflictsResponse)
def get_traffic_conflicts(db: Session = Depends(get_db)):
    """Detects active platform occupancy overlaps and headway buffer encroachments."""
    return traffic_service.get_conflicts(db)

@router.post("/sync", response_model=TrafficSyncResponse)
def sync_traffic_telemetry(db: Session = Depends(get_db)):
    """Synchronizes live traffic delays and running status with external railway provider."""
    return traffic_service.sync_traffic_data(db)
