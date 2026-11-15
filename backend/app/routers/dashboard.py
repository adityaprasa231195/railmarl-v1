from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from ..database import get_db
from ..models.platform import Platform
from ..models.train import Train
from ..schemas.dashboard import DashboardSummary
from ..config import settings

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Computes live aggregated platform and train metrics from the SQLite database."""
    total_platforms = db.query(Platform).count()
    available_platforms = db.query(Platform).filter(func.upper(Platform.status) == "AVAILABLE").count()
    occupied_platforms = db.query(Platform).filter(func.upper(Platform.status) == "OCCUPIED").count()
    reserved_platforms = db.query(Platform).filter(func.upper(Platform.status) == "RESERVED").count()

    incoming_trains = (
        db.query(Train)
        .filter(func.upper(Train.status).in_(["APPROACHING", "ON_TIME", "SCHEDULED"]))
        .count()
    )
    departing_trains = (
        db.query(Train)
        .filter(func.upper(Train.status) == "ARRIVED")
        .count()
    )
    delayed_trains = (
        db.query(Train)
        .filter(or_(func.upper(Train.status) == "DELAYED", Train.delay > 0))
        .count()
    )

    return DashboardSummary(
        totalPlatforms=total_platforms,
        availablePlatforms=available_platforms,
        occupiedPlatforms=occupied_platforms,
        reservedPlatforms=reserved_platforms,
        incomingTrains=incoming_trains,
        departingTrains=departing_trains,
        delayedTrains=delayed_trains,
        stationName=settings.STATION_NAME,
        timestamp=datetime.utcnow().isoformat(),
    )
