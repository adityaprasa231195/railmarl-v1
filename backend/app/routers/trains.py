from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..models.train import Train
from ..models.platform import Platform
from ..models.allocation import Allocation
from ..schemas.train import TrainOut, TrainCreate, TrainUpdate

router = APIRouter(prefix="/trains", tags=["Trains"])

@router.get("", response_model=List[TrainOut])
def list_trains(
    category: Optional[str] = Query(None, description="Filter by train category (EXPRESS, SUPERFAST, PASSENGER, FREIGHT, OTHER)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by train status"),
    search: Optional[str] = Query(None, description="Search train name, number, origin, or destination"),
    db: Session = Depends(get_db),
):
    """Retrieves all train records with optional category, status, and search filters."""
    query = db.query(Train)

    if category and category.lower() != "all":
        clean_cat = category.strip().upper()
        query = query.filter(func.upper(Train.category) == clean_cat)

    if status_filter and status_filter.lower() != "all":
        clean_status = status_filter.strip().upper().replace("-", "_")
        query = query.filter(func.upper(Train.status) == clean_status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Train.name.ilike(term),
                Train.number.ilike(term),
                Train.origin.ilike(term),
                Train.destination.ilike(term),
            )
        )

    trains = query.order_by(Train.arrival_time.asc()).all()
    return [TrainOut.from_orm_model(t) for t in trains]

@router.get("/{train_id}", response_model=TrainOut)
def get_train(train_id: str, db: Session = Depends(get_db)):
    """Retrieves single train record by ID or train number."""
    train = (
        db.query(Train)
        .filter((Train.id == train_id) | (Train.number == train_id))
        .first()
    )
    if not train:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train with ID or number '{train_id}' not found"
        )
    return TrainOut.from_orm_model(train)

@router.post("", response_model=TrainOut, status_code=status.HTTP_201_CREATED)
def create_train(payload: TrainCreate, db: Session = Depends(get_db)):
    """Creates a new train record. Enforces unique number/ID, schedule validation, and platform availability."""
    train_id = payload.id.strip() if payload.id and payload.id.strip() else f"tr-{payload.number.strip()}"

    # 1. Duplicate check
    existing = db.query(Train).filter(
        or_(Train.id == train_id, Train.number == payload.number.strip())
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Train with ID '{train_id}' or number '{payload.number.strip()}' already exists."
        )

    # 2. Platform reference validation
    if payload.platform is not None:
        platform = db.query(Platform).filter(Platform.id == payload.platform).first()
        if not platform:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Platform ID {payload.platform} does not exist."
            )
        if platform.status.upper() == "OUT_OF_SERVICE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot assign train to Platform {payload.platform}: Platform is currently OUT_OF_SERVICE."
            )

    new_train = Train(
        id=train_id,
        number=payload.number.strip(),
        name=payload.name.strip(),
        category=payload.category,
        origin=payload.origin.strip(),
        destination=payload.destination.strip(),
        arrival_time=payload.arrivalTime,
        departure_time=payload.departureTime,
        is_overnight=payload.isOvernight,
        platform_id=payload.platform,
        status=payload.status,
        delay=payload.delay or 0,
        coaches=payload.coaches,
        priority=payload.priority,
        description=payload.description.strip() if payload.description else None,
        data_source=payload.dataSource or "MANUAL_ENTRY",
        last_synced_at=None,
        external_reference=payload.externalReference,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    db.add(new_train)
    db.commit()
    db.refresh(new_train)
    return TrainOut.from_orm_model(new_train)

@router.put("/{train_id}", response_model=TrainOut)
def update_train(train_id: str, payload: TrainUpdate, db: Session = Depends(get_db)):
    """Updates an existing train's schedule, assigned platform, or operational metadata."""
    train = (
        db.query(Train)
        .filter((Train.id == train_id) | (Train.number == train_id))
        .first()
    )
    if not train:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train with ID or number '{train_id}' not found"
        )

    # 1. Number uniqueness check
    if payload.number is not None and payload.number.strip() != train.number:
        duplicate = db.query(Train).filter(
            Train.number == payload.number.strip(),
            Train.id != train.id
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Train number '{payload.number.strip()}' is already used by another service ({duplicate.name})."
            )
        train.number = payload.number.strip()

    # 2. Schedule integrity validation
    new_arr = payload.arrivalTime if payload.arrivalTime is not None else train.arrival_time
    new_dep = payload.departureTime if payload.departureTime is not None else train.departure_time
    new_overnight = payload.isOvernight if payload.isOvernight is not None else getattr(train, "is_overnight", False)

    if not new_overnight and new_dep < new_arr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scheduled departure ({new_dep}) cannot be earlier than arrival ({new_arr}) on the same calendar day. Enable 'isOvernight' for overnight dwells."
        )

    train.arrival_time = new_arr
    train.departure_time = new_dep
    train.is_overnight = new_overnight

    # 3. Platform reference validation
    if payload.platform is not None:
        if payload.platform == 0:  # 0 or None indicates unassigned
            train.platform_id = None
        else:
            platform = db.query(Platform).filter(Platform.id == payload.platform).first()
            if not platform:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Platform ID {payload.platform} does not exist."
                )
            if platform.status.upper() == "OUT_OF_SERVICE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign train to Platform {payload.platform}: Platform is currently OUT_OF_SERVICE."
                )
            train.platform_id = payload.platform

    if payload.name is not None:
        train.name = payload.name.strip()
    if payload.category is not None:
        train.category = payload.category
    if payload.origin is not None:
        train.origin = payload.origin.strip()
    if payload.destination is not None:
        train.destination = payload.destination.strip()
    if payload.status is not None:
        train.status = payload.status
    if payload.delay is not None:
        train.delay = payload.delay
    if payload.coaches is not None:
        train.coaches = payload.coaches
    if payload.priority is not None:
        train.priority = payload.priority
    if payload.description is not None:
        train.description = payload.description.strip() if payload.description else None
    if payload.dataSource is not None:
        train.data_source = payload.dataSource
    if payload.externalReference is not None:
        train.external_reference = payload.externalReference

    train.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(train)
    return TrainOut.from_orm_model(train)

@router.delete("/{train_id}", status_code=status.HTTP_200_OK)
def delete_train(train_id: str, db: Session = Depends(get_db)):
    """Deletes a train only when safe (no active dependent allocation records exist)."""
    train = (
        db.query(Train)
        .filter((Train.id == train_id) | (Train.number == train_id))
        .first()
    )
    if not train:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train with ID or number '{train_id}' not found"
        )

    # Prevent deletion when dependent allocation records exist
    allocation_count = db.query(Allocation).filter(Allocation.train_id == train.id).count()
    if allocation_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Train {train.number} ({train.name}): It has {allocation_count} dependent allocation record(s). Clear dependent allocations first."
        )

    db.delete(train)
    db.commit()
    return {
        "success": True,
        "message": f"Train {train.number} ({train.name}) was deleted successfully.",
        "id": train.id
    }
